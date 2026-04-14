# Phase 2: CRM v2 — Automação de Réguas — Research

**Researched:** 2026-04-14
**Domain:** NestJS automation (BullMQ/SequenceRun), Meta Lead Ads webhook, Prisma schema extensions, AI agent integration, Next.js 16 frontend
**Confidence:** HIGH (all core claims verified against live codebase)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Réguas Automáticas por Etapa**
- Modelo: Cada etapa tem sua própria régua configurável (não global por pipeline)
- Configuração: Inline no Kanban via tela de edição da etapa; usa templates já criados na v1
- Sequência: D0 (imediato), D+1, D+3, D+7... cada step usa um StageMessageTemplate
- Trigger: Card entra na etapa (automático) OU ativação manual pelo SDR — ambos suportados
- SDR pode pausar/retomar régua via botão no card
- Cancelamento: Ao mover card para outra etapa, jobs pendentes da etapa anterior são cancelados e régua da nova etapa começa do D0
- Horário comercial: Configurável por tenant; disparos fora da janela avançam para próximo horário válido
- Engine: JourneyQueueService com BullMQ já existe — réguas por etapa são extensão desse modelo

**Agente IA por Etapa**
- Atribuição: Tenant atribui agente (já cadastrado em `/agentes`) a cada etapa inline no Kanban
- Triggers: Proativo no D0 (agente envia mensagem ao card entrar na etapa) + responde mensagens recebidas
- AgentRunnerService já implementado — conectar ao evento de entrada de card + ao webhook de mensagens recebidas
- Takeover SDR: Botão explícito no CardDetailSheet; agente fica pausado até SDR reativar
- Handoff automático: AgentRunnerService já detecta palavras-chave — mantém comportamento existente
- Alerta: AgentConversationStatus.HANDOFF_REQUIRED já existe

**Movimentação Semi-Automática pelo Agente**
- Agente move card automaticamente ao classificar positivo — sem confirmação do SDR
- Cada movimentação registrada no ActivityTimeline com agentId, motivo, timestamp
- Critérios de classificação salvos na etapa; agente recebe critérios no prompt compilado
- Formato exato dos critérios na etapa: Claude's Discretion (texto simples ou estruturado)

**Webhook Meta Lead Ads**
- Destino: Etapa configurável por formulário Meta (cada formulário mapeia para uma etapa diferente)
- Configuração: Em `/configuracoes` — tenant mapeia: Meta Form ID → pipeline → etapa destino
- Mapeamento: Automático para campos padrão (nome, telefone, email); extras → campo "notas"
- Criação de contato: Reutiliza se telefone/email já existe no tenant; caso contrário cria novo
- Notificação: SDR recebe notificação in-app quando lead entra via webhook
- Autenticação: verify_token pattern do Meta Platform (GET para verificação, POST para leads)

### Claude's Discretion
- Formato exato dos critérios de classificação positiva na etapa (campos de texto simples ou estruturado)

### Deferred Ideas (OUT OF SCOPE)
- SMS como canal de disparo
- Instagram DM
- Email marketing (além do transacional já existente)
- Google Ads webhook
- Self-service onboarding de novos tenants
- Campanhas em massa automáticas por régua
- Dashboard de analytics de conversão por etapa
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-06 | Réguas de mensagens automáticas por etapa (D0, D+N) | SequenceRun/CampaignStep pattern is the proven execution model; new StageRule model extends it per-stage rather than per-campaign |
| REQ-07 | Webhook Meta Lead Ads alimenta Kanban automaticamente | Lead form ingestion pattern in `lead-form.service.ts` is the exact precedent; Meta webhook needs a new public controller following the same contact-upsert + card-create flow |
| REQ-08 | Agente IA atribuído à etapa responde conversas automaticamente | AgentRunnerService.processInboundMessage is already wired to WhatsApp webhook; missing link is the card-stage-entry trigger and the agent proactive D0 send |
</phase_requirements>

---

## Summary

Phase 2 builds on a fully operational Phase 1 codebase. The core automation engine is **already present**: BullMQ queue, SequenceRun/SequenceRunStep execution model, AgentRunnerService with handoff detection, and WhatsApp webhook routing. The work is connecting existing infrastructure to new triggers rather than building an execution engine from scratch.

The main new constructs needed are: (1) **StageRule model** (a rule template per stage with ordered steps referencing StageMessageTemplates), (2) **StageRuleRun model** (an active execution of a StageRule on a specific card — analogous to SequenceRun but scoped to a stage), (3) **MetaWebhookMapping model** (Meta Form ID → pipeline + stage), and (4) **business hours config on Tenant** (stored in `featureFlags` Json column — no migration of the Tenant table itself needed).

The AI agent integration gap is narrow: `AgentRunnerService.processInboundMessage` already handles inbound WhatsApp messages and routes them to the agent assigned to the card's current stage. What is missing is the proactive D0 agent send (triggered when card enters stage) and the card-move endpoint that the agent can call.

**Primary recommendation:** Model régua execution as a `StageRuleRun` (analogous to `SequenceRun`) with `StageRuleRunStep` rows. Reuse the existing BullMQ queue infrastructure from `JourneyQueueService` pattern. Do NOT reuse the `Campaign`/`SequenceRun` tables — they carry campaign-level semantics that conflict with per-stage triggers.

