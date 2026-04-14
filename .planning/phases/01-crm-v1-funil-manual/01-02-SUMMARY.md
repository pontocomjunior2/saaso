---
phase: 01-crm-v1-funil-manual
plan: 02
subsystem: backend
tags: [nestjs, nodemailer, email, whatsapp, pipeline-templates, card-messaging]
dependency_graph:
  requires: [01-01]
  provides: [PIPELINE_TEMPLATES static data, EmailService SMTP/local_demo, POST /pipelines/from-template, GET /pipelines/templates, POST /cards/:id/send-message]
  affects: [PipelineService, PipelineController, CardService, CardController, CardModule, AppModule]
tech_stack:
  added: [nodemailer, @types/nodemailer]
  patterns: [Prisma transaction for multi-model create, SMTP/local_demo fallback pattern, variable substitution in message templates]
key_files:
  created:
    - apps/api/src/pipeline/pipeline-templates.ts
    - apps/api/src/pipeline/dto/create-pipeline-from-template.dto.ts
    - apps/api/src/email/email.service.ts
    - apps/api/src/email/email.module.ts
    - apps/api/src/card/dto/send-message.dto.ts
  modified:
    - apps/api/src/pipeline/pipeline.service.ts
    - apps/api/src/pipeline/pipeline.controller.ts
    - apps/api/src/card/card.service.ts
    - apps/api/src/card/card.controller.ts
    - apps/api/src/card/card.module.ts
    - apps/api/src/app.module.ts
    - apps/api/.env.example
decisions:
  - GET /pipelines/templates registered before GET /pipelines/:id to prevent route shadowing
  - EmailService uses local_demo mode when MAIL_HOST/USER/PASS are absent — no crash on missing config
  - CardActivity for WHATSAPP updated post-logMessage with templateName/actorId since WhatsappService creates the activity internally
  - Template tenant validation (where templateId + tenantId) mitigates T-02-02 cross-tenant tampering
metrics:
  duration: 25 min
  completed: 2026-04-13
  tasks_completed: 2
  files_created: 5
  files_modified: 7
---

# Phase 1 Plan 02: Pipeline Templates + Send Message API + Email Service Summary

**One-liner:** 5 static pipeline templates with Prisma transaction creation, EmailService with Mailtrap SMTP / local_demo fallback, and POST /cards/:id/send-message dispatching WhatsApp or Email via stage template with CardActivity traceability.

## What Was Built

### Task 1: Pipeline Templates + GET /pipelines/templates + POST /pipelines/from-template

1. **`apps/api/src/pipeline/pipeline-templates.ts`** — 5 templates exported as `PIPELINE_TEMPLATES`:
   - `funil-simples` — 4 stages, for direct sales / service providers
   - `funil-comercial-medio` — 6 stages, B2B commercial cycle 15-60 days
   - `funil-saas-completo` — 5 stages, SaaS with trial, demo, onboarding
   - `funil-ecommerce` — 4 stages, cart abandonment recovery and post-sale
   - `pos-venda-cs` — 5 stages, customer success onboarding and retention
   - Each stage has 1-3 message templates covering both WHATSAPP and EMAIL channels with variable placeholders

2. **`apps/api/src/pipeline/dto/create-pipeline-from-template.dto.ts`** — `templateId` (required) and `name` (optional override)

3. **`PipelineService.createFromTemplate`** — Prisma `$transaction` creates pipeline + all stages + all StageMessageTemplates atomically

4. **`PipelineController`** — Two new endpoints:
   - `GET /pipelines/templates` — returns template list with stage count/names (no DB query, static data)
   - `POST /pipelines/from-template` — creates pipeline from template, requires tenant auth
   - `GET /pipelines/templates` registered before `GET /pipelines/:id` to prevent NestJS route shadowing

5. **`findAll` and `findOne`** — Updated to include `messageTemplates` in stage includes

### Task 2: EmailService + POST /cards/:id/send-message

