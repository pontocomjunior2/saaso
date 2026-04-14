# PRD — Revenue Ops OS Autônomo com Agentes de IA

## 1. Visão do Produto

**Produto:** SaaS horizontal que transforma a operação comercial em um sistema autônomo de marketing, vendas, onboarding e sucesso do cliente. Cada workspace possui agentes de IA, playbooks e réguas de nutrição capazes de captar, qualificar, nutrir, vender, iniciar onboarding e sustentar relacionamento com takeover humano quando necessário.

**Problema:** Empresas e operações comerciais perdem receita por depender de follow-up manual, qualificação inconsistente, pouca visibilidade da jornada do lead e ausência de automação confiável entre captação, venda e pós-venda.

**Solução:** Um sistema operacional comercial com inbox, pipelines configuráveis, agentes criados do zero, base de conhecimento por agente, réguas de nutrição por etapa e campanhas. A V1 foca em inbound com `formulário + entrada manual + WhatsApp`, enquanto a arquitetura já nasce pronta para outbound, prospecção fria e modo agência com múltiplos workspaces.

> [!IMPORTANT]
> Atualização estratégica de 18 de março de 2026:
> - O produto é `horizontal`, não vertical.
> - O ICP inicial é `empresa com operação própria`.
> - `Agency mode` entra depois, mas o modelo deve nascer `tenant -> workspace-ready`.
> - O comportamento padrão é `automação 100% autônoma`, com takeover manual por conversa ou por agente.
> - O usuário define seu próprio funil e número de etapas.
> - A navegação deve ser enxuta: `Knowledge Base` fica sob `Agentes`; `Canais` sai da sidebar principal e vai para `Configurações/Integrações`.

---

## 2. Personas

| Persona | Descrição | Necessidade principal |
|---|---|---|
| **Gestor Comercial** | Dono ou gerente de equipe de vendas | Visibilidade do pipeline, métricas, controle de equipe |
| **SDR / Vendedor** | Operador diário do funil | Mover cards, interagir com leads, delegar ao agente IA |
| **Operador de Marketing** | Cria jornadas e réguas | Builder visual de automações, segmentação |
| **Admin SaaS** | Administrador da plataforma | Gerenciar tenants, planos, billing, suporte |

---

## 3. Módulos do Sistema

### 3.1 — Autenticação, Tenant e Workspace-ready
- Login com e-mail/senha (JWT + refresh token)
- Convite de usuários por e-mail
- Roles: `OWNER`, `ADMIN`, `MANAGER`, `AGENT`
- Tenant como conta pagante
- Estrutura pronta para `Workspace`, mesmo que a V1 opere com um workspace padrão
- Isolamento total de dados por tenant (`tenantId` em todas as queries)
- Gestão de perfil e preferências do usuário

### 3.2 — Inbox, Pipelines e Operação Comercial
- Inbox unificada por conversa
- Timeline operacional com mensagens, ações disparadas e takeover
- CRUD de pipelines (ex: "Inbound", "Onboarding", "Sucesso do Cliente")
- Etapas customizáveis por pipeline (drag-and-drop para reordenar)
- Cards representando leads/deals
- Drag-and-drop de cards entre etapas
- Campos customizados por pipeline
- Filtros e busca por nome, tag, responsável, data
- Atribuição de responsável (usuário) ao card

### 3.3 — Contatos, Empresas e Segmentação
- CRUD de contatos com telefone, e-mail, tags
- CRUD de empresas vinculadas a contatos
- Histórico de interações (timeline)
- Merge de contatos duplicados
- Importação em massa (CSV)
- Segmentos e listas dinâmicas
- Entrada manual de leads e oportunidades

### 3.4 — Réguas de Nutrição e Playbooks
- Builder visual orientado a negócio, não a nós genéricos
- Triggers: entrada em etapa, tag adicionada, tempo decorrido, mudança de status, evento externo
- Ações: enviar mensagem, mover card, adicionar tag, agendar tarefa, iniciar agente, pausar automação, encerrar execução
- Condições: if/else baseado em campo, tag, tempo sem resposta, canal, origem, score
- Versionamento da régua
- Logs de execução por contato e por conversa

