# Roadmap: Saaso CRM

## Overview

Plataforma SaaS multi-tenant de CRM com Kanban configurável, réguas de nutrição e automação via IA. Cada tenant cria seu próprio pipeline do zero ou carrega um template, gerencia leads via Kanban e dispara mensagens de WhatsApp/Email manualmente (v1) ou automaticamente por régua (v2).

## Phases

- [ ] **Phase 1: CRM v1 — Funil Manual** - Kanban vazio por padrão, etapas configuráveis inline, templates de pipeline, click-to-send WhatsApp/Email por card
- [ ] **Phase 2: CRM v2 — Automação de Réguas** - Disparos automáticos por régua/dia, webhook Meta Lead Ads, agente IA por etapa

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
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. CRM v1 — Funil Manual | 0/4 | Planning complete | - |
| 2. CRM v2 — Automação de Réguas | 0/0 | Not started | - |
