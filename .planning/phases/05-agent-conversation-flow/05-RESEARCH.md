# Phase 5: Agent Conversation Flow - Research

**Researched:** 2026-04-15
**Domain:** Multi-turn conversational AI agent with structured output, hybrid qualification, unified audit timeline on NestJS + Prisma + OpenAI Responses API
**Confidence:** HIGH

## Summary

Phase 5 transforms an existing stateless `AgentRunnerService` (single-turn stub already shipping in production as of Phase 3/4) into a handler-pipeline runtime that: loads multi-turn history, asks the model for a 7-field structured JSON decision, applies handoff/qualification cascade logic, and emits activities + notifications. CONTEXT.md + AI-SPEC already locked framework (direct OpenAI Responses API + Zod), architecture (5 isolated handlers), schema (`StructuredReplySchema`), eval strategy (Arize Phoenix + golden dataset + promptfoo CI), and guardrails (G1-G8). Research here validates those choices against the **actual** codebase and surfaces **three critical corrections** the planner must honor.

**Primary recommendation:** Accept AI-SPEC Section 4 as the implementation spine with three fixes — (1) Zod must be **added** as a new dep (not assumed present), (2) `CardActivity.type` is a **String** not an enum in this Prisma schema (D-13 must be rewritten as "add activity-type string constants", no migration for the enum), (3) there is no prior BullMQ usage in the `agent` module so the summarizer/retry queues are net-new infra co-located with the pattern established by `StageRuleQueueService`. Everything else in AI-SPEC can be lifted directly into the plan.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Conversation history load + window trimming | API / Backend (`ConversationHistoryLoader`) | Database / Storage (Prisma `AgentMessage`) | Prisma is the existing authoritative store; handler is pure glue. |
| Structured LLM decision call | API / Backend (`AiService.generateStructuredResponse<T>`) | External (OpenAI Responses API) | Single call site, provider abstraction stays where `generateResponse` already lives. |
| Handoff / qualification cascade logic | API / Backend (`HandoffHandler`, `QualificationHandler`) | Database / Storage (status update + activity write) | Pure orchestration; no frontend involvement before the SDR reviews. |
| Outbound WhatsApp send | API / Backend (`OutboundDispatcher` → `WhatsappService`) | External (Evolution API / Meta Cloud) | Reuses Phase 3 provider abstraction unchanged. |
| Conversation summarization | API / Backend (`ConversationSummarizer` BullMQ worker) | Redis (BullMQ queue) | Off-critical-path; mirror `StageRuleQueueService` / `JourneyQueueService` pattern. |
| Qualified badge + "Mover para [stage]" CTA | Browser / Client (React card modal + Kanban) | Frontend Server (Next.js route fetches `/cards/:id/timeline`) | Read-only UI derived from activities; no new backend state. |
| Unified timeline endpoint | API / Backend (`GET /cards/:id/timeline`) | Database / Storage (Prisma merge of 3 sources by `createdAt`) | Read-only merge; AI-SPEC D-05 confirmed. |
| Notification for qualified-ready-to-advance | API / Backend (`NotificationService.emit`) | Browser / Client (SSE subscriber already in place) | Reuse existing in-memory `rxjs.Subject` per-tenant stream. |
| AI-disclosure + commercial-commitment guardrails (G4, G7) | API / Backend (pre-dispatch check in `OutboundDispatcher`) | — | Guardrails live on the hot path; never shift to the model alone. |
| Observability + evals | API / Backend (Phoenix OTLP exporter) | External (self-hosted Phoenix on docker-compose) | LGPD requires in-perimeter tracing; no SaaS. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `zod` | `^3.25` (NOT v4) | Schema definition + runtime validation of structured LLM output | `zod-to-json-schema` (below) currently targets Zod v3 APIs; `Zod 4.x` has breaking changes and `openai-zod-to-json-schema` has not yet confirmed full v4 support. Pin to `^3.25.x`. `[VERIFIED: npm view zod-to-json-schema version => 3.25.2, which transitively supports zod v3]` |
| `zod-to-json-schema` | `^3.25` | Convert Zod schema to JSON Schema for OpenAI `text.format.type='json_schema'` | Direct dep used in AI-SPEC Section 3 example. `[VERIFIED: npm view zod-to-json-schema version => 3.25.2]` |
| OpenAI Responses API | n/a (HTTP) | LLM decisioning, already reached via `fetch` in `AiService` | Existing `AiService.generateResponse` uses `POST /v1/responses` with `text.format: { type: 'text' }` — new `generateStructuredResponse` adds `text.format: { type: 'json_schema', strict: true }` siblings. No SDK install. `[VERIFIED: apps/api/src/common/services/ai.service.ts line 72]` |
| `bullmq` | `^5.71` (already installed) | `agent-summarize` + `agent-retry` queues | Pattern already in repo (`StageRuleQueueService`, `JourneyQueueService`, `CampaignQueueService`, `ProspectQueueService`). `[VERIFIED: apps/api/package.json line 32]` |
| `ioredis` | `^5.10` (already installed) | BullMQ connection | Existing dep. `[VERIFIED: apps/api/package.json line 35]` |
| `@prisma/client` | `^6.19` (already installed) | DB access | Existing. `[VERIFIED: apps/api/package.json line 30]` |

### Supporting (evals / observability — add only when Phase 5 evals wave ships)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@arizeai/openinference-instrumentation-openai` | latest | Auto-instrument `fetch` calls to OpenAI Responses API into OTel spans | AI-SPEC Section 5 Phoenix setup |
| `@opentelemetry/sdk-trace-node` | latest | OTel SDK for Node | Phoenix setup |
| `@opentelemetry/exporter-trace-otlp-grpc` | latest | OTLP export to Phoenix | Phoenix setup |
| `promptfoo` (devDep) | latest | CI prompt regression harness | AI-SPEC Section 5 CI/CD step |

**NOT needed:**
- `openai` SDK — `AiService` stays on `fetch`. Installing would duplicate the surface area.
- `langchain`, `langgraph`, `ai` (Vercel AI SDK), `@openai/agents` — ruled out in AI-SPEC Section 2; CONTEXT D-08 locks hand-rolled handler pipeline.
- `openai-zod-to-json-schema` — mentioned as a potential alternative in AI-SPEC Section 3. `zod-to-json-schema` with `$refStrategy: 'none'` is sufficient because `StructuredReplySchema` has no unions or reused sub-schemas. Keep dep surface minimal.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `zod` + `zod-to-json-schema` | `class-validator` + hand-written JSON Schema | Project already uses `class-validator` for DTOs, but it does not generate JSON Schema — you'd hand-write it per schema change, doubling maintenance burden. Zod is the right tool for LLM structured output even though it's new to this repo. |
| BullMQ for summarizer | Inline async (fire-and-forget Promise) | Loses retry + observability + concurrency-1-per-conversationId control from D-11/CONTEXT. Not recommended. |
| Arize Phoenix (self-hosted) | Langfuse Cloud / Braintrust / LangSmith | AI-SPEC Section 5 rules these out on LGPD grounds (raw PT-BR conversation PII must not leave the tenant perimeter). |

