# Phase 06: Skills + Auto-movement de cards por agente - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 06 delivers:
1. **Skill como entidade plugável** — modelo `Skill` tenant-level + `AgentSkill` N:N join. Cada agente carrega um conjunto de skills ordenadas injetadas no system prompt.
2. **movementMode por etapa** — campo `movementMode: MANUAL | AUTO` em `Stage`. Toggle configurado pelo operador no painel de edição da etapa no Kanban.
3. **Auto-move com gates** — quando AUTO, `suggested_next_stage_id` do agente é aplicado automaticamente se: `mark_qualified=true` AND destino tem `order > stage atual` (forward-only) AND nenhum `auto_moved_by_agent` no card nas últimas 24h (cooldown).
4. **Audit trail** — todo movimento automático gera `CardActivity` com type `auto_moved_by_agent` + snapshot da decisão estruturada no `metadata`.
5. **Frontend** — `/agentes/skills` para CRUD da biblioteca de skills; seção "Skills" no editor de agente com drag-and-drop de ordenação; toggle movementMode no painel de edição de etapa no Kanban.

**Out of scope:**
- Cooldown configurável por etapa (v1 = 24h fixo)
- Gates individuais configuráveis pelo operador (todos 3 sempre obrigatórios)
- Auditor agent offline/online (deferred desde Phase 5)

</domain>

<decisions>
## Implementation Decisions

### Skill Entity (Schema)
- **D-01 (Skill scope):** Skill é tenant-level — biblioteca compartilhada entre agentes do mesmo tenant. Schema: `Skill { id, name, content, tenantId, createdAt, updatedAt }`.
- **D-02 (Skill fields):** Apenas `name` + `content` (texto do prompt a ser injetado). Sem description, tags ou categoria na v1. YAGNI.
- **D-03 (AgentSkill join):** `AgentSkill { id, agentId, skillId, order Int }` — a ordem de injeção é definida por agente, não pela skill global. Um agente pode ter a mesma skill em posições diferentes que outro agente.

### Auto-movement Gates
- **D-04 (All gates required):** Para o auto-move acontecer, TODOS os 3 gates devem passar simultaneamente:
  1. `mark_qualified: true` na resposta estruturada do agente (campo do `StructuredReplySchema` de Phase 5)
  2. forward-only: `suggested_next_stage_id` aponta para etapa com `Stage.order` **maior** que o `Stage.order` atual do card
  3. cooldown: sem `CardActivity` do tipo `auto_moved_by_agent` para o mesmo `cardId` com `createdAt > now() - 24h`
- **D-05 (Cooldown):** 24 horas fixo, não configurável por etapa na v1. Implementado via query em `CardActivity`.
- **D-06 (Cooldown tracking):** Rastreado por card — verifica se existe `CardActivity` com `type = 'auto_moved_by_agent'` para o `cardId` com `createdAt > now - 24h`. Zero infra adicional, usa tabela já existente.

### movementMode
- **D-07 (movementMode field):** Novo campo em `Stage`: `movementMode StageMovementMode @default(MANUAL)`. Novo enum Prisma `StageMovementMode { MANUAL AUTO }`.
- **D-08 (movementMode toggle UX):** Toggle fica no painel de edição de etapa no Kanban (onde operador edita nome e agente atribuído). Default = MANUAL (mais seguro — operador opta ativamente por AUTO).

### CardActivity Audit Trail
- **D-09 (auto_moved_by_agent activity):** Novo tipo de `CardActivity` com `type = 'auto_moved_by_agent'`. Campo `metadata` stores: `{ mark_qualified: true, qualification_reason: string|null, suggested_next_stage_id: string, from_stage_id: string, to_stage_id: string }`. Suficiente para auditoria retroativa sem nova tabela.

### Frontend
- **D-10 (Skill library page):** Nova rota `/agentes/skills` — CRUD da biblioteca de skills do tenant (criar, editar, deletar). Lista skills com nome e preview do conteúdo (primeiros 80 chars). Tema e padrões visuais da área de agentes existente.
- **D-11 (Skill assignment in agent editor):** Nova seção "Skills" na página de editor de agente (`/agentes`). Lista skills disponíveis do tenant, operador adiciona/remove e reordena via drag-and-drop. Ordem salva em `AgentSkill.order`.
- **D-12 (movementMode toggle location):** Toggle "Mover automaticamente quando agente qualificar" no painel de configuração da etapa no Kanban. Aparece apenas quando a etapa tem um agente atribuído (movementMode só faz sentido com agente).

### Skill Injection (Claude's Discretion)
- Formato exato da injeção no system prompt (header `## Skills:`, separadores entre skills) — planner deve checar padrão de seções de `buildAgentCompiledPrompt` em `agent-prompt.builder.ts` e seguir o estilo existente.
- Skills ordenadas por `AgentSkill.order ASC`, cada skill injetada como bloco de texto após o prompt principal do agente.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Agent Runtime (estender para skills e auto-move)
- `apps/api/src/agent/agent-prompt.builder.ts` — Compilação do system prompt; nova seção de skills injeta aqui (ver método `buildAgentCompiledPrompt`)
- `apps/api/src/agent/handlers/qualification.handler.ts` — Handler de qualificação de Phase 5; auto-move logic entra aqui quando `stage.movementMode === AUTO`
- `apps/api/src/agent/agent.service.ts` — CRUD de agentes; estender para gerenciar `AgentSkill`
- `apps/api/src/agent/agent.module.ts` — Módulo NestJS; novos providers de Skill entram aqui