---

## Standard Stack

### Core (already installed — verified against package.json)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| bullmq | ^5.71.0 | Delayed/scheduled job queue | Already in use for JourneyQueueService and CampaignQueueService [VERIFIED: apps/api/package.json] |
| ioredis | ^5.10.0 | Redis client for BullMQ | Existing pattern [VERIFIED: apps/api/package.json] |
| @nestjs/common | ^11.0.1 | NestJS framework | Project standard [VERIFIED: apps/api/package.json] |
| @prisma/client | ^6.19.2 | Database ORM | Project standard [VERIFIED: apps/api/package.json] |
| class-validator | ^0.15.1 | DTO validation | Used in all existing DTOs [VERIFIED: apps/api/package.json] |
| class-transformer | ^0.5.1 | DTO transformation | Project standard [VERIFIED: apps/api/package.json] |
| axios | ^1.13.6 | HTTP client (for Meta Graph API call to fetch lead details) | Already in web; for backend use Node's fetch or install axios [VERIFIED: apps/web/package.json] |

### Supporting (frontend — already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zustand | ^5.0.11 | Frontend state stores | All existing stores use it [VERIFIED: apps/web/package.json] |
| next | 16.1.6 | React framework | Project standard [VERIFIED: apps/web/package.json] |
| lucide-react | (in use) | Icons | Project icon standard [VERIFIED: UI-SPEC.md + component scan] |

### No New Libraries Needed

The entire Phase 2 stack is already installed. No `npm install` step required.

---

## Architecture Patterns

### Recommended Module Structure (new modules to create)

```
apps/api/src/
├── stage-rule/                   # New module: StageRule CRUD + engine
│   ├── stage-rule.module.ts
│   ├── stage-rule.controller.ts  # CRUD for rule template + run control
│   ├── stage-rule.service.ts     # Rule scheduling, pause/resume, cancel
│   ├── stage-rule-queue.service.ts  # BullMQ worker (same pattern as JourneyQueueService)
│   └── dto/
│       ├── create-stage-rule.dto.ts
│       ├── update-stage-rule.dto.ts
│       └── upsert-rule-step.dto.ts
├── meta-webhook/                 # New module: Meta Lead Ads ingestion
│   ├── meta-webhook.module.ts
│   ├── meta-webhook.controller.ts  # Public GET (verify) + POST (lead)
│   ├── meta-webhook.service.ts     # Lead parsing, contact upsert, card create
│   └── dto/
│       ├── meta-lead-payload.dto.ts
│       └── create-meta-mapping.dto.ts
apps/web/src/
├── components/board/
│   ├── StageRuleDrawer.tsx       # New: extends StageTemplatesModal with 3 tabs
│   ├── CardRuleStatusPanel.tsx   # New: pause/resume toggle in CardDetailSheet
│   └── AgentStatusBadge.tsx      # New: takeover/return button in CardDetailSheet
├── app/configuracoes/
│   └── page.tsx                  # Extends existing: adds MetaWebhookConfigSection
```

### Pattern 1: StageRule as lightweight SequenceRun clone

**What:** A `StageRule` model stores the rule template (ordered steps with day offsets and template IDs). A `StageRuleRun` model tracks the active execution per card. Steps are `StageRuleRunStep` rows with a `scheduledFor` datetime. The existing BullMQ queue `journey_execute` (or a new `stage_rule_execute` queue) processes due steps.

**Why not reuse SequenceRun/Campaign:** `SequenceRun` is scoped to a Campaign entity with audience semantics. Stage rules trigger per-card per-stage-entry and must cancel mid-run when the card moves. Mixing models creates coupling bugs.

**Execution flow:**
```
Card enters Stage
  → StageRuleService.startRuleRun(cardId, stageId, tenantId)
    → Loads StageRule for stageId
    → Creates StageRuleRun record (status: RUNNING)
    → Creates StageRuleRunStep rows with scheduledFor dates
      → D0: scheduledFor = nextBusinessHour(now, tenant.businessHours)
      → D+N: scheduledFor = nextBusinessHour(now + N days, tenant.businessHours)
    → Enqueues BullMQ jobs via StageRuleQueueService.enqueue(stepId, scheduledFor)
```

**Business hours helper (new utility):**
```typescript
// Source: [VERIFIED: CONTEXT.md decisions] — tenant defines window (e.g., Mon-Fri 8h-18h)
function nextBusinessHour(target: Date, config: BusinessHoursConfig): Date {
  // If target falls inside window → return target
  // If target falls outside window → advance to next window open
  // config: { days: number[], startHour: number, endHour: number, timezone: string }
}
```

**Cancel on card move (hook into existing moveCard):**
```typescript
// In StageRuleService or called from CardService.moveCard (extend the tx)
async cancelRunsForCard(cardId: string, tx: PrismaTransactionClient): Promise<void> {
  // Update StageRuleRun status CANCELED for this card
  // Remove BullMQ delayed jobs by jobId pattern
}
```

### Pattern 2: Meta Lead Ads webhook (GET + POST, no auth guard)

**What:** Public controller (no `JwtAuthGuard`) at `/meta-webhook`. GET handles Meta's hub.challenge verification. POST receives lead webhook, looks up MetaWebhookMapping by formId, creates contact (upsert by phone/email within tenant), creates card in target stage.

