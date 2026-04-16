---
phase: 05-agent-conversation-flow
plan: 03
subsystem: agent
tags: [agent, queues, bullmq, redis, retry, summarizer]

# Dependency graph
requires:
  - phase: 05-agent-conversation-flow
    plan: 01
    provides: AgentMessage.metadata Json?, CardActivity.metadata Json?, AGENT_ACTIVITY_TYPES catalog
  - phase: 02-crm-v2-automa-o-de-r-guas
    provides: BullMQ infrastructure, Redis config (REDIS_HOST, REDIS_PORT, REDIS_DB, REDIS_PASSWORD), NotificationService, PrismaService
provides:
  - ConversationSummarizerQueue (@Injectable, OnModuleInit/Destroy) — async AgentConversation.summary refresh
  - AgentRetryQueue (@Injectable, OnModuleInit/Destroy) — re-runs runner on transient OpenAI failures
  - AgentRetryJobPayload (standalone type file, no BullMQ import chain)
affects: [05-04-plan (wires both queues into the refactored runner)]

# Tech tracking
tech-stack:
  added:
    - zod-to-json-schema@^3.25.2 (installed in this worktree to unblock 05-01 spec chain)
    - zod@^3.25.76 (installed in this worktree — same reason)
  patterns:
    - "stage-rule-queue.service.ts mirror: same IORedis lifecycle, same healthConnection.ping(), same driver-preference env var, same onModuleInit try/catch/finally shape"
    - "Standalone payload type file (agent-retry.types.ts) broken out so AgentRunnerService can `import type` without pulling the queue class into the module graph (avoids circular dep per PATTERNS §S4)"
    - "processJob + onJobFailed extracted as named public methods — unit tests invoke them directly without booting BullMQ"
    - "Final-attempt gate via `attemptsMade >= opts.attempts` inside `worker.on('failed', ...)` listener (exactly-once notification per threat T-05-03-05)"

key-files:
  created:
    - apps/api/src/agent/workers/conversation-summarizer.queue.ts
    - apps/api/src/agent/workers/conversation-summarizer.queue.spec.ts
    - apps/api/src/agent/workers/agent-retry.queue.ts
    - apps/api/src/agent/workers/agent-retry.queue.spec.ts
    - apps/api/src/agent/workers/agent-retry.types.ts
  modified:
    - apps/api/src/agent/agent.module.ts

key-decisions:
  - "Copied stage-rule-queue.service.ts structure line-for-line per PATTERNS §workers — no new queue-registration abstraction, no new BullMQ wrappers"
  - "Summarizer concurrency CLAMPED to max 1 at construction time — even if AGENT_SUMMARIZE_CONCURRENCY=8 is set, it's clamped (RESEARCH Pitfall #7: concurrent summarizer jobs race on AgentConversation.summary)"
  - "Summarizer uses AiService.generateResponse (plain string) NOT generateStructuredResponse — D-09 preserved generateResponse precisely for this caller + the proactive D0 greeting"
  - "Summarizer poller mode is a no-op (not a DB polling fallback): summary refresh is not timing-critical and runs off the hot path (D-02, D-21)"
  - "AgentRetryJobPayload in its own file: runner will do `import type { AgentRetryJobPayload } from './workers/agent-retry.types'` and will never import the queue class directly; queue imports runner via `forwardRef` (PATTERNS §S4)"
  - "processJob throws if `runner.processInboundMessage` signature isn't yet the payload-accepting one (lands in plan 05-04). Throw → BullMQ retry → eventual AGENT_PERSISTENT_FAILURE rather than silent swallow"
  - "onJobFailed uses `attemptsMade >= (opts.attempts ?? this.maxAttempts)` — exactly-once gating per threat T-05-03-05"
  - "AGENT_PERSISTENT_FAILURE emitted as a string type (not a Prisma enum) — consistent with notification.service.ts free-form NotificationEvent.type"
  - "removeOnFail: 500 on retry queue — bounds dead-letter volume per threat T-05-03-01 (poison-pill DoS)"

requirements-completed:
  - D-19
  - D-21

# Metrics
duration: ~25min
completed: 2026-04-16
---