1. **`apps/api/src/email/email.service.ts`** — `EmailService` with:
   - `sendEmail({ to, subject, body })` method
   - SMTP mode when `MAIL_HOST` + `MAIL_USER` + `MAIL_PASS` are set (Mailtrap or any SMTP)
   - `local_demo` fallback mode — logs simulated send, returns `{ success: true, deliveryMode: 'local_demo' }` without throwing
   - Returns `{ success, deliveryMode, messageId? }`

2. **`apps/api/src/email/email.module.ts`** — Module with `exports: [EmailService]`

3. **`AppModule`** — Registered `EmailModule`

4. **`apps/api/src/card/dto/send-message.dto.ts`** — `SendMessageDto` with `templateId: string` and `channel: CampaignChannel`

5. **`CardService.sendMessage`** — Full dispatch flow:
   - Fetches card with contact (tenant-isolated)
   - Fetches StageMessageTemplate (tenant-isolated, mitigates T-02-02)
   - Resolves `{{nome}}`, `{{email}}`, `{{telefone}}`, `{{empresa}}` variables
   - WHATSAPP: calls `whatsappService.logMessage()`, then updates created CardActivity with `templateName` and `actorId`
   - EMAIL: calls `emailService.sendEmail()`, then creates `EMAIL_OUTBOUND` CardActivity with `channel`, `templateName`, `actorId`

6. **`CardController`** — `POST /cards/:id/send-message` with `@CurrentUser()` for actorId

7. **`CardModule`** — Updated to import `WhatsappModule` and `EmailModule`

8. **`.env.example`** — Added `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM`

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | a467d85 | feat(01-02): add 5 pipeline templates and POST /pipelines/from-template endpoint |
| 2 | c12c73b | feat(01-02): add EmailService and POST /cards/:id/send-message endpoint |

## Threat Model Mitigations Applied

| Threat | Mitigation |
|--------|-----------|
| T-02-01 Spoofing | JwtAuthGuard + TenantGuard on send-message and from-template endpoints |
| T-02-02 Tampering | stageMessageTemplate fetched with `{ id: dto.templateId, tenantId }` — cross-tenant template injection blocked |
| T-02-03 Info Disclosure | Only contact fields from the card's own tenant injected into message body |
| T-02-05 Tampering | templateId validated against static PIPELINE_TEMPLATES list — invalid IDs throw NotFoundException |
| T-02-06 Info Disclosure | SMTP credentials only in env vars, never returned in API responses |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all endpoints fully implemented with real logic.

## Self-Check: PASSED

- [x] `apps/api/src/pipeline/pipeline-templates.ts` — created, exports PIPELINE_TEMPLATES with 5 templates
- [x] `apps/api/src/pipeline/dto/create-pipeline-from-template.dto.ts` — created
- [x] `apps/api/src/pipeline/pipeline.service.ts` — modified, createFromTemplate + messageTemplates in findAll/findOne
- [x] `apps/api/src/pipeline/pipeline.controller.ts` — modified, GET /pipelines/templates + POST /pipelines/from-template
- [x] `apps/api/src/email/email.service.ts` — created, EmailService with smtp/local_demo
- [x] `apps/api/src/email/email.module.ts` — created, exports EmailService
- [x] `apps/api/src/card/dto/send-message.dto.ts` — created, SendMessageDto
- [x] `apps/api/src/card/card.service.ts` — modified, sendMessage method injecting WhatsappService + EmailService
- [x] `apps/api/src/card/card.controller.ts` — modified, POST /cards/:id/send-message
- [x] `apps/api/src/card/card.module.ts` — modified, imports WhatsappModule + EmailModule
- [x] `apps/api/src/app.module.ts` — modified, EmailModule registered
- [x] `apps/api/.env.example` — modified, MAIL_* vars added
- [x] Commit a467d85 — Task 1
- [x] Commit c12c73b — Task 2
- [x] NestJS build exits 0 (verified twice)