**Precedent:** `WhatsappController` already has the identical pattern (lines 91-99):
```typescript
// Source: [VERIFIED: apps/api/src/whatsapp/whatsapp.controller.ts:91-99]
@Get('webhook')
public verifyWebhook(@Query() query: Record<string, unknown>) {
  return this.whatsappService.verifyWebhookChallenge(query);
}

@Post('webhook')
public async webhook(@Body() payload: unknown) {
  return this.whatsappService.handleWebhook(payload);
}
```

**Meta verify_token flow (GET):**
```typescript
// Meta sends: GET /meta-webhook?hub.mode=subscribe&hub.challenge=XYZ&hub.verify_token=TOKEN
// Response: return hub.challenge as plain text (200) or 403 if token mismatch
// Source: [CITED: developers.facebook.com/docs/graph-api/webhooks/getting-started]
```

**Meta lead POST payload structure (from Meta Ads API):**
```json
{
  "entry": [{
    "changes": [{
      "field": "leadgen",
      "value": {
        "form_id": "123456789",
        "leadgen_id": "987654321",
        "page_id": "111222333",
        "created_time": 1234567890
      }
    }]
  }]
}
```
Note: The POST payload contains only IDs. The actual field values require a secondary GET call to the Meta Graph API:
`GET https://graph.facebook.com/v19.0/{leadgen_id}?fields=field_data&access_token={page_access_token}`
[CITED: developers.facebook.com/docs/marketing-api/guides/lead-ads/retrieving]

**MetaWebhookMapping model (new Prisma model):**
```prisma
model MetaWebhookMapping {
  id         String   @id @default(uuid())
  tenantId   String
  tenant     Tenant   @relation(fields: [tenantId], references: [id])
  metaFormId String   // Meta Lead Ads form ID (string, from tenant config)
  pipelineId String
  pipeline   Pipeline @relation(fields: [pipelineId], references: [id])
  stageId    String
  stage      Stage    @relation(fields: [stageId], references: [id])
  verifyToken String  // Per-tenant verify token for webhook validation
  pageAccessToken String? // Meta page access token for Graph API lead retrieval
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([metaFormId])
  @@index([tenantId])
}
```

**Deduplication strategy:** Before creating a new contact, query `prisma.contact.findFirst({ where: { tenantId, OR: [{ phone }, { email }] } })`. If found, link existing contact to new card.

**Idempotency:** Store `leadgenId` on the card or a separate `MetaLeadIngestion` log table to prevent duplicate card creation on webhook retries.

### Pattern 3: Agent proactive D0 + card-move endpoint

**What:** When a card enters a stage and an agent is assigned to that stage, `AgentRunnerService` needs a new method `initiateProactiveMessage(cardId, stageId, tenantId)` that:
1. Loads the agent for the stage
2. Creates/retrieves the AgentConversation
3. Generates an AI greeting (or uses D0 template body as prompt context)
4. Sends via WhatsappService
5. Creates CardActivity: type `AGENT_PROACTIVE`, content `Agente [nome] enviou mensagem de boas-vindas.`

**What:** Agent card-move: A new endpoint `POST /cards/:id/agent-move` (auth guarded, accepts `{ destinationStageId, reason, agentId }`). Calls existing `CardService.moveCard` internally, then creates a CardActivity with type `AGENT_MOVED` and content `Agente [nome] moveu para [etapa] — [motivo]`.

**Agent classification criteria:** Stored as a `classificationCriteria` text field on the Stage (or on the Agent-Stage relation). The `AgentPromptBuilder` injects these criteria into the compiled prompt. When the agent's response classifies as positive, it returns a structured signal parsed by `AgentRunnerService` to trigger the card-move call.

### Pattern 4: Pause/Resume régua — existing SequenceRunStatus reference

The `SequenceRun` enum already has `PAUSED` and `CANCELED` statuses [VERIFIED: apps/web/src/stores/useKanbanStore.ts line 57]. Mirror this in `StageRuleRun`:
```
PENDING → RUNNING → PAUSED → RUNNING (resume)
                  → CANCELED (card moved)
                  → COMPLETED
                  → FAILED
```

Pause: Update `StageRuleRun.status = PAUSED`, remove pending BullMQ delayed jobs.
Resume: Recompute `scheduledFor` for remaining steps from now (preserving day offset structure), re-enqueue.

### Pattern 5: Business hours as Tenant featureFlags JSON

The `Tenant.featureFlags` column is already a `Json?` field. The `TenantFeatureFlags` interface in `tenant-feature-flags.ts` can be extended to include `businessHours`:

```typescript
// Source: [VERIFIED: apps/api/src/tenant/tenant-feature-flags.ts]
export interface TenantFeatureFlags {
  outboundEnabled: boolean;
  coldOutboundEnabled: boolean;
  // NEW:
  businessHours?: {
    enabled: boolean;
    timezone: string;            // e.g., "America/Sao_Paulo"
    days: number[];              // 0=Sun,1=Mon...6=Sat; default [1,2,3,4,5]
    startHour: number;           // 8
    endHour: number;             // 18
  };
}
```

No Prisma migration needed — `featureFlags` is already `Json?`.

### Anti-Patterns to Avoid

