# Phase 2: CRM v2 — Automação de Réguas — Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Automação completa do funil CRM: réguas de mensagens automáticas por etapa, webhook Meta Lead Ads alimentando o Kanban, agente IA respondendo conversas e movendo cards, takeover pelo SDR.

**Não inclui:** campanhas em massa, SMS, Instagram DM, email marketing (fase posterior).

</domain>

<decisions>
## Implementation Decisions

### Réguas Automáticas por Etapa

- **Modelo:** Cada etapa do pipeline tem sua própria régua configurável (não uma régua global por pipeline)
- **Configuração:** Na tela de edição da etapa (inline no Kanban) — usa os templates de mensagem já criados na v1
- **Sequência:** D0 (imediato ao entrar na etapa), D+1, D+3, D+7... — cada step usa um template de mensagem da etapa
- **Trigger de início:** Card entra na etapa (automático) OU ativação manual pelo SDR — ambos suportados
- **O SDR pode pausar/retomar** a régua de qualquer card via botão no card
- **Cancelamento:** Ao mover o card para outra etapa, os jobs pendentes da etapa anterior são cancelados e a régua da nova etapa começa do D0
- **Horário comercial:** Configurável por tenant — tenant define janela (ex: seg-sex 8h–18h). Disparos fora da janela avançam para próximo horário válido
- **Engine:** JourneyQueueService com BullMQ já existe — réguas por etapa são uma extensão desse modelo

### Agente IA por Etapa

- **Atribuição:** Tenant atribui um agente (já cadastrado em `/agentes`) a cada etapa do Kanban — configuração inline na etapa
- **Triggers:** AMBOS — proativo no D0 (agente envia mensagem ao card entrar na etapa) + responde mensagens recebidas do contato enquanto card está na etapa
- **AgentRunnerService:** Já implementado — precisa ser conectado ao evento de entrada de card + ao webhook de mensagens recebidas
- **Takeover pelo SDR:** Botão explícito no CardDetailSheet — SDR vê status do agente (ativo / em takeover) e pode clicar para pausar. Agente fica pausado até SDR reativar
- **Handoff automático:** AgentRunnerService já detecta palavras-chave de handoff — mantém comportamento existente
- **Alerta:** Notificação no card quando agente pede handoff (já existe AgentConversationStatus.HANDOFF_REQUIRED)

### Movimentação Semi-Automática pelo Agente

- **Comportamento:** Agente move card automaticamente ao classificar positivo — sem confirmação do SDR
- **Auditoria:** Cada movimentação registrada no activity log com agentId, motivo, timestamp
- **Critérios de classificação:** Configuráveis por etapa — tenant define critérios de classificação positiva (ex: "cliente confirmou interesse", "agendamento marcado")
- **Implementação:** Critérios salvos na etapa; agente recebe os critérios no prompt compilado; quando detecta critério positivo, chama endpoint para mover card
- **Claude's Discretion:** Formato exato dos critérios na etapa (campos de texto simples ou estruturado)

### Webhook Meta Lead Ads

- **Destino do lead:** Etapa configurável por formulário Meta — cada formulário pode mapear para uma etapa diferente do mesmo pipeline
- **Configuração:** Tela em `/configuracoes` ou `/pipelines` — tenant mapeia: formulário Meta ID → pipeline → etapa destino
- **Mapeamento de campos:** Automático para campos padrão (nome, telefone, email). Campos extras do formulário Meta → campo "notas" do card (sem UI de mapeamento)
- **Criação do contato:** Se contato com aquele telefone/email já existe no tenant, reutiliza; caso contrário cria novo
- **Notificação:** SDR recebe notificação quando lead entra via webhook (canal: in-app ou integração futura)
- **Claude's Discretion:** Autenticação do webhook Meta (verify token pattern padrão do Meta)

</decisions>

<specifics>
## Specific Requirements

- Régua deve respeitar horário comercial configurado pelo tenant antes de despachar via BullMQ
- Botão de pause/resume da régua fica visível no CardDetailSheet (onde já existem SendMessageSection e ActivityTimeline)
- Status do agente (ativo/takeover) deve aparecer no CardDetailSheet próximo ao histórico de conversas
- Movimentação pelo agente gera entrada no ActivityTimeline com origem "Agente: [nome]"
- Webhook Meta usa verify_token pattern do Meta Platform (GET para verificação, POST para leads)
- Configuração de etapa destino por formulário precisa de um campo "formulário Meta ID" na etapa ou em tela dedicada

</specifics>

<code_context>
## Existing Infrastructure (Codebase Scouting)

**Backend — já implementado:**
- `apps/api/src/agent/` — AgentService, AgentRunnerService, AgentPromptBuilder completos
- `apps/api/src/journey/` — JourneyService + JourneyQueueService com BullMQ/Redis (poller fallback)
- `apps/api/src/campaign/` — CampaignService + CampaignQueueService
- `AgentConversationStatus` — OPEN, HANDOFF_REQUIRED (Prisma enum)
- `apps/api/src/whatsapp/` — WhatsAppService com Evolution API

**Frontend — já existe:**
- `/agentes` — CRUD de agentes
- `/journeys` — visualização de journeys
- `/campanhas` — campanhas
- `CardDetailSheet` — já tem SendMessageSection, ActivityTimeline, MoveCardButtons

**O que falta conectar:**
- Régua por etapa: StageRule model + trigger ao mover card + BullMQ jobs
- Agente por etapa: campo `agentId` na Stage + AgentRunnerService conectado ao webhook de mensagens recebidas
- Webhook Meta: endpoint público + parsing + criação de card
- UI: configurações de régua e agente inline na etapa + status no CardDetailSheet

</code_context>

<canonical_refs>
## Canonical References

- `.planning/seeds/crm-v2-automacao.md` — Seed original com escopo da fase
- `.planning/notes/crm-v1-escopo.md` — Fronteira v1/v2 e decisões da fase anterior
- `apps/api/src/agent/agent-runner.service.ts` — AgentRunner já implementado
- `apps/api/src/journey/journey-queue.service.ts` — BullMQ queue service
- `apps/api/src/journey/journey.service.ts` — Journey engine (modelo de automação existente)

</canonical_refs>

<deferred>
## Deferred Ideas (Out of Scope for Phase 2)

- SMS como canal de disparo
- Instagram DM
- Email marketing (além do transacional já existente)
- Google Ads webhook
- Self-service onboarding de novos tenants
- Campanhas em massa automáticas por régua
- Dashboard de analytics de conversão por etapa

</deferred>
