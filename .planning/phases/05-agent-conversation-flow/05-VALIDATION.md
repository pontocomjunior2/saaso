---
phase: 5
slug: agent-conversation-flow
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-15
updated: 2026-04-15
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 30.x (existing `@saaso/api` config) |
| **Config file** | `apps/api/package.json` `"jest"` block |
| **Quick run command** | `pnpm --filter @saaso/api test -- --testPathPattern={pattern}` |
| **Full suite command** | `pnpm --filter @saaso/api test` |
| **Estimated runtime (full api suite)** | ~30 seconds |

Frontend tests (Plan 05-06) use the existing web app config:

| Property | Value |
|----------|-------|
| **Framework** | Vitest + React Testing Library (existing) |
| **Quick run command** | `pnpm --filter @saaso/web test -- --run --passWithNoTests` |

---

## Sampling Rate

- **After every task commit:** Run quick command scoped to changed module
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-T1 | 05-01 | 1 | D-03, D-12, D-13, D-14, D-15 | T-05-01-01 | Zod install + StructuredReplySchema strict/nullable + Prisma metadata columns + AGENT_ACTIVITY_TYPES constants | unit | `cd apps/api && pnpm jest --testPathPattern="agent/schemas/structured-reply" --passWithNoTests=false` | ❌ W0 | ⬜ pending |
| 05-01-T2 | 05-01 | 1 | D-02, D-15, D-17 | T-05-01-02 | AgentPromptProfile extensions (historyWindow, summaryThreshold, blockedTerms) + compiled-prompt structured-output block | unit | `cd apps/api && pnpm jest --testPathPattern="agent/(agent-prompt|agent.service).spec" --passWithNoTests=false` | ✅ | ⬜ pending |
| 05-01-T3 | 05-01 | 1 | D-03, D-18 | T-05-01-03 | AiService.generateStructuredResponse — ok / parse / refusal / provider / empty | unit | `cd apps/api && pnpm jest --testPathPattern="common/services/ai.service.spec" --passWithNoTests=false` | ✅ | ⬜ pending |
| 05-02-T1 | 05-02 | 2 | D-02, D-03, D-18 | T-05-02-01 | ConversationHistoryLoader.reverse + StructuredReplyGenerator fallback + AgentProviderError | unit | `cd apps/api && pnpm jest --testPathPattern="agent/handlers/(conversation-history|structured-reply)" --passWithNoTests=false` | ❌ W0 | ⬜ pending |
| 05-02-T2 | 05-02 | 2 | D-01, D-06, D-10, D-11, D-25, G3 | T-05-02-01 | QualificationHandler (never moves card; G3 stage validation) + HandoffHandler (HANDOFF_REQUIRED; no keyword heuristic) | unit | `cd apps/api && pnpm jest --testPathPattern="agent/handlers/(qualification|handoff)" --passWithNoTests=false` | ❌ W0 | ⬜ pending |
| 05-02-T3 | 05-02 | 2 | D-11, D-12, G4, G5, G6, G7 | T-05-02-02,03,04,05 | OutboundDispatcher guardrails G5→G4→G6→G7 ordering + D-12 metadata persistence + blockedTerms | unit | `cd apps/api && pnpm jest --testPathPattern="agent/handlers/outbound.dispatcher" --passWithNoTests=false` | ❌ W0 | ⬜ pending |
| 05-03-T1 | 05-03 | 2 | D-02, D-21 | T-05-03-01 | ConversationSummarizerQueue (BullMQ concurrency:1, summary write, failure preserves prior summary) | unit | `cd apps/api && pnpm jest --testPathPattern="agent/workers/conversation-summarizer" --passWithNoTests=false` | ❌ W0 | ⬜ pending |
| 05-03-T2 | 05-03 | 2 | D-19 | T-05-03-02 | AgentRetryQueue (exponential backoff 2s/8s/32s, max 3, dead-letter emits AGENT_PERSISTENT_FAILURE) | unit | `cd apps/api && pnpm jest --testPathPattern="agent/workers/agent-retry" --passWithNoTests=false` | ❌ W0 | ⬜ pending |
| 05-04-T1 | 05-04 | 3 | D-04, D-08, D-09, D-10, D-11, D-12, D-18, D-19, D-22, G8 | T-05-04-01,02,03,04,06,07,08 | processInboundMessage rewrite — normalization + cascade + opt-out + optimistic lock + stage.pipelineId resolution | unit+integration | `cd apps/api && pnpm jest --testPathPattern="agent/agent-runner.service.spec" --passWithNoTests=false` | ✅ (expand) | ⬜ pending |
| 05-04-T2 | 05-04 | 3 | D-08, D-09, D-11, D-19, D-22 | T-05-04-01..08 | agent.module DI graph + runner integration spec (≥16 cases inc. normalization + pipelineId + D-22 lock) | unit+integration | `cd apps/api && pnpm jest --testPathPattern="agent/agent-runner.service.spec" --passWithNoTests=false` | ✅ (expand) | ⬜ pending |
| 05-05-T1 | 05-05 | 2 | D-05, D-23, D-24 | T-05-05-01,02,04,05 | getCardTimeline (schema-correct: no tenantId on WhatsAppMessage/CardActivity where-clauses) + 200-item cap | unit | `cd apps/api && pnpm jest --testPathPattern="card/card.service.spec" --passWithNoTests=false` | ✅ (expand) | ⬜ pending |
| 05-05-T2 | 05-05 | 2 | D-05, D-24 | T-05-05-03 | GET /cards/:id/timeline controller + Guard + DTO validation | unit | `cd apps/api && pnpm jest --testPathPattern="card/card.controller.spec" --passWithNoTests=false` | ✅ (expand) | ⬜ pending |
| 05-05-T3 | 05-05 | 2 | D-01 | T-05-05-08,09 | latestAgentSuggestion computed from most-recent AGENT_QUALIFIED activity + invalidation on subsequent MOVE | unit | `cd apps/api && pnpm jest --testPathPattern="card/card.service.spec" --passWithNoTests=false` | ✅ (expand) | ⬜ pending |
| 05-06-T1 | 05-06 | 4 | D-05, D-12, D-24 | T-05-06-01 | ActivityTimeline TYPE_LABELS match AGENT_ACTIVITY_TYPES; StructuredReplyMetadata fields match D-17 schema verbatim | unit | `pnpm --filter @saaso/web test -- --run activity-timeline` | ❌ W0 | ⬜ pending |
| 05-06-T2 | 05-06 | 4 | D-01 | T-05-06-02 | QualifiedBadge + SuggestedStageButton consume card.latestAgentSuggestion (from Plan 05-05 T3); PATCH /cards/:id/move payload | unit | `pnpm --filter @saaso/web test -- --run qualified-badge suggested-stage-button` | ❌ W0 | ⬜ pending |
| 05-06-T3 | 05-06 | 4 | UI-SPEC Tab | T-05-06-03 | CardDetailSheet "Atendimento" tab renders unified timeline with pagination | unit | `pnpm --filter @saaso/web test -- --run card-detail-sheet` | ❌ W0 | ⬜ pending |

