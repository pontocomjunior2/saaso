# Phase 1: CRM v1 — Funil Manual - Research

**Pesquisado em:** 2026-04-13
**Dominio:** NestJS CRM / Kanban / WhatsApp / Email
**Confianca:** HIGH (baseado em leitura direta do codigo-fonte)

---

## Resumo Executivo

O projeto ja possui uma base solida: Kanban com drag-and-drop funcional (@hello-pangea/dnd), CRUD completo de Pipeline/Stage/Card, envio de WhatsApp via Meta Cloud API com modo local_demo como fallback, e `createManualEntry` no ContactService que cria Contact + Card em transacao unica. O gap central desta fase e a ausencia de: (1) modelo `StageMessageTemplate` no Prisma, (2) endpoint de envio-por-card que use template, (3) mecanismo de "carregar template de pipeline", e (4) suporte a email (Mailtrap nao esta configurado — zero dependencias de email no `api/package.json`). O `CardDetailSheet.tsx` e o `CardFormModal.tsx` existem mas nao expoe a secao "Enviar Mensagem".

**Recomendacao principal:** Adicionar `StageMessageTemplate` ao schema Prisma, criar `POST /cards/:id/send-message` que reutilize o `logMessage` do WhatsappService + novo `sendEmail` no EmailService, expandir `CardDetailSheet` com secao de disparo, e implementar `POST /pipelines/from-template` como endpoint de seed estatico.

---

## 1. Evolution API — Estado Atual e Gaps

### O que o projeto implementa

O projeto NAO usa a Evolution API. A integracao WhatsApp existente e 100% via **Meta Cloud API** (WhatsApp Business Cloud API oficial da Meta, `graph.facebook.com/v23.0`).

**Fluxo de envio outbound existente** (rastreado em `whatsapp.service.ts`):

```
POST /whatsapp/send
  body: { contactId, content, direction?, cardId? }
  → WhatsappService.logMessage()
    → verifica contato.phone
    → verifica WhatsAppAccount do tenant
    → dispatchOutboundMessage()
      → se connectionMode === 'cloud_api' (phoneNumberId + accessToken presentes):
          → dispatchCloudApiMessage()
              → POST https://graph.facebook.com/v23.0/{phoneNumberId}/messages
              → payload: { messaging_product, recipient_type, to, type: 'text', text: { body } }
      → senao: modo local_demo (simula SENT sem HTTP)
    → cria WhatsAppMessage no banco
    → registra WhatsAppEvent (OUTBOUND_SEND)
    → se cardId fornecido: cria CardActivity (tipo WHATSAPP_OUTBOUND ou WHATSAPP_OUTBOUND_FAILED)
```

[VERIFIED: leitura direta de `apps/api/src/whatsapp/whatsapp.service.ts` linhas 497-611]

### Gaps para a Phase 1

1. **Sem template**: `POST /whatsapp/send` aceita `content` livre. Nao ha mecanismo de selecionar template da etapa atual.
2. **Sem `actorId`**: O `CardActivity` criado nao registra quem enviou (operador). O modelo `CardActivity` nao tem campo `actorId`/`userId`.
3. **Sem endpoint especifico por card**: Para "1-clique do card", o frontend precisa chamar `POST /whatsapp/send` passando `cardId` — isso ja funciona, mas a UX de selecao de template nao existe.
4. **Modo local_demo operacional**: Se o tenant nao configurar `phoneNumberId` + `accessToken`, as mensagens sao simuladas com status SENT. Isso e suficiente para desenvolvimento/testes.

**Conclusao**: O envio WhatsApp em si ja funciona. O que falta e o layer de template + UX de 1-clique no card.

---

## 2. Mailtrap — Configuracao e Envio

### Estado atual

**Email nao existe no projeto.** Busca em `apps/api/package.json`, `apps/api/src/` e arquivos `.env` confirma:
- Sem `nodemailer`, `@nestjs-modules/mailer`, `@sendgrid/mail`, nem `mailtrap` nas dependencias
- Sem qualquer referencia a SMTP ou envio de email no codigo da API
- O enum `CampaignChannel` ja define `EMAIL` (usado em SequenceRun), mas o codigo de disparo de campanhas nao implementa envio real de email

[VERIFIED: leitura direta de `apps/api/package.json` — zero dependencias de email]

### Padrao recomendado para NestJS

Para envio transacional simples, o padrao adequado para este projeto (que ja evita frameworks pesados) e:

```bash
npm install nodemailer --workspace api
npm install @types/nodemailer --save-dev --workspace api
```

