# Modelo Operacional Codex

## Objetivo

Padronizar como o projeto deve ser conduzido usando as skills locais em `.codex/skills`, reduzindo ambiguidade e evitando execucao improvisada.

## Skills Base Adotadas

- `product-manager`: clarificar problema, escopo, MVP e criterios de aceite
- `project-planner`: quebrar trabalho grande em plano executavel na raiz
- `frontend-specialist`: arquitetura de componentes, acessibilidade, performance e consistencia de UI
- `workflow-ui-ux-pro-max`: direcao visual, layout e sistema de design
- `backend-specialist`: arquitetura de API, validacao, seguranca e modularizacao
- `powershell-windows`: comandos e scripts seguros no ambiente atual

## Fluxo Padrao

1. `Product framing`
   - Ajustar PRD e linguagem de produto antes de codar features grandes
2. `Planning`
   - Criar ou atualizar um plano raiz para iniciativas com impacto multi-arquivo
3. `Discovery`
   - Ler codigo existente, dependencias, pontos de integracao e restricoes
4. `Implementation`
   - Entregar em fatias pequenas, por dominio, com verificacao local
5. `Verification`
   - Rodar build e testes do workspace afetado
6. `Close-out`
   - Resumir o que mudou, o que foi validado e quais riscos ficaram

## Gatilhos Praticos

### Quando atualizar PRD primeiro

- Mudanca de posicionamento do produto
- Mudanca de navegacao
- Mudanca de escopo de sprint
- Inclusao de novos canais, modulos ou personas

### Quando criar plano na raiz

- Feature multi-arquivo
- Refatoracao estrutural
- Alteracao em frontend + backend + dados
- Implementacoes com mais de um sprint ou mais de um modulo

### Quando seguir UI/UX com mais rigor

- Nova tela principal
- Revisao de shell, sidebar, dashboard ou builders
- Fluxos com alto impacto em onboarding ou operacao

## Regras de Produto

- Falar em `Inbox`, `Clientes`, `Pipelines`, `Agentes`, `Reguas`, `Campanhas`
- Evitar `Projetos` como menu central
- `Knowledge Base` fica dentro de `Agentes`
- `Canais` ficam em `Configuracoes/Integracoes`
- Priorizar operacao comercial antes de setup tecnico na navegacao

## Regras de Implementacao

- Backend: validar tudo na borda e respeitar isolamento multi-tenant
- Frontend: manter shell escuro premium, orientado a operacao, evitando layout generico
- UI: evitar desenho padrao de SaaS sem identidade
- Infra: preferir verificacoes pontuais por workspace, nao comandos largos e opacos

## Verificacao Minima Por Mudanca

### Cadencia padrão

- Default: `lint direcionado + build do workspace afetado + 1 smoke crítico`
- Evitar smoke manual amplo em todo corte quando a mudança não altera runtime sensível, canal real ou fluxo multi-etapas
- Reservar smokes mais pesados para:
  - milestones de phase
  - runtime de `Journeys`
  - integrações reais de canal
  - refactors estruturais com alto risco de regressão
- Quando a entrega for principalmente visual, preferir `build` e uma checagem funcional enxuta no lugar de uma bateria longa
- Se o custo de validação começar a frear a cadência, reduzir o escopo antes de abrir mais exploração

### Frontend

- Build do `web`
- Fluxo manual da tela alterada
- Responsividade basica se a tela for primaria

### Backend

- Build da `api`
- Teste do modulo afetado quando existir
- Revisao de validacao, auth e isolamento por tenant

### Produto e Docs

- PRD atualizado quando houver mudanca de escopo
- Plano atualizado quando houver mudanca de fase
- Terminologia consistente entre UI, backlog e documentacao
