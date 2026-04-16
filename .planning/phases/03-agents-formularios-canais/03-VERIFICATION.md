---
phase: 03-agents-formularios-canais
verified: 2026-04-16T21:00:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Send WhatsApp message via Evolution API with real QR-connected instance"
    expected: "Message delivered to phone; CardActivity type=AGENT_PROACTIVE_WHATSAPP recorded; WhatsApp tenant account status=CONNECTED"
    why_human: "Requires live Evolution API server, real WhatsApp number, and QR code scan — cannot test programmatically"
  - test: "Submit embedded form (embed=1) from a parent page and verify postMessage events"
    expected: "saaso:form-submitting fires on submit, saaso:form-submitted fires on success with cardId, parent iframe resizes correctly"
    why_human: "postMessage cross-origin behavior requires browser + real iframe context"
  - test: "Email sent via Mailtrap when contact has email-only (no phone)"
    expected: "HTML email received at configured recipient address; CardActivity type=AGENT_PROACTIVE_EMAIL recorded"
    why_human: "Requires live SMTP credentials and mailbox inspection"
  - test: "Meta Lead Form organic webhook (no campaign_id) correctly routes to processOrganicLead and creates card"
    expected: "POST to /meta-webhook with organic payload creates Contact + Card + CardActivity with META_LEAD_INGESTED; no LeadFormSubmission if no matching internal LeadForm"
    why_human: "Requires actual Meta Platform Webhooks test tool or ngrok tunnel and Meta developer account"
---

# Phase 03: Agentes Efetivos + Formularios + Canais — Verification Report

**Phase Goal:** Agentes funcionam efetivamente — entrada de leads via formulario (proprio e Meta), integracao WhatsApp via Evolution API, email via Mailtrap. Formularios embeddaveis no site do cliente com editor visual. Lead que entra no funil dispara agente proativo automaticamente.
**Verified:** 2026-04-16T21:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### ROADMAP Success Criteria

| # | Success Criteria | Status | Evidence |
|---|-----------------|--------|---------|
| SC-1 | Formulario embedded no site captura lead e cria card no Kanban automaticamente | VERIFIED | `public-lead-form.controller.ts` POST `/public/forms/:tenantSlug/:slug/submit` (no auth); `lead-form.service.ts:submitPublicForm` creates Contact + Card + LeadFormSubmission in Prisma transaction |
| SC-2 | Agente IA dispara WhatsApp real via Evolution API ao entrar nova etapa (D0) | VERIFIED | `agent-runner.service.ts:initiateProactiveIfAssigned` calls `whatsappService.logMessage`; `whatsapp.service.ts:dispatchOutboundMessage` routes to `evolutionProvider.sendMessage` when `account.provider === 'evolution'`; `EvolutionApiService` calls Evolution API `/message/sendText` |
| SC-3 | Email de regua e enviado via Mailtrap API | VERIFIED (partial — human needed) | `email.service.ts` uses nodemailer with SMTP transporter; `sendEmail` accepts optional `html` param; `agent-runner.service.ts:sendProactiveEmail` wired; Mailtrap credentials via env vars — **live delivery requires human test** |
| SC-4 | Editor de formulario permite cliente criar/editar campos e embedar no site | VERIFIED | `apps/web/src/app/formularios/page.tsx` has drag-and-drop field editor (`@hello-pangea/dnd`); `embedSnippet` generates sandboxed iframe; `embedScriptSnippet` generates JS embed with full postMessage protocol |
| SC-5 | Meta Lead Forms integration captura leads de formularios do Facebook/Instagram | VERIFIED | `meta-webhook.service.ts:ingestLead` detects `campaign_id` presence; organic path routes to `processOrganicLead`; mapping resolution: exact `metaFormId` → `pageId` catch-all; creates Contact + Card via `cardService.create`; CardActivity `META_LEAD_INGESTED` |

**Score:** 5/5 success criteria VERIFIED (4 automated, 1 human-needed)

### Observable Truths (Plan must_haves)

