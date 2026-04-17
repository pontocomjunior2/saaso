---
phase: 04-form-editor-embed
reviewed: 2026-04-17T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - apps/web/src/app/f/[tenantSlug]/[slug]/page.tsx
  - apps/web/src/app/formularios/page.tsx
  - apps/api/prisma/schema.prisma
  - apps/api/src/meta-webhook/dto/meta-lead-payload.dto.ts
  - apps/api/src/meta-webhook/dto/create-meta-mapping.dto.ts
  - apps/api/src/meta-webhook/dto/create-page-mapping.dto.ts
  - apps/api/src/meta-webhook/meta-webhook.service.ts
  - apps/api/src/meta-webhook/meta-webhook.controller.ts
  - apps/api/src/meta-webhook/meta-webhook.service.spec.ts
  - apps/web/src/stores/useWhatsAppAccountStore.ts
  - apps/web/src/components/configuracoes/WhatsAppSettingsSection.tsx
  - apps/web/src/app/configuracoes/page.tsx
  - apps/web/src/components/board/AgentStatusBadge.tsx
  - apps/web/src/components/board/KanbanBoard.tsx
  - apps/web/src/components/board/CardDetailSheet.tsx
  - apps/web/src/stores/useLeadFormStore.ts
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-04-17
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

This phase delivers the public lead-form embed system, form builder UI, Meta webhook organic-lead ingestion, and supporting settings/board components. The overall architecture is sound. Two critical issues were found: an open `postMessage` target origin that exposes submission events to any embedding page, and a missing `@IsNotEmpty()` guard on `pageAccessToken` that allows an empty string to bypass length validation. Four warnings cover a race-condition / stale-closure risk in the resize effect, a missing `await` on an async clipboard call that silently swallows errors, use of `as any` in production service code, and a unique-constraint schema gap. Three info items cover dead helper code, a `<meta>` CSP tag placed inside `<body>`, and a polling interval that is never bounded by an upper retry limit.

---

## Critical Issues

### CR-01: Unrestricted `postMessage` target origin leaks submission events to any page

**File:** `apps/web/src/app/f/[tenantSlug]/[slug]/page.tsx:163-170, 252-259`

**Issue:** Both `postMessage` call-sites pass `'*'` as the `targetOrigin`. This means any page that embeds the form in an `<iframe>` — including a malicious third-party page — receives the `saaso:form-submitted` message that includes `cardId`. An attacker who embeds the form in their own page gains real-time notification of every successful submission and the resulting CRM card ID.

