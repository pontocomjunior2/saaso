---
phase: 03-agents-formularios-canais
reviewed: 2026-04-16T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - apps/api/src/meta-webhook/meta-webhook.service.ts
  - apps/api/src/meta-webhook/meta-webhook.service.spec.ts
  - apps/web/src/app/configuracoes/page.tsx
  - apps/web/src/app/formularios/page.tsx
  - apps/web/src/components/board/AgentStatusBadge.tsx
  - apps/web/src/components/board/CardDetailSheet.tsx
  - apps/web/src/components/board/KanbanBoard.tsx
  - apps/web/src/components/configuracoes/WhatsAppSettingsSection.tsx
  - apps/web/src/stores/useLeadFormStore.ts
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-04-16
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

This phase introduced the Meta webhook ingestion pipeline (`MetaWebhookService`), the lead form builder and store, the WhatsApp settings section, and board-level UI components (AgentStatusBadge, CardDetailSheet, KanbanBoard). The overall structure is solid — idempotency gates, per-entry try/catch isolation, and tenant-scoped queries are correctly applied throughout. However one critical logic error was found in `processOrganicLead`, two warnings about URL injection and a React state-closure race, and two minor info items.

---

## Critical Issues

### CR-01: Internal LeadForm lookup uses Meta form ID instead of internal UUID

**File:** `apps/api/src/meta-webhook/meta-webhook.service.ts:354-356`

**Issue:** `processOrganicLead` queries `prisma.leadForm.findFirst` using `{ id: mapping.metaFormId }`. The field `mapping.metaFormId` holds the **external Meta form ID** (e.g. `"1234567890"`), whereas `leadForm.id` is a **Prisma-generated UUID**. These two ID spaces never overlap, so the `internalForm` lookup will always return `null` and `LeadFormSubmission` will never be created for organic leads — silently dropping the submission record every time.

**Fix:** Either (a) store the internal `LeadForm` ID on the mapping as a separate column (e.g. `internalFormId`) and query by that, or (b) query by a dedicated `metaFormId` column on the `LeadForm` model:

```typescript
// Option A — if mapping carries the internal form FK:
const internalForm = await this.prisma.leadForm.findFirst({
  where: { id: mapping.internalFormId, tenantId: mapping.tenantId },
});

// Option B — if LeadForm stores the linked Meta form ID:
const internalForm = await this.prisma.leadForm.findFirst({
  where: { metaFormId: mapping.metaFormId, tenantId: mapping.tenantId },
});
```

---

## Warnings

### WR-01: pageAccessToken interpolated raw into URL — URL injection if token contains special characters

**File:** `apps/api/src/meta-webhook/meta-webhook.service.ts:148` and `309`

**Issue:** The `pageAccessToken` value retrieved from the database is inserted directly into a URL string via template literal:

```typescript
const url = `https://graph.facebook.com/v19.0/${leadgenId}?fields=field_data&access_token=${mapping.pageAccessToken}`;
```

If `pageAccessToken` contains `&`, `#`, or `%` characters (valid in OAuth tokens), the URL may be silently malformed, causing the Graph API call to fail or, in a worst case, cause `leadgenId` (also interpolated) to be interpreted incorrectly. This is not a direct injection vulnerability because both values originate from internal DB records, but it is a correctness bug.

**Fix:** Use `URLSearchParams` to build the query string safely:

```typescript
const params = new URLSearchParams({
  fields: 'field_data',
  access_token: mapping.pageAccessToken,
});
const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(leadgenId)}?${params.toString()}`;
```

Apply the same fix at line 309 (`processOrganicLead`).

---

### WR-02: React state-closure race — `createdFieldId` may be empty string after `setDraft`

**File:** `apps/web/src/app/formularios/page.tsx:728-741`

**Issue:** `insertFieldFromPreset` captures `createdFieldId` via closure mutation inside the `setDraft` updater callback, then reads it synchronously outside:

```typescript
let createdFieldId = '';

setDraft((current) => {
  const nextField = createFieldFromPreset(preset, current.fields);
  createdFieldId = nextField.id;          // written inside async updater
  // ...
});

