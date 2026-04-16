---
phase: 03-agents-formularios-canais
plan: "04"
subsystem: meta-webhook
tags: [meta, lead-forms, organic-leads, webhook, schema-migration, prisma]
dependency_graph:
  requires: [03-02]
  provides: [meta-organic-lead-ingestion, page-level-mapping-crud]
  affects: [meta-webhook, card, lead-form-submission]
tech_stack:
  added: []
  patterns: [payload-type-detection, mapping-fallback-resolution, idempotency-gate, conditional-fk-creation]
key_files:
  created:
    - apps/api/prisma/migrations/20260416_add_pageid_to_meta_webhook_mapping/migration.sql
  modified:
    - apps/api/prisma/schema.prisma
    - apps/api/src/meta-webhook/meta-webhook.service.ts
    - apps/api/src/meta-webhook/meta-webhook.service.spec.ts
    - apps/api/src/meta-webhook/meta-webhook.controller.ts
    - apps/api/src/meta-webhook/dto/create-meta-mapping.dto.ts
    - apps/api/src/meta-webhook/dto/create-page-mapping.dto.ts
    - apps/api/src/meta-webhook/dto/meta-lead-payload.dto.ts
decisions:
  - "LeadFormSubmission creation guarded: only created when an internal LeadForm record matches mapping.metaFormId (FK constraint safety)"
  - "Organic lead audit trail via CardActivity is always created regardless of LeadFormSubmission"
  - "processOrganicLead uses same idempotency gate (MetaLeadIngestion) as campaign leads"
  - "CardService.create hooks already call startRuleRun + initiateProactiveIfAssigned — not duplicated in processOrganicLead"
metrics:
  duration_minutes: 30
  completed_date: "2026-04-16"
  tasks_completed: 3
  files_modified: 8
---

# Phase 03 Plan 04: Meta Lead Forms Webhook Summary

**One-liner:** Organic Meta Lead Forms (page-based) now flow through the same webhook endpoint as Lead Ads using payload-type detection, pageId-based mapping fallback, and safe FK-guarded LeadFormSubmission creation.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | MetaWebhookMapping schema extension — migration | 429f3bb | prisma/migrations/20260416_add_pageid_to_meta_webhook_mapping/migration.sql |
| 2 | Fix LeadFormSubmission FK violation in processOrganicLead | 585bb21 | meta-webhook.service.ts, meta-webhook.service.spec.ts |
| 3 | Page-level mapping CRUD (already in base commit) | 0dcf2fb | controller, DTOs, service — all already in HEAD base |

**Note:** The implementation for all three tasks (schema changes, service extension, controller/DTOs) was already committed in the worktree's base commit (`0dcf2fb` — from a prior parallel worktree execution in the same wave). This execution:
1. Created the missing migration SQL file (Task 1)
2. Fixed a bug in `processOrganicLead` where a raw Meta `form_id` was passed as FK to `LeadFormSubmission.formId` (Task 2)
3. Verified Task 3 artifacts are correct and TypeScript-clean

## Implementation Details

### Schema Changes (already in base)
- `MetaWebhookMapping.metaFormId` changed from required to optional (`String?`)
- New `MetaWebhookMapping.pageId String?` field for organic lead page-level mappings
- `@@unique([pageId, metaFormId])` composite constraint replaces old `@@unique([metaFormId])`
- `@@index([pageId])` and `@@index([metaFormId])` for fast lookup

### ingestLead Routing
```
payload.entry[].changes[].value.campaign_id present?
  YES → processLead(formId, leadgenId)      # unchanged campaign flow
  NO  → processOrganicLead(formId, leadgenId, pageId)  # new organic flow
```

### processOrganicLead Mapping Resolution
```
1. findFirst where metaFormId = formId (exact match)
2. IF null AND pageId: findFirst where pageId = pageId AND metaFormId = null (catch-all)
3. IF still null: log + return (silent skip — T-3-01 mitigation)
```

### LeadFormSubmission Safety (bug fix in this execution)
The plan's pseudocode used the raw Meta `form_id` as `LeadFormSubmission.formId`, but that field is a required FK to the `LeadForm` table (internal UUID). This would cause a FK violation in production.

Fix: Look up internal `LeadForm` by `mapping.metaFormId`. If found, create `LeadFormSubmission` linking the card to the internal form. If not found, skip `LeadFormSubmission` — the `CardActivity` record (`META_LEAD_INGESTED`) provides the audit trail.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed LeadFormSubmission FK violation in processOrganicLead**
- **Found during:** Task 2 code review
- **Issue:** `processOrganicLead` passed raw Meta `form_id` (e.g., "123456") as `formId` to `leadFormSubmission.create`. `LeadFormSubmission.formId` is a required FK to the `LeadForm` table (UUID). This would cause a Prisma FK violation in production.
- **Fix:** Added conditional logic — look up internal `LeadForm` by `mapping.metaFormId`; only create `LeadFormSubmission` if a matching internal form exists. Audit trail always preserved via `CardActivity`.
- **Files modified:** `meta-webhook.service.ts`, `meta-webhook.service.spec.ts`
- **Commit:** 585bb21

**2. [Rule 3 - Missing Artifact] Created migration SQL file**
- **Found during:** Task 1 — no migration existed for the schema changes (pageId + nullable metaFormId)
- **Fix:** Created `20260416_add_pageid_to_meta_webhook_mapping/migration.sql` with ALTER TABLE statements
- **Files modified:** `apps/api/prisma/migrations/20260416_add_pageid_to_meta_webhook_mapping/migration.sql`
- **Commit:** 429f3bb

## Test Results

```
Test Suites: 1 passed, 1 total
Tests:       22 passed, 22 total (21 original + 1 new for no-LeadForm-match case)
```

Tests cover:
- Campaign payload routing to processLead (campaign_id present)
- Organic payload routing to processOrganicLead (no campaign_id)
- Exact formId mapping resolution
- pageId fallback when formId has no match
- Skip when neither formId nor pageId matches any mapping
- Contact + Card + LeadFormSubmission created when internal LeadForm exists
- Contact + Card created (no LeadFormSubmission) when no internal LeadForm
- Idempotency on duplicate leadgenId
- name/email/phone extraction from Meta field_data
- meta_form_arrived notification emitted

## Verification

- `prisma validate`: schema valid
- `npx tsc --noEmit`: no errors in meta-webhook files (2 pre-existing errors in unrelated spec files)
- `npx jest meta-webhook.service --no-coverage`: 22/22 passed

## Known Stubs

None — all data flows are wired.

## Threat Flags

None — no new network endpoints or trust boundaries beyond what the plan's threat model covers.

## Self-Check: PASSED

- migration.sql exists: FOUND at `apps/api/prisma/migrations/20260416_add_pageid_to_meta_webhook_mapping/migration.sql`
- schema.prisma has pageId + nullable metaFormId + composite unique: FOUND
- meta-webhook.service.ts has processOrganicLead: FOUND
- meta-webhook.controller.ts has POST meta-mappings/page: FOUND
- create-page-mapping.dto.ts exists: FOUND
- Commits 429f3bb and 585bb21: FOUND in git log
