# Deploy no EasyPanel

Este projeto deve subir em quatro serviços separados:

- `postgres` para o banco PostgreSQL
- `redis` para filas e runtimes
- `api` para o backend NestJS
- `web` para o frontend Next.js

## Ordem recomendada

1. Suba o `postgres`.
2. Suba o `redis`.
3. Suba o `api` com o Dockerfile em `apps/api/Dockerfile`.
4. Execute o bootstrap do schema no banco de produção com `npx prisma db push`.
5. Suba o `web` com o Dockerfile em `apps/web/Dockerfile`.

## Checklist de configuracao no EasyPanel

### 1) Postgres

- Nome do servico: `postgres`
- Imagem: `postgres:16` ou o Postgres gerenciado do EasyPanel
- Porta interna: `5432`
- Volume persistente: sim
- Variaveis:
  - `POSTGRES_USER=postgres`
  - `POSTGRES_PASSWORD=<senha forte>`
  - `POSTGRES_DB=saaso`

### 2) Redis

- Nome do servico: `redis`
- Imagem: `redis:7-alpine`
- Porta interna: `6379`
- Volume persistente: opcional, mas recomendado
- Variaveis:
  - se usar senha, defina `REDIS_PASSWORD`

### 3) API

- Nome do servico: `api`
- Build context: raiz do repo
- Dockerfile: `apps/api/Dockerfile`
- Porta exposta: `3001`
- Variaveis obrigatorias:
  - `PORT=3001`
  - `FRONTEND_URL=https://app.seudominio.com`
  - `DATABASE_URL=postgresql://postgres:<senha>@postgres:5432/saaso?schema=public`
  - `JWT_SECRET=<segredo forte>`
  - `JWT_EXPIRATION=15m`
  - `WHATSAPP_WEBHOOK_VERIFY_TOKEN=<token forte>`
  - `WHATSAPP_CLOUD_API_BASE_URL=https://graph.facebook.com/v23.0`
  - `REDIS_HOST=redis`
  - `REDIS_PORT=6379`
  - `REDIS_DB=0`
  - `REDIS_PASSWORD=<se existir>`
  - `CAMPAIGN_RUNTIME_DRIVER=bullmq`
  - `JOURNEY_RUNTIME_DRIVER=bullmq`
  - `PROSPECT_RUNTIME_DRIVER=bullmq`

### 4) Web

- Nome do servico: `web`
- Build context: raiz do repo
- Dockerfile: `apps/web/Dockerfile`
- Porta exposta: `3000`
- Build args:
  - `NEXT_PUBLIC_API_URL=https://api.seudominio.com`
  - `NEXT_PUBLIC_DEMO_TENANT_SLUG=saaso-demo`
  - `NEXT_PUBLIC_DEMO_EMAIL=admin@saaso.com`
  - `NEXT_PUBLIC_DEMO_PASSWORD=admin123`
- Variaveis de runtime:
  - `PORT=3000`
  - `NODE_ENV=production`

## Arquivos de build

- Backend: `apps/api/Dockerfile`
- Frontend: `apps/web/Dockerfile`
- Exemplo de env: `docs/easypanel.env.example`

## Variáveis do backend

Use no serviço `api`:

- `PORT`
- `FRONTEND_URL`
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRATION`
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- `WHATSAPP_CLOUD_API_BASE_URL`
- `OPENAI_API_KEY`
- `OPENAI_API_BASE_URL`
- `REDIS_HOST`
- `REDIS_PORT`
- `REDIS_DB`
- `REDIS_PASSWORD`
- `CAMPAIGN_RUNTIME_DRIVER`
- `CAMPAIGN_RUNTIME_POLL_MS`
- `CAMPAIGN_RUNTIME_WORKER_CONCURRENCY`
- `JOURNEY_RUNTIME_DRIVER`
- `JOURNEY_RUNTIME_POLL_MS`
- `JOURNEY_RUNTIME_WORKER_CONCURRENCY`
- `PROSPECT_RUNTIME_DRIVER`
- `PROSPECT_RUNTIME_POLL_MS`
- `PROSPECT_RUNTIME_WORKER_CONCURRENCY`

## Variáveis do frontend

O `web` precisa destes valores no build:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_DEMO_TENANT_SLUG`
- `NEXT_PUBLIC_DEMO_EMAIL`
- `NEXT_PUBLIC_DEMO_PASSWORD`

`NEXT_PUBLIC_API_URL` precisa apontar para a URL pública do backend.

## Banco de dados

Hoje o projeto não usa migrations versionadas. Em produção, o primeiro bootstrap deve ser feito com:

```bash
npx prisma db push
```

Execute esse comando apenas depois do `api` estar apontando para o banco de producao correto.

Se o schema mudar depois, repita o comando antes de colocar o backend novo em produção.

Se você quiser migrar os dados do banco local para a produção, faça isso fora do deploy com dump e restore do PostgreSQL.

## Checklist de deploy

- Verificar que o `build` do backend passa localmente.
- Verificar que o `build` do frontend passa localmente.
- Confirmar `DATABASE_URL` e `REDIS_*`.
- Confirmar `FRONTEND_URL` e `NEXT_PUBLIC_API_URL`.
- Rodar `prisma db push` no banco de produção.
- Fazer smoke de login, inbox e formulário público.
- Validar os webhooks do WhatsApp e os runtimes de campanha/journeys/prospect.

## Ordem operacional para publicar

1. Criar o `postgres`.
2. Criar o `redis`.
3. Subir o `api` e validar o health endpoint.
4. Rodar `npx prisma db push` no banco de producao.
5. Subir o `web`.
6. Validar login no demo e fluxo principal do inbox.
7. Validar formulário público.
8. Validar status do WhatsApp e do runtime das filas.

## Rollback

- Backend: voltar para a imagem anterior.
- Frontend: voltar para a imagem anterior.
- Banco: restaurar backup anterior se o `db push` tiver causado alteração indevida.

## Observação

O banco local atual não é um artefato de deploy. O caminho correto é provisionar um Postgres em produção e sincronizar o schema e, se necessário, os dados.