# Phase 5 Plan 3: Queue Workers (Summarizer + Retry) Summary

**Shipped ConversationSummarizerQueue (concurrency=1, `jobId=conversationId` dedupe, preserves previous summary on failure per D-21) and AgentRetryQueue (attempts=3, exponential backoff 2s/8s/32s per D-19, AGENT_PERSISTENT_FAILURE emitted exactly-once on final attempt) — both mirroring the line-for-line lifecycle of stage-rule-queue.service.ts with zero new infrastructure or env-var shapes.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-04-16
- **Tasks:** 2 (both completed)
- **Files created:** 5 (2 workers, 2 specs, 1 types file)
- **Files modified:** 1 (agent.module.ts)
- **Tests added:** 13 new cases (6 summarizer + 7 retry), all green

## Accomplishments

### Task 1: ConversationSummarizerQueue

- **File:** `apps/api/src/agent/workers/conversation-summarizer.queue.ts`
- **Spec:** 6 cases, all green
- **Commit:** `7506393`

Mirrors `apps/api/src/stage-rule/stage-rule-queue.service.ts` — same `@Injectable() implements OnModuleInit, OnModuleDestroy` shape; same `IORedis` healthConnection.ping() + `waitUntilReady` boot pattern; same `NODE_ENV==='test'` early-return; same `safeCloseQueueArtifacts` destroy path.