- **Reusing Campaign/SequenceRun for stage rules:** These models have audience, campaign status, and multi-contact semantics. Stage rules are card-scoped. Mixing creates cancellation and isolation bugs.
- **Blocking the card-move transaction with BullMQ calls:** BullMQ `queue.removeJobs()` is async. Do not await it inside the Prisma transaction; fire it after the transaction commits.
- **Sending Meta lead_id to the browser:** The page access token and lead details must only ever live on the backend. Never proxy raw Meta tokens to frontend.
- **Assuming Redis is available at startup:** The existing BullMQ setup already handles Redis unavailability gracefully (falls back to poller). The new StageRuleQueueService must follow the identical pattern.
- **Missing `Content-Type: text/plain` on Meta verify response:** Meta's challenge verification requires the response to be the raw challenge string (not JSON-wrapped). Return with `@Res()` and `res.send(challenge)` or ensure NestJS doesn't wrap it.

---

## New Prisma Schema — Additions Required

### New Models

```prisma
model StageRule {
  id        String          @id @default(uuid())
  stageId   String          @unique  // one rule per stage
  stage     Stage           @relation(fields: [stageId], references: [id], onDelete: Cascade)
  tenantId  String
  tenant    Tenant          @relation(fields: [tenantId], references: [id])
  isActive  Boolean         @default(true)
  steps     StageRuleStep[]
  runs      StageRuleRun[]
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt

  @@index([tenantId, stageId])
}

model StageRuleStep {
  id                    String   @id @default(uuid())
  ruleId                String
  rule                  StageRule @relation(fields: [ruleId], references: [id], onDelete: Cascade)
  order                 Int
  dayOffset             Int      // 0 = D0 (immediate), 1 = D+1, 3 = D+3, etc.
  channel               CampaignChannel
  messageTemplateId     String   // FK → StageMessageTemplate
  messageTemplate       StageMessageTemplate @relation(fields: [messageTemplateId], references: [id])
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@unique([ruleId, order])
  @@index([ruleId, order])
}

model StageRuleRun {
  id              String            @id @default(uuid())
  ruleId          String
  rule            StageRule         @relation(fields: [ruleId], references: [id])
  cardId          String
  card            Card              @relation(fields: [cardId], references: [id], onDelete: Cascade)
  tenantId        String
  tenant          Tenant            @relation(fields: [tenantId], references: [id])
  status          StageRuleRunStatus @default(PENDING)
  triggerSource   String            // "CARD_ENTERED" | "MANUAL"
  startedAt       DateTime?
  completedAt     DateTime?
  pausedAt        DateTime?
  canceledAt      DateTime?
  lastError       String?
  steps           StageRuleRunStep[]
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  @@index([tenantId, status])
  @@index([cardId, status])
}

model StageRuleRunStep {
  id              String              @id @default(uuid())
  runId           String
  run             StageRuleRun        @relation(fields: [runId], references: [id], onDelete: Cascade)
  tenantId        String
  ruleStepId      String
  ruleStep        StageRuleStep       @relation(fields: [ruleStepId], references: [id])
  order           Int
  channel         CampaignChannel
  scheduledFor    DateTime
  status          StageRuleRunStepStatus @default(PENDING)
  startedAt       DateTime?
  completedAt     DateTime?
  attempts        Int                 @default(0)
  lastError       String?
  externalMessageId String?
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  @@unique([runId, order])
  @@index([tenantId, status, scheduledFor])
}

model MetaWebhookMapping {
  id              String   @id @default(uuid())
  tenantId        String
  tenant          Tenant   @relation(fields: [tenantId], references: [id])
  metaFormId      String   @unique
  pipelineId      String
  pipeline        Pipeline @relation(fields: [pipelineId], references: [id])
  stageId         String
  stage           Stage    @relation(fields: [stageId], references: [id])
  verifyToken     String
  pageAccessToken String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([tenantId])
}

model MetaLeadIngestion {
  id          String   @id @default(uuid())
  tenantId    String
  metaLeadId  String   @unique  // leadgen_id from Meta — for deduplication
  cardId      String?
  card        Card?    @relation(fields: [cardId], references: [id], onDelete: SetNull)
  createdAt   DateTime @default(now())
}
```

### New Enums

```prisma
enum StageRuleRunStatus {
  PENDING
  RUNNING
  PAUSED
  COMPLETED
  CANCELED
  FAILED
}

enum StageRuleRunStepStatus {
  PENDING
  QUEUED
  RUNNING
  SENT
  FAILED
  SKIPPED
}
```

### Stage model additions

```prisma
// Add to Stage model:
stageRule           StageRule?
metaWebhookMappings MetaWebhookMapping[]
classificationCriteria String?   // Free text criteria for agent card-move
```

### Relations to add to Tenant, Card, Pipeline