### 3.5 — Agentes de IA
- Criação de agente do zero com `prompt + temperatura + base de conhecimento`
- Templates básicos criados pelo super admin
- Configuração de agente por etapa, objetivo ou função
- Ações do agente: responder mensagem, qualificar lead, mover card, agendar reunião, iniciar onboarding, manter relacionamento
- Handoff para humano (takeover manual por conversa ou por agente)
- Pausar, desligar e reativar automação
- Histórico de conversas do agente
- Limites de uso por plano (tokens/mês)

### 3.6 — Base de Conhecimento
- Upload de documentos (PDF, DOCX, TXT)
- Embedding vetorial com pgvector
- Organização por categorias/pastas
- Vinculação de base a agentes específicos
- Re-indexação manual e automática
- Chunking inteligente de documentos
- UI agrupada dentro de `Agentes`

### 3.7 — Canais e Captação
- Formulários públicos com embed e URL própria
- Entrada manual de leads
- Integração via WhatsApp Cloud API oficial
- Envio e recebimento de mensagens (texto, mídia, templates)
- Webhooks para mensagens recebidas
- Status de entrega (sent, delivered, read)
- Cada tenant usa seu próprio número e configura seus próprios canais
- `Canais` ficam em `Configurações/Integrações`, não como menu principal

### 3.8 — Campanhas e Outbound
- Campanhas ligadas a listas, segmentos ou audiências
- Sequências de mensagens e follow-up
- Estrutura preparada para outbound assistido e outbound frio
- Feature flag para habilitação de prospecção fria
- Modelo preparado para `Prospect`, `Audience`, `Campaign`, `Sequence`, `SequenceRun`
- V1 com provisionamento arquitetural; rollout gradual na fase seguinte

### 3.9 — Templates de Funis, Agentes e Réguas
- Biblioteca de templates pré-construídos
- Templates de agente publicados pelo super admin
- Exportar pipeline + régua como template
- Importar template em novo tenant
- Categorização (vendas, onboarding, sucesso, retenção, reativação)

### 3.10 — Billing e Planos (SaaS)
- Planos: Free, Starter, Pro, Enterprise
- Limites por plano: nº de workspaces, pipelines, agentes, tokens IA/mês, contatos, campanhas
- Integração Stripe (checkout, portal, webhooks)
- Trial period configurável
- Upgrades e downgrades pro-rated
- Dashboard de uso por tenant

### 3.11 — Analytics e Dashboard
- Dashboard principal com KPIs: leads novos, conversão, tempo médio por etapa
- Funil de conversão visual
- Performance por agente IA vs humano
- Métricas de execução de réguas
- Métricas de takeover e autonomia
- Relatórios exportáveis (CSV/PDF)
- Métricas de uso do WhatsApp (mensagens enviadas/recebidas)

### 3.12 — Navegação do Produto

**Sidebar principal enxuta**
- `Dashboard`
- `Inbox`
- `Clientes`
- `Pipelines`
- `Agentes`
- `Réguas`
- `Campanhas`
- `Analytics`

**Submenus recomendados**
- `Clientes`: `Contatos`, `Empresas`, `Segmentos`
- `Agentes`: `Meus agentes`, `Templates`, `Knowledge Base`
- `Campanhas`: `Campanhas`, `Listas`, `Templates de mensagem`

**Fora da sidebar principal**
- `Configurações`
- `Canais`
- `Integrações`
- `Usuários`
- `Permissões`

> [!NOTE]
> `Projetos` não deve ser item central do produto. O nome é ambíguo e remete a software de gestão genérico. No futuro, o conceito correto para múltiplos clientes será `Workspace`.

---

## 4. Arquitetura Técnica

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                    │
│  App Router · React Server Components · Tailwind CSS    │
│  Zustand (state) · React Query (data fetching)          │
└──────────────────────┬──────────────────────────────────┘
                       │ REST + WebSocket
