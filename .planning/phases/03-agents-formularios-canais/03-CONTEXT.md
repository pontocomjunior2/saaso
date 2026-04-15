---
phase: "03"
name: "Agentes Efetivos + Formulários + Canais"
created: "2026-04-14"
status: discussing
---

# 03-CONTEXT: Agentes Efetivos + Formulários + Canais

## Prior Decisions (from Phase 02 CONTEXT, STATE, roadmap)

- Mailtrap configurado com token de produção via nodemailer SMTP (demomailtrap.co)
- Card create e card move são gatilhos oficiais para start/cancel de StageRule
- Agente ativo da etapa substitui somente o passo D0 da régua; delays futuros seguem por queue
- AgentRunnerService já tem `initiateProactiveIfAssigned` com skeleton implementation (cria conversa, gera greeting AI, envia via whatsappService.logMessage)
- LeadForm e LeadFormSubmission models já existem no Prisma schema
- MetaWebhookMapping model já existe (Phase 02 — Meta Lead Ads webhook)

## What Already Exists (do not rebuild)

### Backend
- `apps/api/src/whatsapp/whatsapp.service.ts` — Meta Cloud API (1902 linhas). `connectionMode: 'cloud_api' | 'local_demo' | 'configuration_incomplete'`. Has `dispatchCloudApiMessage`, `handleWebhook`, `receiveInboundMessage`, `logMessage`. Injects AgentRunnerService e JourneyService.
- `apps/api/src/email/email.service.ts` — nodemailer SMTP (Mailtrap). Fallback local_demo.
- `apps/api/src/agent/agent-runner.service.ts` — Reactive agent via `processInboundMessage`. Proactive stub `initiateProactiveIfAssigned` (cria conversa skeleton, gera greeting AI, chama whatsappService.logMessage).
- `apps/api/src/agent/agent-prompt.builder.ts` — `buildAgentCompiledPrompt`, `normalizeAgentPromptProfile`.
- `apps/api/src/stage-rule/` — StageRule CRUD module + BullMQ queue service.
- `apps/api/src/card/card.service.ts` — Has automation state builder, injects WhatsappService, EmailService, StageRuleService, AgentRunnerService.

### Frontend
- `apps/web/src/app/formularios/page.tsx` — Full form builder UI with drag-and-drop, preview, embed code generator (iframe + script with postMessage resize).
- `apps/web/src/stores/useLeadFormStore.ts` — Zustand store for LeadForm CRUD + analytics.
- `apps/web/src/stores/useKanbanStore.ts` — Zustand store with all Kanban operations including StageRule management.
- `apps/f/[tenantSlug]/[slug]/page.tsx` — Public form page with `embed=1` support + postMessage height sync.

### Schema
- `LeadForm` model — fields as Json, links to Stage and Tenant.
- `LeadFormSubmission` model — payload as Json, optional card/contact FK.
- `WhatsAppAccount` model — phoneNumber, phoneNumberId, wabaId, accessToken, status (CONNECTED/DISCONNECTED/QR_READY/ERROR).
- `WhatsAppEvent` model — kind, status, source, payload as Json.
- `WhatsAppMessage` model — contactId, content, direction, externalId.

---

## Gray Areas Requiring Decisions

### 1. WhatsApp Provider Architecture (MAJOR)

**Situação**: O código atual usa Meta Cloud API diretamente (WhatsAppService com connectionMode cloud_api/local_demo). Phase 03 exige Evolution API.

**Options**:
- **A. Migration completa**: Substituir Meta Cloud API por Evolution API. WhatsAppAccount fields mudam para Evolution API concepts (instance name, API key, webhook URL). Breaking change para tenants configurados com Cloud API.
- **B. Provider abstraction**: Interface `IWhatsAppProvider` com implementations `MetaCloudProvider` e `EvolutionProvider`. WhatsAppAccount ganha campo `provider: 'meta_cloud' | 'evolution'`. Permite migração gradual.
- **C. Evolution API como primary + Meta Cloud como fallback**: Evolution API é o provider default. Cloud API mantido para backwards compatibilidade mas não exposto na UI nova.

