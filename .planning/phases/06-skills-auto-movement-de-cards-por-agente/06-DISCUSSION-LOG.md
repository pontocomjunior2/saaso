# Phase 06: Skills + Auto-movement - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-22
**Phase:** 06-skills-auto-movement-de-cards-por-agente
**Areas discussed:** Skill entity shape, Auto-movement gates, Frontend — Skill manager + movementMode toggle

---

## Skill entity shape

| Option | Description | Selected |
|--------|-------------|----------|
| Tenant-level (reutilizável) | Skills ficam em biblioteca do tenant, reutilizáveis entre agentes | ✓ |
| Agent-local (interna) | Cada agente tem suas próprias skills, sem biblioteca global | |

**User's choice:** Tenant-level (reutilizável)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Nome + conteúdo apenas | Skill simples: { name, content }. Ordenação no join AgentSkill. | ✓ |
| Nome + conteúdo + descrição | Adiciona description (para UI, não injetado no prompt) | |
| Nome + conteúdo + tags/categoria | Organização avançada de bibliotecas maiores | |

**User's choice:** Nome + conteúdo apenas (YAGNI)

---

## Auto-movement gates

| Option | Description | Selected |
|--------|-------------|----------|
| Todos os 3 gates obrigatórios | mark_qualified AND forward-only AND cooldown | ✓ |
| mark_qualified + forward-only apenas | Sem cooldown gate | |
| Só forward-only | Move sempre que sugerir avançar | |

**User's choice:** Todos os 3 gates — mais seguro

---

| Option | Description | Selected |
|--------|-------------|----------|
| 24 horas fixo | Simples, sem configuração por etapa | ✓ |
| Configurável por etapa | Operador define cooldown (1h, 6h, 24h) por stage | |
| Sem cooldown | Confiar apenas nos outros gates | |

**User's choice:** 24 horas fixo

---

| Option | Description | Selected |
|--------|-------------|----------|
| Por card via CardActivity | Verifica auto_moved_by_agent nas últimas 24h | ✓ |
| Por conversa via AgentConversation | Campo lastAutoMoveAt, requer migração | |

**User's choice:** Por card via CardActivity (zero infra adicional)

---

## Frontend — Skill manager + movementMode toggle

| Option | Description | Selected |
|--------|-------------|----------|
| Nova página /agentes/skills | CRUD completo da biblioteca do tenant | ✓ |
| Dentro do editor de agente (inline) | Gerenciamento dentro do contexto do agente | |
| Seção nas Configurações | Skills vivem fora da área de agentes | |

**User's choice:** Nova página /agentes/skills

---

| Option | Description | Selected |
|--------|-------------|----------|
| Seção "Skills" no editor do agente com drag-and-drop | Atribuição e ordenação no contexto do agente | ✓ |
| Da biblioteca: botão "Atribuir a agentes" | Fluxo inverso, bom para gerenciar muitos agentes | |

**User's choice:** Seção no editor do agente com drag-and-drop

---

| Option | Description | Selected |
|--------|-------------|----------|
| Painel de configuração da etapa no Kanban | Toggle no contexto da etapa | ✓ |
| No editor do agente, por agente | Menos preciso (agente pode estar em múltiplas etapas) | |
| Página de configurações de pipeline | Nível de pipeline, lista todas etapas | |

**User's choice:** Painel de configuração da etapa no Kanban

---

## Claude's Discretion

- Formato exato da injeção de skills no system prompt (header, separadores)
- Estrutura de rotas e controllers para Skill CRUD API
- Drag-and-drop library (verificar @dnd-kit antes de adicionar)

## Deferred Ideas

- Cooldown configurável por etapa
- Gates individuais configuráveis pelo operador
- Auditor agent offline/online
- Skill categories/tags
- Rollback de auto-move pelo SDR