Integracao direta via `nodemailer.createTransport()` com credenciais Mailtrap SMTP:

```typescript
// Configuracao Mailtrap SMTP (sandbox para dev)
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,       // smtp.mailtrap.io
  port: Number(process.env.MAIL_PORT), // 2525
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});
```

[ASSUMED] Mailtrap foi mencionado como requisito mas nao esta configurado. Necessario criar conta Mailtrap e adicionar credenciais ao `.env`.

### Variaveis de ambiente necessarias (novas)

```
MAIL_HOST=smtp.mailtrap.io
MAIL_PORT=2525
MAIL_USER=<mailtrap_inbox_user>
MAIL_PASS=<mailtrap_inbox_password>
MAIL_FROM=noreply@saaso.app
```

---

## 3. Stage Model — O que Existe e o que Falta

### Modelo atual

```prisma
model Stage {
  id         String   @id @default(uuid())
  name       String
  order      Int
  pipelineId String
  pipeline   Pipeline @relation(...)
  cards      Card[]
  agents     Agent[]
  leadForms  LeadForm[]
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

[VERIFIED: `apps/api/prisma/schema.prisma` linhas 75-86]

### O que falta para Phase 1

Para os success criteria da Phase 1, o `Stage` **nao precisa de alteracoes de schema** inicialmente. As funcionalidades "canal padrao", "SLA em dias" e "criterio de saida" estao fora do escopo do CRM v1 — pertencem ao CRM v2 (automacao).

O que e necessario e o modelo `StageMessageTemplate` (novo, descrito na secao 4).

### O que o StageService ja faz

- `POST /stages`: cria etapa no fim da ordem
- `PATCH /stages/:id`: atualiza nome
- `DELETE /stages/:id`: remove etapa
- `PATCH /stages/reorder/:pipelineId`: reordena etapas por array de IDs

**Gap**: Nao ha endpoint para criar etapa "inline" a partir do board vazio. O `KanbanBoard.tsx` atual nao renderiza nenhuma UI de adicionar etapa — apenas `onAddCard`. A criacao inline de etapa precisa ser adicionada na pagina do pipeline.

---

## 4. Message Templates — Modelo de Dados Necessario

### Modelo atual

**Nao existe** nenhum modelo de template de mensagem por etapa. O `Campaign.messageTemplate` e uma `String?` simples no nivel de campanha, nao estruturado por etapa de funil.

[VERIFIED: schema.prisma — nenhum modelo StageMessageTemplate existe]

### Modelo proposto (novo)

```prisma
model StageMessageTemplate {
  id        String   @id @default(uuid())
  stageId   String
  stage     Stage    @relation(fields: [stageId], references: [id], onDelete: Cascade)
  name      String                        // "Boas-vindas WhatsApp"
  channel   CampaignChannel               // WHATSAPP | EMAIL
  subject   String?                       // Assunto (somente EMAIL)
  body      String                        // Corpo da mensagem (suporta variaveis: {{nome}}, {{empresa}})
  tenantId  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([stageId])
  @@index([tenantId, stageId])
}
```

Adicionar relacao inversa no `Stage`:

```prisma
model Stage {
  // ...campos existentes...
  messageTemplates StageMessageTemplate[]
}
```

Adicionar relacao no `Tenant`:

```prisma
model Tenant {
  // ...campos existentes...
  stageMessageTemplates StageMessageTemplate[]
}
```

### Substituicao de variaveis

O `body` suporta `{{nome}}`, `{{empresa}}`, `{{telefone}}`, `{{email}}` resolvidos no momento do disparo com os dados do `Contact` vinculado ao card.

---

## 5. Pipeline Templates — Estrategia de Armazenamento

### Opcoes analisadas

| Opcao | Pros | Contras |
|-------|------|---------|
| JSON estatico no codigo | Zero infra, sem migracao, versionavel | Nao editavel em runtime |
| Seed no banco | Templates editaveis | Polui banco com dados globais, nao e por-tenant |
| Endpoint que cria a partir de JSON estatico | Zero DB overhead, templates versionados | Unico approach que atende o caso de uso |

### Recomendacao

**JSON estatico + endpoint `POST /pipelines/from-template`**

Criar arquivo `apps/api/src/pipeline/pipeline-templates.ts` com as 5 definicoes:

```typescript
export const PIPELINE_TEMPLATES = [
  {
    id: 'vendas-inbound',
    name: 'Vendas Inbound',
    stages: [
      { name: 'Novo Lead', order: 1 },
      { name: 'Qualificacao', order: 2 },
      { name: 'Proposta Enviada', order: 3 },
      { name: 'Negociacao', order: 4 },
      { name: 'Ganho', order: 5 },
    ],
  },
  // ... mais 4 templates
] as const;
```

Endpoint: `POST /pipelines/from-template` com body `{ templateId: string, name?: string }`. O servico le o JSON, cria o Pipeline com as Stages em transacao.

### 5 templates sugeridos

1. **Vendas Inbound** — Novo Lead / Qualificacao / Proposta / Negociacao / Ganho
2. **SDR Outbound** — Prospeccao / Primeiro Contato / Follow-up / Reuniao Agendada / Oportunidade
3. **Atendimento/Suporte** — Aberto / Em Analise / Aguardando Cliente / Resolvido / Fechado
4. **Onboarding de Clientes** — Contrato Assinado / Kickoff / Configuracao / Treinamento / Ativo
5. **Parceiros/Revenda** — Prospecto / Qualificado / Proposta / Negociacao / Parceiro Ativo

---

## 6. Activity Log — Suficiencia do Modelo Atual

### Modelo atual

```prisma
model CardActivity {
  id        String   @id @default(uuid())
  cardId    String
  card      Card     @relation(...)
  type      String   // ex: "CREATED", "MOVED", "WHATSAPP_OUTBOUND"
  content   String   // descricao textual
  createdAt DateTime @default(now())
}
```

[VERIFIED: `apps/api/prisma/schema.prisma` linhas 109-116]

### O que ja funciona

O `WhatsappService.logMessage()` ja cria `CardActivity` quando `cardId` e fornecido:
- Tipo `WHATSAPP_OUTBOUND` com content "Mensagem outbound enviada via WhatsApp (cloud_api)."
- Tipo `WHATSAPP_OUTBOUND_FAILED` em caso de erro

[VERIFIED: `apps/api/src/whatsapp/whatsapp.service.ts` linhas 590-604]

### O que falta

1. **Campo `actorId` (userId)**: O modelo nao registra quem executou a acao. Para o success criterion "operador" aparecer no log, precisamos adicionar `actorId String?` + relacao `User`.
2. **Tipo `EMAIL_OUTBOUND`**: Nao existe — sera criado junto com o EmailService.
3. **Campo `channel`**: Nao existe explicitamente — atualmente fica embutido no `content` textual. Para filtrar/exibir por canal no frontend, seria util adicionar `channel String?` ao `CardActivity`.
4. **Campo `templateName`**: Nao existe — util para o log mostrar qual template foi usado.

### Alteracao minima necessaria no schema

```prisma
model CardActivity {
  id           String   @id @default(uuid())
  cardId       String
  card         Card     @relation(fields: [cardId], references: [id])
  type         String
  content      String
  channel      String?  // "WHATSAPP" | "EMAIL" | null
  templateName String?  // nome do template usado, se houver
  actorId      String?  // userId do operador
  createdAt    DateTime @default(now())
}
```

Adicionar ao `User`: `cardActivities CardActivity[]`

---

## 7. Frontend — Gaps no KanbanBoard e CardDetailSheet

### KanbanBoard.tsx — Estado atual

**O que funciona:**
- Drag-and-drop com `@hello-pangea/dnd` (funcional)
- Botao `+` por coluna (`onAddCard`) que abre `CardFormModal`
- Botao de editar card (`onEditCard`)
- Selecao de card (`onCardSelect`) que dispara abertura do `CardDetailSheet`
- `createCardWithContact` no store chama `POST /contacts/manual-entry` (funciona)

**O que falta:**
1. **Board vazio**: Quando o pipeline nao tem etapas, o board renderiza um `<div>` vazio sem nenhuma UI de "adicionar etapa" ou "carregar template". Precisa de um estado empty-state com as 2 opcoes.
2. **Adicionar etapa inline**: Nao existe botao para criar nova etapa pelo board. Necessario adicionar UI ao lado da ultima coluna (botao `+ Nova Etapa`).
3. **Selecao de pipeline na pagina `/pipelines`**: O botao "Novo Pipeline" esta presente mas sem funcionalidade — nao abre modal nem chama `POST /pipelines`.

[VERIFIED: leitura direta de `apps/web/src/components/board/KanbanBoard.tsx`]

### CardDetailSheet.tsx — Estado atual

**O que existe:**
- Painel lateral fixo (right-side sheet) que abre ao selecionar um card
- Secao de contato (nome, telefone, email, empresa)
- Secao de agente e conversa ativa
- Secao "Linha do tempo operacional" — renderiza `card.activities[]` com tipo e content
- Secao "Status da regua" — passos do SequenceRun

**O que falta:**
1. **Secao "Enviar Mensagem"**: Nao existe. Necessario adicionar secao com:
   - Selector de canal (WhatsApp / Email)
   - Lista de templates da etapa atual (`stage.messageTemplates`)
   - Preview do body com variaveis resolvidas
   - Botao "Enviar" que chama `POST /cards/:id/send-message`
2. **Botao "Mover card"**: Para o success criterion 5 (mover por botao, alem de drag), o sheet deveria ter botoes de avanco/retrocesso entre etapas.
3. **Formato do activity log**: Atualmente `activity.type` e exibido como texto bruto (ex: "WHATSAPP_OUTBOUND"). Precisa de mapeamento para texto amigavel em pt-BR.

[VERIFIED: leitura direta de `apps/web/src/components/board/CardDetailSheet.tsx`]

### useKanbanStore.ts — Gaps

O store atual:
- Tem `createCardWithContact` (funciona)
- Nao tem `sendMessage` action
- Nao tem `createStage` / `deleteStage` actions
- Nao tem `loadTemplate` action

Novas acoes necessarias:
```typescript
sendMessage: (cardId: string, templateId: string, channel: 'WHATSAPP' | 'EMAIL') => Promise<void>
createStage: (pipelineId: string, name: string) => Promise<void>
loadTemplate: (pipelineId: string, templateId: string) => Promise<void>
```

---

## 8. Fluxo de Envio WhatsApp Existente

### Rastreamento completo do envio outbound

```
Frontend (CardDetailSheet — a criar)
  → api.post('/cards/:id/send-message', { templateId, channel })  ← endpoint NOVO

