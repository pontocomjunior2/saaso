---
phase: 02-crm-v2-automa-o-de-r-guas
plan: "04"
subsystem: card-lifecycle-automation
tags: [card-service, agent, stage-rule, webhook, notification, takeover]
dependency_graph:
  requires: [02-02, 02-03]
  provides: [card-lifecycle-hooks, agent-takeover-toggle, stage-agent-assignment]
  affects: [02-05]
tech_stack:
  added: [stage-agent-assignment-route, agent-conversation-toggle-route, agent-move-route]
  patterns: [post-transaction-hooks, forwardRef-module-wiring, D0-agent-precedence]
key_files:
  created:
    - apps/api/src/card/dto/agent-move.dto.ts
    - apps/api/src/stage/dto/set-stage-agent.dto.ts
  modified:
    - apps/api/src/agent/agent-prompt.builder.ts
    - apps/api/src/agent/agent-runner.service.ts
    - apps/api/src/agent/agent-runner.service.spec.ts
    - apps/api/src/agent/agent.controller.ts
    - apps/api/src/agent/agent.module.ts
    - apps/api/src/agent/agent.service.ts
    - apps/api/src/app.module.ts
    - apps/api/src/card/card.controller.ts
    - apps/api/src/card/card.module.ts
    - apps/api/src/card/card.service.ts
    - apps/api/src/card/card.service.spec.ts
    - apps/api/src/stage/stage.controller.ts
    - apps/api/src/stage/stage.controller.spec.ts
    - apps/api/src/stage/stage.module.ts
    - apps/api/src/stage-rule/stage-rule.service.ts
    - apps/api/src/stage-rule/stage-rule.service.spec.ts
    - apps/api/src/stage-rule/stage-rule.module.ts
    - apps/api/src/whatsapp/whatsapp.module.ts
    - apps/api/src/whatsapp/whatsapp.service.ts
decisions:
  - "CardService.create agora dispara StageRuleService.startRuleRun e AgentRunnerService.initiateProactiveIfAssigned após persistir o card"
  - "CardService.moveCard cancela runs ativos da etapa anterior e inicia nova automação apenas em movimento cross-stage"
  - "Quando a etapa tem agente ativo, StageRuleService marca passos D0 como SKIPPED e deixa D+N normalmente enfileirados"
  - "O primeiro outbound proativo do agente usa o mesmo fluxo de WhatsappService.logMessage para manter persistência e delivery consistentes"
  - "classificationCriteria da etapa entra no prompt compilado do agente para proactive e inbound"
metrics:
  completed_date: "2026-04-14"
  tasks_completed: 2
  tests_passing: 29
requirements: [REQ-06, REQ-08]
---

# Phase 02 Plan 04: Automation Integration + Card Lifecycle Hooks Summary

`02-04` conectou os módulos já existentes ao ciclo de vida real do card: criação manual, criação via Meta webhook e mudança de etapa agora disparam a automação correta sem rollback do ato principal.

## What Was Built

- `CardService.create` passou a disparar `StageRuleService.startRuleRun(..., 'CARD_ENTERED')` e `AgentRunnerService.initiateProactiveIfAssigned(...)` após persistir o card.
- `CardService.moveCard` passou a cancelar runs ativos do card, iniciar uma nova régua da etapa de destino e acionar proactive do agente quando o movimento é entre etapas.
- `CardService.agentMove` e `POST /cards/:id/agent-move` criam trilha de auditoria `AGENT_MOVED` com agente, etapa de destino e motivo.
- `AgentRunnerService.initiateProactiveIfAssigned` deixou de ser stub: agora compila prompt com contexto da etapa, gera mensagem via IA, envia pelo fluxo de WhatsApp, cria `AgentConversation`, `AgentMessage` e `CardActivity` `AGENT_PROACTIVE`.
- `AgentRunnerService.toggleTakeover` e `POST /agent-conversations/:id/toggle-takeover` alternam `OPEN` ↔ `HANDOFF_REQUIRED` e registram `AGENT_HANDOFF_MANUAL` / `AGENT_RESUMED`.
- `AgentService.setStageAgent` e `PATCH /stages/:stageId/agent` passam a controlar o agente vinculado à etapa e o `classificationCriteria`.
- `StageRuleService.startRuleRun` agora aplica a precedência de D0: se há agente ativo na etapa, o passo D0 nasce como `SKIPPED`, mas D+1/D+N seguem normais.
- `MetaWebhookModule` e `NotificationModule` foram registrados em `app.module.ts`.

## Verification

- `..\\..\\node_modules\\.bin\\tsc.cmd --noEmit -p tsconfig.json`
- `npx jest --runInBand --no-coverage src/agent/agent-runner.service.spec.ts src/agent/agent.service.spec.ts src/stage-rule/stage-rule.service.spec.ts src/card/card.service.spec.ts src/stage/stage.controller.spec.ts src/agent/agent.controller.spec.ts`

## Next

- `02-05` pode seguir para a interface de configuração/visualização sabendo que os gatilhos backend de REQ-06 e REQ-08 já estão fechados.
