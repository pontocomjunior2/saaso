---
phase: 02-crm-v2-automa-o-de-r-guas
plan: "02"
subsystem: stage-rule
tags: [nestjs, bullmq, crud, queue, stage-rule, automation]
dependency_graph:
  requires: [02-01]
  provides: [StageRuleService, StageRuleQueueService, StageRuleController]
  affects: [app.module.ts]
tech_stack:
  added: [bullmq, ioredis (already present)]
  patterns: [forwardRef circular injection, poller-fallback pattern, BullMQ delayed jobs, tenant-scoped CRUD]
key_files:
  created:
    - apps/api/src/stage-rule/stage-rule.service.ts
    - apps/api/src/stage-rule/stage-rule-queue.service.ts
    - apps/api/src/stage-rule/stage-rule.controller.ts
    - apps/api/src/stage-rule/stage-rule.module.ts
    - apps/api/src/stage-rule/stage-rule.service.spec.ts
    - apps/api/src/stage-rule/stage-rule-queue.service.spec.ts
    - apps/api/src/stage-rule/dto/create-stage-rule.dto.ts
    - apps/api/src/stage-rule/dto/upsert-rule-step.dto.ts
    - apps/api/jest.stage-rule.config.js
  modified:
    - apps/api/src/app.module.ts
decisions:
  - "executeStep leaves WhatsApp/Email send as log-only stubs; actual dispatch wired in Plan 04"
  - "CardActivity has no tenantId field in schema -- omitted from RULE_STEP_SENT activity creation"
  - "replaceSteps uses two separate calls (transaction then findFirst) to avoid Prisma transaction return type narrowing to null"
  - "jest.stage-rule.config.js uses absolute path to resolve @prisma/client from root node_modules in worktree context"
metrics:
  duration: "12 minutes"
  completed_date: "2026-04-14"
  tasks_completed: 2
  files_created: 9
  files_modified: 1
requirements: [REQ-06]
---

# Phase 02 Plan 02: StageRule CRUD Module and Queue Service Summary

StageRule CRUD API + BullMQ-backed execution queue with poller fallback -- the backend engine for D0/D+N scheduled message automation per pipeline stage.

## What Was Built

### Task 1: StageRule CRUD Module (commit 3f20d51)

**StageRuleService** (485 lines) exposes:
- `getRuleForStage` / `createRuleForStage` / `updateRule` / `replaceSteps` / `deleteRule` -- tenant-scoped CRUD
- `startRuleRun(cardId, stageId, tenantId, triggerSource)` -- creates StageRuleRun + StageRuleRunStep rows, computes scheduledFor via nextBusinessHour, enqueues each step
- `pauseRun` -- sets status=PAUSED, best-effort removes pending BullMQ jobs
- `resumeRun` -- recomputes scheduledFor from now, re-enqueues pending steps, sets status=RUNNING
- `cancelRun` -- atomically sets status=CANCELED inside transaction, best-effort removes jobs after tx
- `cancelActiveRunsForCard` -- finds all RUNNING/PAUSED runs for a card and cancels them
- `executeStep` -- called by queue worker; skips if run is CANCELED/PAUSED, creates CardActivity, marks step SENT, completes run when all steps done

**StageRuleController** (109 lines) -- 9 routes behind JwtAuthGuard + TenantGuard:
- GET /stages/:stageId/rule
- POST /stages/:stageId/rule
- PATCH /stage-rules/:id
- PUT /stage-rules/:id/steps
- DELETE /stage-rules/:id
- POST /stage-rule-runs/:runId/pause
- POST /stage-rule-runs/:runId/resume
- POST /stage-rule-runs/:runId/cancel
- POST /cards/:cardId/stage-rule/start (manual trigger, requires stageId in body)

**DTOs:** CreateStageRuleDto (isActive optional boolean), UpsertRuleStepsDto (array of RuleStepInput).

6 unit tests pass covering all run lifecycle behaviors.

### Task 2: StageRuleQueueService (commit b91ae3c)

Mirrors JourneyQueueService pattern exactly (308 lines):
- queueName = 'stage_rule_execute'
- STAGE_RULE_RUNTIME_DRIVER env var controls bullmq vs poller mode
- enqueueRuleStep(stepId, scheduledFor) -- adds BullMQ delayed job with jobId: stepId
- removeJob(stepId) -- removes delayed job; returns false if not found
- Worker processor calls StageRuleService.executeStep(job.data.stepId)
- Poller fallback (10s interval) queries PENDING StageRuleRunStep rows, marks QUEUED, calls executeStep
- Clean teardown on onModuleDestroy

5 unit tests pass covering enqueue, removeJob, poller, worker callback behaviors.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CardActivity schema has no tenantId column**
- **Found during:** Task 1 implementation
- **Issue:** Plan spec included tenantId in CardActivity.create() data but the Prisma model has no tenantId field
- **Fix:** Removed tenantId from the cardActivity.create() call
- **Files modified:** stage-rule.service.ts

**2. [Rule 1 - Bug] Prisma transaction return type narrowing**
- **Found during:** Task 1 TypeScript compilation
- **Issue:** prisma.$transaction callback returning tx.stageRule.findFirst() caused type narrowing to null
- **Fix:** Moved findFirst call outside the transaction
- **Files modified:** stage-rule.service.ts

**3. [Rule 3 - Blocker] Jest module resolution in git worktree**
- **Found during:** Task 1 test execution
- **Issue:** Worktree has no node_modules; @prisma/client needed explicit path mapping
- **Fix:** Created jest.stage-rule.config.js with absolute moduleNameMapper and modulePaths
- **Files created:** apps/api/jest.stage-rule.config.js

**4. [Rule 1 - Bug] Circular mock reference in spec TypeScript errors**
- **Found during:** Task 1 test compilation
- **Issue:** mockPrisma.$transaction circular reference rejected by TypeScript strict mode
- **Fix:** Refactored to buildMockPrisma() factory function with explicit MockPrisma type
- **Files modified:** stage-rule.service.spec.ts

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| WhatsApp send (log only) | stage-rule.service.ts ~428 | Actual dispatch wired in Plan 04 |
| Email send (log only) | stage-rule.service.ts ~433 | Actual dispatch wired in Plan 04 |

These stubs do not block the plan goal. They are intentional per plan spec ("card-move integration handled in Plan 04").

## Threat Surface Scan

All STRIDE mitigations implemented:
- T-2-03 (EoP): All 9 routes use @UseGuards(JwtAuthGuard, TenantGuard); service filters by tenantId
- T-2-04 (Tampering): Worker re-loads step from DB by id; tenant context from DB not job payload
- T-2-05 (DoS): BullMQ retry; poller marks QUEUED before execute to prevent double-processing

## Self-Check

- [x] stage-rule.service.ts exists with all 6 async methods
- [x] stage-rule-queue.service.ts exists with enqueueRuleStep and removeJob
- [x] stage-rule.controller.ts has @Post('cards/:cardId/stage-rule/start')
- [x] app.module.ts contains StageRuleModule
- [x] 11 unit tests pass (6 service + 5 queue)
- [x] Commits 3f20d51 and b91ae3c exist

## Self-Check: PASSED
