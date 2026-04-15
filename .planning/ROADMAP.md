# Roadmap: Saaso CRM

## Overview

Plataforma SaaS multi-tenant de CRM com Kanban configurável, réguas de nutrição e automação via IA. Cada tenant cria seu próprio pipeline do zero ou carrega um template, gerencia leads via Kanban e dispara mensagens de WhatsApp/Email manualmente (v1) ou automaticamente por régua (v2).

## Phases

- [ ] **Phase 1: CRM v1 — Funil Manual** - Kanban vazio por padrão, etapas configuráveis inline, templates de pipeline, click-to-send WhatsApp/Email por card
- [ ] **Phase 2: CRM v2 — Automação de Réguas** - Disparos automáticos por régua/dia, webhook Meta Lead Ads, agente IA por etapa
- [x] **Phase 3: Agentes Efetivos + Formulários + Canais** - Evolution API WhatsApp, form entry com trigger de agente, rate limiting, channel fallback
- [ ] **Phase 4: Form Editor + Embed + Frontend** - Editor visual de formulários, embed script, Meta Lead Forms integration, frontend form builder UI
- [ ] **Phase 5: Agent Conversation Flow** - Multi-turn memory, hybrid qualification (agent marks + human confirms), structured output, unified audit timeline

## Phase Details

### Phase 1: CRM v1 — Funil Manual
**Goal**: Operador cria pipeline personalizado (ou carrega template), adiciona leads manualmente, e dispara mensagens de WhatsApp/Email com 1 clique pelo card, com histórico de atividades completo.
**Depends on**: Nothing (first phase)
**Requirements**: REQ-01, REQ-02, REQ-03, REQ-04, REQ-05
**Success Criteria** (what must be TRUE):
  1. Tenant abre o Kanban e encontra board vazio — pode criar etapas inline ou carregar 1 dos 5 templates disponíveis
  2. Operador cria um card de lead manualmente com nome, telefone, email e origem
  3. Operador abre o card, seleciona template de mensagem da etapa atual e dispara para WhatsApp ou Email com 1 clique
  4. Activity log do card mostra todas as mensagens enviadas com timestamp, canal e operador
  5. Operador move o card entre etapas via drag-and-drop ou botão no card
**Plans:** 4 plans
Plans:
- [ ] 01-01-PLAN.md — Schema + Backend Foundation (StageMessageTemplate, CardActivity expansion, CRUD REST)
- [ ] 01-02-PLAN.md — Pipeline Templates + Send Message API + Email Service
- [ ] 01-03-PLAN.md — Frontend Kanban (empty state, stage creation inline, template loader modal)
- [ ] 01-04-PLAN.md — Frontend Card UX (send message section, activity log, move card buttons)

### Phase 2: CRM v2 — Automação de Réguas
**Goal**: Réguas de mensagens disparam automaticamente por etapa e dia (D0, D+1, D+3...). Meta Lead Ads alimenta o Kanban sem intervenção manual. Agente IA pode ser atribuído por etapa.
**Depends on**: Phase 1
**Requirements**: REQ-06, REQ-07, REQ-08
**Success Criteria** (what must be TRUE):
  1. Lead de campanha Meta Ads entra automaticamente no Kanban via webhook
  2. Mensagem de boas-vindas (D0) é disparada automaticamente ao entrar na etapa
  3. Régua executa sequência configurada (D+1, D+3...) sem intervenção manual
  4. Agente IA atribuído à etapa responde conversas no WhatsApp automaticamente
**Plans:** 5 plans
Plans:
- [x] 02-01-PLAN.md — Prisma schema + business hours utility + db push
- [x] 02-02-PLAN.md — StageRule CRUD module + BullMQ queue service (REQ-06 backend)
- [x] 02-03-PLAN.md — Meta webhook module + mapping CRUD (REQ-07 backend)
- [x] 02-04-PLAN.md — Card move hooks + agent proactive D0 + card-move endpoint (REQ-06+REQ-08 integration)
- [ ] 02-05-PLAN.md — Frontend: StageRuleDrawer, CardRuleStatusPanel, AgentStatusBadge, MetaWebhookConfigSection

### Phase 3: Agentes Efetivos + Formulários + Canais
**Goal**: Agentes funcionam efetivamente — entrada de leads via formulário (próprio e Meta), integração WhatsApp via Evolution API, email via Mailtrap. Formulários embeddáveis no site do cliente com editor visual. Lead que entra no funil dispara agente proativo automaticamente.
**Depends on**: Phase 1, Phase 2
**Requirements**: REQ-09, REQ-10, REQ-11
**Success Criteria** (what must be TRUE):
  1. Formulário embedded no site do cliente captura lead e cria card no Kanban automaticamente
  2. Agente IA dispara WhatsApp real via Evolution API ao entrar nova etapa (D0)
  3. Email de régua é enviado via Mailtrap API (já configurado, validar integração)
  4. Editor de formulário permite cliente criar/editar campos e embedar no site
  5. Meta Lead Forms integration captura leads de formulários do Facebook/Instagram
**Plans:** 5 plans
Plans:
- [ ] 03-01-PLAN.md — Evolution API WhatsApp service + provider abstraction
- [ ] 03-02-PLAN.md — Lead form entry flows + agent proactive trigger hooks
- [ ] 03-03-PLAN.md — Form editor + embed script (iframe + postMessage secure)
- [ ] 03-04-PLAN.md — Meta Lead Forms webhook integration
- [ ] 03-05-PLAN.md — Frontend: form builder UI, embed code generator, form preview

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. CRM v1 — Funil Manual | 0/4 | Planning complete | - |
| 2. CRM v2 — Automação de Réguas | 4/5 | Executing | 2026-04-14 |
| 3. Agentes Efetivos + Formulários + Canais | 0/5 | Planning complete | 2026-04-14 |

### Phase 5: Agent Conversation Flow — Multi-turn Memory, Hybrid Qualification, Audit Timeline

**Goal:** Agente conversa de forma multi-turn com memória persistida, decide via structured output (should_respond/mark_qualified/request_handoff/suggested_next_stage_id), sinaliza qualificação para humano confirmar avanço, e toda interação fica auditável em timeline unificada.
**Requirements**: TBD
**Depends on:** Phase 3, Phase 4
**Plans:** 0 plans (CONTEXT ready at `.planning/phases/05-agent-conversation-flow/05-CONTEXT.md`)

Plans:
- [ ] TBD (run `/gsd-plan-phase 5` to break down)