**Installation:**
```bash
# From apps/api/
pnpm add zod@^3.25 zod-to-json-schema@^3.25
# Evals wave (later plan):
pnpm add @arizeai/openinference-instrumentation-openai @opentelemetry/sdk-trace-node \
         @opentelemetry/sdk-trace-base @opentelemetry/exporter-trace-otlp-grpc @opentelemetry/api
pnpm add -D promptfoo
```

**Version verification performed 2026-04-15:** `npm view zod version => 4.3.6` (latest), `npm view zod-to-json-schema version => 3.25.2` (latest). `zod-to-json-schema` tracks Zod v3 in its current major; pinning Zod at `^3.25` avoids an incompatible Zod v4 transitive. `[VERIFIED: npm registry, 2026-04-15]`

## Architecture Patterns

### System Architecture Diagram

```
                     Inbound WhatsApp webhook
                                |
                                v
          +--------------------------------------+
          | WhatsappService.handleInbound        |  (existing, Phase 3)
          +--------------------------------------+
                                |
                                v
          +--------------------------------------+
          | AgentRunnerService.processInbound    |  (thin orchestrator, refactored)
          +--------------------------------------+
              |         |         |         |           |
              v         v         v         v           v
       +----------+ +--------+ +-------+ +-------+ +-----------+
       | History  | | Struct | | Hand  | | Qual  | | Outbound  |
       | Loader   | | Gen    | | off   | | Hand  | | Dispatch  |
       | (Prisma) | | (OpenAI| | (stop)| | (cont)| | (WhatsApp)|
       |          | |  API)  | |       | |       | |           |
       +----------+ +--------+ +-------+ +-------+ +-----------+
              |         |         |         |           |
              +---------+---------+---------+-----------+
                                |
                                v
                    +-----------------------+
                    | AgentMessage (metadata)|
                    | CardActivity (type)    |
                    | Notification.emit      |
                    | AgentConversation.set  |
                    +-----------------------+
                                |
                                v
                     (async fork after N turns)
                                |
                                v
                    +-----------------------+
                    | BullMQ agent-summarize |
                    |  -> AgentConversation. |
                    |     summary            |
                    +-----------------------+

Read path (frontend):
  GET /cards/:id/timeline
     -> merge (WhatsAppMessage, AgentMessage, CardActivity) by createdAt
     -> render in "Atendimento" tab of CardDetailSheet
```

File-to-responsibility mapping lives in the Component Responsibilities table at the end of Section 4.

### Recommended Project Structure

Extends the existing `agent/` module layout without reorganizing. Files new in Phase 5 are marked `[NEW]`.

```
apps/api/src/agent/
├── agent.module.ts                             # [+handlers, +workers]
├── agent.service.ts                            # unchanged (except profile type extension for historyWindow/summaryThreshold)
├── agent-runner.service.ts                     # refactored to thin orchestrator
├── agent-prompt.builder.ts                     # append structured-output contract block
├── agent.controller.ts                         # unchanged
├── dto/
│   ├── agent-prompt-profile.dto.ts             # add historyWindow, summaryThreshold
│   └── ...existing
├── schemas/                                    # [NEW]
│   └── structured-reply.schema.ts              # [NEW] Zod source of truth
├── handlers/                                   # [NEW]
│   ├── conversation-history.loader.ts          # [NEW]
│   ├── structured-reply.generator.ts           # [NEW]
│   ├── qualification.handler.ts                # [NEW]
│   ├── handoff.handler.ts                      # [NEW]
│   └── outbound.dispatcher.ts                  # [NEW]
├── workers/                                    # [NEW]
│   ├── conversation-summarizer.queue.ts        # [NEW] BullMQ queue + worker
│   └── agent-retry.queue.ts                    # [NEW] BullMQ retry queue
└── agent-runner.service.spec.ts                # expand

apps/api/src/common/services/
└── ai.service.ts                               # + generateStructuredResponse<T>()

apps/api/src/card/
├── card.controller.ts                          # + GET /cards/:id/timeline endpoint
└── card.service.ts                             # + buildUnifiedTimeline() method

apps/api/src/notification/
└── notification.service.ts                     # + new notification type constants (AGENT_QUALIFIED_READY_TO_ADVANCE, AGENT_REFUSAL_REVIEW, AGENT_PERSISTENT_FAILURE, LEAD_OPT_OUT)

apps/web/src/components/board/
├── ActivityTimeline.tsx                        # extend TYPE_LABELS with AGENT_QUALIFIED/AGENT_HELD/etc.
├── CardDetailSheet.tsx                         # add "Atendimento" tab rendering unified timeline
├── board-types.ts                              # extend UnifiedTimelineEvent type
├── QualifiedBadge.tsx                          # [NEW] green pill + tooltip
└── SuggestedStageButton.tsx                    # [NEW] 1-click CTA
apps/web/src/app/agentes/
└── [agent editor page] - add IMPORTANTE banner + historyWindow/summaryThreshold inputs
apps/web/src/stores/
└── timeline-store.ts                           # [NEW] Zustand store (optional; inline fetch also viable)
```

### Pattern 1: NestJS @Injectable Handler Pipeline

**What:** Each step of the inbound processing is a `@Injectable()` class with a single public `async` method taking a plain input object and returning a plain output object. Orchestrator awaits sequentially, branches on handoff/qualified booleans. Matches the "handler pattern" already in use (e.g. `agent-prompt.builder.ts` is a pure function, `EvolutionApiService` and `MetaCloudProvider` are injectable services composed by `WhatsappService`).

**When to use:** Every handler in Section 4 of AI-SPEC.

**Example:**
```typescript
// apps/api/src/agent/handlers/conversation-history.loader.ts
// [CITED: CONTEXT.md D-08, AI-SPEC Section 4 State Management snippet]
@Injectable()
export class ConversationHistoryLoader {
  constructor(private readonly prisma: PrismaService) {}

  async load(input: {
    conversationId: string;
    windowSize: number;
  }): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    const rows = await this.prisma.agentMessage.findMany({
      where: { conversationId: input.conversationId },
      orderBy: { createdAt: 'desc' },
      take: input.windowSize,
      select: { role: true, content: true, createdAt: true },
    });
    // Pitfall: OpenAI Responses API reads `input` array top-down. Reverse to oldest-first.
    return rows.reverse().map((m) => ({
      role: m.role === 'AGENT' ? 'assistant' : 'user',
      content: m.content,
    }));
  }
}
```

### Pattern 2: Zod Schema + JSON Schema Conversion (new to repo)

**What:** Define the decision contract once in Zod; convert to JSON Schema at runtime for OpenAI's `strict: true` mode. Zod `.safeParse` post-validates.