**Recommendation: Option B (Provider Abstraction)**
- Why: Tenants existentes podem ter Cloud API configurado. Evolution API é o novo default para Phase 03, mas não queremos quebrar quem já configurou.
- How: Criar interface com métodos `sendMessage`, `receiveWebhook`, `getAccountStatus`, `disconnect`, `connect`. WhatsAppService vira facade que delega ao provider ativo por tenant/account.
- Schema evolution: Adicionar `provider` field em WhatsAppAccount. Evolution API usa `instanceName` + `apiKey` (different from Cloud API's phoneNumberId + accessToken).
- AgentRunnerService chama WhatsAppService facade (sem saber qual provider).
- **Impact**: Medium. WhatsAppService é grande (1900 linhas). Facade pattern permite extrair sem reescrever tudo de uma vez.

### 2. Evolution API Connection Model

**Decisão**: Evolution API funciona com instances (cada WhatsAppAccount = uma instance). A conexão é via QR code scan ou API key.

**Connection flow**:
1. Tenant cria WhatsAppAccount no Saaso → backend cria instance na Evolution API
2. Retorna QR code URL → frontend exibe QR para scan
3. Após scan, webhook da Evolution API notifica Saaso de mensagens recebidas
4. Saaso roteia mensagem recebida para AgentRunnerService (se agente ativo) ou inbox

**Webhook**: Evolution API envia webhook para `POST /whatsapp/evolution-webhook` com payload contendo `instance`, `data.phoneNumber`, `data.message`.

**Decisão confirmada**: Evolution API será configurado via variável de ambiente `EVOLUTION_API_URL` + `EVOLUTION_API_KEY` (global instance, multi-tenant). Cada tenant cria sua própria instance via API.

### 3. Form Submission → Agent Trigger

**Situação**: `initiateProactiveIfAssigned` já existe como stub. Form submission cria card automaticamente, mas não dispara agente.

**Decisão**: O trigger para agente proativo D0 deve ser o mesmo para todas as fontes de entrada (form, Meta webhook, manual entry):
- Quando card é criado (via qualquer fonte), CardService verifica se existe agente ativo na etapa
- Se existe, chama `AgentRunnerService.initiateProactiveIfAssigned(cardId, stageId, tenantId)`
- Full implementation do stub: gerar greeting via AI, enviar via WhatsApp (agora via provider abstraction)

**Why**: Mantém consistência. D0 é o mesmo independente de como o lead entrou.

### 4. Form Submission Flow (Backend)

**Situação**: LeadFormSubmission já existe no schema. Falta o endpoint de submit público (`POST /forms/:slug/submit`).

**Decisão**:
- Endpoint público (sem auth JWT) — qualquer um pode submeter um form pelo slug
- Payload validation: JSON com campos do form
- Mapeamento: fields com `mapTo` conhecido → cria Contact + Card + LeadFormSubmission
- Após criar card → trigger agente proativo (decisão 3)
- Rate limiting por IP para evitar spam

**Why**: Formulário embedded no site do cliente é acessado por visitantes não-autenticados.

### 5. Form Embed Security

**Situação**: `apps/f/[tenantSlug]/[slug]/page.tsx` usa `postMessage` com `targetOrigin` adequado quando `embed=1`. Embed script no builder usa `referrerPolicy: strict-origin-when-cross-origin` e valida `event.source === iframe.contentWindow`.

**Decisão**: Security já está razoável. Para Phase 03:
- Manter `postMessage` com validação de origin (já implementado)
- Adicionar CSP header na página pública de formulário quando embed=1
- Não abrir links externos em `target="_blank"` sem `rel="noopener noreferrer"`

**Why**: postMessage com validação já evita message injection de terceiros. CSP adiciona camada extra.

### 6. Meta Lead Forms vs Meta Lead Ads

**Situação**: Phase 02 já implementou Meta Lead Ads (webhook de leads de campanhas de anúncios). Phase 03 menciona "Meta Lead Forms integration" (formulários nativos do Facebook/Instagram em páginas/orgânicos).

**Decisão**: Meta Lead Ads e Meta Lead Forms usam o MESMO webhook endpoint (Meta Platform Webhooks). A diferença está no tipo de payload e no mapeamento:
- Reutilizar `MetaWebhookMapping` e `MetaWebhookService` de Phase 02
- Meta Lead Forms: leads orgânicos de páginas FB/IG (sem campanha)
- Meta Lead Ads: leads de campanhas pagas (com campaign_id)
- Mesmo flow: webhook → mapeia pipeline/stage → cria card → trigger agente D0

**Why**: Evitar duplicação de código. A infraestrutura de webhook já suporta ambos os casos.

### 7. Email Service Evolution

**Situação**: `email.service.ts` usa nodemailer com Mailtrap SMTP. Envia emails text-only (sem HTML body).

**Decisão**: Para Phase 03, adicionar suporte a HTML body nos emails de régua. Mailtrap continua como provider SMTP (não mudar). Template de email já tem campo `body` em StageMessageTemplate — validar se pode ser HTML.

**Why**: Emails de régua de nutrição precisam de formatação HTML para links, botões CTA, branding.

### 8. Agent Proactive Message Channel

**Situação**: `initiateProactiveIfAssigned` gera greeting via AI e envia via `whatsappService.logMessage`. Mas o lead pode não ter WhatsApp (tem só email).

**Decisão**: Agente proativo D0 deve tentar WhatsApp primeiro (se contact.phone existe). Se não, enviar email (se contact.email existe). Se nenhum, logar no card e não enviar.

**Why**: Lead de formulário pode ter preenchido só email. Lead de Meta Ads pode ter só phone.

---

## Implementation Strategy Summary

### Wave 1: Foundation
- Provider abstraction interface para WhatsApp
- Evolution API service implementation
- WhatsAppAccount schema extension (provider field, evolution fields)
- Email service HTML body support

### Wave 2: Form Entry + Agent Trigger
- Public form submit endpoint (`POST /forms/:slug/submit`)
- Card creation from form submission
- Full `initiateProactiveIfAssigned` implementation with channel fallback
- Rate limiting for public endpoint

### Wave 3: Evolution Webhook + Agent Integration
- Evolution API webhook endpoint
- Webhook → AgentRunnerService routing
- QR code connect flow for WhatsApp accounts

### Wave 4: Meta Lead Forms (reuse Phase 02 infra)
- Extend MetaWebhookMapping for Lead Forms (non-campaign)
- Same webhook handler with extended mapping logic

### Wave 5: Frontend
- WhatsApp account settings page (Evolution API provider UI)
- Form submission flow validation (already has builder)
- Agent status badge improvements
- QR code display for WhatsApp connection

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Evolution API version mismatch | Pin Evolution API version in docs, test with v2.x |
| Provider abstraction over-engineering | Keep interface minimal (4 methods max initially) |
| Form endpoint spam/abuse | Rate limiting per IP, optional reCAPTCHA v2 |
| Breaking existing Cloud API tenants | Provider abstraction preserves both modes |