┌──────────────────────▼──────────────────────────────────┐
│                  BACKEND (NestJS)                        │
│  Modules: Auth · Tenants · Pipelines · Cards ·          │
│           Contacts · Journeys · Agents · Knowledge ·    │
│           WhatsApp · Billing · Analytics                 │
│  Guards: JWT · Roles · Tenant                           │
│  Prisma ORM · Class-validator · Class-transformer       │
└───┬───────────┬───────────┬───────────┬─────────────────┘
    │           │           │           │
    ▼           ▼           ▼           ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌──────────────┐
│Postgres│ │pgvector│ │ Redis  │ │External APIs │
│(Prisma)│ │  (RAG) │ │BullMQ  │ │WhatsApp·Stripe│
└────────┘ └────────┘ └────────┘ └──────────────┘
```

### Stack Detalhada

| Camada | Tecnologia | Justificativa |
|---|---|---|
| **Frontend** | Next.js 14+ (App Router) | SSR, RSC, routing nativo, SEO |
| **Estilização** | Tailwind CSS | Produtividade, design system |
| **State Management** | Zustand + React Query | Leve, type-safe, cache inteligente |
| **Backend** | NestJS (TypeScript) | Módulos, DI, guards, decorators, OOP |
| **ORM** | Prisma | Type-safe, migrations, multi-schema |
| **Banco** | PostgreSQL | Robusto, extensível (pgvector) |
| **Vector DB** | pgvector (extensão PG) | RAG sem infra extra |
| **Filas/Jobs** | Redis + BullMQ | Jobs assíncronos, retries, scheduling |
| **Mensageria** | WhatsApp Cloud API | API oficial da Meta |
| **Billing** | Stripe | Checkout, portal, webhooks |
| **Infra** | Docker + EasyPanel | Deploy simplificado |
| **CI/CD** | GitHub Actions | Automação de testes e deploy |

---

## 5. Modelo de Dados (Entidades Principais)

```
Tenant ──┬── User (roles)
         ├── Workspace
         │    ├── Pipeline ── Stage ── Card ── CardActivity
         │    ├── Contact ── Company
         │    ├── Conversation ── Message ── ConversationEvent
         │    ├── Playbook ── PlaybookVersion ── PlaybookExecution
         │    ├── Agent ── AgentConversation ── AgentMessage
         │    ├── KnowledgeBase ── KnowledgeDocument ── KnowledgeChunk
         │    ├── ChannelAccount ── ChannelMessage
         │    ├── Campaign ── Audience ── Prospect ── SequenceRun
         │    └── Template (pipeline/agent/playbook)
         └── Subscription ── Plan ── UsageRecord