if (createdFieldId) {                     // read immediately after setDraft call
  setSelectedBlock({ type: 'field', fieldId: createdFieldId });
}
```

In React's concurrent mode the updater function may be called asynchronously or re-invoked, making the `createdFieldId` read outside the updater unreliable. The `setSelectedBlock` call may fire with an empty string, failing to select the newly added field.

**Fix:** Compute the new field ID **before** calling `setDraft`, then use it in both the updater and the subsequent `setSelectedBlock` call:

```typescript
const insertFieldFromPreset = (presetId: string, destinationIndex?: number) => {
  const preset = FIELD_PRESETS.find((item) => item.id === presetId);
  if (!preset) return;

  // Capture a stable snapshot of existing IDs before the state update
  const existingIds = draft.fields.map((f) => f.id);
  const existingKeys = draft.fields.map((f) => f.key);
  const newId = makeUniqueToken(preset.field.id, existingIds);
  const newKey = makeUniqueToken(preset.field.key, existingKeys);
  const newField: LeadFormField = { ...cloneField(preset.field), id: newId, key: newKey };

  setDraft((current) => {
    const nextFields = current.fields.map(cloneField);
    const index = typeof destinationIndex === 'number'
      ? Math.min(Math.max(destinationIndex, 0), nextFields.length)
      : nextFields.length;
    nextFields.splice(index, 0, newField);
    return cloneDraft({ ...current, fields: nextFields });
  });

  setSelectedBlock({ type: 'field', fieldId: newId });
};
```

The same pattern applies to `duplicateField` at line 744.

---

### WR-03: `upsertContact` has a TOCTOU race condition that can create duplicate contacts

**File:** `apps/api/src/meta-webhook/meta-webhook.service.ts:407-435`

**Issue:** `upsertContact` performs a `findFirst` then `create` — two separate DB round-trips with no transaction. Under concurrent webhook delivery (Meta commonly sends duplicate or near-simultaneous callbacks), two processes can both observe `existing === null` and both attempt `create`, causing a duplicate contact record or a DB unique-constraint error that propagates as an uncaught exception (no `isPrismaUniqueViolation` check on the `contact.create` call).

**Fix:** Wrap in a Prisma `upsertOrCreate` pattern using `createMany` with `skipDuplicates`, or catch the P2002 error on `contact.create` and re-fetch:

```typescript
private async upsertContact(tenantId: string, phone?: string, email?: string, name?: string) {
  const whereOr = [
    phone ? { phone } : null,
    email ? { email } : null,
  ].filter(Boolean) as Array<{ phone?: string; email?: string }>;

  if (whereOr.length) {
    const existing = await this.prisma.contact.findFirst({
      where: { tenantId, OR: whereOr },
    });
    if (existing) return existing;
  }

  try {
    return await this.prisma.contact.create({
      data: { tenantId, name: name ?? 'Lead Meta', phone, email },
    });
  } catch (e) {
    if (isPrismaUniqueViolation(e) && whereOr.length) {
      // Race: another process created the contact between our findFirst and create
      const existing = await this.prisma.contact.findFirst({
        where: { tenantId, OR: whereOr },
      });
      if (existing) return existing;
    }
    throw e;
  }
}
```

---

## Info

### IN-01: `console.error` left in production code path

**File:** `apps/web/src/components/board/KanbanBoard.tsx:260`

**Issue:** A bare `console.error('Failed to toggle autopilot', err)` is left in the autopilot toggle error handler. This leaks internal error objects to the browser console in production.

**Fix:** Either remove the log or gate it behind a `process.env.NODE_ENV !== 'production'` check, and optionally surface the error to the UI state so the user knows the toggle failed:

```typescript
} catch (err) {
  if (process.env.NODE_ENV !== 'production') {
    console.error('Failed to toggle autopilot', err);
  }
  // Optionally: set an error state to show feedback to the user
} finally {
```

---

### IN-02: Shared `phoneNumber` state between Evolution and Meta Cloud provider forms

**File:** `apps/web/src/components/configuracoes/WhatsAppSettingsSection.tsx:83,308,401`

**Issue:** The single `phoneNumber` state variable is used both as the optional phone number for an Evolution instance (line 308) and as the required phone number for Meta Cloud account creation (line 401). When the user types a phone for Meta Cloud and then switches to Evolution, the Evolution form is pre-populated with the Meta value (and vice versa). This creates a confusing UX and may lead to unintentionally submitting wrong phone numbers.

**Fix:** Split into two separate state variables, one per provider:

```typescript
const [instanceName, setInstanceName] = useState('');
const [evolutionPhone, setEvolutionPhone] = useState('');
const [metaPhone, setMetaPhone] = useState('');
```

Use `evolutionPhone` in the Evolution creation handler and `metaPhone` in `handleCreateMetaAccount`.

---

_Reviewed: 2026-04-16_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