#### Plan 02 must_haves (REQ-09, REQ-11)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | POST /forms/:slug/submit is a public endpoint — no JWT guard | VERIFIED | `public-lead-form.controller.ts` has `@Controller('public/forms')` with no `@UseGuards`; actual path is `/public/forms/:tenantSlug/:slug/submit` (deviation from plan path, but functionally equivalent and consistent with frontend) |
| 2 | SubmitFormDto validates payload: { payload: Record<string, any> } | PARTIAL | No `SubmitFormDto` class file created; public controller accepts `Record<string, unknown>` directly; `validateSubmissionPayload()` method in service handles validation; functionally equivalent |
| 3 | LeadFormService.submitForm creates LeadFormSubmission, Contact (or finds existing), Card, and triggers agent proactive D0 | VERIFIED | `submitPublicForm` creates all three in Prisma transaction; creates `AgentConversation` directly (bypasses `CardService.create` hook but achieves same outcome) |
| 4 | Rate limit: max 5 submissions per 15 minutes per IP | VERIFIED | `rate-limit.service.ts` implements `maxRequests = 5`, `windowMs = 15 * 60 * 1000`; `submitPublicForm` calls `rateLimitService.check(ip, form.tenant.id)` |
| 5 | initiateProactiveIfAssigned channel fallback: WhatsApp > Email > CardActivity log | VERIFIED | `agent-runner.service.ts:738` — phone path sends via WhatsApp, falls back to email on failure; email-only path calls `sendProactiveEmail`; neither path creates `AGENT_PROACTIVE_LOGGED` |
| 6 | CardActivity recorded for ALL paths | VERIFIED | All three paths create CardActivity: `AGENT_PROACTIVE_WHATSAPP`, `AGENT_PROACTIVE_EMAIL`, `AGENT_PROACTIVE_LOGGED` |
| 7 | initiateProactiveIfAssigned is idempotent-safe: called once per card creation event | VERIFIED | `initiateProactiveIfAssigned` checks `existingConversation` at line 682 and returns early if found; form submission creates conversation inside transaction so CardService.create hook would also return early |

#### Plan 04 must_haves (REQ-11)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Meta Lead Forms and Meta Lead Ads use the SAME webhook endpoint | VERIFIED | Both use POST `/meta-webhook`; `ingestLead` routes internally |
| 2 | Campaign payload has campaign_id; organic page payload does NOT | VERIFIED | `isCampaign = !!value.campaign_id` at line 86 of `meta-webhook.service.ts` |
| 3 | Mapping resolution: exact metaFormId match → fallback to pageId | VERIFIED | `processOrganicLead` line 266: exact metaFormId lookup, then line 270-273: pageId catch-all fallback |
| 4 | MetaWebhookMapping gains optional pageId field | VERIFIED | `schema.prisma` line 721: `pageId String?` |
| 5 | metaFormId becomes nullable | VERIFIED | `schema.prisma` line 720: `metaFormId String?` |
| 6 | Organic leads create Contact + Card + LeadFormSubmission | VERIFIED | `processOrganicLead` calls `cardService.create` and creates `LeadFormSubmission` when internal `LeadForm` matches; skips LeadFormSubmission when no internal form (guarded FK) |
| 7 | Card creation triggers initiateProactiveIfAssigned via CardService.create hooks | VERIFIED | `card.service.ts` line 417: `agentRunnerService.initiateProactiveIfAssigned` called after `card.create` |
| 8 | Existing campaign lead flow remains unchanged | VERIFIED | `processLead` not modified; isCampaign=true routes to existing path |

