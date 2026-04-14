---
phase: 01-crm-v1-funil-manual
plan: 01
subsystem: backend
tags: [prisma, nestjs, crud, schema, tenant-isolation]
dependency_graph:
  requires: []
  provides: [StageMessageTemplate CRUD API, CardActivity expanded schema]
  affects: [Stage model, Tenant model, User model, CardActivity model]
tech_stack:
  added: []
  patterns: [NestJS module pattern, Prisma tenant isolation via tenantId filter, stage ownership via pipeline.tenantId join]
key_files:
  created:
    - apps/api/src/stage-message-template/stage-message-template.module.ts
    - apps/api/src/stage-message-template/stage-message-template.service.ts
    - apps/api/src/stage-message-template/stage-message-template.controller.ts
    - apps/api/src/stage-message-template/dto/create-stage-message-template.dto.ts
    - apps/api/src/stage-message-template/dto/update-stage-message-template.dto.ts
  modified:
    - apps/api/prisma/schema.prisma
    - apps/api/src/app.module.ts
decisions:
  - Project does not use @nestjs/mapped-types — UpdateDto implemented with explicit optional fields using class-validator decorators
  - Database uses db push (no migration history files) — used prisma db push instead of prisma migrate dev
  - Prisma client DLL locked by running API server on Windows, but generate succeeded (types updated in index.d.ts)
metrics:
  duration: 4 min
  completed: 2026-04-13
  tasks_completed: 2
  files_created: 5
  files_modified: 2
---

# Phase 1 Plan 01: Schema + Backend Foundation Summary

**One-liner:** Prisma schema extended with StageMessageTemplate model and CardActivity traceability fields, plus full CRUD REST API with per-tenant isolation.

## What Was Built

1. **Schema changes** (`apps/api/prisma/schema.prisma`):
   - New `StageMessageTemplate` model with `id`, `stageId`, `name`, `channel` (CampaignChannel enum), `subject?`, `body`, `tenantId`, timestamps, and compound indexes
   - `CardActivity` expanded with `channel?`, `templateName?`, `actorId?` (+ `actor User?` relation)
   - Inverse relations added: `Stage.messageTemplates`, `Tenant.stageMessageTemplates`, `User.cardActivities`
   - Applied via `prisma db push` (project has no migration history)

2. **CRUD REST module** (`apps/api/src/stage-message-template/`):
   - `GET /stage-message-templates?stageId=:id` — list templates by stage (tenant-isolated)
   - `GET /stage-message-templates/:id` — get single template
   - `POST /stage-message-templates` — create template (validates stage ownership)
   - `PATCH /stage-message-templates/:id` — update template
   - `DELETE /stage-message-templates/:id` — remove template
   - All endpoints protected by `JwtAuthGuard` + `TenantGuard`
   - All methods use `@CurrentTenant()` for tenant isolation

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 8229d83 | feat(01-01): add StageMessageTemplate model and expand CardActivity fields |
| 2 | b36c93c | feat(01-01): implement StageMessageTemplate CRUD REST module |

## Threat Model Mitigations Applied

| Threat | Mitigation |
|--------|-----------|
| T-01-01 Spoofing | JwtAuthGuard + TenantGuard on all endpoints |
| T-01-02 Tampering | class-validator on all DTO fields |
| T-01-03 Info Disclosure | tenantId filter on all queries |
| T-01-04 Elevation | Stage ownership validated via `pipeline.tenantId` before create |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] @nestjs/mapped-types not installed**
- **Found during:** Task 2 build verification
- **Issue:** `update-stage-message-template.dto.ts` initially used `PartialType`/`OmitType` from `@nestjs/mapped-types`, which is not installed in the project
- **Fix:** Rewrote UpdateDto with explicit optional fields using `@IsOptional()` decorator — same pattern used across the rest of the codebase
- **Files modified:** `apps/api/src/stage-message-template/dto/update-stage-message-template.dto.ts`
- **Commit:** b36c93c

**2. [Rule 3 - Blocking] No migration history — prisma migrate dev failed**
- **Found during:** Task 1 migration step
- **Issue:** The project has no `prisma/migrations/` directory; `prisma migrate dev` detected schema drift and required a reset
- **Fix:** Used `prisma db push` instead — consistent with how the project manages schema without migration files
- **Files modified:** None (database only)

## Known Stubs

None — all endpoints fully implemented with real Prisma queries.

## Self-Check: PASSED

- [x] `apps/api/prisma/schema.prisma` — modified, contains `model StageMessageTemplate`
- [x] `apps/api/src/stage-message-template/stage-message-template.service.ts` — created
- [x] `apps/api/src/stage-message-template/stage-message-template.controller.ts` — created
- [x] `apps/api/src/stage-message-template/stage-message-template.module.ts` — created
- [x] `apps/api/src/stage-message-template/dto/create-stage-message-template.dto.ts` — created
- [x] `apps/api/src/stage-message-template/dto/update-stage-message-template.dto.ts` — created
- [x] `apps/api/src/app.module.ts` — modified, StageMessageTemplateModule registered
- [x] Commit 8229d83 — schema changes
- [x] Commit b36c93c — CRUD module
- [x] NestJS build exits 0
- [x] Database in sync (`prisma db push` confirms "already in sync" on second run)
