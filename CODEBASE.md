# CODEBASE

## Snapshot

- Project: `Saaso`
- Product direction: `Revenue Ops OS autonomo com agentes de IA`
- OS: `Windows`
- Shell: `PowerShell`
- Package manager: `npm@10.8.2`
- Workspace model: `npm workspaces + turbo`

## Monorepo

- `apps/web`: Next.js 16 + React 19 + Tailwind 4
- `apps/api`: NestJS 11 + Prisma + PostgreSQL
- `docs`: PRD, arquitetura e mapas auxiliares
- `Saaso_blueprint-automacao`: blueprint de reguas/playbooks
- `.codex/skills`: biblioteca local de skills e workflows

## Product Source Of Truth

- Primary product doc: `docs/prd_e_sprints.md`
- Technical reference: `docs/arquitetura_tecnica.md`
- Blueprint reference: `Saaso_blueprint-automacao/`

## Approved Product Decisions

- Produto horizontal, nao vertical
- ICP inicial: empresa com operacao propria
- Agency mode entra depois, mas a base deve nascer `tenant -> workspace-ready`
- V1 de canais: `formulario + entrada manual + WhatsApp`
- Futuro de canais: `Meta + Google`
- Automacao padrao: `100% autonoma`
- Takeover manual permitido por conversa e por agente
- Usuario define funil e numero de etapas
- `Knowledge Base` fica dentro de `Agentes`
- `Canais` ficam em `Configuracoes/Integracoes`
- Outbound e prospeccao fria ficam provisionados na arquitetura

## Navigation Language

- `Dashboard`
- `Inbox`
- `Clientes`
- `Pipelines`
- `Agentes`
- `Reguas`
- `Campanhas`
- `Analytics`

## Development Workflow

1. Alinhar escopo e linguagem de produto no `docs/prd_e_sprints.md`
2. Criar ou atualizar um plano de execucao na raiz para features grandes
3. Fazer discovery tecnico antes de editar
4. Implementar por fatias pequenas e verificaveis
5. Validar build/teste do workspace afetado
6. Registrar riscos e proximos passos na resposta final

## Commands

### Root

- `npm run dev`
- `npm run dev:web`
- `npm run dev:api`

### Web

- `npm run build --workspace web`
- `npm run lint --workspace web`

### API

- `npm run build --workspace api`
- `npm run test --workspace api -- --runInBand`
- `npm run lint --workspace api`

## Current Engineering Notes

- `web` builda com sucesso em producao
- A suite de testes da `api` ainda possui varios testes scaffold falhando e nao representa um baseline confiavel
- O Kanban teve um ajuste de drag em `apps/web/src/components/board/KanbanBoard.tsx`
- O produto ainda esta em transicao de `CRM com IA` para `Revenue Ops OS autonomo`

## Working Rules

- Para trabalho multi-arquivo ou de arquitetura, planejar antes de implementar
- Para UI, preservar o shell tipo Hostman aprovado e evitar layout generico de SaaS
- Para backend, validar input na borda e manter isolamento por tenant
- Para PowerShell, seguir sintaxe segura e ASCII em scripts