*Status legend:* ⬜ pending · ✅ green · ❌ red · ⚠️ flaky

---

## Wave 0 Requirements

- [x] `pnpm add zod@^3.25 zod-to-json-schema@^3.25 --filter @saaso/api` — covered in Plan 05-01 Task 1
- [x] Prisma migration: add `AgentMessage.metadata Json?` AND `CardActivity.metadata Json?` — Plan 05-01 Task 1
- [x] Test fixtures for OpenAI Responses API mocking (stubs returning `text.format.json_schema` shapes + refusal content blocks) — Plan 05-01 Task 3 spec file
- [x] Test fixtures for StructuredReply valid/invalid JSON — Plan 05-01 Task 1 schema spec
- [x] AGENT_ACTIVITY_TYPES constant file seeded — Plan 05-01 Task 1
- [x] `AgentPromptProfile` extended with `blockedTerms?: string[]` — Plan 05-01 Task 2 (additive on existing `Agent.profile` JSON column; no DB migration)
- [x] Wave 0 test scaffolds created for every ❌ W0 row above — each target Plan's Task ‎1 creates the spec file with at least one initial failing case (TDD entry point)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end multi-turn conversation via WhatsApp (Evolution API) | D-04 | Requires live channel + real WhatsApp number | Send 3 fragmented bubbles from test number; verify `should_respond:false` holds intermediate turns, final consolidated reply dispatched. Assert single AGENT row in `AgentMessage` per actual outbound. |
| Hybrid qualification UX — agent suggests, SDR confirms | D-01 | UI interaction spans notification + kanban card actions | Trigger qualification via agent response; verify notification badge in UI; open card; click SuggestedStageButton; verify card moves AND AGENT_QUALIFIED activity's `suggested_next_stage_id` no longer surfaces as pending (invalidation via CARD_MOVED). |
| Phoenix trace ingestion + PII scrubbing | D-27 | Requires Phoenix docker-compose + span inspection | Fire 1 inbound via Evolution sandbox; open Phoenix UI; verify span for `ai.generateStructuredResponse` exists; verify phone/email/CPF regex redaction in span attributes. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify command or Wave 0 dependencies noted
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (Zod install, metadata columns, fixtures, blockedTerms field, activity constants)
- [x] No watch-mode flags used in commands
- [x] Feedback latency < 30s (API suite ~30s, per-module scope ~5s)
- [x] `nyquist_compliant: true` set in frontmatter
- [x] `wave_0_complete: true` set in frontmatter (all blockers for Wave 1+ accounted for in Plan 05-01)

**Approval:** approved