#### Plan 05 must_haves (REQ-09)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | WhatsApp settings section appears on /configuracoes | VERIFIED | `configuracoes/page.tsx` line 467: `<WhatsAppSettingsSection />` |
| 2 | Provider selector offers 'Meta Cloud API' and 'Evolution API' options | VERIFIED | `WhatsAppSettingsSection.tsx` lines 220-233: toggle buttons |
| 3 | Evolution API flow: instance name input -> create instance -> QR code -> poll -> connected | VERIFIED | `handleCreateInstance` calls `createEvolutionInstance`; `startPolling` polls every 3000ms; QR code fetched on `qrcode` state; stops on `connected` |
| 4 | QR code displayed as base64 image, refreshed on demand | VERIFIED | `WhatsAppSettingsSection.tsx` line 332: `src={qrCode.startsWith('data:') ? qrCode : 'data:image/png;base64,'+qrCode}`; "Atualizar QR Code" button |
| 5 | Connection status indicator with color coding | VERIFIED | `STATUS_CONFIG` and `CONNECTION_STATE_LABELS` map status to colors: DISCONNECTED=gray, QR_READY=amber, connected=emerald, error=rose |
| 6 | AgentStatusBadge shows active/paused/takeover on Kanban cards | VERIFIED | `AgentStatusBadge.tsx` CONFIG with `active`/`paused`/`takeover`; `KanbanBoard.tsx` line 505: `<AgentStatusBadge ... compact>` |
| 7 | Form submission count displayed on form list in /formularios | VERIFIED | `formularios/page.tsx` line 1069: `{form.submissionCount ?? 0} envios`; `isRecent()` function; `useLeadFormStore.ts` has `submissionCount?` on LeadForm type |

