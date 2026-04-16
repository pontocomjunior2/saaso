---
phase: 05-agent-conversation-flow
plan: 04
subsystem: agent
tags: [agent, runner, orchestrator, retry, summarizer]

requires:
  - phase: 05-agent-conversation-flow
    plan: 01
    provides: structured prompt/profile, metadata columns, activity constants
  - phase: 05-agent-conversation-flow
    plan: 02
    provides: handlers, StructuredReplyGenerator, OutboundDispatcher
  - phase: 05-agent-conversation-flow
    plan: 03
    provides: AgentRetryQueue, ConversationSummarizerQueue
provides:
  - processInboundMessage thin orchestrator
  - retry payload normalization support
  - opt-out branch + optimistic update helper
  - handler/queue DI graph in AgentModule
affects: [05-06-plan]

tech-stack:
  added: []
  patterns:
    - "Single runner orchestration layer delegating to handlers and queues"
    - "Optimistic conversation update via updateMany on updatedAt"
    - "Retry payload normalization preserving inboundContent semantics"

key-files:
  created:
    - .planning/phases/05-agent-conversation-flow/05-04-SUMMARY.md
  modified:
    - apps/api/src/agent/agent-runner.service.ts
    - apps/api/src/agent/agent-runner.service.spec.ts
    - apps/api/src/agent/agent.module.ts

requirements-completed:
  - D-04
  - D-08
  - D-09
  - D-10
  - D-11
  - D-12
  - D-18
  - D-19
  - D-22
  - G8

completed: 2026-04-16
---

# Phase 05 Plan 04: Runner Orchestration Summary

Refactored `AgentRunnerService.processInboundMessage()` from the older inline reply flow into a handler-driven orchestrator. The runner now normalizes three input shapes, including retry jobs with `inboundContent`, resolves the current card/agent/conversation, applies pre-handler opt-out detection, persists USER turns, loads history, delegates structured generation, and then executes the Phase 5 cascade: parse fallback, refusal hold, handoff hard-stop, qualification, dispatch, retry enqueue, and summarizer enqueue.

The legacy keyword heuristic `shouldRequireHandoff` was removed from the runner. Handoff routing now depends on the structured model output and the dedicated `HandoffHandler`. The runner also now resolves `card.stage.pipelineId` explicitly and passes that to `QualificationHandler`, matching the schema reality that `Card` has `stageId` but not `pipelineId` directly.

`AgentModule` was expanded to register the Phase 5 handlers alongside the queue providers, and `agent-runner.service.spec.ts` was replaced with Phase 5 coverage for normalization, opt-out, held/refusal/parse branches, retry enqueue, summarizer thresholding, disclosure detection, and proactive-message preservation.

Focused verification passed:

- `pnpm jest src/agent/agent-runner.service.spec.ts src/agent/workers/agent-retry.queue.spec.ts --runInBand`

Additional structural checks confirmed the new runner contains `normalizeInbound`, `inboundContent`, `retryQueue.enqueue`, `summarizerQueue.enqueue`, `updateMany`, `DISCLOSURE_CHALLENGE_PATTERN`, and `card.stage.pipelineId`.

Global `pnpm exec tsc --noEmit` in `apps/api` remains blocked by unrelated pre-existing errors outside this plan:

- `src/lead-form/lead-form.service.spec.ts(31,15): TS2554`
- `src/whatsapp/evolution.service.spec.ts(22,7): TS2352`