```

> [!IMPORTANT]
> Todas as entidades operacionais devem respeitar `tenantId` e, quando aplicável, `workspaceId`. A V1 pode operar com um workspace padrão, mas o modelo não deve exigir refactor para suportar modo agência.

---

## 6. Requisitos Não-Funcionais

| Requisito | Especificação |
|---|---|
| **Performance** | API < 200ms p95 para operações CRUD |
| **Escalabilidade** | Suportar 1.000 tenants com 10k contacts cada |
| **Segurança** | JWT + RBAC, rate limiting, input sanitization |
| **Disponibilidade** | 99.5% uptime (SLA) |
| **Multi-tenancy** | Isolamento lógico via `tenantId` (shared database) |
| **Observabilidade** | Logs estruturados, health checks, métricas |
| **LGPD** | Consentimento, exportação e exclusão de dados |

---

## 7. Plano de Sprints (4 Fases · 15 Sprints · ~2 semanas cada)

### 📦 FASE 1 — Fundação e Core Operacional (Sprints 1–4)

#### Sprint 1 — Fundação, Segurança e Shell
- Setup do monorepo (apps/web, apps/api, packages/shared)
- Configuração NestJS + Prisma + PostgreSQL
- Configuração Next.js + Tailwind
- Módulo Auth: registro, login, JWT, refresh token
- Módulo Tenant com modelo `workspace-ready`
- Guard de autenticação e tenant isolation
- `ValidationPipe` global no Nest
- Correções de sessão e armazenamento seguro no frontend
- Novo shell visual inspirado no Hostman
- Seed de dados iniciais
- **Entrega:** Base segura com autenticação funcional e layout principal do produto

#### Sprint 2 — Inbox, Pipelines e Board
- Inbox básica por conversa
- CRUD de pipelines
- CRUD de etapas (stages) por pipeline
- Drag-and-drop de etapas para reordenação
- Tela de board visual (Kanban)
- Melhorias de fluidez no drag-and-drop
- Endpoint de listagem com paginação
- **Entrega:** Operação comercial visual com inbox e board utilizáveis

#### Sprint 3 — Clientes, Empresas e Entrada Manual
- CRUD de cards vinculados a etapas
- Drag-and-drop de cards entre etapas (atualiza `stageId`)
- Detalhes do card (sidebar/modal)
- Campos customizáveis (JSON schema)
- CRUD de contatos com validação de telefone
- CRUD de empresas
- Vinculação contato ↔ empresa ↔ card
- Timeline de atividades do contato
- Importação CSV
- Entrada manual de leads e oportunidades
- Segmentos e listas iniciais
- **Entrega:** Base comercial estruturada para captação e operação

#### Sprint 4 — Captação Inbound
- Formulários públicos com publicação e embed
- Integração com WhatsApp Cloud API
- Configuração do WABA por tenant
- Webhook de recebimento de mensagens
- Envio de mensagens de texto
- Vinculação mensagem ↔ contato ↔ card ↔ conversa
- Configuração de canais em `Configurações/Integrações`
- **Entrega:** Entrada inbound funcional por formulário, manual e WhatsApp

### ⚡ FASE 2 — Inbound Autônomo (Sprints 5–8)

#### Sprint 5 — Builder de Agentes
- Configuração de agente por etapa, função ou objetivo
- Prompt system + temperatura + contexto operacional
- Templates básicos de agentes pelo super admin
- Integração com OpenAI API
- Logs de conversa do agente
- **Entrega:** Agentes configuráveis e prontos para operação

#### Sprint 6 — Knowledge Base e Contexto
- Setup pgvector no PostgreSQL
- Embedding de documentos (OpenAI Embeddings API)
- Chunking inteligente de textos
- Upload de documentos (PDF, DOCX, TXT)
- Vinculação de base a agentes
- Busca por similaridade vetorial
- Re-indexação manual
- **Entrega:** Knowledge Base funcional dentro de `Agentes`

#### Sprint 7 — Réguas de Nutrição V1
- Builder visual orientado a etapa, trigger, delay, condição e ação
- Salvar/carregar régua como versão
- Ativar, pausar e duplicar régua
- Templates iniciais baseados no blueprint
- **Entrega:** Builder de réguas funcional

#### Sprint 8 — Runtime de Automação e Takeover
- Processamento de triggers com BullMQ
- Execução de ações (enviar mensagem, mover card, tag, iniciar agente)
- Handoff manual por conversa
- Desligar automação por agente
- Logs de execução por contato e por conversa
- **Entrega:** Inbound autônomo confiável com takeover operacional

---

### 🧠 FASE 3 — Otimização e Outbound Provisionado (Sprints 9–12)

#### Sprint 9 — Analytics e Templates
- Dashboard com KPIs (leads, conversão, tempo por etapa)
- Métricas de autonomia vs takeover
- Biblioteca de templates de agentes, pipelines e réguas
- Preview de template antes de aplicar
- **Entrega:** Operação mensurável e reutilizável

#### Sprint 10 — Campanhas e Audiências
- CRUD de campanhas
- Listas e segmentos de audiência
- Templates de mensagem
- Feature flags de outbound
- **Entrega:** Camada de campanhas pronta para expansão

#### Sprint 11 — Outbound Assistido
- Sequências e cadências
- Disparo para listas importadas ou criadas manualmente
- Classificação de resposta
- Opt-out e suppression list
- **Entrega:** Outbound assistido funcional

#### Sprint 12 — Arquitetura para Prospecção Fria
- Modelo de `Prospect`, `Source`, `ResearchTask`, `EnrichmentTask`
- Permissões, limites e auditoria para agentes prospectadores
- Feature flag para prospecção fria
- UI ainda opcional ou escondida
- **Entrega:** Base pronta para agente prospectador em V2

---

### 💰 FASE 4 — Escala SaaS e Agency Mode (Sprints 13–15)

#### Sprint 13 — Agency Mode
- Suporte real a múltiplos workspaces por tenant
- Permissões por workspace
- Visão consolidada e visão por cliente
- **Entrega:** Estrutura pronta para agências

#### Sprint 14 — Billing e Planos
- Definição de planos e limites
- Integração Stripe: checkout session, customer portal
- Webhooks Stripe (subscription lifecycle)
- Enforcement de limites
- Tela de planos e faturamento
- **Entrega:** Sistema de billing funcional

#### Sprint 15 — Canais Avançados e Polish
- Onboarding wizard para novos tenants
- Preparação para Meta e Google como canais futuros
- Melhorias finais de UX e performance
- Exportação de relatórios (CSV/PDF)
- **Entrega:** Base de produto pronta para expansão de canais e tiers

---

## 8. Definição de MVP

O MVP real é composto pelos **Sprints 1 a 8** e entrega:

- ✅ Registro e login multi-tenant
- ✅ Shell de produto consistente e navegação enxuta
- ✅ Inbox + pipelines + board Kanban funcional
- ✅ Gestão de contatos, empresas, segmentos e entrada manual
- ✅ Formulários + WhatsApp integrados ao fluxo inbound
- ✅ Agentes configuráveis com prompt, temperatura e base de conhecimento
- ✅ Réguas de nutrição com runtime real
- ✅ Takeover humano por conversa ou por agente

> [!NOTE]
> O MVP agora foca na proposta de valor central correta: **operação inbound autônoma com inbox, agentes, réguas e takeover**. Outbound, agency mode e billing entram depois, mas com arquitetura provisionada desde a base.

---

## 9. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Aprovação de templates WhatsApp pela Meta | Atraso na captação e nas campanhas | Iniciar processo de aprovação antecipadamente |
| Custo de tokens OpenAI por tenant | Margem do SaaS | Implementar limites por plano e cache de respostas |
| Complexidade do builder de réguas | Atraso na fase 2 | Priorizar builder semântico por etapa e evitar canvas genérico |
| Ambiguidade de navegação (`Clientes`, `Projetos`, `Campanhas`) | Baixa adoção e curva de aprendizado ruim | Manter sidebar enxuta e esconder setup em `Configurações` |
| pgvector em escala | Performance de RAG | Monitorar queries e indexar adequadamente |
| Regras de compliance para outbound frio | Bloqueio de canal ou risco legal | Usar feature flags, opt-out e rollout gradual |
| LGPD e dados de WhatsApp | Compliance | Implementar opt-in, export e delete desde o MVP |

---

## 10. Verificação

### Testes Automatizados
- **Unit tests**: Jest + NestJS testing utilities para cada service/controller
- **Integration tests**: Supertest para rotas da API com banco de teste
- **E2E**: Playwright para fluxos críticos (login → criar pipeline → mover card)
- **Comando**: `npm run test` (unit) e `npm run test:e2e` (end-to-end)

### Verificação Manual
- Testar fluxo completo de login e criação de tenant
- Validar navegação da sidebar principal e submenus
- Criar pipeline, adicionar etapas e arrastar cards com fluidez
- Criar agente, anexar base de conhecimento e testar resposta
- Criar régua, ativar trigger e verificar execução
- Enviar/receber mensagem WhatsApp pelo inbox
- Testar takeover manual por conversa
- Validar isolamento: dados de tenant A não aparecem no tenant B