```prisma
// Tenant:
stageRules       StageRule[]
stageRuleRuns    StageRuleRun[]
metaWebhookMappings MetaWebhookMapping[]

// Card:
stageRuleRuns    StageRuleRun[]
metaLeadIngestions MetaLeadIngestion[]

// Pipeline:
metaWebhookMappings MetaWebhookMapping[]
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Delayed job scheduling | Custom setTimeout/DB poller | BullMQ (already installed) | Race conditions, server restart loss, no retry semantics |
| Business hours timezone math | Manual UTC offset arithmetic | date-fns-tz or Luxon (or the existing poller pattern + a helper) | DST handling, edge cases around midnight |
| Meta webhook HMAC validation | Manual crypto | Node.js `crypto.timingSafeEqual` with SHA-256 | Timing attack vulnerability in naive string comparison |
| Contact deduplication | Custom fuzzy match | Exact match on phone OR email within tenantId (Prisma `OR` clause) | Keep it deterministic; fuzzy matching introduces false merges |
| BullMQ job removal on cancel | Iterating all queue jobs | `queue.removeJobScheduler(jobId)` + `queue.remove(jobId)` | BullMQ API exists for this [CITED: docs.bullmq.io/guide/jobs/removing-jobs] |

**Key insight:** The existing CampaignQueueService and JourneyQueueService are nearly identical. The new StageRuleQueueService will be a third instance of the same pattern. Consider extracting a `BaseQueueService` abstract class to avoid triple maintenance — but that's a refactor option, not a blocker.

---

## Common Pitfalls

### Pitfall 1: BullMQ `jobId` uniqueness scoping

**What goes wrong:** Two cards in the same stage both have step 0 enqueued. If `jobId = ruleStepId` (the template step, not the run step), BullMQ deduplicates and only one job runs.
**Why it happens:** BullMQ deduplicates by `jobId` within a queue.
**How to avoid:** Use `StageRuleRunStep.id` (the per-run step row) as the BullMQ `jobId`, not `StageRuleStep.id` (the template).
**Warning signs:** Second card silently never sends its D0 message.

### Pitfall 2: Meta webhook retry storms

**What goes wrong:** If the POST endpoint returns non-2xx (e.g., timeout during Graph API call), Meta retries the webhook for up to 12 hours with exponential backoff. Each retry creates a duplicate lead.
**Why it happens:** The Graph API call (to fetch lead field_data) is a network call inside the webhook handler.
**How to avoid:** Return 200 immediately after persisting the raw `leadgen_id` to `MetaLeadIngestion`. Process the Graph API call asynchronously (via a BullMQ job or a fire-and-forget async call). Use `MetaLeadIngestion.metaLeadId` (@unique) to idempotently ignore duplicate webhooks.
**Warning signs:** Duplicate cards for the same Meta lead.

### Pitfall 3: Card move transaction + BullMQ cancel race

**What goes wrong:** BullMQ `queue.remove(jobId)` fails after the Prisma transaction already committed the card move. Old rule jobs still execute, sending messages for the wrong stage.
**Why it happens:** BullMQ operations are not transactional with Prisma.
**How to avoid:** (1) Set `StageRuleRun.status = CANCELED` inside the Prisma transaction (atomic). (2) Before executing any step, the worker checks `StageRuleRun.status` — if CANCELED, skip and return. This makes BullMQ removal a best-effort optimization, not a correctness requirement.
**Warning signs:** Messages sent after card was moved to a different stage.

### Pitfall 4: Agent proactive D0 and régua D0 both fire simultaneously

**What goes wrong:** If a stage has both a StageRule with D0 step AND an agent assigned, both the régua template send AND the agent proactive message fire at card entry, creating a double send.
**Why it happens:** Two separate triggers on the same `CARD_ENTERED` event.
**How to avoid:** Define clear precedence: if the stage has an agent with proactive mode, the D0 régua step is skipped (or the agent's D0 message IS the régua D0 send). Document this rule in the `StageRuleService.startRuleRun` logic.
**Warning signs:** Leads receiving two different greeting messages.

### Pitfall 5: Business hours config missing → immediate send at any hour

**What goes wrong:** If a tenant has no `businessHours` config, D0 fires at 3am.
**Why it happens:** Missing null check in `nextBusinessHour()` helper.
**How to avoid:** Default `businessHours` (when not configured) to Mon-Fri 08:00-18:00 BRT. Document this default in the `TenantFeatureFlags` interface.
**Warning signs:** Tenant complaints about messages sent outside business hours.

### Pitfall 6: Meta verify_token response format

**What goes wrong:** Meta's webhook verification returns 403 if the server responds with JSON instead of the raw challenge string.
**Why it happens:** NestJS default serialization wraps strings in JSON (`"challenge_string"`).
**How to avoid:** Use `@Res() res: Response` and `res.send(challenge)` (not `return challenge`) OR use the `@Header('Content-Type', 'text/plain')` decorator with careful response handling.
**Warning signs:** Meta dashboard shows webhook as "unverified" even though the endpoint returns 200.

---

## Existing Infrastructure Map (codebase-verified)

### What Exists (do not re-implement)

| Component | Location | Status |
|-----------|----------|--------|
| BullMQ queue (journey) | `journey/journey-queue.service.ts` | Operational with Redis/poller fallback |
| BullMQ queue (campaign) | `campaign/campaign-queue.service.ts` | Identical pattern |
| AgentRunnerService | `agent/agent-runner.service.ts` | Full implementation with handoff detection |
| WhatsApp webhook routing | `whatsapp/whatsapp.controller.ts:96-99` | POST /whatsapp/webhook calls AgentRunnerService |
| Contact upsert pattern | `lead-form/lead-form.service.ts` | Exact same logic needed for Meta webhook |
| Card creation in stage | `card/card.service.ts:create()` | Used by lead form; reuse for Meta webhook |
| Card move (cross-stage) | `card/card.service.ts:moveCard()` | Hook here to cancel StageRuleRun |
| SequenceRun execution | `campaign/campaign-runtime.service.ts` | Reference model for StageRuleRun engine |
| Agent `stageId` field | `schema.prisma:Agent` | Agent already has stageId FK to Stage |
| AgentConversationStatus | `schema.prisma:enum` | OPEN, HANDOFF_REQUIRED, CLOSED |
| CardActivity types | `card/card.service.ts` | CREATED, MOVED, WHATSAPP_OUTBOUND, EMAIL_OUTBOUND, AGENT_HANDOFF, AGENT_RESPONSE |
| StageMessageTemplate | `stage-message-template/` + `schema.prisma` | Already linked to Stage; used by v1 |
| TenantFeatureFlags JSON | `tenant/tenant-feature-flags.ts` | Extend for businessHours |
| `verify_token` pattern | `whatsapp/whatsapp.service.ts` | `verifyWebhookChallenge()` method |
| Dark surface UI | `configuracoes/page.tsx` | `rounded-[30px] border border-white/10 bg-[rgba(8,18,34,0.82)]` |
| StageTemplatesModal | `components/board/StageTemplatesModal.tsx` | Extend with Régua + Agente tabs |
| CardDetailSheet | `components/board/CardDetailSheet.tsx` | Add CardRuleStatusPanel + AgentStatusBadge |
| `getConversationMeta()` | `components/board/CardDetailSheet.tsx:31` | Use existing mapping for status display |
| `busyCardId` pattern | `components/board/KanbanBoard.tsx` | Optimistic busy state for async actions |

### What is Missing (must build)

| Component | Where | Notes |
|-----------|-------|-------|
| StageRule CRUD | New `stage-rule/` module | Template + ordered steps |
| StageRuleRun engine | `stage-rule/stage-rule.service.ts` | Start, pause, resume, cancel |
| StageRuleQueueService | `stage-rule/stage-rule-queue.service.ts` | Third BullMQ instance, same pattern |
| Business hours helper | `common/utils/business-hours.ts` | `nextBusinessHour(date, config): Date` |
| MetaWebhook controller | New `meta-webhook/` module | Public GET+POST |
| MetaWebhookMapping CRUD | `meta-webhook/` | Config UI in /configuracoes |
| Agent proactive D0 | `agent/agent-runner.service.ts` | New `initiateProactiveMessage()` method |
| Agent card-move endpoint | `card/card.controller.ts` | `POST /cards/:id/agent-move` |
| Prisma schema additions | `prisma/schema.prisma` | 5 new models + 2 enums |
| StageRuleDrawer | `components/board/StageRuleDrawer.tsx` | Extends StageTemplatesModal |
| CardRuleStatusPanel | `components/board/CardRuleStatusPanel.tsx` | Pause/resume toggle |
| AgentStatusBadge | `components/board/AgentStatusBadge.tsx` | Takeover/return button |
| MetaWebhookConfigSection | Inside `configuracoes/page.tsx` | Dark surface card pattern |
| New Zustand stores/actions | `stores/` | Rule run control, agent takeover, Meta mapping |

---

## Code Examples

### StageRuleQueueService skeleton (follow existing pattern exactly)

```typescript
// Source: [VERIFIED: apps/api/src/journey/journey-queue.service.ts] — mirror this pattern
@Injectable()
export class StageRuleQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly queueName = 'stage_rule_execute';
  private readonly queueDriverPreference =
    (process.env.STAGE_RULE_RUNTIME_DRIVER?.trim().toLowerCase() ?? 'bullmq') as 'bullmq' | 'poller';
  // ... identical Redis connection setup ...

  public async enqueueRuleStep(stepId: string, scheduledFor: Date): Promise<boolean> {
    const delayInMs = Math.max(0, scheduledFor.getTime() - Date.now());
    await this.queue.add('rule_step.execute', { stepId }, {
      jobId: stepId,  // Use StageRuleRunStep.id, NOT StageRuleStep.id
      delay: delayInMs,
    });
  }
}
```

### Card move + cancel rule run (extend CardService.moveCard)

```typescript
// Source: [VERIFIED: apps/api/src/card/card.service.ts:443-530]
// In CardService.moveCard, after the cross-stage move tx commits:
if (!isSameStage) {
  // 1. Cancel active rule runs for this card (status update inside tx is safe)
  await this.stageRuleService.cancelActiveRunsForCard(cardId, tenantId);
  // 2. Start new rule run for destination stage (after tx)
  await this.stageRuleService.startRuleRunIfExists(cardId, dto.destinationStageId, tenantId, 'CARD_ENTERED');
  // 3. Trigger agent proactive D0 if agent assigned to destination stage
  await this.agentRunnerService.initiateProactiveIfAssigned(cardId, dto.destinationStageId, tenantId);
}
```

### Meta webhook verify_token (GET endpoint — return raw string)

```typescript
// Source: [VERIFIED: apps/api/src/whatsapp/whatsapp.controller.ts:91] + Meta docs
@Get('webhook')
public verifyMetaWebhook(
  @Query('hub.mode') mode: string,
  @Query('hub.verify_token') token: string,
  @Query('hub.challenge') challenge: string,
  @Res() res: Response,
): void {
  if (mode === 'subscribe' && this.metaWebhookService.validateToken(token)) {
    res.status(200).send(challenge);  // raw string, not JSON
  } else {
    res.status(403).send('Forbidden');
  }
}
```

### Contact upsert pattern (from lead-form precedent)

```typescript
// Source: [VERIFIED: apps/api/src/lead-form/lead-form.service.ts] — same logic
async upsertContact(tenantId: string, phone?: string, email?: string, name?: string) {
  const existing = await this.prisma.contact.findFirst({
    where: { tenantId, OR: [
      phone ? { phone } : undefined,
      email ? { email } : undefined,
    ].filter(Boolean) as any },
  });
  if (existing) return existing;
  return this.prisma.contact.create({ data: { tenantId, name: name ?? 'Lead Meta', phone, email } });
}
```

### Frontend: optimistic pause/resume (follow busyCardId pattern)

```typescript
// Source: [VERIFIED: apps/web/src/components/board/CardDetailSheet.tsx — busyCardId pattern]
const [isBusy, setIsBusy] = useState(false);
const handleTogglePause = async () => {
  setIsBusy(true);
  const optimisticStatus = run.status === 'RUNNING' ? 'PAUSED' : 'RUNNING';
  setLocalStatus(optimisticStatus);  // optimistic update
  try {
    await api.post(`/stage-rules/runs/${run.id}/toggle-pause`);
  } catch {
    setLocalStatus(run.status);  // revert
    setError('Não foi possível alterar o status da régua. Tente novamente.');
  } finally {
    setIsBusy(false);
  }
};
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@nestjs/bull` (Bull v3) | `bullmq` (Bull v4+) with `ioredis` | 2022 | BullMQ has better delayed job support, priority, and job removal APIs |
| Polling-only schedulers | BullMQ + poller fallback | Project already uses this | No change needed |
| Meta Ads v12 API | Meta Graph API v19.0 | 2024 | URL base is `https://graph.facebook.com/v19.0/` |

