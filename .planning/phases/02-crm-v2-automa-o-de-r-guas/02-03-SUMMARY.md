---
phase: 02-crm-v2-automa-o-de-r-guas
plan: "03"
subsystem: meta-webhook
tags: [webhook, lead-ingestion, notification, sse, meta-ads, idempotency]
dependency_graph:
  requires: [02-01]
  provides: [meta-webhook-module, notification-module, stage-rule-stub, agent-proactive-stub]
  affects: [02-04]
tech_stack:
  added: [NotificationService-SSE, rxjs-Subject]
  patterns: [fire-and-forget-webhook, idempotency-via-unique-key, per-tenant-SSE-stream]
key_files:
  created:
    - apps/api/src/meta-webhook/meta-webhook.service.ts
    - apps/api/src/meta-webhook/meta-webhook.controller.ts
    - apps/api/src/meta-webhook/meta-webhook.module.ts
    - apps/api/src/meta-webhook/meta-webhook.service.spec.ts
    - apps/api/src/meta-webhook/meta-webhook.controller.spec.ts
    - apps/api/src/meta-webhook/dto/create-meta-mapping.dto.ts
    - apps/api/src/meta-webhook/dto/meta-lead-payload.dto.ts
    - apps/api/src/notification/notification.service.ts
    - apps/api/src/notification/notification.controller.ts
    - apps/api/src/notification/notification.module.ts
    - apps/api/src/notification/notification.service.spec.ts
    - apps/api/src/stage-rule/stage-rule.service.ts
    - apps/api/src/stage-rule/stage-rule.module.ts
  modified:
    - apps/api/src/agent/agent-runner.service.ts
decisions:
  - "Idempotency via Prisma P2002 unique-constraint catch on MetaLeadIngestion.metaLeadId"
  - "Fire-and-forget POST /meta-webhook returns 200 before ingestLead completes (T-2-09)"
  - "listMappings uses explicit select excluding pageAccessToken (T-2-08)"
  - "StageRuleService stub created in this plan; Plan 02 provides full implementation"
  - "initiateProactiveIfAssigned stub added to AgentRunnerService; Plan 04 adds full logic"
metrics:
  duration_minutes: 25
  completed_date: "2026-04-14"
  tasks_completed: 2
  files_created: 13
  files_modified: 1
  tests_added: 20
---

# Phase 02 Plan 03: Meta Webhook Module + Notification SSE Summary

**One-liner:** Meta Lead Ads webhook with idempotent lead ingestion, D0 rule + proactive agent + per-tenant SSE notification fan-out on card creation.

## What Was Built

### Task 1: MetaWebhookService + DTOs (commit `feb222d`)

**MetaWebhookService** (`apps/api/src/meta-webhook/meta-webhook.service.ts`, 337 lines):
- `validateToken(token)` — queries `MetaWebhookMapping.verifyToken` in DB; no env-var dependency
- `handleVerification(mode, token, challenge)` — delegates to validateToken, returns `{ ok, challenge }`
- `ingestLead(payload)` — iterates `entry[].changes[]` where `field==='leadgen'`; each `processLead` wrapped in try/catch for fault isolation
- `processLead(formId, leadgenId)` — 10-step pipeline:
  1. Mapping lookup (silent return if not found — T-2-06)
  2. Idempotency gate via `prisma.metaLeadIngestion.create` + P2002 catch (T-2-07)
  3. Meta Graph API v19.0 fetch for lead details (best-effort; degrades gracefully)
  4. Contact upsert by phone OR email within tenantId
  5. Card creation via `CardService.create`
  6. `MetaLeadIngestion.cardId` update
  7. `CardActivity` of type `META_LEAD_INGESTED`
  8. `StageRuleService.startRuleRun(card.id, stageId, tenantId, 'CARD_ENTERED')` — CONTEXT.md D0 locked decision
  9. `AgentRunnerService.initiateProactiveIfAssigned(card.id, stageId, tenantId)` — same locked decision
  10. `NotificationService.emit(tenantId, { type: 'meta_lead_arrived', ... })` — CONTEXT.md locked decision
- `createMapping/listMappings/deleteMapping` — full CRUD; `listMappings` explicit `select` excludes `pageAccessToken` (T-2-08)
- 12 unit tests passing

**DTOs:**
- `CreateMetaMappingDto` — class-validator decorators with Length constraints
- `MetaLeadPayload/MetaLeadEntry/MetaLeadChange` — interface types matching Meta webhook format

### Task 2: Controller + NotificationModule (commit `1cffb61`)

**MetaWebhookController** (`apps/api/src/meta-webhook/meta-webhook.controller.ts`):
- `GET /meta-webhook` — raw `text/plain` challenge response (200) or 403; NOT JSON (Meta requires plain text)
- `POST /meta-webhook` — fire-and-forget: `res.send('EVENT_RECEIVED')` before `ingestLead` resolves (T-2-09)
- `GET/POST/DELETE /meta-mappings` — authenticated with `@UseGuards(JwtAuthGuard, TenantGuard)` per method
- 5 unit tests passing