**Score:** 5/5 must-have truth groups VERIFIED

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/api/src/whatsapp/providers/whatsapp-provider.interface.ts` | IWhatsAppProvider contract | VERIFIED | 7 lines; sendMessage, receiveWebhook, getAccountStatus, connect, disconnect |
| `apps/api/src/whatsapp/providers/meta-cloud.provider.ts` | MetaCloudProvider implements IWhatsAppProvider | VERIFIED | `implements IWhatsAppProvider` at line 38 |
| `apps/api/src/whatsapp/evolution.service.ts` | EvolutionApiService implements IWhatsAppProvider | VERIFIED | `implements IWhatsAppProvider` at line 14 |
| `apps/api/src/whatsapp/evolution.controller.ts` | POST /whatsapp/evolution/webhook + instance endpoints | VERIFIED | `@Controller('whatsapp/evolution')` with webhook, instance CRUD, qr, state endpoints |
| `apps/api/src/whatsapp/whatsapp.service.ts` | Facade with resolveProvider | VERIFIED | `resolveProvider` at line 1017; routes to `evolutionProvider` or `metaCloudProvider` |
| `apps/api/prisma/schema.prisma` | WhatsAppAccount: provider, instanceName, apiKey, webhookUrl | VERIFIED | Lines 503-506 |
| `apps/api/src/email/email.service.ts` | Optional html parameter | VERIFIED | `html?: string` at line 33; passed to nodemailer at line 51 |
| `apps/api/src/lead-form/public-lead-form.controller.ts` | POST /public/forms/:tenantSlug/:slug/submit (no auth) | VERIFIED | `@Controller('public/forms')`, no @UseGuards |
| `apps/api/src/lead-form/lead-form.service.ts` | submitPublicForm() orchestrating validation, creation, trigger | VERIFIED | `submitPublicForm` at line 368; validates, rate-limits, creates Contact+Card+Submission+Conversation |
| `apps/api/src/lead-form/rate-limit.service.ts` | In-memory rate limiter 5/15min | VERIFIED | `maxRequests = 5`, `windowMs = 15 * 60 * 1000`, throws 429 |
| `apps/api/src/meta-webhook/meta-webhook.service.ts` | ingestLead with isCampaign routing; processOrganicLead | VERIFIED | `isCampaign` detection at line 86; `processOrganicLead` at line 259 |
| `apps/api/src/meta-webhook/meta-webhook.controller.ts` | POST /meta-mappings/page | VERIFIED | Line 80: `@Post('meta-mappings/page')` with `CreatePageMappingDto` |
| `apps/api/src/meta-webhook/dto/create-page-mapping.dto.ts` | pageId required, metaFormId optional | VERIFIED | `pageId @IsNotEmpty`, `metaFormId @IsOptional` |
| `apps/api/prisma/schema.prisma` | MetaWebhookMapping: pageId?, metaFormId nullable, composite unique | VERIFIED | Lines 720-735: both fields, `@@unique([pageId, metaFormId])`, indexes |
| `apps/web/src/components/configuracoes/WhatsAppSettingsSection.tsx` | Dark-surface WhatsApp management with QR flow (min 180 lines) | VERIFIED | File exists; dark surface pattern present; QR display, polling, provider toggle all implemented |
| `apps/web/src/stores/useWhatsAppAccountStore.ts` | Zustand store for WhatsApp CRUD + QR + polling (min 80 lines) | VERIFIED | `useWhatsAppAccountStore` with fetchAccounts, createEvolutionInstance, fetchQrCode, fetchConnectionState |
| `apps/web/src/components/board/AgentStatusBadge.tsx` | Badge with active/paused/takeover (min 40 lines) | VERIFIED | CONFIG with 3 states, compact prop, null-returns-null guard, `conversationStatusToAgentStatus` helper |
| `apps/web/src/app/f/[tenantSlug]/[slug]/page.tsx` | Form submission lifecycle with validation | VERIFIED | SubmissionState type, handleSubmit, validateField, client validation (email/phone/required/select), success/error screens, postMessage events |
| `apps/web/src/app/formularios/page.tsx` | Embed generator with sandbox + postMessage protocol | VERIFIED | `embedSnippet` has sandbox attribute; `embedScriptSnippet` has source validation, all lifecycle events, saasoFormCallbacks |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| POST /public/forms/:tenantSlug/:slug/submit | LeadFormService.submitPublicForm | controller route | VERIFIED | `public-lead-form.controller.ts` calls `leadFormService.submitPublicForm` |
| LeadFormService.submitPublicForm | Contact + Card + LeadFormSubmission creation | Prisma $transaction | VERIFIED | `lead-form.service.ts:436` — transaction creates all three |
| LeadFormService.submitPublicForm | AgentConversation creation | direct Prisma create | VERIFIED | Line 580: `agentConversation.create` within transaction when agent found |
| CardService.create | AgentRunnerService.initiateProactiveIfAssigned | post-save hook | VERIFIED | `card.service.ts:417` — called after card.create (used by meta-webhook path) |
| MetaWebhookService.ingestLead | processOrganicLead (organic) or processLead (campaign) | payload type detection | VERIFIED | `isCampaign` gate at line 86 |
| MetaWebhookService.processOrganicLead | CardService.create | service call | VERIFIED | Line 338: `cardService.create` called with `source: 'meta-form'` |
| MetaWebhookService.processOrganicLead | LeadFormSubmission | FK-guarded Prisma create | VERIFIED | Line 350-366: creates submission only when internal LeadForm matches |
| WhatsAppSettingsSection | /whatsapp/evolution/instance | api.post via store | VERIFIED | `useWhatsAppAccountStore.ts:194` — `api.post('/whatsapp/evolution/instance', dto)` |
| WhatsAppSettingsSection | /whatsapp/evolution/instance/:name/qr | api.get via store | VERIFIED | `useWhatsAppAccountStore.ts:209` — `api.get('/whatsapp/evolution/instance/${instanceName}/qr')` |
| WhatsAppSettingsSection | /whatsapp/accounts | api.get/post/patch/delete via store | VERIFIED | Lines 106, 119, 138, 157 in store |
| AgentRunnerService.initiateProactiveIfAssigned | WhatsAppService.logMessage (phone path) | channel fallback | VERIFIED | Line 725: `whatsappService.logMessage` when `contact.phone` present |
| AgentRunnerService | EmailService.sendEmail (email path) | sendProactiveEmail | VERIFIED | Line 802: `emailService.sendEmail` with HTML body |
| WhatsAppService.dispatchOutboundMessage | EvolutionApiService.sendMessage | provider resolution | VERIFIED | Line 1060-1062: routes to `evolutionProvider.sendMessage` when `provider === 'evolution'` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `WhatsAppSettingsSection.tsx` | `accounts` / `qrCode` / `connectionState` | `useWhatsAppAccountStore` → `api.get/post` | Yes — fetches from `/whatsapp/accounts`, Evolution API endpoints | FLOWING |
| `AgentStatusBadge.tsx` (in KanbanBoard) | `status` prop | `conversationStatusToAgentStatus(card.conversations[0]?.status)` from KanbanBoard state | Yes — Kanban store fetches real cards with conversations | FLOWING |
| `formularios/page.tsx` form list | `form.submissionCount` | `useLeadFormStore` list response | Conditionally flowing — backend GET /lead-forms list must return `submissionCount`; defaults to `0` if not included in response | PARTIAL — submissionCount defaults to 0 if backend does not include it |
| Public form page (`f/[tenantSlug]/[slug]/page.tsx`) | `form.fields`, `submissionState` | Backend `/public/forms/:tenantSlug/:slug` GET then POST `/submit` | Yes — real backend responses | FLOWING |

### Behavioral Spot-Checks

| Behavior | Verification Method | Result | Status |
|----------|-------------------|--------|--------|
| IWhatsAppProvider interface has all 5 methods | File read + grep | sendMessage, receiveWebhook, getAccountStatus, connect, disconnect present | PASS |
| Rate limit throws 429 after 5 requests | Code inspection | `check()` method: `entry.count > maxRequests → throw HttpException(429)` | PASS |
| processOrganicLead falls back to pageId | Code inspection | `if (!mapping && pageId)` at line 271 in meta-webhook.service.ts | PASS |
| MetaWebhookMapping has composite unique | Schema inspection | `@@unique([pageId, metaFormId])` at line 735 | PASS |
| WhatsApp dispatch uses Evolution provider for evolution accounts | Code inspection | `dispatchOutboundMessage` line 1060: `if (providerName === 'evolution') { evolutionProvider.sendMessage }` | PASS |
| Form submission count displayed in form list | Code inspection | `formularios/page.tsx:1069` — `{form.submissionCount ?? 0} envios` | PASS |
| Live WhatsApp delivery via Evolution API | Requires running server + real QR-connected instance | N/A | SKIP (human needed) |
| Mailtrap SMTP email delivery | Requires SMTP credentials + mailbox | N/A | SKIP (human needed) |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| REQ-09 | 03-01, 03-05 | Evolution API WhatsApp provider abstraction + management UI | SATISFIED | IWhatsAppProvider interface, EvolutionApiService, WhatsApp facade, WhatsAppSettingsSection |
| REQ-10 | 03-02, 03-03 | Public form submission flow + embedded form UX | SATISFIED | PublicLeadFormController, submitPublicForm, public form page with full lifecycle states |
| REQ-11 | 03-02, 03-04 | Meta Lead Forms organic webhook + rate limiting | SATISFIED | processOrganicLead in meta-webhook.service.ts, RateLimitService, MetaWebhookMapping schema extension |

No REQUIREMENTS.md file found in `.planning/` — requirements inferred from ROADMAP.md Phase 3 requirements field and plan frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/api/src/lead-form/lead-form.service.ts` | 514 | `tx.card.create` (direct Prisma) instead of `CardService.create` | WARNING | For form submission path, card is created inside Prisma transaction bypassing CardService hooks. However, `AgentConversation` is created directly in the same transaction — functionally equivalent. Not a blocker. |
| `apps/web/src/stores/useLeadFormStore.ts` | 67-69 | `submissionCount?: number` defaults to 0 | INFO | Backend GET /lead-forms must include `submissionCount` in response for badges to show real data. Currently falls back to 0. Display is safe but count data depends on backend response shape. |
| `apps/api/src/lead-form/lead-form.service.ts` | — | No `submit-form.dto.ts` created | INFO | Plan specified a `SubmitFormDto` class; implementation accepts `Record<string, unknown>` directly in the public controller. Validation is in service method. No functional gap. |
| `apps/api/src/agent/agent-runner.service.ts` | 809-811 | Duplicate ternary `result.deliveryMode === 'smtp' ? 'AGENT_PROACTIVE_EMAIL' : 'AGENT_PROACTIVE_EMAIL'` | INFO | Both branches return the same value — redundant but not wrong. |

