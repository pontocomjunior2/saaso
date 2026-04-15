# Phase 05: Agent Conversation Flow (Multi-turn + Qualification + Timeline) - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning
**Brainstorm session:** 2026-04-15 (design approved by user)

<domain>
## Phase Boundary

Phase 05 transforms the current stateless agent (single-turn reply) into a multi-turn conversational agent with persisted context, structured output for decision-making, hybrid qualification (agent marks, human confirms the move), unified audit timeline, and data-layer preparation for a future auditor agent.

**In scope:**
- Multi-turn memory using window + summary strategy (last N messages + `AgentConversation.summary`)
- Structured JSON output from the model: `should_respond`, `reply`, `mark_qualified`, `qualification_reason`, `suggested_next_stage_id`, `request_handoff`, `handoff_reason`
- Handler-pipeline refactor of `AgentRunnerService` (orchestrator thin, 5 isolated handlers)
- Hybrid qualification flow: agent signals `AGENT_QUALIFIED` activity + notification + suggested-next-stage button; SDR confirms the move
- Unified timeline endpoint `GET /cards/:id/timeline` merging `WhatsAppMessage`, `AgentMessage`, `CardActivity` by timestamp (read-only, no new materialized table)
- Prompt-driven fragmentation handling via `should_respond: false` (NO backend debounce — this is an explicit product decision)
- Frontend: agent editor banner IMPORTANTE about fragmentation, kanban qualified badge + 1-click suggested-stage move, timeline tab in card modal, notification type
- Audit-readiness: persist raw structured output in `AgentMessage.metadata` for every AGENT turn, plus `AGENT_HELD` / `AGENT_QUALIFIED` / `AGENT_PARSE_FALLBACK` / `AGENT_ERROR` activities

**Out of scope (explicit YAGNI):**
- Full function calling / tool use (only structured output in this phase)
- Backend message debounce (prompt-driven by design)
- Materialized `ConversationTimeline` table (read-only merge is sufficient)
- Explicit state machine on `AgentConversation` (current status enum suffices)
- The auditor agent itself (online or offline) — will be a later phase
- Immutable per-turn prompt snapshot versioning (tracked as known gap for auditor phase)

**Depends on:** Phase 03 (Evolution API, AgentRunner stub, AgentConversation/AgentMessage tables), Phase 02 (BullMQ, rule engine hooks, CardActivity, Notification module).

</domain>

<decisions>
## Implementation Decisions

### Brainstorm Answers (user-confirmed 2026-04-15)
- **D-01 (Qualification mode):** Hybrid — agent signals `mark_qualified` and human SDR confirms the stage move. Reason: preserves human control and produces the richest signal for the future auditor agent (agent suggestion vs. human decision).
- **D-02 (Memory policy):** Window + summary. Last N (default 20) `AgentMessage` records loaded raw + `AgentConversation.summary` (field already exists) refreshed periodically via BullMQ worker. Reason: best cost/quality tradeoff for 10–40 turn qualification conversations.
- **D-03 (Agent decision format):** Minimal structured output validated with Zod. No function calling / no tools in this phase. Parse failure falls back to treating the raw text as `reply` with `should_respond: true`.
- **D-04 (Fragmentation handling):** Prompt-driven via `should_respond: false`. NO backend debounce. The agent editor UI MUST carry an "IMPORTANTE" banner reminding the admin to include fragmentation-handling instructions in the agent prompt. When the model returns `should_respond: false`, runner persists the USER message, logs `AGENT_HELD`, and sends nothing.
- **D-05 (Timeline):** Read-only merge by timestamp in a new endpoint `GET /cards/:id/timeline`. No new table. Reason: data is already normalized across 3 sources; merge is cheap and avoids drift.
- **D-06 (Qualified UX):** Badge on Kanban card + notification to owner (reusing existing `notification` module with new `AGENT_QUALIFIED_READY_TO_ADVANCE` type) + 1-click "Move to [suggested stage]" button from `suggested_next_stage_id`.
- **D-07 (Auditor scope):** Explicitly out of this phase. This phase only guarantees the data is captured and auditable (see Section 5.3 of the design). Auditor gets its own phase.

