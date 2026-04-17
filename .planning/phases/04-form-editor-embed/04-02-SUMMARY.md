---
phase: 04-form-editor-embed
plan: 02
status: complete
completed: 2026-04-15
---

## 04-02: Meta Lead Forms Webhook — Organic Lead Processing

### What was built
- **Schema migration**: Added `pageId String?` to `MetaWebhookMapping`, made `metaFormId` nullable (`String?`), added composite unique constraint `@@unique([pageId, metaFormId])`, added indexes on `pageId` and `metaFormId`, added `@@unique([verifyToken])`
- **Payload DTO extended**: `MetaLeadChangeValue` now includes optional `campaign_id`, `page_id`, `ad_id`, `adgroup_id`
- **Payload-type routing in `ingestLead`**: Detects `campaign_id` presence to route: campaign → `processLead` (unchanged), organic → `processOrganicLead` (new)
- **`processOrganicLead` method**: 11-step pipeline: mapping resolution (exact formId → pageId fallback), idempotency via MetaLeadIngestion, fetch lead details from Meta Graph API, upsert Contact, create Card via CardService.create (triggers automation hooks), create LeadFormSubmission, link ingestion to card, record activity, emit in-app notification (`meta_form_arrived`)
- **Card custom fields**: Organic leads get `source: 'meta-form'` (distinguishes from campaign `source: 'meta-ads'`), plus `metaLeadId`, `metaFormId`, `pageId`
- **Page-level mapping CRUD**: `CreatePageMappingDto` created, `POST /meta-mappings/page` endpoint added to controller, `CreateMetaMappingDto` updated with optional `pageId` and `metaFormId`
- **listMappings updated**: Now includes `pageId` field in response

### Key files modified
- `apps/api/prisma/schema.prisma` — MetaWebhookMapping schema extended with pageId + nullable metaFormId + new constraints
- `apps/api/src/meta-webhook/dto/meta-lead-payload.dto.ts` — MetaLeadChangeValue interface with all optional payload fields
- `apps/api/src/meta-webhook/dto/create-meta-mapping.dto.ts` — metaFormId now optional, pageId added as optional
- `apps/api/src/meta-webhook/dto/create-page-mapping.dto.ts` — New DTO for page-level mappings (pageId required)
- `apps/api/src/meta-webhook/meta-webhook.service.ts` — ingestLead routing + processOrganicLead method + createMapping updated with pageId + listMappings includes pageId
- `apps/api/src/meta-webhook/meta-webhook.controller.ts` — POST /meta-mappings/page endpoint added
- `apps/api/src/meta-webhook/meta-webhook.service.spec.ts` — 10 new tests: campaign routing, organic routing, pageId fallback, Contact+Card+LeadFormSubmission creation, idempotency, field_data extraction, meta_form_arrived notification

### Deviations from plan
- Prisma migration (`npx prisma migrate dev`) could not be executed from worktree environment — migration file must be generated manually with `cd apps/api && npx prisma migrate dev --name add_pageid_to_meta_webhook_mapping`
- Schema comments (`// nullable for page-level catch-all mappings`) added for code clarity

### Self-Check: PASSED
- MetaWebhookMapping has pageId String? field
- metaFormId is nullable (String?)
- @@unique([pageId, metaFormId]) constraint in place
- @@index([pageId]) and @@index([metaFormId]) in place
- processOrganicLead method exists with full pipeline
- ingestLead routes to processOrganicLead when campaign_id absent
- Idempotency via MetaLeadIngestion table reused
- Card created via CardService.create (triggers automation hooks)
- LeadFormSubmission created for organic leads
- Campaign flow unchanged
- TypeScript compiles (pending verification — prisma generate not run in worktree)