**NotificationService** (`apps/api/src/notification/notification.service.ts`):
- In-memory `Map<tenantId, Subject<NotificationEvent>>`
- `emit(tenantId, event)` / `subscribe(tenantId): Observable<NotificationEvent>`
- Per-tenant isolation: Subject keyed by tenantId (T-2-10b mitigation)
- 3 unit tests: same-tenant delivery, cross-tenant isolation, multi-subscriber fan-out

**NotificationController** (`apps/api/src/notification/notification.controller.ts`):
- `@Sse('stream')` at `GET /notifications/stream`
- `@UseGuards(JwtAuthGuard, TenantGuard)` at class level
- Pipes Observable through rxjs `map` to `MessageEvent` format

**MetaWebhookModule / NotificationModule** — created but NOT registered in `app.module.ts` (Plan 04 Wave 3 handles registration to avoid concurrent-modification conflict with Plan 02 Wave 2).

## Deviations from Plan

### Auto-added Missing Critical Functionality

**1. [Rule 2 - Missing Method] Added `initiateProactiveIfAssigned` stub to AgentRunnerService**
- **Found during:** Task 1 — method referenced by plan but not yet in codebase (Plan 04 adds it in Wave 3)
- **Issue:** TypeScript compilation would fail; MetaWebhookService cannot call a non-existent method
- **Fix:** Added a functional stub implementation that creates an `AgentConversation` record if an agent is assigned to the stage; Plan 04 will add the proactive message-sending logic on top
- **Files modified:** `apps/api/src/agent/agent-runner.service.ts`
- **Commit:** `feb222d`

**2. [Rule 3 - Blocking] Created StageRuleService + StageRuleModule stubs**
- **Found during:** Task 1 — Plan 02 (Wave 2 parallel) creates `stage-rule/` module; this worktree doesn't have it yet
- **Issue:** Import would fail with "Cannot find module" at compile time
- **Fix:** Minimal stub with correct `startRuleRun` signature; Plan 02's full implementation will replace this on merge
- **Files created:** `apps/api/src/stage-rule/stage-rule.service.ts`, `apps/api/src/stage-rule/stage-rule.module.ts`
- **Commit:** `feb222d`

**3. [Rule 3 - Blocking] Created jest.config.js and node_modules junction for worktree**
- **Found during:** Task 1 verification — worktree has no `node_modules` or jest config
- **Fix:** Created `jest.config.js` in worktree api dir; created Windows junction pointing to main repo's `apps/api/node_modules`; ran `prisma generate` targeting worktree schema
- **Files created:** `apps/api/jest.config.js`, `apps/api/create-link.js` (infrastructure only, not committed)

## Threat Surface Scan

All implemented mitigations align with the plan's threat model:

| Threat | Mitigation | Verified |
|--------|------------|---------|
| T-2-06 Spoofing | `processLead` returns silently when no mapping matches `form_id` | Unit test: "returns silently when formId has no mapping" |
| T-2-07 Tampering (replay) | P2002 unique-constraint catch on `metaLeadId` | Unit test: "returns silently when leadgenId already in MetaLeadIngestion" |
| T-2-08 Info Disclosure (pageAccessToken) | `select` clause in `listMappings` explicitly excludes it | Unit test: "does NOT return pageAccessToken field"; grep for `pageAccessToken: true` returns empty |
| T-2-09 DoS (webhook flood) | Fire-and-forget POST returns 200 before processing | Unit test: "returns 200 immediately even before ingestLead completes" |
| T-2-10b Cross-tenant SSE leak | Subject keyed by tenantId from JWT-verified `@CurrentTenant()` | Unit test: "emit to tenant A is not received by subscriber of tenant B" |

No new threat surface beyond what the plan's threat model covers.

## Known Stubs

| Stub | File | Line | Note |
|------|------|------|------|
| `initiateProactiveIfAssigned` — creates AgentConversation but does NOT send proactive message | `apps/api/src/agent/agent-runner.service.ts` | 302 | Plan 04 (Wave 3) adds the proactive first-message logic |
| `StageRuleService.startRuleRun` — returns `null` | `apps/api/src/stage-rule/stage-rule.service.ts` | 13 | Plan 02 (Wave 2) provides full implementation |

These stubs are intentional coordination points between parallel plans. The MetaWebhookService correctly calls both methods; the downstream behavior is completed by Plans 02 and 04 respectively.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `apps/api/src/meta-webhook/meta-webhook.service.ts` | FOUND |
| `apps/api/src/meta-webhook/meta-webhook.controller.ts` | FOUND |
| `apps/api/src/meta-webhook/meta-webhook.module.ts` | FOUND |
| `apps/api/src/notification/notification.service.ts` | FOUND |
| `apps/api/src/notification/notification.controller.ts` | FOUND |
| `apps/api/src/notification/notification.module.ts` | FOUND |
| commit `feb222d` | FOUND |
| commit `1cffb61` | FOUND |
| All 20 tests passing | PASSED |