### Architecture
- **D-08 (Handler pipeline):** `AgentRunnerService.processInboundMessage` becomes a thin orchestrator that delegates to 5 isolated handlers in `apps/api/src/agent/handlers/`: `ConversationHistoryLoader`, `StructuredReplyGenerator`, `QualificationHandler`, `HandoffHandler`, `OutboundDispatcher`. A sixth service `ConversationSummarizer` runs async via BullMQ. Each handler is unit-testable without mocking the whole runner. Reason: matches the existing `Agent*` module pattern (AgentService, AgentRunnerService, AgentPromptBuilder) and gives the future auditor clean plug-in points.
- **D-09 (Proactive flow preserved):** `initiateProactiveIfAssigned` (D0 entry) is NOT refactored into the pipeline — it remains a single-shot greeting without history. Scope stays minimal.
- **D-10 (Handoff keyword removal):** The current keyword heuristic (`shouldRequireHandoff` matching "humano", "atendente", ...) is REMOVED. Handoff becomes solely a model decision via `request_handoff: true`. Cleaner separation, no hidden heuristics competing with the agent prompt.
- **D-11 (Cascade order inside runner):** `request_handoff` checked FIRST (hard stop, no agent reply). `mark_qualified` is NON-terminal — the agent still sends the reply while also flagging the card. `should_respond: false` short-circuits the outbound: USER `AgentMessage` is already persisted (step 2); only `CardActivity AGENT_HELD` is added with the raw structured output in `metadata.held_output` and the `reason`. NO `AgentMessage` AGENT-role row is created for held turns (keeps conversation history a truthful record of actual messages exchanged).

### Schema (single Prisma migration `add_agent_message_metadata_and_activity_types`)
- **D-12 (`AgentMessage.metadata Json?`):** New nullable column. For AGENT-role messages, stores the raw validated structured output (`{ should_respond, mark_qualified, qualification_reason, suggested_next_stage_id, request_handoff, handoff_reason }`). For USER-role messages, left null. Critical for retroactive audit.
- **D-13 (`CardActivityType` enum additions):** `AGENT_QUALIFIED`, `AGENT_HELD`, `AGENT_PARSE_FALLBACK`, `AGENT_ERROR`. Existing values (`AGENT_RESPONSE`, `AGENT_HANDOFF`, `AGENT_HANDOFF_MANUAL`, `AGENT_RESUMED`, `AGENT_PROACTIVE_*`) remain unchanged.
- **D-14 (`CardActivity.metadata Json?`):** Verify existence in current schema; if absent, add. Needed to store `suggested_next_stage_id`, `qualification_reason`, parse-failure raw response, etc.
- **D-15 (Agent.profile JSON extension, no migration):** New optional fields `historyWindow` (default 20) and `summaryThreshold` (default 10). No DB migration — lives in existing `profile Json?`.
- **D-16 (`AgentConversation` unchanged):** `summary String?` and `status` enum already cover all needed states. No closedAt field added in this phase (out of scope; derive from status when needed).

### Structured Output Contract
```ts
// apps/api/src/agent/schemas/structured-reply.schema.ts
export const StructuredReplySchema = z.object({
  should_respond: z.boolean(),
  reply: z.string().nullable(),
  mark_qualified: z.boolean(),
  qualification_reason: z.string().nullable(),
  suggested_next_stage_id: z.string().nullable(),
  request_handoff: z.boolean(),
  handoff_reason: z.string().nullable(),
});
```
- **D-17:** Model is instructed (via a system block appended by `buildAgentCompiledPrompt`) to always return ONLY a JSON object matching this schema. `AiService` must support passing a JSON-output hint (provider-dependent). If the provider lacks native JSON mode, the generator adds `Responda apenas com JSON válido obedecendo o schema: ...` to the prompt.

### Error Handling
- **D-18 (Parse failure):** Logged + fallback to `{ should_respond: true, reply: <raw text>, mark_qualified: false, request_handoff: false }` + `AGENT_PARSE_FALLBACK` activity with raw response in metadata. Lead always receives SOME reply.
- **D-19 (AI provider failure):** No `AgentMessage` AGENT created. `AGENT_ERROR` activity logged. Retry via BullMQ `agent-retry` queue with exponential backoff (max 3 attempts). On persistent failure, notify owner with `AGENT_PERSISTENT_FAILURE` notification type.
- **D-20 (WhatsApp send failure):** Keep current behavior — error logged, activity created, AGENT message NOT persisted (prevents showing a message that never left).
- **D-21 (Summarization failure):** Job marked failed in BullMQ. Previous `summary` remains. Never affects in-flight response (runs off critical path).
- **D-22 (Race — concurrent inbounds):** Optimistic lock via `AgentConversation.updatedAt`. If the row was updated mid-processing, abort and reprocess with fresh history. A Redis distributed lock by `conversationId` is noted as future hardening if contention is observed.