`targetOrigin: '*'` is explicitly [flagged as a security risk in the MDN postMessage documentation](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage#security_concerns) when the message contains sensitive data.

**Fix:** Pass the parent-page origin instead of `'*'`. The origin can be collected from the `?embed=1` referrer or from a whitelisted `?parentOrigin=` query parameter:

```tsx
// Collect allowed parent origin from URL params (validated server-side on form load)
const allowedOrigin = searchParams.get('parentOrigin') ?? '*';

window.parent.postMessage({ type: 'saaso:form-resize', ... }, allowedOrigin);
```

If a configurable origin is not feasible in the short term, at minimum restrict the `saaso:form-submitted` and `saaso:form-submitting` messages (which carry `cardId`) to `allowedOrigin`, and keep only the benign `saaso:form-resize` event on `'*'`.

---

### CR-02: `pageAccessToken` empty-string bypass in `CreatePageMappingDto`

**File:** `apps/api/src/meta-webhook/dto/create-page-mapping.dto.ts:20-22`

**Issue:** `pageAccessToken` is decorated `@IsOptional() @IsString()`. When a caller submits `pageAccessToken: ""` (empty string), `@IsOptional()` treats it as "provided" and `@IsString()` passes because `""` is a valid string. The empty token is then stored in the database. When `processOrganicLead` checks `if (mapping.pageAccessToken)`, an empty string is falsy and the fallback `name = 'Lead (Form)'` path is taken — but the token was stored as `""` rather than `null`, which is semantically incorrect and bypasses any future `?? null` guards.

Compare with `CreateMetaMappingDto` (line 21-23) which correctly adds `@Length(8, 128)` to `verifyToken`.

**Fix:**
```typescript
@IsOptional()
@IsString()
@MinLength(1)          // reject empty string
pageAccessToken?: string;
```

Or use a transform to coerce `""` to `undefined` before persistence.

---

## Warnings

### WR-01: Stale closure / over-broad dependency array in the embed resize effect

**File:** `apps/web/src/app/f/[tenantSlug]/[slug]/page.tsx:153-192`

**Issue:** The `useEffect` that sets up the `ResizeObserver` lists `[form, isEmbedMode, isLoading, slug, submissionState, success, tenantSlug, values, fieldErrors, submitError]` as dependencies (line 192). Every time any of those values changes, the effect tears down and re-creates the observer. This is semantically wrong: the observer must persist between state changes, not be recreated on every render. In practice, typing in a field (`values` changes on each keystroke) tears down and re-creates the observer on every character, creating unnecessary garbage-collection pressure and a brief window where height changes are unobserved.

Additionally, `schedulePost` captures `rootRef` and `tenantSlug`/`slug` via closure, but those never change after mount, so the dependencies should be stable refs.

**Fix:** Separate the observer setup (which should run once on mount) from the height-post trigger (which should run on content changes):

```tsx
// Effect 1: set up observer once
useEffect(() => {
  if (!isEmbedMode || !rootRef.current) return;
  const ro = new ResizeObserver(() => {
    window.requestAnimationFrame(() => {
      if (rootRef.current) {
        window.parent.postMessage({ type: 'saaso:form-resize', ... }, allowedOrigin);
      }
    });
  });
  ro.observe(rootRef.current);
  window.addEventListener('resize', ...);
  return () => { ro.disconnect(); window.removeEventListener('resize', ...); };
}, [isEmbedMode]); // stable deps only
```

---

### WR-02: `copyText` is `async` but the call-sites discard the returned Promise without `void`-marking or error handling

**File:** `apps/web/src/app/formularios/page.tsx:797-803, 953, 955, 1599, 1615, 1632`

**Issue:** `copyText` is declared `async` and calls `window.navigator.clipboard.writeText(value)`. The clipboard API throws when the page does not have focus or permission (e.g. browser background tab). All call-sites use `() => void copyText(...)` pattern, which explicitly discards the promise — but this means clipboard errors are silently swallowed with no user feedback. If clipboard access is denied the user gets no indication that the copy failed.

**Fix:** Catch the error and show a transient UI message:

```tsx
const copyText = async (value: string) => {
  if (!value || typeof window === 'undefined' || !window.navigator.clipboard) return;
  try {
    await window.navigator.clipboard.writeText(value);
    // optionally: set a brief "Copiado!" state
  } catch {
    // show user-visible feedback, e.g. setCopyError('Nao foi possivel copiar')
  }
};
```

---

### WR-03: `as any` cast in production service code bypasses Prisma error type safety

**File:** `apps/api/src/meta-webhook/meta-webhook.service.ts:19`

**Issue:**
```typescript
(e as any).code === 'P2002'
```
The `isPrismaUniqueViolation` helper casts the caught error to `any` to read `.code`. This bypasses TypeScript's type system. If Prisma's error type changes, or if `e` is something else entirely (e.g. a network error with a `.code` property that happens to equal `'P2002'`), the idempotency gate silently skips leads. False positives here mean leads are permanently dropped.

**Fix:** Use a typed Prisma error check:

```typescript
import { Prisma } from '@prisma/client';

function isPrismaUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}
```

---

### WR-04: `MetaWebhookMapping` unique constraint does not cover the `(pageId, null)` catch-all case unambiguously

**File:** `apps/api/prisma/schema.prisma:735`

**Issue:** The schema declares:
```prisma
@@unique([pageId, metaFormId])
```
In PostgreSQL, `NULL != NULL` for unique constraint purposes, so `(pageId='page-1', metaFormId=NULL)` and another `(pageId='page-1', metaFormId=NULL)` are treated as two distinct rows — the unique constraint does not fire. This means multiple catch-all page mappings for the same `pageId` can be created, and `processOrganicLead` (which calls `findFirst` on `{ pageId, metaFormId: null }`) will silently use whichever row Prisma returns first, creating non-deterministic routing.

**Fix:** Add a partial unique index via a raw migration for the catch-all case:
```sql
CREATE UNIQUE INDEX unique_page_catchall
  ON "MetaWebhookMapping" ("pageId")
  WHERE "metaFormId" IS NULL;
```
Or enforce the constraint in `createMapping` by checking for existing catch-all rows before insert:
```typescript
const existing = await this.prisma.metaWebhookMapping.findFirst({
  where: { pageId: dto.pageId, metaFormId: null, tenantId },
});
if (existing) throw new BadRequestException('Ja existe um mapeamento catch-all para esta page.');
```

---

## Info

### IN-01: `getFieldInitialValue` helper is dead code

**File:** `apps/web/src/app/f/[tenantSlug]/[slug]/page.tsx:79-85`

**Issue:** `getFieldInitialValue` always returns `''` regardless of field type:
```tsx
function getFieldInitialValue(field: LeadFormField): string {
  if (field.type === 'select') {
    return '';
  }
  return '';
}
```
Both branches return the same value. The function is called during form initialization but its only consumer is `Object.fromEntries(data.fields.map(...))` (line 131). This is dead code that adds maintenance confusion.

**Fix:** Remove the function and inline the empty string, or implement meaningful default handling (e.g. returning the first option value for `select` fields to pre-populate the control):
```tsx
setValues(Object.fromEntries(data.fields.map((field) => [field.key, ''])));
```

---

### IN-02: `<meta httpEquiv="Content-Security-Policy">` rendered inside `<body>` has no effect

**File:** `apps/web/src/app/f/[tenantSlug]/[slug]/page.tsx:334-338`

**Issue:**
```tsx
{isEmbedMode ? (
  <meta
    httpEquiv="Content-Security-Policy"
    content="default-src 'self'; ... frame-ancestors *;"
  />
) : null}
```
A `<meta http-equiv="Content-Security-Policy">` tag placed inside `<body>` (inside the form JSX) is ignored by all modern browsers — CSP meta tags must be in `<head>`, and even then, `frame-ancestors` is not honoured via `<meta>` at all (it requires an HTTP response header). This gives a false sense of security: the `frame-ancestors *` directive is not applied.

**Fix:** Remove the `<meta>` tag from the component body. Set the `Content-Security-Policy` (or the simpler `X-Frame-Options`) header in the Next.js `next.config.js` `headers()` function for the `/f/` route pattern, or in the server middleware.

---

### IN-03: Evolution QR-code polling interval has no timeout ceiling

**File:** `apps/web/src/components/configuracoes/WhatsAppSettingsSection.tsx:109-128`

**Issue:** `startPolling` creates an interval that runs every 3 000 ms indefinitely until `stopPolling` is called. If the user navigates away and the unmount cleanup runs (`stopPolling`) the interval is cleared. However, if `stopPolling` is never called (e.g. a logic path that misses calling it), or if the user leaves the tab open for an extended period while the QR scan window has already expired, the interval continues polling the Evolution API indefinitely. There is no maximum polling duration.

**Fix:** Add a ceiling via `setTimeout`:
```tsx
const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

const startPolling = useCallback((name: string) => {
  setIsPolling(true);
  setActiveInstanceName(name);
  pollRef.current = setInterval(async () => { /* ... */ }, 3000);
  // Stop polling after 3 minutes if QR scan never completes
  pollTimeoutRef.current = setTimeout(() => stopPolling(), 3 * 60 * 1000);
}, [...]);

const stopPolling = useCallback(() => {
  if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  if (pollTimeoutRef.current) { clearTimeout(pollTimeoutRef.current); pollTimeoutRef.current = null; }
  setIsPolling(false);
}, []);
```

---

_Reviewed: 2026-04-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---

---

# Addendum: Plan 04-04 Gap-Closure Review

**Addendum Reviewed:** 2026-04-17
**Depth:** standard
**Files Re-Reviewed (gap-closure changes only):**
- `apps/api/prisma/schema.prisma`
- `apps/api/src/meta-webhook/meta-webhook.service.ts`
- `apps/api/src/meta-webhook/meta-webhook.service.spec.ts`
- `apps/api/src/lead-form/lead-form.service.ts`
- `apps/api/src/lead-form/lead-form.service.spec.ts`

## Addendum Summary

The plan 04-04 gap-closure introduces four substantive changes: `LeadFormSubmission.formId` made nullable in the schema, `processOrganicLead` refactored to unconditionally create `LeadFormSubmission` with best-effort internal form lookup, `leadFormInclude` extended with `_count.submissions` and a latest-submission subquery, and `LeadFormResponse` enriched with `submissionCount`/`lastSubmissionAt`. The schema and `lead-form.service.ts` changes are correct. One critical logic bug was found in the internal-form lookup inside `processOrganicLead`: the service queries `LeadForm` by `id = mapping.metaFormId`, but `mapping.metaFormId` is Meta's external numeric form ID, not an internal UUID — the lookup will always return `null` in production. One additional warning was found in the test spec: `LeadFormService` is instantiated with only two constructor arguments, omitting `RateLimitService`, which causes a silent crash if `submitPublicForm` is ever called with an IP address in tests.

---

## Critical Issues (Addendum)

### CR-A01: Internal `LeadForm` lookup always misses — `mapping.metaFormId` is a Meta external ID, not a Prisma UUID

**File:** `apps/api/src/meta-webhook/meta-webhook.service.ts:355-369`

**Issue:** The gap-closure intent is: when a mapping has a `metaFormId`, try to find a matching internal `LeadForm` record and link the submission via `formId`. The lookup is:

```typescript
const internalForm = await this.prisma.leadForm.findFirst({
  where: { id: mapping.metaFormId, tenantId: mapping.tenantId },
});
```

`mapping.metaFormId` is the Meta platform's external form ID (a numeric string such as `"1234567890123456"`). `LeadForm.id` is a `uuid()` primary key. These two namespaces never overlap. The query will always return `null`, `internalFormId` will always be `null`, and every `LeadFormSubmission` created by `processOrganicLead` will have `formId = null`. As a result:

1. `LeadForm.submissionCount` will never reflect organic Meta leads — the metric is broken.
2. `LeadForm.lastSubmissionAt` will never be populated from organic Meta leads.
3. The entire gap-closure purpose (linking Meta organic leads to internal forms) is silently defeated.

The test at line 391 of `meta-webhook.service.spec.ts` does not catch this because `baseMapping.metaFormId = 'form-1'` and the mocked `internalForm.id = 'form-1'` coincide — the test fabricates a scenario that cannot occur in production where `metaFormId` is an external numeric string.

The correct linking strategy requires a separate field or a lookup table that maps Meta's external `form_id` to the internal `LeadForm.id`. One approach: add an `externalFormId` field to `LeadForm` (or store the Meta form ID in `MetaWebhookMapping.metaFormId` separately from the internal link), then query:

```typescript
const internalForm = await this.prisma.leadForm.findFirst({
  where: { externalFormId: mapping.metaFormId, tenantId: mapping.tenantId },
});
```

Alternatively, if `MetaWebhookMapping` is always created by the user who selects a specific internal `LeadForm`, store the internal `LeadForm.id` in a dedicated column (e.g. `MetaWebhookMapping.leadFormId`) and use that for the lookup:

```typescript
// In schema: MetaWebhookMapping gains an optional leadFormId FK
let internalFormId: string | null = mapping.leadFormId ?? null;
```

**Fix (schema approach):**
```prisma
model MetaWebhookMapping {
  // ... existing fields ...
  leadFormId  String?   // internal LeadForm FK, separate from Meta's metaFormId
  leadForm    LeadForm? @relation(fields: [leadFormId], references: [id], onDelete: SetNull)
}
```

Then in `processOrganicLead`:
```typescript
const internalFormId = mapping.leadFormId ?? null;
// No DB lookup needed — the relation is pre-resolved at mapping creation time
```

---

## Warnings (Addendum)

### WR-A01: `LeadFormService` test instantiation omits `RateLimitService` — silent crash path if IP rate-limiting is exercised in tests

**File:** `apps/api/src/lead-form/lead-form.service.spec.ts:31`

**Issue:**
```typescript
service = new LeadFormService(prismaService as PrismaService, journeyService);
```

`LeadFormService`'s constructor signature (line 130-135 of `lead-form.service.ts`) requires three dependencies: `PrismaService`, `JourneyService`, and `RateLimitService`. The test omits `RateLimitService`, so `this.rateLimitService` is `undefined`. Any test that calls `submitPublicForm` with a non-null `ip` will throw `TypeError: Cannot read properties of undefined (reading 'check')` at line 421. The existing tests happen to call `submitPublicForm` without `ip`, which avoids the crash — but the omission leaves a coverage gap and will break any future test that passes an IP.

**Fix:**
```typescript
const rateLimitService = {
  check: jest.fn(), // no-op for tests
} as any;

service = new LeadFormService(
  prismaService as PrismaService,
  journeyService,
  rateLimitService,
);
```

---

## Info (Addendum)

### IN-A01: `remove()` manually deletes `LeadFormSubmission` rows that would now cascade-delete automatically

**File:** `apps/api/src/lead-form/lead-form.service.ts:332-344`

**Issue:** `remove()` runs a transaction that explicitly calls `tx.leadFormSubmission.deleteMany({ where: { formId: id, tenantId } })` before deleting the `LeadForm`. With the 04-04 schema change, `LeadFormSubmission.form` now has `onDelete: Cascade`, so submissions where `formId = id` are automatically deleted when the parent `LeadForm` is deleted. The manual `deleteMany` is redundant.

This is harmless (the end result is the same) but is now misleading boilerplate. It also means submissions where `formId IS NULL` (organic Meta leads) are NOT deleted when a form is removed, which is correct — but future maintainers may incorrectly assume the `deleteMany` covers the full cleanup.

**Fix:** Remove the explicit `deleteMany` and rely on the cascade:
```typescript
public async remove(tenantId: string, id: string): Promise<LeadForm> {
  await this.findOne(tenantId, id);
  return this.prisma.leadForm.delete({ where: { id } });
  // LeadFormSubmission rows with formId = id cascade-delete via schema onDelete: Cascade
  // Submissions with formId = null (organic Meta leads) are intentionally preserved
}
```
If the transaction is still needed for other reasons, retain it but add a comment explaining that the `deleteMany` is no longer required by the cascade.

---

### IN-A02: `leadFormInclude` subquery fetches the latest submission per form on every list call — no pagination guard

**File:** `apps/api/src/lead-form/lead-form.service.ts:118-122`

**Issue:**
```typescript
submissions: {
  select: { createdAt: true },
  orderBy: { createdAt: 'desc' },
  take: 1,
},
```
`take: 1` correctly limits the result to one row. The index `@@index([tenantId, createdAt])` on `LeadFormSubmission` supports ordering by `createdAt` globally, but the subquery for `findAll` orders within each form's submissions. For a tenant with many forms and large submission counts, PostgreSQL will perform one subquery per form. This is acceptable for current scale but worth noting. No action required unless the tenant list grows beyond ~100 forms.

This is informational only — no code change is needed.

---

_Addendum Reviewed: 2026-04-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
