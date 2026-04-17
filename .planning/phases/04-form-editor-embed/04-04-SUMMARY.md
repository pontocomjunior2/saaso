---
phase: 04-form-editor-embed
plan: "04"
subsystem: api
tags: [lead-form, meta-webhook, prisma, gap-closure]
dependency_graph:
  requires: [04-01, 04-02, 04-03]
  provides: [LeadFormSubmission-always-created, submissionCount-on-response]
  affects: [meta-webhook.service, lead-form.service, prisma-schema]
tech_stack:
  added: []
  patterns: [nullable-fk, best-effort-enrichment, prisma-_count-subquery, take-1-latest]
key_files:
  created:
    - apps/api/prisma/migrations/20260417_leadform_submission_nullable_formid/migration.sql
  modified:
    - apps/api/prisma/schema.prisma
    - apps/api/src/meta-webhook/meta-webhook.service.ts
    - apps/api/src/meta-webhook/meta-webhook.service.spec.ts
    - apps/api/src/lead-form/lead-form.service.ts
    - apps/api/src/lead-form/lead-form.service.spec.ts
decisions:
  - "LeadFormSubmission.formId made nullable so page-level catch-all organic leads (metaFormId=null) can still create an audit row"
  - "Internal LeadForm lookup is best-effort (try/catch) — failure logs a warning but does NOT block submission creation"
  - "prisma migrate dev not run in worktree (no DB connectivity) — migration SQL hand-authored and must be applied during deploy"
  - "Pre-existing tsc errors in lead-form.service.spec.ts (missing 3rd constructor arg) and other files are out of scope — present before this plan"
metrics:
  duration: "~25 min"
  completed: "2026-04-17"
  tasks_completed: 3
  files_modified: 5
  files_created: 1
---

# Phase 04 Plan 04: Gap Closure — LeadFormSubmission + submissionCount Summary

**One-liner:** Nullable FK migration + unconditional LeadFormSubmission creation + _count subquery on leadFormInclude closes both verification gaps from 04-VERIFICATION.md.

## What Was Built

### Gap 1 — LeadFormSubmission conditional creation (CLOSED)

`processOrganicLead` previously only created a `LeadFormSubmission` when `mapping.metaFormId` was non-null AND an internal `LeadForm` record matched. Page-level catch-all mappings (`metaFormId=null`) never created a row.

**Fix:** Removed the outer `if (mapping.metaFormId)` gate. The create call now runs unconditionally after every Card creation. The internal `LeadForm` lookup is retained as a best-effort enrichment (wrapped in try/catch) that populates `internalFormId` when it resolves, or leaves it `null` when `metaFormId` is null or no match is found.

The `LeadFormSubmission.formId` schema field was made nullable (`String?`) to accommodate rows with no internal form match. A hand-authored Prisma migration (`20260417_leadform_submission_nullable_formid`) adds `ALTER TABLE "LeadFormSubmission" ALTER COLUMN "formId" DROP NOT NULL`.

### Gap 2 — Form submission count hollow (CLOSED)

`GET /forms` returned `LeadFormResponse` without `submissionCount` or `lastSubmissionAt`, so `/formularios` was permanently stuck at "0 envios".

**Fix:**
- `leadFormInclude` extended with `_count: { select: { submissions: true } }` and `submissions: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 }`.
- `LeadFormResponse` interface gains `submissionCount: number` and `lastSubmissionAt: string | null`.
- `mapLeadForm` populates both: `form._count?.submissions ?? 0` and `form.submissions?.[0]?.createdAt?.toISOString() ?? null`.
- The frontend (`useLeadFormStore.ts`, `formularios/page.tsx`) was already wired to consume these fields — no frontend changes required.

## Verification Results

**Prisma validate:** `The schema at prisma/schema.prisma is valid`

**Jest — meta-webhook.service.spec:** 23 tests passed (0 failed)
- `uses internal LeadForm id when mapping.metaFormId resolves to an internal form` — PASS
- `creates Contact + Card + LeadFormSubmission with null formId for page-level catch-all` — PASS
- `creates LeadFormSubmission with null formId when internal LeadForm lookup returns nothing` — PASS
- All pre-existing tests remain green

**Jest — lead-form.service.spec:** 7 tests passed (0 failed)
- `findAll returns submissionCount and lastSubmissionAt for each form` — PASS
- `findOne returns submissionCount = 0 and lastSubmissionAt = null when form has no submissions` — PASS

**Total:** 30 tests, 2 suites, all green.

**TypeScript:** No new errors introduced in implementation files. Pre-existing errors in `lead-form.service.spec.ts` (missing 3rd constructor arg, already present before this plan), `ai.service.ts`, and `evolution.service.spec.ts` are out of scope.

## Deviations from Plan

### Auto-fixed Issues

None.

### Planned Fallback Applied

**`prisma migrate dev` not executed (no DB in worktree)**
- Same fallback as plan 04-02 per its SUMMARY `Deviations` section.
- Migration directory `20260417_leadform_submission_nullable_formid/migration.sql` hand-authored with `ALTER TABLE "LeadFormSubmission" ALTER COLUMN "formId" DROP NOT NULL`.
- `npx prisma generate` ran successfully against the updated schema.
- Must be applied with `npx prisma migrate deploy` during next deploy cycle.

## Commits

| Hash | Message |
|------|---------|
| e1cbdfb | feat(04-04): make LeadFormSubmission.formId nullable + migration |
| ac3d61f | feat(04-04): unconditional LeadFormSubmission creation in processOrganicLead |
| a84e664 | feat(04-04): expose submissionCount and lastSubmissionAt on LeadFormResponse |

## Known Stubs

None — all fields are now populated from real DB data.

## Threat Flags

No new trust boundaries introduced. All mitigations from plan threat model (T-4-40 through T-4-43) implemented as described:
- T-4-40: `_count` inherits tenant filter from `where: { tenantId }` on all findAll/findOne queries.
- T-4-41: Unconditional create in `processOrganicLead` closes repudiation gap.
- T-4-42: FK `onDelete: Cascade` retained; `formId=null` rows are independent (no FK).
- T-4-43: Existing `@@index([tenantId, formId])` and `@@index([tenantId, createdAt])` cover the subquery.

## Self-Check: PASSED

- `apps/api/prisma/schema.prisma` — formId String? and LeadForm? confirmed
- `apps/api/prisma/migrations/20260417_leadform_submission_nullable_formid/migration.sql` — exists
- `apps/api/src/meta-webhook/meta-webhook.service.ts` — internalFormId + unconditional create confirmed
- `apps/api/src/lead-form/lead-form.service.ts` — _count, submissions, submissionCount, lastSubmissionAt confirmed
- Commits e1cbdfb, ac3d61f, a84e664 — all present in git log