### Frontend
- **D-23 (Agent editor IMPORTANTE banner):** Added at the top of the System Prompt section. Copy is in the design Section 4.1 and must be followed verbatim in Portuguese. Two optional advanced inputs: `historyWindow`, `summaryThreshold`.
- **D-24 (Kanban qualified badge):** Green pill "✓ Pronto para avançar" shown when the card has the most recent `AGENT_QUALIFIED` activity with no subsequent `MOVE` activity. Tooltip shows `qualification_reason`.
- **D-25 (Suggested-stage button):** Expanded card view primary CTA "Mover para [Stage Name] (sugerido pelo agente)" using `suggested_next_stage_id` from activity metadata. If stage deleted/invalid, fallback copy "Agente marcou como qualificado — selecione manualmente o destino" with no pre-filled target.
- **D-26 (Timeline tab):** New tab "Atendimento" inside card modal rendering `GET /cards/:id/timeline`. Cronological list with source-specific icons, filters (canal, eventos do sistema, apenas agente). Theme follows parent modal (light theme per D-12 of Phase 04).
- **D-27 (Notification type):** New `NotificationType.AGENT_QUALIFIED_READY_TO_ADVANCE` with deep link to `/kanban?card=:id`. Emitted by `QualificationHandler` via existing `NotificationService.emit`.
- **D-28 (Handoff badge existing):** Keep current red "⏸ Handoff — SDR responda" badge behavior driven by `AgentConversationStatus.HANDOFF_REQUIRED`. `toggleTakeover` flow unchanged.

### Testing
- **D-29:** Each new handler has its own unit spec (`*.spec.ts`) with ≥3 cases minimum per Section 5.2 of the design. Existing `agent-runner.service.spec.ts` is expanded (not rewritten) for integration coverage.
- **D-30:** Manual smoke test via Evolution API sandbox with fragmented inbound ("oi" → "tudo bem?" → "quero saber preço") must demonstrate `AGENT_HELD` on early fragments and a single consolidated reply on completion.

### Claude's Discretion
- Exact JSON-mode integration with `AiService` (may require provider-specific branch; OpenAI JSON mode vs Anthropic `response_format`). Planner should check current `AiService` internals.
- Exact prompt template wording for the structured-output instruction appended by `buildAgentCompiledPrompt`.
- Timeline endpoint pagination strategy (cursor by ts is fine; limit default 100).
- Whether to render `AGENT_HELD` as a visible event in the timeline by default or behind the "Eventos do sistema" filter toggle (default ON is the recommendation).
- Icon set / exact visual for timeline event types — follow existing card modal styling.

</decisions>

<specifics>
## Specific Ideas

- "Agent editor banner IMPORTANTE uses the exact ⚠️ emoji + bold 'IMPORTANTE' header. Includes a concrete example directive the admin can copy-paste into their prompt."
- "Structured output schema lives in a dedicated file so the auditor phase can import it unchanged."
- "Runner cascade order is: handoff (return) → qualified (record, continue) → respond/hold (dispatch). Documented inline with comments — it is subtle."
- "`AgentMessage.metadata` stores the raw structured output as-is, not a transformed version. Auditor phase needs the original decision surface."
- "Timeline endpoint merges by timestamp, not by conversationId — a card can span multiple conversations (handoff cycles, re-opens). Group by none; trust timestamps."
- "1-click suggested-stage button must validate the stage belongs to the same pipeline before showing. Silent fallback if invalid."
- "Summarizer runs in BullMQ queue `agent-summarize` with a single concurrency per `conversationId` to avoid concurrent summary writes."
- "No keyword-based handoff anywhere in the new flow. Even the existing `shouldRequireHandoff` method is deleted. Single source of truth is `request_handoff` from the model."

</specifics>

<canonical_refs>
## Canonical References

### Current Agent Runtime (to refactor)
- `apps/api/src/agent/agent-runner.service.ts` — `processInboundMessage` (to refactor into pipeline) and `initiateProactiveIfAssigned` (preserved as-is)
- `apps/api/src/agent/agent-prompt.builder.ts` — Prompt compilation (append structured-output instruction here)
- `apps/api/src/agent/agent.service.ts` — Agent CRUD (profile field extension lives here)
- `apps/api/src/agent/agent-runner.service.spec.ts` — Existing integration tests to expand

### Schema
- `apps/api/prisma/schema.prisma` — AgentMessage (add `metadata`), CardActivityType enum (add values), CardActivity (verify/add `metadata`), Agent.profile JSON extension (no migration)

### Integrations
- `apps/api/src/whatsapp/whatsapp.service.ts` — Inbound hook that invokes `processInboundMessage` (no change to call site, only to runner internals). Outbound `sendMessage` used by `OutboundDispatcher`.
- `apps/api/src/common/services/ai.service.ts` — `generateResponse` needs a JSON-output variant or option. Check current signature and extend minimally.
- `apps/api/src/notification/*` — Add `AGENT_QUALIFIED_READY_TO_ADVANCE` type. Reuse `NotificationService.emit`.
- `apps/api/src/card/card.service.ts` — `moveCard` (triggered by SDR clicking suggested-stage button — no change in this service; frontend just calls existing endpoint).
- BullMQ setup from Phase 02 — reuse for `agent-summarize` and `agent-retry` queues.