Backend: POST /cards/:id/send-message  ← controller NOVO
  → CardService.sendMessage(tenantId, cardId, { templateId, channel })  ← metodo NOVO
    → busca card (valida tenantId)
    → busca StageMessageTemplate por templateId
    → resolve variaveis no template.body usando contact data
    → se channel === 'WHATSAPP':
        → chama WhatsappService.logMessage(tenantId, { contactId, content, cardId })
          → (fluxo ja existente descrito na secao 1)
    → se channel === 'EMAIL':
        → chama EmailService.sendEmail({ to, subject, body, cardId, tenantId })  ← NOVO
          → nodemailer + Mailtrap SMTP
          → cria CardActivity tipo EMAIL_OUTBOUND
    → retorna { success: true, deliveryMode, messageId }
```

### Modo local_demo (sem credenciais Meta)

Se o tenant nao tem `phoneNumberId` + `accessToken` configurados, o `dispatchOutboundMessage` retorna `deliveryMode: 'local_demo'` com `status: SENT` sem fazer HTTP real. Isso permite testar o fluxo completo sem conta Meta Business. O `CardActivity` e criado normalmente.

[VERIFIED: `whatsapp.service.ts` linhas 838-843]

---

## 9. Recomendacoes de Implementacao

### Ordem de execucao recomendada

**Wave 0 — Schema e dados** (sem impacto em UI existente)
1. Adicionar `StageMessageTemplate` ao schema Prisma
2. Adicionar campos `channel`, `templateName`, `actorId` ao `CardActivity`
3. Rodar migracao: `npx prisma migrate dev --name crm-v1-templates`
4. Adicionar `pipeline-templates.ts` com os 5 templates estaticos

**Wave 1 — Backend**
5. `POST /pipelines/from-template` — cria pipeline a partir de template
6. `GET /stages/:id/templates` — lista templates da etapa
7. `POST /stages/:id/templates` — cria template
8. `DELETE /stages/:id/templates/:templateId` — remove template
9. `POST /cards/:id/send-message` — disparo com template
10. Criar `EmailService` com nodemailer + Mailtrap

**Wave 2 — Frontend board**
11. Empty-state no KanbanBoard (sem etapas) com opcoes "Criar etapa" e "Carregar template"
12. Botao "+ Nova Etapa" ao lado da ultima coluna
13. Modal de selecao de template de pipeline
14. Adicionar `createStage` / `loadTemplate` ao `useKanbanStore`

**Wave 3 — CardDetailSheet**
15. Secao "Enviar Mensagem" com selector de template
16. Preview de variaveis no body
17. Botao "Enviar" com feedback de sucesso/erro
18. Melhorar exibicao do activity log (mapeamento de tipos para pt-BR)

### Decisao de design: endpoint unico vs. reutilizar `/whatsapp/send`

Recomendado: **endpoint dedicado `POST /cards/:id/send-message`** no `CardController`. Razoes:
- Encapsula a logica de "buscar template + resolver variaveis + despachar por canal"
- O `CardController` ja tem o contexto do card e do tenant
- Evita que o frontend precise conhecer `contactId` e `content` antecipadamente
- Facil de estender para suportar multiplos canais

---

## 10. Riscos e Dependencias

### Riscos

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|--------------|---------|-----------|
| Mailtrap sem credenciais no `.env` | HIGH | MEDIO | Criar conta Mailtrap gratuita antes de Wave 1; modo local_demo nao existe para email, portanto precisa de credenciais reais (mesmo sandbox) |
| Meta Cloud API sem configuracao real | MEDIO | BAIXO | `local_demo` mitiga — WhatsApp funciona sem conta real em dev |
| `actorId` no `CardActivity` exige `CurrentUser` no controller | MEDIO | MEDIO | `JwtAuthGuard` ja existe; `CurrentUser` decorator precisa ser criado ou `CurrentTenant` adaptado para retornar userId |
| Frontend `CardDetailSheet` crescendo em complexidade | MEDIO | BAIXO | Ja e um painel lateral com scroll — adicionar secao de envio e incremental, nao requer refactor |
| `StageMessageTemplate` sem UI de CRUD inicial | BAIXO | MEDIO | Para Phase 1, templates podem ser criados via seed ou API direta; UI de gerenciamento de templates por etapa pode vir como tela de configuracao separada |

### Dependencias criticas (blockers)

1. **Credenciais Mailtrap**: Nenhum envio de email funciona sem elas. Nao e possivel implementar modo local_demo para email sem mais complexidade.
2. **Migracao Prisma**: `StageMessageTemplate` e campos em `CardActivity` precisam estar no banco antes de qualquer desenvolvimento de controller/service.
3. **`CurrentUser` decorator**: Necessario para registrar `actorId` no `CardActivity`. Verificar se ja existe em `apps/api/src/common/decorators/`.

### Dependencias de ciclo de vida

- Phase 2 (automacao) depende de `StageMessageTemplate` estar correto e estavel — planejar schema com extensibilidade em mente (ex: suporte futuro a `delaySeconds` no template para disparo automatico).

---

## Assumptions Log

| # | Afirmacao | Secao | Risco se Errado |
|---|-----------|-------|-----------------|
| A1 | Evolution API nao e usada — integracao e Meta Cloud API | 1 | Baixo (verificado diretamente no codigo) |
| A2 | Mailtrap e a solucao de email escolhida para este projeto | 2 | Medio — se outra solucao for preferida, trocar nodemailer target e trivial |
| A3 | Os 5 templates de pipeline listados atendem os casos de uso iniciais | 5 | Baixo — sao estaticos e facilmente alteraveis |
| A4 | `actorId` no CardActivity e suficiente para rastreabilidade de operador (sem tabela de auditoria separada) | 6 | Baixo para Phase 1 |

---

## Fontes

### Primarias (VERIFIED — leitura direta do codigo-fonte)

- `apps/api/prisma/schema.prisma` — todos os modelos Prisma
- `apps/api/src/whatsapp/whatsapp.service.ts` — fluxo completo de envio WhatsApp
- `apps/api/src/whatsapp/whatsapp.controller.ts` — endpoints disponiveis
- `apps/api/src/card/card.service.ts` — CRUD e moveCard
- `apps/api/src/card/card.controller.ts` — endpoints de card
- `apps/api/src/pipeline/pipeline.service.ts` — findAll/findOne com includes completos
- `apps/api/src/stage/stage.service.ts` — CRUD de etapa
- `apps/api/src/contact/contact.service.ts` — createManualEntry
- `apps/web/src/components/board/KanbanBoard.tsx` — board com DnD
- `apps/web/src/components/board/CardDetailSheet.tsx` — painel lateral
- `apps/web/src/components/board/CardFormModal.tsx` — modal de criacao de card
- `apps/web/src/stores/useKanbanStore.ts` — state management do Kanban
- `apps/web/src/app/pipelines/[id]/page.tsx` — pagina do board
- `apps/api/package.json` — dependencias da API (confirma ausencia de email libs)

### Secundarias (ASSUMED)
- Padrao nodemailer + Mailtrap para NestJS baseado em conhecimento de treinamento