**Deprecated/outdated:**
- `@nestjs/schedule` with cron: Not used in this project; BullMQ with delayed jobs is the project standard. Do not introduce `@nestjs/schedule`.
- Bull (v3): The project uses BullMQ (v5). Do not import from `bull`.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Backend runtime | Yes | v20.19.5 | — |
| Redis | BullMQ job queue | Not reachable locally | — | Poller fallback (already implemented in JourneyQueueService pattern) |
| PostgreSQL | Prisma database | Assumed (app runs) | — | — |
| Meta Graph API | Lead field retrieval | External | v19.0 | Webhook stores leadgen_id; field fetch is async |

**Redis not reachable locally** — this is the standard dev configuration. The BullMQ queue services already handle this gracefully with the poller fallback. New StageRuleQueueService must follow the identical pattern.

**Missing dependencies with no fallback:** None — all critical infrastructure has fallback.

---

## Validation Architecture

`workflow.nyquist_validation` not set → treating as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 30 + ts-jest |
| Config file | `apps/api/package.json` (jest key) |
| Quick run command | `cd apps/api && npx jest --testPathPattern="stage-rule" --no-coverage` |
| Full suite command | `cd apps/api && npx jest --no-coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-06 | StageRule starts run on card entry, schedules steps with correct dates | unit | `cd apps/api && npx jest stage-rule.service.spec -x` | No — Wave 0 |
| REQ-06 | Business hours helper returns next valid slot | unit | `cd apps/api && npx jest business-hours.spec -x` | No — Wave 0 |
| REQ-06 | Cancel run cancels pending BullMQ jobs | unit (mock queue) | `cd apps/api && npx jest stage-rule.service.spec -x` | No — Wave 0 |
| REQ-06 | Pause/resume preserves remaining steps | unit | `cd apps/api && npx jest stage-rule.service.spec -x` | No — Wave 0 |
| REQ-07 | Meta GET returns raw hub.challenge | unit | `cd apps/api && npx jest meta-webhook.controller.spec -x` | No — Wave 0 |
| REQ-07 | Duplicate leadgen_id is idempotent (no duplicate card) | unit | `cd apps/api && npx jest meta-webhook.service.spec -x` | No — Wave 0 |
| REQ-07 | Contact upsert matches existing by phone | unit | `cd apps/api && npx jest meta-webhook.service.spec -x` | No — Wave 0 |
| REQ-08 | AgentRunnerService.initiateProactiveIfAssigned sends D0 message | unit | `cd apps/api && npx jest agent-runner.service.spec -x` | No — Wave 0 |
| REQ-08 | Agent card-move creates AGENT_MOVED CardActivity | unit | `cd apps/api && npx jest card.service.spec -x` | Partial (file exists, extend) |

### Wave 0 Gaps

- [ ] `apps/api/src/stage-rule/stage-rule.service.spec.ts` — covers REQ-06 (rule start, pause, resume, cancel)
- [ ] `apps/api/src/common/utils/business-hours.spec.ts` — covers business hours helper
- [ ] `apps/api/src/meta-webhook/meta-webhook.controller.spec.ts` — covers REQ-07
- [ ] `apps/api/src/meta-webhook/meta-webhook.service.spec.ts` — covers contact upsert, idempotency
- [ ] `apps/api/src/agent/agent-runner.service.spec.ts` — covers REQ-08 proactive send

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (webhook endpoints are intentionally public) | — |
| V3 Session Management | No | — |
| V4 Access Control | Yes | All management endpoints use existing `JwtAuthGuard + TenantGuard`; webhook endpoints are public but tenant-isolated by `verifyToken` |
| V5 Input Validation | Yes | class-validator on all DTOs; raw Meta webhook payload typed as `unknown` and validated before processing |
| V6 Cryptography | Yes | Meta verify_token stored in DB; HMAC validation for webhook signature if Meta sends `X-Hub-Signature-256` header |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Forged Meta webhook POST (no valid form mapping) | Spoofing | Return 200 early (don't disclose existence); process only if `MetaWebhookMapping` exists for `form_id` |
| Webhook replay / duplicate lead | Tampering | `MetaLeadIngestion.metaLeadId @unique` — idempotent upsert |
| Meta page access token leak | Info Disclosure | `pageAccessToken` never returned to frontend; only stored server-side |
| Cross-tenant agent card-move | Elevation of Privilege | `POST /cards/:id/agent-move` must validate `card.tenantId === request.tenantId` |
| Rule step executed for wrong tenant | Elevation of Privilege | BullMQ worker loads `StageRuleRunStep` by ID; verifies `tenantId` from DB before sending message |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `TenantFeatureFlags` JSON column is sufficient for businessHours config without a schema migration | Architecture Patterns #5 | Low — the `featureFlags` field is `Json?` and already used for dynamic config |
| A2 | BullMQ `queue.remove(jobId)` can remove delayed jobs by the same `jobId` used at enqueue time | Don't Hand-Roll | Medium — if BullMQ API changed between v4 and v5; verify with `queue.getJob(jobId)` and `job.remove()` pattern |
| A3 | Meta Lead Ads POST webhook always carries `entry[0].changes[0].value.form_id` | Architecture Patterns #2 | Medium — Meta may send batch entries; handler should iterate all `entry[].changes[]` |
| A4 | Meta Graph API v19.0 is current stable for lead retrieval | Standard Stack | Low — v19.0 released 2024; check Meta changelog if needed |

---

## Open Questions

1. **Meta page access token per mapping or per tenant?**
   - What we know: Each Meta form belongs to a Facebook page; each page has its own access token.
   - What's unclear: Does the tenant have one page (one token) or multiple pages (multiple tokens)?
   - Recommendation: Store `pageAccessToken` on `MetaWebhookMapping` (per-form-mapping) to support multiple pages. If tenant has only one page, all mappings share the same token — which is fine.

2. **D0 "imediato" — what if business hours block D0?**
   - What we know: CONTEXT.md says D0 is "imediato ao entrar na etapa" but also says business hours must be respected.
   - What's unclear: If a card enters a stage at 3am, does D0 fire immediately or advance to 8am?
   - Recommendation: Apply business hours to D0 as well. "Imediato" means "first available slot", not "bypass business hours". Plannable as a configurable flag per StageRule if needed.

3. **Agent proactive D0 vs règua D0 conflict**
   - What we know: Both are triggered by `CARD_ENTERED`. Both could send a message.
   - What's unclear: User has not specified precedence.
   - Recommendation: If stage has both a rule D0 step AND an agent assigned, the agent's proactive message replaces the rule D0 step (agent IS the D0 action). Document in StageRuleService logic.

---

## Sources

### Primary (HIGH confidence — verified against live codebase)

- `apps/api/src/journey/journey-queue.service.ts` — BullMQ queue pattern (Redis options, worker setup, enqueue with delay, poller fallback)
- `apps/api/src/campaign/campaign-queue.service.ts` — Second instance confirming the pattern is reusable
- `apps/api/src/agent/agent-runner.service.ts` — Full AgentRunnerService implementation
- `apps/api/src/card/card.service.ts` — moveCard, sendMessage, automationState logic
- `apps/api/src/whatsapp/whatsapp.controller.ts` — webhook GET+POST pattern
- `apps/api/prisma/schema.prisma` — All existing model definitions
- `apps/api/src/tenant/tenant-feature-flags.ts` — Existing featureFlags structure
- `apps/web/src/components/board/StageTemplatesModal.tsx` — Modal pattern to extend
- `apps/web/src/components/board/CardDetailSheet.tsx` — Agent/sequence status display patterns
- `.planning/phases/02-crm-v2-automa-o-de-r-guas/02-CONTEXT.md` — All locked decisions
- `.planning/phases/02-crm-v2-automa-o-de-r-guas/02-UI-SPEC.md` — UI design contract

### Secondary (MEDIUM confidence — cited from official documentation)

- [CITED: developers.facebook.com/docs/graph-api/webhooks/getting-started] — verify_token GET/POST pattern
- [CITED: developers.facebook.com/docs/marketing-api/guides/lead-ads/retrieving] — leadgen POST payload + Graph API retrieval pattern
- [CITED: docs.bullmq.io/guide/jobs/removing-jobs] — Job removal API for cancellation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified against package.json
- Architecture: HIGH — patterns extracted from live codebase; new models follow existing conventions
- Pitfalls: HIGH — derived from existing code analysis (BullMQ jobId uniqueness, Meta webhook retry semantics)
- Meta webhook specifics: MEDIUM — cited from official Meta docs, not executed in this session

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (stable domain; Meta API version may change)