### Frontend
- `apps/web/src/app/agents/*` (verify exact path) — Agent editor page (add IMPORTANTE banner + advanced fields)
- `apps/web/src/components/board/KanbanBoard.tsx` — Kanban board (add qualified badge via activity lookup)
- Card modal component (locate) — add "Atendimento" tab
- `apps/web/src/stores/*` — new or extended store for timeline endpoint + qualified-state derivation

### Prior Phase Context (consult during planning)
- `.planning/phases/03-agents-formularios-canais/03-CONTEXT.md` — Phase 03 decisions (Evolution API, agent proactive stub)
- `.planning/phases/02-crm-v2-automa-o-de-r-guas/02-04-SUMMARY.md` — Card move hooks + proactive D0 integration
- `.planning/ROADMAP.md` — Phase list

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`AgentConversation` + `AgentMessage`** tables already persist full history with roles (USER/AGENT), timestamps, and `whatsAppMessageId` links. Nothing to add beyond `AgentMessage.metadata`.
- **`AgentConversation.summary`** field already exists — ready for the Summarizer worker to populate.
- **`CardActivity`** table is the system-event source of truth. Adding enum values and populating `metadata` is sufficient — no structural rework.
- **`buildAgentCompiledPrompt`** is well-factored and includes persona, objective, KB, stage classification, guardrails, etc. Only needs a new appended section for the structured-output contract.
- **`initiateProactiveIfAssigned`** (Phase 03) already handles D0 with channel fallback — preserved untouched.
- **BullMQ infrastructure** from Phase 02 is production-ready for `agent-summarize` and `agent-retry` queues.
- **`NotificationService.emit`** with tenant-scoped notifications already used across phases — add one new type.
- **`AiService.generateResponse`** currently returns a plain string. Needs a JSON-mode variant (`generateStructuredResponse<T>(prompt, userMessage, schema, options)`) — scope of one method, not a rewrite.
- **Zod** is already a project dependency (check `package.json` in planner) for schema validation.

### Established Patterns
- Prisma service + `include` validators — follow existing `agentRuntimeInclude` pattern for new queries.
- Handlers in NestJS — match existing module structure; each handler is a `@Injectable()` class.
- `CardActivity.create` call sites are inline across services — preserve that pattern in handlers (don't abstract into a new service unless repeated ≥3 times).
- Zustand stores on frontend — `create<State>((set) => ({ ... }))` + `api` from `@/lib/api` (per Phase 04 D-13).
- Kanban light theme `bg-white border-[#f0f0f0]` vs configuracoes dark theme — qualified badge and timeline tab follow Kanban light theme.

### Integration Points
- **Inbound WhatsApp** → `WhatsappService` → `AgentRunnerService.processInboundMessage` (refactored pipeline call site unchanged)
- **Card move by SDR** → `CardService.moveCard` → `initiateProactiveIfAssigned` for the new stage's agent (existing hook, unchanged)
- **Handoff** → `AgentConversation.status = HANDOFF_REQUIRED` → Kanban badge + notification
- **Qualified** → `CardActivity` `AGENT_QUALIFIED` → Kanban badge + notification + suggested-stage CTA

### Known Gaps (not fixed this phase, tracked for auditor phase)
- No immutable per-turn prompt snapshot. If admin edits the prompt, we cannot reconstruct which prompt generated which reply. Workaround note: `Agent.updatedAt` gives a coarse window; real fix is `AgentMessage.metadata.promptVersion` in a future phase.
- No Redis distributed lock on `conversationId` — current optimistic lock via `updatedAt` is sufficient for expected throughput but will need hardening under contention.

</code_context>

<deferred>
## Deferred Ideas

- **Tool use / function calling** for agent actions (schedule_followup, save_lead_field, append_note) — next iteration after structured output proves stable in production
- **Online auditor agent** (real-time coach on each reply) — overkill for now, out of roadmap
- **Offline auditor agent** (batch analysis of closed conversations with scored rubric) — next phase after this
- **Materialized `ConversationTimeline` table** — only if read-only merge becomes a measurable hot path
- **Explicit state machine** on `AgentConversation` — only if conversations need richer lifecycle states beyond current enum
- **Typing indicator** via Evolution API during agent "thinking" — UX polish, not blocking
- **Multi-agent handoff within same card** (agent A → agent B without SDR) — product decision not made
- **Immutable prompt version snapshotting per turn** — tied to auditor phase
- **Stage-advance rollback** (agent mis-qualified → SDR undo) — rely on existing card move history for now

</deferred>

---

*Phase: 05-agent-conversation-flow*
*Context gathered: 2026-04-15*
*Brainstorm artifact: user-approved in session 2026-04-15*