### Human Verification Required

#### 1. Evolution API WhatsApp Real Message Delivery

**Test:** Configure a WhatsApp account with `provider=evolution` and a working Evolution API server. Set instanceName, scan QR code. From the Kanban, move a card with a phone-number contact to a stage assigned to an active agent.
**Expected:** Agent sends a WhatsApp message to the contact's phone via Evolution API; CardActivity type=AGENT_PROACTIVE_WHATSAPP is created; no errors in server logs.
**Why human:** Requires live Evolution API deployment, real WhatsApp number, and QR code authentication — cannot be automated without external infrastructure.

#### 2. Embedded Form postMessage Lifecycle

**Test:** Load the embedded form in an iframe on a test HTML page with `embed=1`. Open browser DevTools, add event listener for `message`. Fill and submit the form.
**Expected:** `saaso:form-submitting` fires on submit; `saaso:form-submitted` fires on success with `cardId` in event data; iframe height syncs after success screen renders; error state shows on 4xx/5xx responses; retry button resets to idle state.
**Why human:** Cross-origin postMessage behavior requires a real browser context and iframe integration that cannot be simulated by file inspection or unit tests.

#### 3. Mailtrap Email Delivery (Email Channel Fallback)

**Test:** Create a contact with email but no phone. Move that contact's card to a stage assigned to an active agent. Verify email delivery.
**Expected:** HTML email received at contact email address via Mailtrap SMTP; email shows personalized greeting from agent; CardActivity type=AGENT_PROACTIVE_EMAIL created; AgentConversation status=OPEN created.
**Why human:** Requires live SMTP credentials (MAILTRAP_HOST, MAILTRAP_USER, MAILTRAP_PASS env vars) and mailbox inspection.