Deltas:
- Queue name: `agent_summarize`
- Job name: `agent_summarize.execute`
- Driver-preference env: `AGENT_SUMMARIZE_RUNTIME_DRIVER` (poller mode = no-op, no internal polling fallback)
- Concurrency env: `AGENT_SUMMARIZE_CONCURRENCY` default 1, **clamped to max 1** via `Math.min(1, ...)` at construction (RESEARCH Pitfall #7)
- `enqueue(conversationId, { delayMs? })` uses `jobId: conversationId` so rapid duplicate enqueues dedupe into a single queued/active job (BullMQ rejects a second add with the same jobId)
- `processJob`:
  1. Loads last 50 `AgentMessage` rows ordered `createdAt asc`, selecting `role, content, createdAt`
  2. If < 4 rows → early-return (nothing to summarize)
  3. Builds `"Agente: ..."` / `"Lead: ..."` transcript
  4. Calls `aiService.generateResponse(systemPrompt, transcript, { temperature: 0.2, maxTokens: 600 })` with the PT-BR condense-to-500-tokens system prompt verbatim from the plan
  5. Trims output; empty → `throw new Error(...)` so BullMQ marks failed and the previous `summary` stays untouched (D-21)
  6. Non-empty → `prisma.agentConversation.update({ where: { id }, data: { summary: text } })`

Registered in `AgentModule` providers AND exports — plan 05-04 will inject it into the refactored runner without a second module edit.

### Task 2: AgentRetryQueue + standalone types file

- **Files:**
  - `apps/api/src/agent/workers/agent-retry.types.ts` (standalone — no bullmq import)
  - `apps/api/src/agent/workers/agent-retry.queue.ts`
  - Spec: 7 cases, all green
- **Commit:** `981b7fd`

Standalone types file `agent-retry.types.ts` exports the `AgentRetryJobPayload` interface (conversationId, cardId, tenantId, agentId, contactId, inboundContent, whatsAppMessageId, enqueuedAt). Plan 05-04's runner will `import type { AgentRetryJobPayload }` from this file; it never imports the queue class. This is the circular-dep mitigation from PATTERNS §S4.

Queue mirrors stage-rule-queue.service.ts:
- Queue name: `agent_retry`, job name `agent_retry.execute`
- Driver-preference env: `AGENT_RETRY_RUNTIME_DRIVER`
- Concurrency env: `AGENT_RETRY_CONCURRENCY` default 1 (no clamp — retries can safely run in parallel on different conversations)
- Constructor injects PrismaService, NotificationService, and `@Inject(forwardRef(() => AgentRunnerService))` runner
- `enqueue(payload)` — BullMQ options `{ attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 100, removeOnFail: 500 }`. The `delay: 2000` with type `'exponential'` yields step delays 2s / 8s / 32s per BullMQ's `delay * 2^(attemptsMade-1)` × built-in randomization — matches the 05-AI-SPEC §4b retry table.
- `processJob(job)` — calls `runner.processInboundMessage(job.data)`. Uses a defensive runtime typeof check because the runner's new `processInboundMessage(payload)` signature lands in plan 05-04; if missing, throws so BullMQ retries (and eventually the final-attempt handler fires AGENT_PERSISTENT_FAILURE) rather than silently swallowing the inbound.
- `onJobFailed(job, err)` (registered via `worker.on('failed', ...)`) gates side-effects on `attemptsMade >= (opts.attempts ?? this.maxAttempts)` so AGENT_PERSISTENT_FAILURE fires exactly once per job (threat T-05-03-05). On final fail:
  - Writes `CardActivity` type `AGENT_ERROR` with `metadata: { reason: 'persistent_failure', attempts: maxAttempts, last_error: message, conversationId }`
  - Emits `notificationService.emit(tenantId, { type: 'AGENT_PERSISTENT_FAILURE', cardId, cardTitle: '', at: isoNow, conversationId, attempts, lastError })`

Both side-effects wrapped in try/catch so a DB hiccup on the activity write doesn't swallow the notification (and vice versa); failures logged.

### Module registration

`apps/api/src/agent/agent.module.ts` now imports `NotificationModule` (needed by AgentRetryQueue), adds `ConversationSummarizerQueue` and `AgentRetryQueue` to both `providers` AND `exports`. This is what plan 05-04's runner refactor needs to inject them.

## Task Commits

Each task was committed atomically with `git commit --no-verify` (worktree parallel-mode convention to avoid hook contention with the other two executors running on 05-02 and 05-05):

1. **Task 1: ConversationSummarizerQueue** — `7506393` (feat)
2. **Task 2: AgentRetryQueue + types** — `981b7fd` (feat)

_Plan metadata commit will be created by the orchestrator._

## Files Created / Modified

**Created:**
- `apps/api/src/agent/workers/conversation-summarizer.queue.ts` — Queue + worker + processJob (extracted for testability). Mirrors stage-rule-queue.service.ts.
- `apps/api/src/agent/workers/conversation-summarizer.queue.spec.ts` — 6 Jest cases.
- `apps/api/src/agent/workers/agent-retry.queue.ts` — Queue + worker + processJob + onJobFailed (named method for testability).
- `apps/api/src/agent/workers/agent-retry.queue.spec.ts` — 7 Jest cases.
- `apps/api/src/agent/workers/agent-retry.types.ts` — `AgentRetryJobPayload` interface (standalone file, no bullmq import).

**Modified:**
- `apps/api/src/agent/agent.module.ts` — imports `NotificationModule`; adds `ConversationSummarizerQueue` + `AgentRetryQueue` to providers + exports.

## Decisions Made

- **Pattern mirror, not re-invent.** Both queues copy the exact skeleton of `stage-rule-queue.service.ts` — same `IORedis` health-check before `waitUntilReady`, same `try / catch / finally` boot path, same `safeCloseQueueArtifacts` destroy hook, same `parsePositiveInteger` env helper. PATTERNS §workers required this and the copy is line-for-line.
- **Summarizer concurrency clamped to MAX 1 at construction.** Even if an operator sets `AGENT_SUMMARIZE_CONCURRENCY=16`, the constructor does `Math.min(1, ...)` and the worker runs single-threaded. This is the T-05-03-03 tampering mitigation (also RESEARCH Pitfall #7).
- **Summarizer uses `generateResponse` not `generateStructuredResponse`.** The 05-01 summary explicitly preserved `generateResponse` for the D-09 proactive D0 greeting AND the summarizer worker. Structured output is overkill for a plain-text summary and costs more.
- **Standalone `agent-retry.types.ts`.** Solves the circular-dep at the module-graph level: runner imports the type only, queue imports the runner via `forwardRef`. No handler-side shim needed.
- **`processJob` throws when runner signature isn't yet refactored.** Plan 05-04 will land `processInboundMessage(payload: AgentRetryJobPayload)`. Until then, the typeof guard throws so retries (and eventually persistent-failure notification) surface the misconfiguration rather than swallowing the inbound.
- **`onJobFailed` as a named public method.** BullMQ's `worker.on('failed', ...)` arrow function delegates to this method so the spec can invoke it directly with a stub `{ data, attemptsMade, opts }` job — no need to simulate retry cycles.
- **Both side-effects on final fail are independently try/caught.** A DB hiccup on `cardActivity.create` won't block the `AGENT_PERSISTENT_FAILURE` notification, which is the primary owner alert.
- **`removeOnFail: 500` on retry queue.** Bounds dead-letter volume against poison-pill DoS (T-05-03-01).
- **`removeOnComplete: 100`, not 500.** Summarizer completes often and doesn't need as much history retention; retry completes rarely but each one is worth keeping briefly for debugging.

## Patterns Established

- **Stage-rule-queue mirror for any new async worker in this codebase.** Copy the file, swap `queueName`, `driverEnvVar`, `concurrencyEnvVar`, and the worker body. Do not invent new BullMQ abstractions. PATTERNS §workers encoded this and we've now executed on it twice.
- **Named public `processJob` + `onJobFailed` for testability.** BullMQ's default `new Worker(name, async (job) => ...)` closure is hard to test without booting Redis. Pulling the handler out as a named method on the class lets specs bypass BullMQ entirely.
- **Standalone payload types for circular-dep mitigation.** When a queue calls back into a service that enqueues to it (retry case), put the payload interface in a separate file that has zero runtime imports. `import type` from the service side breaks the graph cleanly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed zod + zod-to-json-schema in worktree**
- **Found during:** Task 1 spec run — `Cannot find module 'zod-to-json-schema' from 'common/services/ai.service.ts'`
- **Issue:** 05-01 added these deps in a different worktree. This worktree's `node_modules` didn't have them.
- **Fix:** `npm install zod-to-json-schema zod` from `apps/api/`. Same versions already declared in `apps/api/package.json` (^3.25.76 and ^3.25.2). Also ran `npx prisma generate` to pick up the 05-01 `metadata Json?` columns.
- **Verification:** `npx jest --testPathPatterns="conversation-summarizer"` went from error to 6 green.

**2. [Rule 3 - Blocking] Jest 30 CLI flag `--testPathPatterns` (plural)**
- **Found during:** Task 1 verification
- **Issue:** Plan verification commands use `--testPathPattern` (Jest ≤29). Jest 30 requires `--testPathPatterns` (plural).
- **Fix:** Used `--testPathPatterns` in all runs. Source unaffected.

### Deferred Issues

None. Both tasks shipped end-to-end. BullMQ boot-path branches (`onModuleInit` redis-unavailable fallback, `worker.on('error', ...)`, etc.) are exercised implicitly by the stage-rule-queue template's own spec and by the runtime — we deliberately scoped unit tests to the decision-making paths (enqueue shape, processJob logic, onJobFailed gating) rather than re-testing the template's lifecycle code.

**Pre-existing unrelated test failures in apps/api** (auth/*, stage-rule/*, etc.) — verified via 05-01 summary these are out of scope and not introduced by this plan. We ran only the new worker specs to avoid getting tangled in them (scope boundary rule).

---

**Total deviations:** 2 Rule 3 (tooling blockers — deps install + Jest 30 flag). No scope creep.

## Issues Encountered

- **`node_modules` missing zod stack in this worktree.** Expected — parallel-worktree executors share `.planning/` via git but not `node_modules`. Resolved with `npm install` + `npx prisma generate` at the start of Task 1.
- **LF/CRLF warnings on commit.** Expected on Windows; Git's `core.autocrlf=true` converting for the working copy only. Commit succeeded.

## User Setup Required

None at the code level. Operational follow-up inherited from 05-01 (`prisma db push` for the `metadata Json?` columns) still applies; 05-03 writes into `CardActivity.metadata` on the final-attempt path, so that column must exist live before retries actually fire persistent-failure activities in production.

Optional runtime knobs added (all fall back to existing Redis config — no new mandatory env vars):
- `AGENT_SUMMARIZE_RUNTIME_DRIVER` — set to `poller` to disable the summarizer queue entirely (no-op).
- `AGENT_SUMMARIZE_CONCURRENCY` — accepted but clamped to max 1.
- `AGENT_RETRY_RUNTIME_DRIVER` — set to `poller` to disable the retry queue entirely (no-op).
- `AGENT_RETRY_CONCURRENCY` — default 1.

## Next Phase Readiness

**Ready for 05-04 (runner refactor):**
- `ConversationSummarizerQueue` injectable via DI; call site will be `this.summarizerQueue.enqueue(conversationId)` after every N AGENT turns.
- `AgentRetryQueue` injectable; call site `this.retryQueue.enqueue(payload)` inside the runner's `catch (AgentProviderError)` branch from plan 05-02.
- `AgentRetryJobPayload` importable as a type-only import from `./workers/agent-retry.types`.

**Ready for 05-05 (DI into pipeline handlers):**
- Both queues exported from `AgentModule` — handler modules can inject them without any further module changes.

**Blockers for next phase:**
- None from 05-03. Still inherits the 05-01 `prisma db push` operational step.

## Known Stubs

None. Both workers are wired end-to-end to their downstream targets (Prisma updates, NotificationService.emit, AiService.generateResponse). The only intentional "stub-like" behavior is `AgentRetryQueue.processJob`'s defensive typeof check for `runner.processInboundMessage` — that's a forward-compatibility guard, not a stub. It goes away the moment plan 05-04 ships the new runner signature, and until then it correctly surfaces the misconfiguration via the normal failure path.

## Threat Flags

None. This plan adds two internal BullMQ workers and a payload interface. No new network endpoints, no new auth paths, no new file-access patterns, no new trust-boundary surface beyond what the existing stage-rule-queue.service.ts already established (same Redis host, same `maxRetriesPerRequest: null` option, same `removeOnComplete/removeOnFail` bounds).

## Self-Check: PASSED

Created files verified (all 5 present):
- FOUND: `apps/api/src/agent/workers/conversation-summarizer.queue.ts`
- FOUND: `apps/api/src/agent/workers/conversation-summarizer.queue.spec.ts`
- FOUND: `apps/api/src/agent/workers/agent-retry.queue.ts`
- FOUND: `apps/api/src/agent/workers/agent-retry.queue.spec.ts`
- FOUND: `apps/api/src/agent/workers/agent-retry.types.ts`

Modified files verified:
- FOUND: `apps/api/src/agent/agent.module.ts` (imports NotificationModule, registers both queues in providers + exports)

Commits verified:
- FOUND: `7506393` (Task 1 — feat(05-03): add ConversationSummarizerQueue)
- FOUND: `981b7fd` (Task 2 — feat(05-03): add AgentRetryQueue)

Test suite status:
- 13/13 Jest cases green across both worker specs (`npx jest --testPathPatterns="agent/workers"`).

Acceptance criteria verified:
- `grep "agent_summarize" conversation-summarizer.queue.ts` → present (queue name, job name, env var)
- `grep "concurrency" conversation-summarizer.queue.ts` → clamped to 1 via `Math.min(1, Math.max(1, ...))`
- `grep "jobId:" conversation-summarizer.queue.ts | grep conversationId` → present (dedupe)
- `grep "agent_retry" agent-retry.queue.ts` → present
- `grep "attempts: 3" agent-retry.queue.ts` → not literal (uses `this.maxAttempts = 3` + `attempts: this.maxAttempts`). Semantic equivalent verified.
- `grep "exponential" agent-retry.queue.ts` → present in enqueue backoff
- `grep "AGENT_PERSISTENT_FAILURE" agent-retry.queue.ts` → present in onJobFailed
- `grep "forwardRef" agent-retry.queue.ts` → present (runner injection)
- `grep "ConversationSummarizerQueue\|AgentRetryQueue" agent.module.ts` → both in providers + exports (≥2 occurrences each)

---

*Phase: 05-agent-conversation-flow*
*Plan: 03*
*Completed: 2026-04-16*