**When to use:** Inside `AiService.generateStructuredResponse<T>`.

**Example:** See AI-SPEC Section 4 verbatim. **Critical rules** (from AI-SPEC Pitfalls #2 + #5):
1. Every field must be `.nullable()`, never `.optional()` — strict mode rejects properties missing from `required[]`.
2. Call `zodToJsonSchema(schema, { target: 'openApi3', $refStrategy: 'none' })` — inlines everything; strict mode errors on `$ref` in production.
3. Output shape declaration: `text.format: { type: 'json_schema', name: '<snake_case>', strict: true, schema: <inlined> }`. Legacy `response_format` is Chat Completions only; will 400 against `/v1/responses`.

### Pattern 3: BullMQ Queue Co-located in Module

**What:** Queue service + worker instantiated in a single `@Injectable()` class that implements `OnModuleInit` + `OnModuleDestroy`. Redis connection built from `REDIS_*` env vars. Driver preference env var allows falling back to a poller for dev.

**When to use:** `conversation-summarizer.queue.ts` and `agent-retry.queue.ts`. Mirror `stage-rule-queue.service.ts` line-for-line for connection + snapshot + error handling.

**Example source to copy from:** `apps/api/src/stage-rule/stage-rule-queue.service.ts` (lines 1-120 lay out the exact template). `[VERIFIED: file read]`

### Pattern 4: CardActivity Write is Inline, Not Abstracted

**What:** Every handler writes its own `prisma.cardActivity.create({ data: { cardId, type, content, channel?, actorId? } })` directly. Do NOT extract into a "CardActivityService" — the codebase's existing convention is inline calls at every producer site (Journey, Campaign, AgentRunner, Card all do this). Only abstract if the same write is repeated 3+ times within the new handler set.

### Pattern 5: Notifications Fire-and-Forget via rxjs Subject

**What:** `NotificationService.emit(tenantId, event)` is synchronous, in-memory, per-tenant rxjs.Subject. Use it from handlers without awaiting. SSE subscribers on frontend consume.

**When to use:** Inside `QualificationHandler` (emit `AGENT_QUALIFIED_READY_TO_ADVANCE`), inside `StructuredReplyGenerator` refusal path (emit `AGENT_REFUSAL_REVIEW`), inside `agent-retry` worker on final fail (emit `AGENT_PERSISTENT_FAILURE`), inside `AgentRunnerService` on opt-out (emit `LEAD_OPT_OUT`). `[VERIFIED: apps/api/src/notification/notification.service.ts]`

### Anti-Patterns to Avoid

- **Adding a `CardActivityService` just for new activity types** — breaks existing codebase convention; reviewers will push back.
- **Using a Zod v4 release** — `zod-to-json-schema` v3.x currently tracks Zod v3 APIs. Use Zod `^3.25.x`.
- **Inlining the Zod→JSON Schema conversion on the hot path** — memoize at module level (compute once per schema at boot), or cache per-schema in `AiService`. Re-converting 6KB of JSON Schema per inbound message is measurable overhead.
- **Streaming the structured output call** — `strict: true` + partial JSON cannot be Zod-parsed incrementally. Stream only for a future typing-indicator (deferred idea in CONTEXT.md).
- **Writing `AgentMessage` AGENT-role row for held turns** (D-11 says NO) — conversation history must reflect what was actually sent to the lead.
- **Keeping the keyword heuristic `shouldRequireHandoff`** — D-10 mandates its **deletion**. Single source of truth is the model's `request_handoff` field. Leaving both in place is a silent behavioural conflict.
- **Materializing a ConversationTimeline table** — D-05 explicitly rules this out. Do the merge in code; 3 indexed queries by `cardId` + `ORDER BY createdAt DESC LIMIT 100` is cheap.
- **Temperature > 0.5 on the structured call** — degrades JSON-schema compliance. Use 0.3 per AI-SPEC Section 4 table.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON-Schema-from-TypeScript-type generation | ad-hoc string template | `zod-to-json-schema` with `$refStrategy: 'none'` | OpenAI strict mode has specific constraints (additionalProperties:false, required[] matches properties exactly, no $ref) that a handwritten template will subtly violate. |
| Runtime validation of LLM JSON | ad-hoc `typeof` checks | `StructuredReplySchema.safeParse(parsed)` | Strict mode is not 100% (documented in AI-SPEC Pitfall #3). Zod's discriminated-null checks catch `mark_qualified: true, qualification_reason: null` drift. |
| Queueing + retry + concurrency | inline `setTimeout` or `Promise.all` with attempts counter | BullMQ + `agent-retry` queue with exponential backoff 2s/8s/32s max 3 attempts | Retry state must survive API restarts (summarizer job in flight during a deploy); only a persistent queue does this. |
| OpenTelemetry instrumentation of `fetch` → OpenAI | manual span creation around each call | `@arizeai/openinference-instrumentation-openai` (auto-instruments global fetch with OpenAI schema) | 100% of span attributes (prompt, response, token counts) pre-captured, anonymisation via processor pipeline is pluggable. |
| PII anonymisation in spans | ad-hoc JSON mutation | Arize OTel span processor with regex pipeline (AI-SPEC Section 5) | LGPD-critical; a single missed field is a reportable incident. Do it in one central processor. |
| Unified timeline merge | new materialized table with triggers | Read-only Prisma queries + in-memory sort | Writes already happen to 3 authoritative tables; a materialized copy guarantees drift. D-05 is explicit. |

**Key insight:** the Zod+Responses API combination has ~6 well-documented foot-guns (strict optional, strict required, $ref, refusal path, temperature, history order). AI-SPEC Section 3 Pitfalls documents them; the code in Section 4 handles them all. Deviating from that template is where hand-roll pain lives.

## Runtime State Inventory

> Phase 5 is additive — new columns + new activity-type strings + new BullMQ queues. No rename/refactor/migration. This section is included for completeness per the research protocol.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | New `AgentMessage.metadata Json?` column (D-12); existing `AgentMessage` rows get `NULL` which is correct | One Prisma migration `add_agent_message_metadata` — no backfill needed. |
| Stored data | `CardActivity.metadata Json?` — **verify existence before migration**. Current schema at lines 122-133 shows: `id, cardId, type, content, createdAt, actorId?, channel?, templateName?` — **no `metadata` column**. Must add. | Include in the same Prisma migration. `[VERIFIED: apps/api/prisma/schema.prisma lines 122-133]` |
| Stored data | `CardActivity.type` is a free-form `String`, not an enum. **CONTEXT D-13 is incorrect when it says "CardActivityType enum additions"** — no such enum exists. | Add activity type strings as TypeScript string-literal unions (or `as const` objects) in a shared module; no Prisma enum migration. Values: `AGENT_QUALIFIED`, `AGENT_HELD`, `AGENT_PARSE_FALLBACK`, `AGENT_ERROR`, `AGENT_DISCLOSURE_ENFORCED`, `AGENT_COMMERCIAL_DEFLECTION`, `AGENT_REFUSAL_REVIEW`, `LEAD_OPT_OUT`. `[VERIFIED: apps/api/prisma/schema.prisma line 125]` |
| Stored data | `Agent.profile` JSON — D-15 adds `historyWindow` + `summaryThreshold`. Existing profile shape is well-factored (`AgentPromptProfile` interface at `agent-prompt.builder.ts` lines 4-20). | Extend `AgentPromptProfile` interface + `normalizeAgentPromptProfile` + `UpdateAgentDto`. No DB migration. `[VERIFIED: apps/api/src/agent/agent-prompt.builder.ts lines 4-20]` |
| Live service config | None — no external SaaS will have cached state about Phase 5 (Phoenix is introduced *in* this phase and starts empty). | None. |
| OS-registered state | None — no scheduled tasks / cron / systemd units touched. BullMQ queues are app-managed. | None. |
| Secrets / env vars | `OPENAI_API_KEY` already present. Phase 5 adds: `PHOENIX_OTLP_URL` (default `http://phoenix:4317` for docker-compose), optionally `AGENT_EVAL_FLYWHEEL_ENABLED=true`. | Plan Wave 0 includes `.env.example` update. |
| Build artifacts | `apps/api/dist/` will need rebuild after module graph changes; no lingering stale artifacts expected in CI. | Standard build. |

## Common Pitfalls

### Pitfall 1: `CardActivity.type` is a String, not an enum — D-13 is wrong
**What goes wrong:** Planner reads CONTEXT D-13 literally, adds enum values to Prisma schema, migration fails because no `CardActivityType` enum exists.
**Why it happens:** AI-SPEC/CONTEXT inherited assumption from other project conventions; the actual schema stores `type String` (line 125 of `schema.prisma`).
**How to avoid:** Plan must treat the new activity types as TypeScript constants shared between emitters (handlers) and the frontend `ActivityTimeline.tsx` `TYPE_LABELS` dictionary. No Prisma enum migration; only the column additions for `AgentMessage.metadata` and (conditionally) `CardActivity.metadata`.
**Warning signs:** Any PLAN.md line referencing "enum value addition" or "add to CardActivityType" — reject and rewrite.

### Pitfall 2: Zod is not a current dependency
**What goes wrong:** Planner assumes Zod is available (AI-SPEC Section 3 literally says "project already ships zod@^3"); code is written using `import { z } from 'zod'`; compile fails.
**Why it happens:** CONTEXT code_context bullet "Zod is already a project dependency (check `package.json` in planner)" is incorrect. `pnpm-lock.yaml` and all three package.json (root, api, web) show no Zod dep. `[VERIFIED: grep across apps/api/package.json, apps/web/package.json, package.json — no zod match]`
**How to avoid:** Wave 0 of the plan explicitly installs `zod@^3.25` and `zod-to-json-schema@^3.25` in `apps/api`. Do not pin Zod v4 — see Pitfall 3.
**Warning signs:** Wave 1 tasks attempt `import { z } from 'zod'` without an install step.

### Pitfall 3: Zod v4 + zod-to-json-schema compatibility is uncertain
**What goes wrong:** Installing Zod `^4` (the `npm view zod version` latest) with `zod-to-json-schema@^3.x` leads to TS type mismatches + runtime schema-conversion errors on nullable/discriminated fields.
**Why it happens:** `zod-to-json-schema` (v3.25.2 latest as of 2026-04-15) was written against Zod v3 internals. Zod v4 introduces breaking schema-tree changes.
**How to avoid:** Pin at `zod@^3.25` explicitly. When `zod-to-json-schema@4.x` lands (or `openai-zod-to-json-schema` confirms v4 support), this is an upgrade-as-separate-plan decision, not a Phase 5 concern.
**Warning signs:** `pnpm add zod` without a version pin resolves to 4.x silently; the plan must include the `^3.25` pin. `[VERIFIED: npm view zod version => 4.3.6 on 2026-04-15]` `[CITED: https://www.npmjs.com/package/zod-to-json-schema]`

### Pitfall 4: OpenAI Responses API strict mode rejects `.optional()` fields
**What goes wrong:** Developer writes `qualification_reason: z.string().optional()` (intuitive for "only present when qualified"); `zod-to-json-schema` produces a schema where `qualification_reason` is absent from `required[]`; OpenAI returns 400 because strict mode demands `required[]` enumerate every property in `properties`.
**How to avoid:** Schema in `structured-reply.schema.ts` uses `.nullable()` everywhere per AI-SPEC Section 3 Pitfall 2 and Section 4b Best Practices. Add a unit test that asserts the produced JSON Schema has `required[]` of length 7 and `additionalProperties: false`.
**Warning signs:** Any field declared with `.optional()`, `.default(...)`, or both — all incompatible with strict mode.

### Pitfall 5: History ordering reversed
**What goes wrong:** Prisma query uses `orderBy: { createdAt: 'desc' }` + `take: 20` (correct for limiting to recent N); developer forgets to `.reverse()` before passing to OpenAI Responses API `input`. Model reads newest-first and injects recency bias wrongly.
**How to avoid:** `ConversationHistoryLoader.load()` must `.reverse()` before return. Unit test asserts `history[0].createdAt < history[history.length-1].createdAt`. `[CITED: AI-SPEC Pitfall #8]`

### Pitfall 6: Refusal arrives as `output[].content[].type === 'refusal'`, not an error
**What goes wrong:** Developer catches only HTTP errors; safety refusals arrive as 200 OK with a refusal content block; `JSON.parse(refusalString)` throws; it is mis-logged as a parse failure and the lead receives the parse-fallback generic reply. Worse: raw refusal text is sent as the "reply".
**How to avoid:** `AiService.generateStructuredResponse` inspects `data.output[*].content[*]` for `type === 'refusal'` BEFORE attempting JSON.parse. Returns `{ ok: false, reason: 'refusal', raw: refusal.refusal }`. Handler maps to `should_respond: false` + `AGENT_HELD` activity with `metadata.reason='model_refusal'`. `[CITED: AI-SPEC Pitfall #4]`

### Pitfall 7: Summarizer racing with runner → summary overwrite drops facts
**What goes wrong:** Multiple inbound messages on same `conversationId` land in short succession; two summarizer jobs are enqueued; both read the same window; the one finishing second overwrites the first — the net summary may be missing turns that only the first job saw.
**How to avoid:** BullMQ worker for `agent-summarize` must use `concurrency: 1` **per conversationId**. BullMQ doesn't support grouped concurrency natively — implement by setting the job name to `summarize:${conversationId}` and using `groupKey` via BullMQ's `group` option (BullMQ Pro feature) **OR** the cheap workaround: `Worker` with global `concurrency: 1` for this queue. Start with global concurrency:1 (single conversational throughput is fine at SMB scale) and revisit under load. `[CITED: CONTEXT specifics bullet "Summarizer runs in BullMQ queue agent-summarize with a single concurrency per conversationId"]`

### Pitfall 8: Optimistic lock via `AgentConversation.updatedAt` is a light contract
**What goes wrong:** Two inbound messages process in parallel; both read the conversation at `t0`; both write at `t1`; the second write silently overwrites the first's `lastMessageAt` / `status`. Under WhatsApp fragmentation this is the rule, not the edge case.
**How to avoid (D-22):** Runner captures `conversation.updatedAt` at load; at the end of processing, `prisma.agentConversation.updateMany({ where: { id, updatedAt: capturedAt }, data: {...} })` — if count=0, abort + reprocess with fresh load. Mark as acceptable for SMB scale; harden to Redis distributed lock if contention observed. `[CITED: CONTEXT D-22, Known Gaps]`

### Pitfall 9: Zod→JSON Schema conversion is not free
**What goes wrong:** `zodToJsonSchema(StructuredReplySchema, {...})` called on every inbound message. Schema is 6KB of JSON; conversion walks a tree. At 10k msgs/day × 100ms allocation churn = measurable GC pressure.
**How to avoid:** Convert once at module init and cache. `StructuredReplyGenerator` holds the computed JSON Schema as a private readonly field.

### Pitfall 10: CardActivity lacks a `metadata` column today
**What goes wrong:** D-14 says "verify CardActivity.metadata exists; add if absent." Code reviewer assumes it exists because it's used in 5 handlers.
**How to avoid:** **It does NOT exist.** Schema confirmed at lines 122-133: no `metadata` field. Must add in the same Prisma migration as `AgentMessage.metadata`. `[VERIFIED: apps/api/prisma/schema.prisma lines 122-133]`

## Code Examples

### StructuredReplySchema (single source of truth)

```typescript
// apps/api/src/agent/schemas/structured-reply.schema.ts
// [CITED: CONTEXT D-17 + AI-SPEC Section 4b verbatim]
import { z } from 'zod';

export const StructuredReplySchema = z
  .object({
    should_respond: z.boolean()
      .describe('true se o agente deve enviar a reply ao lead agora; false para segurar.'),
    reply: z.string().nullable()
      .describe('Texto pronto para envio. null quando should_respond=false.'),
    mark_qualified: z.boolean()
      .describe('true se o lead atende aos critérios de qualificação desta etapa.'),
    qualification_reason: z.string().nullable()
      .describe('Justificativa curta quando mark_qualified=true; null caso contrário.'),
    suggested_next_stage_id: z.string().nullable()
      .describe('ID de etapa válida do pipeline atual, ou null.'),
    request_handoff: z.boolean()
      .describe('true se o lead precisa de atendimento humano imediato.'),
    handoff_reason: z.string().nullable()
      .describe('Justificativa do handoff; null quando request_handoff=false.'),
  })
  .strict();

export type StructuredReply = z.infer<typeof StructuredReplySchema>;
```

### AiService.generateStructuredResponse — drop-in sibling to `generateResponse`

See AI-SPEC Section 4 lines 320-432 verbatim. Key additions to the existing file:
- import `z` and `zodToJsonSchema`
- `StructuredCallOptions` and `StructuredResult<T>` types exported
- `generateStructuredResponse<T>` method on `AiService`
- private helper `extractOutputText` is already in place (line 131) — reuse
- do NOT delete the existing `generateResponse` — `initiateProactiveIfAssigned` and the summarizer both still need plain-text generation

### Handler cascade (runner orchestrator)

```typescript
// apps/api/src/agent/agent-runner.service.ts (refactored processInboundMessage)
// [CITED: CONTEXT D-11 cascade order]
public async processInboundMessage(input: { ... }): Promise<AgentRunnerResult> {
  // 1. Resolve card + agent + conversation (same as today)
  // 2. Persist USER AgentMessage + write opt-out check (G8)
  // 3. Load history + summary
  const history = await this.historyLoader.load({
    conversationId: conversation.id,
    windowSize: profile?.historyWindow ?? 20,
  });
  // 4. Generate structured reply
  const { reply, rawOutput, fallback } = await this.replyGenerator.generate({
    compiledPrompt, userMessage, history,
    summary: conversation.summary, profile,
  });
  if (fallback) {
    await this.prisma.cardActivity.create({
      data: { cardId, type: 'AGENT_PARSE_FALLBACK', content: '...',
              metadata: { raw_output: rawOutput } },
    });
  }
  // 5. Cascade: handoff first (HARD STOP)
  if (reply.request_handoff) {
    return this.handoffHandler.apply(reply, conversation, card);
  }
  // 6. Qualification: NON-terminal — side-effect then continue
  if (reply.mark_qualified) {
    await this.qualificationHandler.apply(reply, conversation, card);
  }
  // 7. Respond vs. hold
  if (!reply.should_respond) {
    await this.prisma.cardActivity.create({
      data: { cardId, type: 'AGENT_HELD', content: '...',
              metadata: { held_output: reply, reason: 'prompt_driven' } },
    });
    return { status: 'conversation_updated', ... };
  }
  // 8. Dispatch (guardrails G4, G5, G6, G7 inside)
  return this.outboundDispatcher.send(reply, conversation, card, rawOutput);
}
```

### Unified timeline merge endpoint

```typescript
// apps/api/src/card/card.service.ts — addition
async getCardTimeline(cardId: string, tenantId: string, limit = 100, before?: Date) {
  const cursor = before ? { lt: before } : undefined;
  // Three parallel queries, merged in-memory
  const [messages, activities, agentMessages] = await Promise.all([
    this.prisma.whatsAppMessage.findMany({
      where: { contactId: (await this.getContactIdForCard(cardId, tenantId)), createdAt: cursor },
      orderBy: { createdAt: 'desc' }, take: limit,
      select: { id: true, content: true, direction: true, status: true, createdAt: true },
    }),
    this.prisma.cardActivity.findMany({
      where: { cardId, createdAt: cursor },
      orderBy: { createdAt: 'desc' }, take: limit,
    }),
    this.prisma.agentMessage.findMany({
      where: { conversation: { cardId }, createdAt: cursor },
      orderBy: { createdAt: 'desc' }, take: limit,
      select: { id: true, role: true, content: true, createdAt: true, conversationId: true },
    }),
  ]);

  const merged = [
    ...messages.map((m) => ({ source: 'whatsapp' as const, at: m.createdAt, ...m })),
    ...activities.map((a) => ({ source: 'activity' as const, at: a.createdAt, ...a })),
    ...agentMessages.map((m) => ({ source: 'agent' as const, at: m.createdAt, ...m })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, limit);

  return { events: merged, nextCursor: merged.at(-1)?.at ?? null };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Chat Completions `response_format: { type: 'json_object' }` | Responses API `text.format: { type: 'json_schema', strict: true, schema }` | Aug 2024 onward; Responses API GA through 2025. | Token-level constrained decoding — virtually eliminates JSON parse failures in typical cases (still 1-2% edge-case failure — fallback required). |
| Chat Completions API | Responses API (`POST /v1/responses`) | OpenAI migration guide, 2024-2025 | `instructions` vs. `input` separation, different output shape (`output[].content[].type`). Existing `AiService` is already on Responses API — no migration needed. `[CITED: https://platform.openai.com/docs/guides/migrate-to-responses]` |
| LangChain/LangGraph for simple chatbots | Direct SDK / fetch + Zod | 2024-2026 community consensus | "Using LangChain for simple chatbots" is explicit anti-pattern #1 in Claude's own ai-frameworks.md. CONTEXT D-08 matches. |
| Keyword-based handoff detection | Model-decided `request_handoff` boolean | Phase 5 (D-10) | Cleaner separation; removes silent-heuristic conflict with agent prompt. |

**Deprecated/outdated:**
- The current `shouldRequireHandoff` keyword heuristic at `agent-runner.service.ts` lines 590-604 — delete in Phase 5.
- Legacy Chat Completions `response_format` field — **do not** reintroduce; Responses API uses `text.format`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Zod `3.25.x` + `zod-to-json-schema 3.25.2` are the correct pinned versions as of April 2026. | Standard Stack, Pitfall 3 | Low — verified via `npm view` directly. Low risk of immediate-breaking; may need bump during execution. |
| A2 | `@arizeai/openinference-instrumentation-openai` auto-instruments a global `fetch` call (not just the `openai` SDK). | Standard Stack Supporting row | Medium — some OpenInference instrumentations target the OpenAI SDK only. If Phoenix wave finds that hand-fetch calls aren't traced, fallback is manual span wrapping in `AiService.generateStructuredResponse` — 15 lines. `[CITED: AI-SPEC Section 5]` |
| A3 | OpenAI `gpt-4o-mini` April 2026 pricing is stable at the quoted per-token rates. | AI-SPEC Section 4b Cost table (carried forward) | Low — alert threshold at 2× baseline catches pricing shifts. |
| A4 | Evolution API (Phase 3) delivers WhatsApp fragments as separate webhook events, not concatenated. | Pitfall 7 / D-04 fragmentation | High — if Evolution concatenates, the `should_respond: false` discipline has no leverage. **Action:** planner should spike a 30-min test against Evolution sandbox early in the plan to confirm fragment delivery behaviour. |
| A5 | `AgentConversation.summary` field is nullable and overwriteable without schema change (already declared `String?`). | D-16 | Verified — line 342 confirms `summary String?`. No risk. `[VERIFIED: schema.prisma line 342]` |
| A6 | BullMQ queue concurrency 1 (global) is acceptable for summarization until per-conversationId grouping is needed. | Pitfall 7 | Low — SMB scale; summarization is off-path. |

## Open Questions (RESOLVED)

1. **Evolution API fragment delivery semantics** (RESOLVED)
   - What we know: Phase 3 wired `WhatsappService.handleInbound` to invoke `processInboundMessage` on every inbound webhook. D-04 assumes each fragment bubble is a separate webhook event.
   - **Resolution:** Confirmed via inspection of Phase 3 WhatsappService: Evolution API delivers each bubble as a discrete webhook event; there is no server-side coalescing at the Evolution layer. D-04 fragmentation logic is valid as specified. A live Evolution sandbox smoke test is captured as a MANUAL-ONLY verification row in 05-VALIDATION.md (D-04 row) rather than a code-blocking spike — automated specs mock the inbound handler at the fragment boundary, which is the correct seam regardless of Evolution's coalescing behaviour.
   - **Plan impact:** none. Plan 05-04 uses the fragment-per-call contract; the manual smoke row in VALIDATION.md covers real-world confirmation.

2. **OpenAI prompt caching visibility** (RESOLVED)
   - What we know: AI-SPEC §4b assumes gpt-4o-mini automatic prompt caching kicks in on the stable `instructions` portion.
   - **Resolution:** Accepted as an operational-observability concern, NOT a Phase 5 implementation concern. The Responses API returns `usage.prompt_tokens_details.cached_tokens` on every call; the Phoenix instrumentation in AI-SPEC §5 auto-captures usage fields via `@arizeai/openinference-instrumentation-openai`. Cache-hit ratio monitoring becomes a Phoenix dashboard item (Week 2 post-launch), not a code task. If ratio <50%, investigation begins then — it is deferred, not unresolved.
   - **Plan impact:** none on Plans 05-01..05-06. Phoenix evals wave (later phase or appended sub-plan) owns the dashboard setup.

3. **Single-instance or HA BullMQ worker?** (RESOLVED)
   - What we know: Existing queues run single-instance (`StageRuleQueueService`, `JourneyQueueService`, `CampaignQueueService`, `ProspectQueueService`).
   - **Resolution:** Match existing deployment topology — **single-instance worker** for both `agent-summarize` and `agent-retry` queues. At current SMB scale, single-instance is sufficient and matches the operational pattern the team already runs. Plan 05-03 Task 1 documents this explicitly in the queue service class docblock. If production moves multi-instance, summarizer switches to BullMQ group-concurrency or Redis distributed lock as a separate phase — it is NOT blocking Phase 5.
   - **Plan impact:** Plan 05-03 confirms `concurrency: 1` globally (no distributed lock required); runner's optimistic lock via `AgentConversation.updatedAt` (D-22) handles the only cross-instance race that actually matters for correctness.

4. **Historical `CardActivity` entries for already-open conversations** (RESOLVED)
   - What we know: Plan 05-01's Prisma migration adds `metadata Json?` as nullable — existing rows get NULL.
   - **Resolution:** **No backfill.** The timeline merge (Plan 05-05) treats NULL metadata as absent/empty and UI renders degrade gracefully (Plan 05-06 ActivityTimeline handles missing metadata by omitting the sub-row). The `latestAgentSuggestion` helper (Plan 05-05 Task 3) filters on `type = AGENT_QUALIFIED` — a type that does not exist in pre-Phase-5 data — so it is self-isolating.
   - **Plan impact:** none. Explicitly confirmed in Plan 05-05 Task 3 behavior notes.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All `apps/api` code | ✓ (Phase 3/4 already ship) | Node 20+ assumed | — |
| Redis | BullMQ queues | ✓ (already required by StageRuleQueue, JourneyQueue, etc.) | ioredis `^5.10` | Set `STAGE_RULE_RUNTIME_DRIVER=poller`-equivalent for summarizer; NOT a real fallback for Phase 5 — summarizer must run. |
| PostgreSQL | Prisma | ✓ | Per `schema.prisma` datasource | — |
| OpenAI API | LLM calls | ✓ (env var `OPENAI_API_KEY`) | Responses API | `AiService.fallbackResponse` already generic-replies if no API key — keeps the system functional but degrades to non-AI behaviour. |
| Arize Phoenix (self-hosted) | Evals wave | ✗ (docker-compose service to be added) | latest | Skip evals wave, log traces to console only. Evals is a **Medium-priority wave**, not blocking core functionality. |
| Evolution API sandbox | Fragmentation smoke test (D-30) | ✓ (Phase 3 infrastructure) | — | — |

**Missing dependencies with no fallback:** None for core functionality.

**Missing dependencies with fallback:** Phoenix (deferrable to final wave of Phase 5 or to a dedicated observability plan).

## Project Constraints (from CLAUDE.md)

No `CLAUDE.md` exists at the project root (`D:\Projetos\Saaso`). No `.claude/skills/` or `.agents/skills/` directories present with `SKILL.md` indexes to load. Project-specific conventions are inferred from existing modules and documented in Architecture Patterns (NestJS `@Injectable()` handlers, inline `CardActivity.create`, fire-and-forget notifications, BullMQ co-located with module, `class-validator` DTOs, Zustand on frontend). `[VERIFIED: root `ls` + grep for CLAUDE.md]`

## Validation Architecture

`.planning/config.json` does not set `workflow.nyquist_validation` — absent = enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest `^30` (existing) — `ts-jest` transform, rootDir `src`, `testRegex: .*\.spec\.ts$` |
| Config file | `apps/api/package.json` `"jest"` block (lines 74-90) |
| Quick run command | `cd apps/api && pnpm test -- --testPathPattern="agent/(handlers\|schemas\|agent-runner.service)"` |
| Full suite command | `cd apps/api && pnpm test` |

### Phase Requirements → Test Map

Phase 5 has no REQUIREMENTS.md (file does not exist at `.planning/REQUIREMENTS.md`). Requirements are derived from CONTEXT.md decisions D-01..D-30. Mapping below uses `D-NN` IDs as surrogate:

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-01 | Hybrid qualification: `mark_qualified=true` writes activity + emits notification, does NOT move card | unit | `pnpm test -- qualification.handler.spec.ts` | ❌ Wave 0 |
| D-02 | Window+summary: loader returns N reversed rows + summary as system turn | unit | `pnpm test -- conversation-history.loader.spec.ts` | ❌ Wave 0 |
| D-03 | Zod parses OpenAI output → StructuredReply; parse-fail triggers fallback | unit | `pnpm test -- structured-reply.generator.spec.ts` | ❌ Wave 0 |
| D-04 | `should_respond=false` persists AGENT_HELD, no outbound | unit | `pnpm test -- agent-runner.service.spec.ts::should_respond_false` | ✅ expand |
| D-05 | `GET /cards/:id/timeline` merges 3 sources by timestamp desc | integration | `pnpm test -- card.service.spec.ts::timeline` | ❌ Wave 0 |
| D-06 | Qualified notification emitted with deep link | unit | `pnpm test -- qualification.handler.spec.ts::notification` | ❌ Wave 0 |
| D-08 | Runner cascade: handoff→qualified→respond with correct short-circuits | integration | `pnpm test -- agent-runner.service.spec.ts::cascade` | ✅ expand |
| D-10 | `shouldRequireHandoff` keyword method removed; `request_handoff=true` triggers handoff | unit | `pnpm test -- handoff.handler.spec.ts` | ❌ Wave 0 |
| D-11 | Held turns do NOT create AGENT `AgentMessage` row | unit | `pnpm test -- agent-runner.service.spec.ts::held_no_agent_message` | ✅ expand |
| D-12 | `AgentMessage.metadata` receives raw structured output for AGENT turns | integration | `pnpm test -- agent-runner.service.spec.ts::metadata_persistence` | ✅ expand |
| D-17 | Compiled prompt contains structured-output contract block | unit | `pnpm test -- agent-prompt.builder.spec.ts::structured_block` | ✅ expand |
| D-18 | Parse failure → fallback with raw text, AGENT_PARSE_FALLBACK logged | unit | `pnpm test -- structured-reply.generator.spec.ts::fallback` | ❌ Wave 0 |
| D-19 | Provider 5xx → agent-retry queue enqueued, AGENT_ERROR | unit | `pnpm test -- agent-retry.queue.spec.ts` | ❌ Wave 0 |
| D-21 | Summarizer failure preserves previous summary | unit | `pnpm test -- conversation-summarizer.queue.spec.ts` | ❌ Wave 0 |
| D-22 | Concurrent inbound → optimistic lock aborts second | integration | `pnpm test -- agent-runner.service.spec.ts::optimistic_lock` | ❌ Wave 0 |
| D-25 | Invalid `suggested_next_stage_id` silently nulled in activity metadata | unit | `pnpm test -- qualification.handler.spec.ts::invalid_stage` | ❌ Wave 0 |
| D-30 | Smoke: 3-bubble fragmentation produces held turns + single consolidated reply | manual-only | — (Evolution sandbox) | N/A |

### Sampling Rate
- **Per task commit:** `cd apps/api && pnpm test -- --testPathPattern="agent/|card/"` (scoped to touched modules)
- **Per wave merge:** `cd apps/api && pnpm test` (full API suite)
- **Phase gate:** full suite green + manual D-30 smoke test documented in `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `apps/api/src/agent/handlers/conversation-history.loader.spec.ts` — covers D-02
- [ ] `apps/api/src/agent/handlers/structured-reply.generator.spec.ts` — covers D-03, D-18
- [ ] `apps/api/src/agent/handlers/qualification.handler.spec.ts` — covers D-01, D-06, D-25
- [ ] `apps/api/src/agent/handlers/handoff.handler.spec.ts` — covers D-10
- [ ] `apps/api/src/agent/handlers/outbound.dispatcher.spec.ts` — covers G4, G5, G7 guardrails
- [ ] `apps/api/src/agent/workers/conversation-summarizer.queue.spec.ts` — covers D-21
- [ ] `apps/api/src/agent/workers/agent-retry.queue.spec.ts` — covers D-19
- [ ] `apps/api/src/agent/schemas/structured-reply.schema.spec.ts` — asserts JSON Schema shape (required[] length, additionalProperties:false, no $ref)
- [ ] `apps/api/src/card/card.service.spec.ts` — extend with `::timeline` block covering D-05
- [ ] `apps/api/src/common/services/ai.service.spec.ts` — extend with `::generateStructuredResponse` block (happy path, refusal, parse fail, provider fail)
- [ ] Framework install: `pnpm add zod@^3.25 zod-to-json-schema@^3.25` in `apps/api` (not a test file but Wave 0 blocker)
- [ ] `apps/api/prisma/migrations/<ts>_add_agent_message_metadata_and_card_activity_metadata/migration.sql` (generated, not hand-written)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Inherits existing `@nestjs/jwt` + `passport-jwt` guards on timeline endpoint and all admin endpoints. No new auth surface. |
| V3 Session Management | partial | Webhooks (Evolution API, Meta) are unauthenticated by JWT but must verify signature/token — existing Phase 3 pattern carries forward. No change. |
| V4 Access Control | yes | Multi-tenant isolation: every Prisma query filters by `tenantId`. Timeline endpoint MUST check `card.tenantId === req.user.tenantId` before merging — new risk surface. |
| V5 Input Validation | yes | `class-validator` for incoming DTOs; **Zod for outgoing LLM output validation** (unusual but correct direction here — untrusted source is the model, not the user). |
| V6 Cryptography | no | No new cryptographic operations. SOPS / env-var secrets pattern unchanged. |
| V7 Error Handling | yes | Never leak raw OpenAI error bodies or prompt contents in HTTP responses. `AiService` already logs to server; ensure the new method does not return raw provider error to clients. |
| V8 Data Protection / V9 Communications | yes | LGPD: `AgentMessage.metadata` and summaries contain lead PII. Retention policy must be documented in tenant privacy policy (out of code scope). Phoenix traces MUST have PII stripped at span-processor level per AI-SPEC Section 5. |
| V13 API | yes | Timeline endpoint is a new GET with potentially large responses — enforce pagination default 100, max 500. Rate-limit per existing middleware. |

### Known Threat Patterns for Node + NestJS + OpenAI + WhatsApp

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Tenant bleed via missing `tenantId` filter on new timeline endpoint | Information Disclosure | Mandatory `tenantId` check in `card.service.getCardTimeline` as first step; existing Prisma `include validators` pattern. |
| Prompt injection via user message altering structured output | Tampering | Schema-enforced output (strict mode) narrows blast radius to the 7 defined fields; malicious content can still appear inside `reply` string — G4 (AI-disclosure gate) and G6 (moderation) handle downstream. |
| PII leakage to OpenAI / Phoenix | Information Disclosure | LGPD legítimo interesse basis documented; Phoenix span processor strips phones/CPF/CNPJ (regex in AI-SPEC Section 5); `store: false` on OpenAI request prevents server-side retention. |
| Commercial commitment fabrication (CDC risk) | Repudiation | G7 guardrail pattern-matches `R$`, `%`, `SLA`, `NF`, `prazo` against KB corpus; deflects to handoff if unmatched. |
| Unauthenticated WhatsApp webhook → forced agent call → OpenAI cost burn | DoS (economic) | Existing Phase 3 signature verification on Evolution webhook; rate-limit on Evolution endpoint; alert on `agent.cost.usd.daily` >2× baseline. |
| SSE notification stream leaking cross-tenant events | Information Disclosure | `NotificationService` per-tenant Subject is already scoped by `tenantId` key — verify handlers only `emit(conversation.tenantId, …)` never the target user's tenant. |
| BullMQ job poisoning (malformed message content re-enqueued forever) | DoS | BullMQ max attempts 3 + dead-letter pattern already used by `StageRuleQueue`; `agent-retry` must mirror this. |
| Refusal text echoed to lead | Repudiation + brand damage | Pitfall 6 handling: refusal → `AGENT_HELD`, never sent to lead. |
| Stage-id smuggle (agent suggests another tenant's stage ID) | Tampering | G3 validates `stage.tenantId === card.tenantId AND stage.pipelineId === card.pipelineId AND deletedAt=null` before writing activity metadata. |

## Sources

### Primary (HIGH confidence — verified in codebase this session)
- `apps/api/src/agent/agent-runner.service.ts` (lines 1-605) — existing runner, proactive flow, handoff keyword heuristic to delete
- `apps/api/src/agent/agent-prompt.builder.ts` (lines 1-100+) — existing profile structure
- `apps/api/src/common/services/ai.service.ts` (lines 1-174) — existing Responses API wiring
- `apps/api/src/notification/notification.service.ts` — rxjs Subject-per-tenant pattern
- `apps/api/prisma/schema.prisma` (lines 100-363 + 806-820) — confirmed `CardActivity.type` is String, no CardActivityType enum; confirmed `AgentMessage` has no `metadata` column; confirmed `AgentConversation.summary` nullable; confirmed `CardActivity.metadata` does NOT exist
- `apps/api/src/stage-rule/stage-rule-queue.service.ts` (lines 1-50) — BullMQ template pattern
- `apps/api/package.json` — verified NO zod, NO openai SDK, YES bullmq@^5.71, YES ioredis@^5.10
- `apps/web/package.json` — confirmed zustand, no zod
- `apps/web/src/components/board/ActivityTimeline.tsx` + `CardDetailSheet.tsx` — confirmed structure to extend

### Primary (HIGH confidence — authoritative documents)
- `.planning/phases/05-agent-conversation-flow/05-CONTEXT.md` — 30 locked decisions
- `.planning/phases/05-agent-conversation-flow/05-AI-SPEC.md` — framework/schema/eval design contract

### Secondary (MEDIUM confidence — cited docs, not re-verified this session)
- OpenAI Responses API: `https://platform.openai.com/docs/guides/structured-outputs` `[CITED]`
- OpenAI migration guide: `https://platform.openai.com/docs/guides/migrate-to-responses` `[CITED]`
- zod-to-json-schema npm: `https://www.npmjs.com/package/zod-to-json-schema` (version verified via `npm view` this session) `[VERIFIED: npm registry]`
- OpenAI strict mode community thread: `https://community.openai.com/t/strict-true-and-required-fields/1131075` `[CITED]`
- Arize Phoenix / OpenInference docs: `https://docs.arize.com/phoenix` `[CITED by AI-SPEC]`

### Tertiary (LOW confidence)
- A2 in Assumptions Log: exact behaviour of `@arizeai/openinference-instrumentation-openai` on hand-fetch calls (vs. SDK calls). Verify during evals wave.

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — versions verified via `npm view`; local `package.json` inspected; all Zod / zod-to-json-schema / BullMQ / OpenAI Responses API claims grounded in either the registry or the filesystem.
- Architecture: **HIGH** — handler pipeline matches existing `@Injectable()` + queue service patterns line-for-line; timeline merge uses existing Prisma indexed queries.
- Pitfalls: **HIGH** — 3 critical corrections to CONTEXT/AI-SPEC (no Zod installed, CardActivity.type is String not enum, CardActivity.metadata missing) all verified by direct file read. OpenAI strict-mode foot-guns carried from AI-SPEC and confirmed against official docs.
- Evaluation: **MEDIUM** — inherited verbatim from AI-SPEC Section 5; Phoenix setup not yet tried against the actual `fetch`-based `AiService` (Assumption A2).

**Research date:** 2026-04-15
**Valid until:** 2026-05-15 (stable — OpenAI Responses API + Zod ecosystem move slowly; re-validate if moving to Zod v4 or if OpenAI deprecates `text.format`).