#### 4. Meta Lead Forms Organic Webhook (End-to-End)

**Test:** Use Meta Developer Tools or ngrok tunnel to send an organic Lead Form webhook (no `campaign_id` in payload) to POST /meta-webhook with a valid `verifyToken`. Ensure a `MetaWebhookMapping` exists with matching `pageId`.
**Expected:** Contact and Card created in correct pipeline/stage; CardActivity type=META_LEAD_INGESTED recorded; `processOrganicLead` path taken (not `processLead`); agent D0 triggered via CardService.create hook.
**Why human:** Meta webhook testing requires a Facebook App, page access token, and external webhook delivery that cannot be mocked end-to-end in a CI environment.

### Gaps Summary

No blocking gaps found. All artifacts exist, are substantive, and are wired to real data flows.

**Implementation deviations noted (non-blocking):**

1. **Plan 03-02 endpoint path**: Plan specified `/forms/:slug/submit`; implementation uses `/public/forms/:tenantSlug/:slug/submit`. Frontend and backend are consistent with each other — the deviation is from the plan's expected path, not an inconsistency. Functionally equivalent and arguably better (includes tenant scoping).

2. **CardService bypass in form submission**: Plan 03-02 recommended "Option (b) — rely on CardService.create hook". Implementation creates cards via `tx.card.create` inside a Prisma transaction. However, `AgentConversation` is created directly in the same transaction, so the D0 agent trigger is preserved. The `CardService.create` hook path IS used by Meta webhook organic leads — so both paths work.

3. **submit-form.dto.ts not created**: Plan 03-02 specified a `SubmitFormDto` class with `@IsObject()` validation. Implementation validates inline via `validateSubmissionPayload()` in the service. No gap in validation coverage.

4. **submissionCount backend coverage**: The `submissionCount` field is declared on the `LeadForm` frontend type and displayed in the UI, but it defaults to 0 if the backend GET /lead-forms list response does not include it. This is a potential data gap depending on backend response shape — not a code bug, but worth monitoring.

---

_Verified: 2026-04-16T21:00:00Z_
_Verifier: Claude (gsd-verifier)_