### Schema (migrations necessárias)
- `apps/api/prisma/schema.prisma` — Adicionar `Skill`, `AgentSkill`, enum `StageMovementMode`, campo `movementMode` em `Stage`

### Card Movement (reusar existente)
- `apps/api/src/card/card.service.ts` — `moveCard` existente; auto-move chama este método para manter consistência (triggers de régua, posicionamento)
- `apps/api/src/card/card.module.ts` — Verificar providers disponíveis para injeção no QualificationHandler

### Frontend (estender)
- `apps/web/src/app/agentes/page.tsx` — Editor de agente (Phase 5 já adicionou IMPORTANTE banner + advanced fields); nova seção Skills aqui
- `apps/web/src/components/board/CardDetailSheet.tsx` — Card modal; `auto_moved_by_agent` aparece na Atendimento tab (timeline) de Phase 5
- `apps/web/src/components/board/ActivityTimeline.tsx` — `TYPE_LABELS` estendida em Phase 5; adicionar label para `auto_moved_by_agent`

### Prior Phase Context
- `.planning/phases/05-agent-conversation-flow/05-CONTEXT.md` — D-01 a D-28; especialmente D-06/D-25 (QualifiedBadge/SuggestedStageButton) e D-08 (QualificationHandler pipeline) que Phase 6 estende
- `.planning/phases/05-agent-conversation-flow/05-02-SUMMARY.md` — Implementação do QualificationHandler
- `.planning/phases/05-agent-conversation-flow/05-06-SUMMARY.md` — Frontend Phase 5; padrões de stores e componentes

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `QualificationHandler` (`apps/api/src/agent/handlers/qualification.handler.ts`): cria `AGENT_QUALIFIED` activity + emite notificação. Auto-move logic (quando `stage.movementMode === AUTO` e todos gates passam) é extensão deste handler — injetar `CardService` e chamar `moveCard` após a notificação existente.
- `CardService.moveCard`: endpoint existente para mover cards; mantém lógica de posicionamento e dispara hooks de régua. Auto-move deve usar este método, não implementar move direto no DB.
- `CardActivity.metadata Json?`: já existe na tabela — snapshot da decisão estruturada vai aqui sem migração adicional de colunas.
- `buildAgentCompiledPrompt` (`agent-prompt.builder.ts`): já tem seções estruturadas separadas por `---`. Skills entram como nova seção appended ao final, antes do structured-output block.
- `Agent.profile Json?`: padrão para estender agent config sem migração (Phase 5 usou para `historyWindow`/`summaryThreshold`). Skills via `AgentSkill` é mais correto para lista ordenada, mas o padrão de `profile` já mostra que extensions são bem-vindas.

### Established Patterns
- NestJS `@Injectable()` handlers com injeção via constructor: seguir padrão dos handlers de Phase 5
- Prisma migrations: `npx prisma migrate dev` (dev) ou `npx prisma db push` para schema changes
- `CardActivity.type` é `String` (não enum Prisma) — constantes de tipo definidas em código como strings literais
- Zustand stores + `api` from `@/lib/api`: padrão frontend estabelecido em Phase 4+5
- Drag-and-drop: verificar se `@dnd-kit/core` ou similar já existe no projeto antes de adicionar

### Integration Points
- `QualificationHandler.handle()` → injetar auto-move após criar `AGENT_QUALIFIED` activity, com `CardService` injetado
- `Stage` model → adicionar `movementMode` field (requer incluir nos `agentRuntimeInclude` se usado no handler)
- `Agent` model → relacionamento `skills AgentSkill[]` para carregar skills na compilação do prompt
- `apps/web/src/app/agentes/page.tsx` → adicionar seção Skills com drag-and-drop
- Kanban stage settings panel → toggle movementMode (verificar se existe drawer de edição de etapa ou precisa criar)

</code_context>

<specifics>
## Specific Ideas

- "Auto-move deve chamar `CardService.moveCard` existente para reusar lógica de posicionamento e triggers de régua (stageRules). Não implementar um move duplicado diretamente no DB."
- "Snapshot no metadata do `auto_moved_by_agent`: `{ mark_qualified: true, qualification_reason, suggested_next_stage_id, from_stage_id, to_stage_id }` — suficiente para auditoria retroativa."
- "Gateway forward-only: comparar `Stage.order` do target vs. `Stage.order` atual. Requer incluir `Stage.order` na query que carrega o card/stage no QualificationHandler."
- "Drag-and-drop na seção Skills do editor: verificar `package.json` por `@dnd-kit` antes de instalar nova dependência."
- "Toggle movementMode no stage settings: mostrar apenas quando a etapa tem um agente atribuído (`stageId` no Agent). Se não há agente, toggle não aparece (sem sentido)."

</specifics>

<deferred>
## Deferred Ideas

- Cooldown configurável por etapa (valor diferente de 24h por stage)
- Gates individuais como configuração pelo operador (ex: desabilitar forward-only)
- Auditor agent offline/online (análise retroativa de conversas) — deferred desde Phase 5
- Skill categories/tags para organizar bibliotecas maiores
- Rollback de auto-move (undo pelo SDR) — confiar no histórico de CardActivity por ora

</deferred>

---

*Phase: 06-skills-auto-movement-de-cards-por-agente*
*Context gathered: 2026-04-22*
