# LLM Handoff — 2026-03-18

Atualizado pela última vez em `2026-03-19`.

## Estado atual

O projeto saiu da fase de base genérica e já está alinhado ao posicionamento de `Revenue Ops OS` com:

- navegação principal enxuta
- `Clientes` separado em `Contatos`, `Empresas` e `Segmentos`
- `Inbox` como domínio operacional
- `Pipelines` como board principal
- `Configurações` iniciado como centro de canais e prontidão inbound

## Fases

### Phase 1

Concluída.

- `ValidationPipe` global
- sessão frontend sem persistência insegura de senha
- shell principal consolidado
- app `workspace-ready` sem quebrar a V1

### Phase 2

Concluída.

- `Inbox` funcional
- takeover manual por conversa
- board/pipelines reorganizados
- melhoria do drag no Kanban

### Phase 3

Concluída.

- `Contatos`, `Empresas` e `Segmentos` operacionais
- entrada manual criando `contato -> empresa -> card -> conversa`
- `Inbox` refletindo a thread criada por entrada manual

### Phase 4

Iniciada, não concluída.

Primeiro corte entregue:

- `Configurações` virou painel de canais/prontidão inbound
- leitura de API, WhatsApp, formulários e entrada manual
- checklist operacional da fase

Segundo corte entregue:

- submissão pública de formulário agora cria `contato -> card -> conversa`
- lead vindo de formulário entra no `Inbox` mesmo sem mensagem de canal
- `Inbox` exibe resumo operacional quando a thread ainda não tem mensagens

Terceiro corte entregue:

- tela de `WhatsApp` reestruturada para credenciais, webhook e simulador inbound
- `POST /whatsapp/simulate-inbound` cria/reaproveita contato, card e thread operacional
- mensagem inbound simulada aciona o runner do agente e cai no `Inbox`

Quarto corte entregue:

- `POST /whatsapp/webhook` aceita payload simplificado e processa inbound publico
- inbound sem agente ativo ainda cria card e aparece no `Inbox`
- `Inbox` ganhou fallback de `card/pipeline` fora da conversa do agente

Quinto corte entregue:

- `Agentes` ganhou pausa global por agente fora do wizard
- desligar um agente move conversas abertas dele para `HANDOFF_REQUIRED`
- reativar o agente libera novos atendimentos automáticos sem reabrir conversas manualmente pausadas

Sexto corte entregue:

- `Inbox` agora diferencia `AUTONOMA`, `MANUAL` e `SEM AGENTE`
- o painel lateral usa o agente da etapa como fallback quando ainda nao existe conversa registrada
- threads sem agente ativo deixaram de aparecer como automacao disponivel

Sétimo corte entregue:

- runtime inicial de `Réguas` agora persiste `JourneyExecution` e `JourneyExecutionLog`
- `JourneyService` executa gatilhos `manual`, `lead_form_submitted` e `whatsapp_inbound_received`
- ações suportadas no runtime: `append_card_activity`, `move_card_to_next_stage` e `request_handoff`
- `LeadFormService` e `WhatsappService` passaram a acionar jornadas automaticamente
- `journeys/[id]` ganhou painel lateral com execuções recentes, status e logs
- `journeys` agora mostra contagem, último status e data da última execução
- corrigido bug de serialização dos nós/arestas com `ValidationPipe`
- corrigido bug do Next 16 em `journeys/[id]` por acesso síncrono a `params`

Oitavo corte entregue:

- `KnowledgeBase` virou domínio persistido no backend com CRUD por tenant
- `Agentes` ganhou store e UI reais para criar, editar e remover bases dentro do mesmo módulo
- wizard de `Agentes` agora fecha o fluxo `prompt + temperatura + knowledge base`
- preview do agente passou a mostrar a seção de base vinculada e o contexto extra da base
- runtime do agente usa `knowledgeBaseName`, `knowledgeBaseSummary` e `knowledgeBaseContent` no prompt compilado
- corrigido stale state no frontend: salvar/remover agente agora refaz leitura das bases e sincroniza `agentCount`
- removida a mensagem desatualizada de `Knowledge Base / EM BREVE` na sidebar; o shell agora comunica que templates e bases vivem dentro do módulo de agentes
- durante o corte foi encontrado um problema operacional do Prisma: gerar o client com `--no-engine` derruba a API local em modo data proxy; o estado final ficou normalizado com `prisma generate` padrão

Nono corte entregue:

- `GET /whatsapp/webhook` agora responde ao challenge oficial da Meta
- `POST /whatsapp/webhook` agora aceita o envelope oficial da Meta para mensagens inbound
- o webhook agora também processa `statuses` da Meta e atualiza mensagens outbound para `SENT`, `DELIVERED`, `READ` ou `FAILED`
- a tela de `WhatsApp` foi atualizada para explicar verify token, payload oficial e suporte a status updates
- `.env.example` agora documenta `WHATSAPP_WEBHOOK_VERIFY_TOKEN`

Décimo corte entregue:

- `JourneyExecutionJob` foi adicionado ao schema com `scheduledFor`, `status`, `attempts`, `delayInSeconds` e `lastError`
- `JourneyService` saiu da execução síncrona e agora agenda nós, processa jobs elegíveis e mantém a execução em `RUNNING` enquanto houver pendências
- o runtime ganhou poller interno, endpoint manual `POST /journeys/runtime/process-due` e retry simples para falhas de job
- o builder de `Journeys` agora oferece nós de `Delay`, botão de processamento manual e leitura de jobs agendados
- as execuções detalhadas passaram a expor `pendingJobCount`, `runningJobCount`, `failedJobCount`, `nextScheduledAt` e a fila de jobs
- o smoke validou delay real de `7 segundos`, execução em `RUNNING` com job pendente e conclusão automática posterior pelo poller

Décimo primeiro corte entregue:

- `WhatsappService` agora expõe capacidades operacionais do canal com `connectionMode`, `isOperational`, `supportsSimulator`, `canSendOfficialOutbound`, `canReceiveOfficialWebhook` e `verifyTokenConfigured`
- o envio outbound passou a usar a `Cloud API` quando `accessToken + phoneNumberId` estão completos, mantendo `fallback local` para workspaces ainda não finalizados
- a tela `WhatsApp` foi redesenhada para comunicar `Cloud API oficial`, `Demo local` e `Configuração parcial` sem depender apenas do enum legado de status
- `Configurações` passou a resumir o canal por modo operacional e o bloco de “próximo corte” foi atualizado
- `POST /whatsapp/send` agora assume `OUTBOUND` por padrão quando o cliente não envia `direction`
- o smoke validou persistência de falha limpa em outbound oficial (`deliveryMode=cloud_api`, `status=FAILED`, erro `401 Invalid OAuth access token`) e confirmou o default server-side de `OUTBOUND`

Décimo segundo corte entregue:

- `JourneyService` agora suporta branching real com nós de `condition`
- a avaliação das condições lê `triggerPayload`, `contact`, `company` e `card` no runtime
- arestas de saída passaram a aceitar caminho `SIM`, `NAO` e `Sempre`, com seleção exclusiva do branch correspondente
- o builder de `Journeys` ganhou inspector para editar `campo`, `operador` e `valor` do nó de condição
- o builder de `Journeys` também ganhou inspector de arestas para marcar o caminho condicional sem editar JSON manualmente
- labels `SIM/NAO` agora aparecem no canvas para leitura imediata do fluxo
- o smoke validou o caminho positivo com a execução `1d741a47-8f0c-48e8-82a8-e0d671bc03f8`
- o smoke validou o caminho negativo com a execução `d2a31b9b-2d00-47e8-8d91-064aa1c6c8f6`
- a UI do builder foi validada no navegador após reload, com inspector funcional para nó e aresta

Décimo terceiro corte entregue:

- `BullMQ` e `ioredis` foram adicionados ao `apps/api` para transformar `Journeys` em runtime com fila externa real
- nasceu o `JourneyQueueService`, responsável por conectar no Redis, publicar `JourneyExecutionJob` e executar jobs por worker
- o poller interno foi mantido como fallback operacional, evitando regressão se Redis ou enqueue falharem
- a API agora expõe `GET /journeys/runtime/status` com driver, backlog, retry, próximo disparo e estado da fila
- a tela `Journeys` ganhou cards de runtime mostrando `BullMQ` vs `poller`, backlog e política operacional
- o smoke principal subiu uma API isolada em `:3101` com `JOURNEY_RUNTIME_POLL_MS=60000` e ainda assim concluiu o delay de `7s` via BullMQ
- a execução validada desse corte foi `b4752afc-3482-4caa-bd07-4d62b4a283f9`

Décimo quarto corte entregue:

- `JourneyService` agora expõe `POST /journeys/runtime/jobs/:jobId/requeue` e `POST /journeys/runtime/executions/:executionId/requeue-failed`
- jobs falhos passaram a persistir `deadLetteredAt`, `deadLetterReason`, `manuallyRequeuedAt` e `manualRequeueCount`
- `JourneyQueueService` agora expõe telemetria de worker com concorrência, jobs enfileirados, processados, falhos e reenfileirados
- a tela `journeys/[id]` ganhou ações `Reenfileirar job` e `Reenfileirar jobs falhos`, além de linhas de dead-letter por job
- a overview de `Journeys` agora mostra `dead-letter` no backlog e telemetria do worker no card de runtime
- o smoke validou `requeue` unitário e em lote sobre a execução `b4752afc-3482-4caa-bd07-4d62b4a283f9`
- foi detectado um gap separado: `manual_trigger` sem `contactId/cardId` hoje só materializa os nós de gatilho e não percorre o fluxo completo

Décimo quinto corte entregue:

- corrigida a corrida de concorrência no runtime de `Journeys` para nós com fan-in sob BullMQ
- o job atual agora é marcado como `COMPLETED` antes da checagem de readiness dos nós filhos, evitando que um join fique órfão quando os pais executam em paralelo
- `manual_trigger` sem `contactId/cardId` voltou a percorrer o fluxo completo esperado da régua
- o smoke validou a execução `c35ee396-a417-41be-b058-aa9cb973d4e6` com `trigger_form -> trigger_whatsapp -> condition_gate -> append_activity -> delay_short -> move_stage`
- a execução acima concluiu com warnings operacionais esperados por ausência de card, mas sem perder os nós intermediários do fluxo

Décimo sexto corte entregue:

- `GET /journeys/runtime/status` agora retorna `recentDeadLetters` com `journeyName`, `executionId`, `nodeLabel`, motivo e contagem de requeue manual
- a overview de `Journeys` ganhou o bloco `Dead-letter recente`, com atalho para abrir a régua afetada
- o smoke validou que o runtime status mostra `deadLetterJobs=1` e o job falho enquanto ele existe
- o mesmo smoke validou que `recentDeadLetters` volta a vazio logo após o `requeue` manual do job

Décimo sétimo corte entregue:

- o shell principal foi redesenhado para ficar mais próximo da direção aprovada: `sidebar compacta`, `topbar utilitária` e menos blocos explicativos
- [Sidebar.tsx](D:/Projetos/Saaso/apps/web/src/components/layout/Sidebar.tsx) saiu do modo “card verboso” e passou para navegação mais densa e operacional
- [Header.tsx](D:/Projetos/Saaso/apps/web/src/components/layout/Header.tsx) virou uma barra superior compacta com busca, ações rápidas e identidade do workspace
- [DashboardLayout.tsx](D:/Projetos/Saaso/apps/web/src/components/layout/DashboardLayout.tsx) e [globals.css](D:/Projetos/Saaso/apps/web/src/app/globals.css) foram simplificados para um shell mais reto e menos glassmorphism
- [page.tsx](D:/Projetos/Saaso/apps/web/src/app/page.tsx) deixou o hero promocional e passou a priorizar leitura operacional do pipeline
- [shell-config.ts](D:/Projetos/Saaso/apps/web/src/components/layout/shell-config.ts) teve os `RouteMeta` encurtados para reduzir peso visual no topo
- o corte foi validado em modo enxuto: `lint` direcionado e `build` do `web`

Décimo oitavo corte entregue:

- [page.tsx](D:/Projetos/Saaso/apps/web/src/app/pipelines/page.tsx) foi alinhada ao shell novo e deixou a abertura excessivamente promocional
- o board de `Pipelines` agora entra com enquadramento mais operacional: seleção de pipeline, métricas rápidas e detalhe lateral continuam, mas com hierarquia visual mais reta
- [codex_operating_model.md](D:/Projetos/Saaso/docs/codex_operating_model.md) passou a formalizar a cadência enxuta de validação: `lint direcionado + build do workspace + 1 smoke crítico`
- o corte foi validado só com `lint` direcionado e `build` do `web`, sem rodada longa de smoke

Décimo nono corte entregue:

- [page.tsx](D:/Projetos/Saaso/apps/web/src/app/inbox/page.tsx) saiu do hero antigo e virou uma console de inbox com barra-resumo compacta, fila mais densa e painel lateral mais reto
- [page.tsx](D:/Projetos/Saaso/apps/web/src/app/agentes/page.tsx) ganhou topo operacional com métricas rápidas e cards de agentes em visual escuro, alinhados ao shell novo
- o módulo de `Agentes` continua com o wizard atual, mas a moldura geral já deixou de parecer uma tela isolada do resto do produto
- o corte foi validado com `lint` direcionado e `build` do `web`

Vigésimo corte entregue:

- [page.tsx](D:/Projetos/Saaso/apps/web/src/app/configuracoes/page.tsx) perdeu o hero promocional e passou a operar como centro compacto de sinais, canais e próximos cortes
- [page.tsx](D:/Projetos/Saaso/apps/web/src/app/whatsapp/page.tsx) foi alinhada ao shell novo, mantendo credenciais, webhook e simulador, mas com leitura mais reta e menos ruído visual
- [page.tsx](D:/Projetos/Saaso/apps/web/src/app/journeys/page.tsx) ganhou topo operacional e deixou os cards claros, passando a usar o mesmo padrão escuro do restante da aplicação
- o corte foi validado com `lint` direcionado e `build` do `web`

Vigésimo primeiro corte entregue:

- [page.tsx](D:/Projetos/Saaso/apps/web/src/app/formularios/page.tsx) saiu do hero guiado e passou a abrir com barra operacional, métricas rápidas e ações principais alinhadas ao shell novo
- [page.tsx](D:/Projetos/Saaso/apps/web/src/app/journeys/[id]/page.tsx) ganhou um cabeçalho mais útil, com status da régua, métricas rápidas e ações do runtime sem cara de builder isolado
- o canvas de `journeys/[id]` manteve o fluxo atual, mas perdeu parte do enquadramento visual antigo para se aproximar do restante do app
- o corte foi validado com `lint` direcionado e `build` do `web`

Vigésimo segundo corte entregue:

- `Phase 5` foi aberta com a fundação real de `Campanhas`
- o schema ganhou `Audience` e `Campaign`, ambas multi-tenant e prontas para o roadmap de outbound
- nasceu o `CampaignModule` no backend com CRUD protegido para `audiences` e `campaigns`
- `Audience` agora calcula `contactCount`, `campaignCount` e `sampleContacts` usando a base comercial atual do tenant
- os filtros dinâmicos suportados neste corte são `search`, `tags`, `industries`, `positions`, `companyIds`, `onlyWithPhone` e `onlyWithEmail`
- a navegação principal passou a expor `Campanhas` como módulo real em [shell-config.ts](D:/Projetos/Saaso/apps/web/src/components/layout/shell-config.ts)
- [page.tsx](D:/Projetos/Saaso/apps/web/src/app/campanhas/page.tsx) entrou no shell novo com cards de campanhas e audiências, métricas rápidas e drawer lateral para criar/editar
- [useCampaignStore.ts](D:/Projetos/Saaso/apps/web/src/stores/useCampaignStore.ts) consolidou o carregamento de `campaigns + audiences + segments + companies` em um único fluxo
- a validação enxuta passou em `prisma generate`, `prisma db push`, lint direcionado do backend/frontend e build dos dois workspaces
- o smoke crítico da phase subiu uma API isolada em `:3201`, fez login real, criou a audiência `Phase 5 Clinicas WhatsApp` com `contactCount=1` e criou a campanha `Phase 5 Reengajamento` vinculada a ela
- o smoke do runtime outbound criou uma `SequenceRun` com `2` steps, processou ambos e encerrou a execução como `COMPLETED`

### Phase 5

Iniciada, não concluída.

Primeiro corte entregue:

- módulo real de `Campanhas` no backend e frontend
- `audiences` dinâmicas calculadas sobre a base atual
- campanhas com `canal`, `status`, `audiência`, `mensagem base` e `agendamento`
- navegação principal atualizada com rota `/campanhas`
- smoke real de login + criação de audiência + criação de campanha

## Documentos principais

- PRD revisado: [prd_e_sprints.md](D:/Projetos/Saaso/docs/prd_e_sprints.md)
- plano raiz: [revenue-ops-foundation.md](D:/Projetos/Saaso/revenue-ops-foundation.md)
- contexto do monorepo: [CODEBASE.md](D:/Projetos/Saaso/CODEBASE.md)
- modelo operacional: [codex_operating_model.md](D:/Projetos/Saaso/docs/codex_operating_model.md)

## Arquivos mais importantes do estado atual

### Produto e layout

- shell e IA de navegação: [shell-config.ts](D:/Projetos/Saaso/apps/web/src/components/layout/shell-config.ts)
- sessão/layout: [SessionProvider.tsx](D:/Projetos/Saaso/apps/web/src/components/layout/SessionProvider.tsx)

### Clientes

- contatos: [page.tsx](D:/Projetos/Saaso/apps/web/src/app/contatos/page.tsx)
- empresas: [page.tsx](D:/Projetos/Saaso/apps/web/src/app/empresas/page.tsx)
- segmentos: [page.tsx](D:/Projetos/Saaso/apps/web/src/app/segmentos/page.tsx)
- store de contatos: [useContactStore.ts](D:/Projetos/Saaso/apps/web/src/stores/useContactStore.ts)
- store de empresas: [useCompanyStore.ts](D:/Projetos/Saaso/apps/web/src/stores/useCompanyStore.ts)

### Backend de clientes

- controller: [contact.controller.ts](D:/Projetos/Saaso/apps/api/src/contact/contact.controller.ts)
- service: [contact.service.ts](D:/Projetos/Saaso/apps/api/src/contact/contact.service.ts)
- DTO de entrada manual: [create-manual-entry.dto.ts](D:/Projetos/Saaso/apps/api/src/contact/dto/create-manual-entry.dto.ts)

### Inbox e takeover

- inbox frontend: [page.tsx](D:/Projetos/Saaso/apps/web/src/app/inbox/page.tsx)
- inbox store: [useInboxStore.ts](D:/Projetos/Saaso/apps/web/src/stores/useInboxStore.ts)
- WhatsApp service: [whatsapp.service.ts](D:/Projetos/Saaso/apps/api/src/whatsapp/whatsapp.service.ts)
- agent runner: [agent-runner.service.ts](D:/Projetos/Saaso/apps/api/src/agent/agent-runner.service.ts)
- status da conversa: [agent.service.ts](D:/Projetos/Saaso/apps/api/src/agent/agent.service.ts)

### Phase 4 iniciada

- configurações/canais: [page.tsx](D:/Projetos/Saaso/apps/web/src/app/configuracoes/page.tsx)
- formulários: [page.tsx](D:/Projetos/Saaso/apps/web/src/app/formularios/page.tsx)
- store de formulários: [useLeadFormStore.ts](D:/Projetos/Saaso/apps/web/src/stores/useLeadFormStore.ts)
- página WhatsApp atual: [page.tsx](D:/Projetos/Saaso/apps/web/src/app/whatsapp/page.tsx)
- store de WhatsApp: [useWhatsAppStore.ts](D:/Projetos/Saaso/apps/web/src/stores/useWhatsAppStore.ts)
- DTO inbound WhatsApp: [simulate-inbound-message.dto.ts](D:/Projetos/Saaso/apps/api/src/whatsapp/dto/simulate-inbound-message.dto.ts)
- submit de formulário: [lead-form.service.ts](D:/Projetos/Saaso/apps/api/src/lead-form/lead-form.service.ts)
- inbox com empty-state operacional: [page.tsx](D:/Projetos/Saaso/apps/web/src/app/inbox/page.tsx)
- service de agentes: [agent.service.ts](D:/Projetos/Saaso/apps/api/src/agent/agent.service.ts)
- página de agentes: [page.tsx](D:/Projetos/Saaso/apps/web/src/app/agentes/page.tsx)
- store de knowledge base: [useKnowledgeBaseStore.ts](D:/Projetos/Saaso/apps/web/src/stores/useKnowledgeBaseStore.ts)
- módulo backend de knowledge base: [knowledge-base.module.ts](D:/Projetos/Saaso/apps/api/src/knowledge-base/knowledge-base.module.ts)
- service backend de knowledge base: [knowledge-base.service.ts](D:/Projetos/Saaso/apps/api/src/knowledge-base/knowledge-base.service.ts)
- prompt builder do agente: [agent-prompt.builder.ts](D:/Projetos/Saaso/apps/api/src/agent/agent-prompt.builder.ts)
- controller do WhatsApp: [whatsapp.controller.ts](D:/Projetos/Saaso/apps/api/src/whatsapp/whatsapp.controller.ts)
- service do WhatsApp: [whatsapp.service.ts](D:/Projetos/Saaso/apps/api/src/whatsapp/whatsapp.service.ts)
- tela do canal WhatsApp: [page.tsx](D:/Projetos/Saaso/apps/web/src/app/whatsapp/page.tsx)
- DTO de mensagens WhatsApp: [create-message.dto.ts](D:/Projetos/Saaso/apps/api/src/whatsapp/dto/create-message.dto.ts)
- service de journeys: [journey.service.ts](D:/Projetos/Saaso/apps/api/src/journey/journey.service.ts)
- queue de journeys: [journey-queue.service.ts](D:/Projetos/Saaso/apps/api/src/journey/journey-queue.service.ts)
- controller de journeys: [journey.controller.ts](D:/Projetos/Saaso/apps/api/src/journey/journey.controller.ts)
- store de journeys: [useJourneyStore.ts](D:/Projetos/Saaso/apps/web/src/stores/useJourneyStore.ts)
- builder de journeys: [page.tsx](D:/Projetos/Saaso/apps/web/src/app/journeys/[id]/page.tsx)
- overview de journeys: [page.tsx](D:/Projetos/Saaso/apps/web/src/app/journeys/page.tsx)

### Phase 5 iniciada

- tela de campanhas: [page.tsx](D:/Projetos/Saaso/apps/web/src/app/campanhas/page.tsx)
- store de campanhas: [useCampaignStore.ts](D:/Projetos/Saaso/apps/web/src/stores/useCampaignStore.ts)
- módulo backend de campanhas: [campaign.module.ts](D:/Projetos/Saaso/apps/api/src/campaign/campaign.module.ts)
- service backend de campanhas: [campaign.service.ts](D:/Projetos/Saaso/apps/api/src/campaign/campaign.service.ts)
- controller de campanhas: [campaign.controller.ts](D:/Projetos/Saaso/apps/api/src/campaign/campaign.controller.ts)
- controller de audiencias: [audience.controller.ts](D:/Projetos/Saaso/apps/api/src/campaign/audience.controller.ts)
- schema Prisma: [schema.prisma](D:/Projetos/Saaso/apps/api/prisma/schema.prisma)

## Validação já feita

### Builds

- `npm run build --workspace api`
- `npm run build --workspace web`

### Smoke manual concluído

- `Empresas`: criação e edição
- `Contatos`: criação e edição
- `Entrada manual`: criação de lead com card e conversa
- `Segmentos`: atualização após novos dados
- `Inbox`: nova thread em takeover manual
- `Configurações`: leitura de sinais reais do inbound
- `Formulários`: criação, publicação e submissão pública
- `Inbox`: lead de formulário apareceu como thread autônoma
- `WhatsApp`: simulador inbound criou thread, card e resposta do agente
- `Webhook`: payload público simplificado criou thread e card mesmo sem agente ativo
- `Inbox`: fallback de contexto exibiu `card/pipeline` mesmo sem conversa de agente
- `Agentes`: pausa global desligou o agente principal e moveu conversas abertas para takeover manual
- `Inbox`: thread nova em etapa pausada entrou sem resposta e com status operacional correto
- `Journeys`: teste manual gerou execução concluída com warnings por ausência de contexto
- `Journeys`: submissão pública do formulário gerou execução concluída e moveu o card para `Proposta`
- `Journeys`: simulação de inbound WhatsApp gerou execução concluída e moveu o card para `Qualificação`
- `Journeys`: tela de detalhe passou a refletir `3` execuções persistidas com logs visíveis
- `Agentes`: base `Base Atlas Comercial` criada, editada e vinculada ao agente principal
- `Agentes`: `Qualificador Conversacional` passou a refletir a base vinculada no card, no wizard e no prompt compilado
- `Agentes`: contador de bases sincronizou `1 agente vinculado` após o patch de refresh
- `Agentes`: tentativa de excluir base vinculada retornou `400` com bloqueio seguro do backend
- `WhatsApp`: smoke oficial validou challenge `GET /whatsapp/webhook`
- `WhatsApp`: payload oficial da Meta criou a thread `Camila Meta`
- `WhatsApp`: status update oficial mudou uma mensagem outbound com `externalId` para `READ`
- `WhatsApp`: `GET /whatsapp/account` passou a expor readiness operacional real do canal
- `WhatsApp`: a tela do canal passou a mostrar `Cloud API oficial`, webhook oficial e fallback local de verify token
- `WhatsApp`: `POST /whatsapp/send` persistiu falha limpa em `cloud_api` para `Camila Meta` com erro `401` do token demo
- `WhatsApp`: `POST /whatsapp/send` sem `direction` confirmou default backend para `OUTBOUND`
- `Journeys`: a régua `Reativação de Leads Quentes` foi editada para incluir `Delay · Esperar 7 segundos`
- `Journeys`: trigger manual com `contactId/cardId` retornou execução `RUNNING` e `delay_short` em `PENDING`
- `Journeys`: o poller automático concluiu o delay, liberou `move_stage` e fechou a execução como `COMPLETED`
- `Journeys`: o builder exibiu jobs, próximo disparo e trilha completa de scheduling no painel lateral
- `Journeys`: `POST /journeys/runtime/process-due` retornou resumo consistente do runtime após o smoke
- `Journeys`: branching condicional percorreu apenas o caminho `SIM` quando `origin=manual_branch_true`
- `Journeys`: branching condicional percorreu apenas o caminho `NAO` quando `origin=manual_false`
- `Journeys`: o canvas exibiu labels `SIM/NAO` e o inspector permitiu editar nó de condição e aresta condicional no browser
- `Journeys`: `GET /journeys/runtime/status` passou a expor `driver=bullmq`, fila operacional e backlog
- `Journeys`: a API isolada em `:3101` iniciou com `BullMQ operacional para Journeys em redis://127.0.0.1:6379/0`
- `Journeys`: a execução `b4752afc-3482-4caa-bd07-4d62b4a283f9` concluiu em ~8s com `JOURNEY_RUNTIME_POLL_MS=60000`, validando que o delay foi consumido pela fila externa
- `Journeys`: a tela de overview compila com cards de driver, backlog, retry e próximo disparo
- `Journeys`: o job `move_stage` da execução `b4752afc-3482-4caa-bd07-4d62b4a283f9` foi forçado para `FAILED` e recuperado via `POST /journeys/runtime/jobs/:jobId/requeue`
- `Journeys`: os jobs `append_activity` e `move_stage` da mesma execução foram forçados para `FAILED` e recuperados via `POST /journeys/runtime/executions/:executionId/requeue-failed`
- `Journeys`: os logs passaram a registrar `Job reenfileirado manualmente após dead-letter.` e os jobs preservam o dead-letter anterior em `previousDeadLetteredAt/Reason`
- `Journeys`: a execução `c35ee396-a417-41be-b058-aa9cb973d4e6` confirmou que `manual_trigger` sem contexto voltou a materializar `condition_gate`, `append_activity`, `delay_short` e `move_stage`
- `Journeys`: `GET /journeys/runtime/status` exibiu `deadLetterJobs=1` e o item recente do `move_stage` da execução `b4752afc-3482-4caa-bd07-4d62b4a283f9`
- `Journeys`: após `POST /journeys/runtime/jobs/:jobId/requeue`, o mesmo endpoint voltou a `deadLetterJobs=0` com `recentDeadLetters=[]`
- `Shell`: sidebar, header, dashboard layout e home compilaram no `web` após a revisão visual
- `Pipelines`: a tela compila no `web` já no padrão do shell novo
- `Inbox`: a tela compila no `web` com barra-resumo operacional, lista mais densa e painel lateral alinhado ao shell
- `Agentes`: a tela compila no `web` com topo operacional e cards visuais no mesmo padrão escuro do app
- `Configurações`: a tela compila no `web` no padrão do shell novo, com módulos mais compactos
- `WhatsApp`: a tela compila no `web` com o mesmo enquadramento visual do resto do painel
- `Journeys`: a overview compila no `web` com topo operacional e cards escuros coerentes com o shell
- `Formulários`: a tela compila no `web` com cabeçalho operacional e builder mais alinhado ao shell
- `journeys/[id]`: a tela compila no `web` com header operacional e métricas da régua no topo
- `Campanhas`: a tela compila no `web` com alternância entre audiência dinâmica e lista manual no drawer lateral
- `Campanhas`: o store passou a carregar contatos para sustentar listas manuais no mesmo fluxo
- `Campanhas`: a lista manual foi validada com audiência `MANUAL` e campanha vinculada via API real
- `Campanhas`: o backend agora persiste `steps` por campanha para fundar a cadência antes do runtime outbound
- `Campanhas`: o drawer passou a editar etapas com atraso, canal e mensagem no mesmo fluxo de criação da campanha
- `Campanhas`: a campanha `Phase 5 Cadencia 142642` foi criada com `2` steps persistidos
- `Campanhas`: `GET /campaigns/:id` devolveu `step1:0-HOURS` e `step2:24-HOURS` com as mensagens corretas
- `Tenant`: o backend agora expõe feature flags persistidas para `outboundEnabled` e `coldOutboundEnabled`
- `CampaignRuntime`: o backend ganhou `SequenceRun` e `SequenceRunStep` para outbound por contato, com runtime de campanhas e envio via WhatsApp integrado
- `CampaignRuntime`: o smoke direto no banco criou `SequenceRun` com `2` steps, processou ambos e fechou a execução como `COMPLETED`
- `CampaignRuntime`: o runtime de campanhas agora também expõe `BullMQ/Redis` no status autenticado, com `driver=bullmq`, `queueOperational=true` e `queueName=campaign_execute`
- `CampaignRuntime`: o step falho agora grava dead-letter persistente e permite requeue manual por `stepId` ou por execução
- `CampaignRuntime`: o smoke autenticado gerou dead-letter por falta de telefone, reenfileirou o step e confirmou que a fila consumiu o requeue
- `WhatsApp`: o backend agora persiste eventos em `WhatsAppEvent` e expõe `GET /whatsapp/events` para observar inbound, outbound e webhooks
- `WhatsApp`: o smoke autenticado registrou `WEBHOOK_SIMULATOR` e `OUTBOUND_SEND` no histórico de eventos por tenant
- `Prospect`: o backend agora provisionou `Prospect`, `ResearchTask` e `EnrichmentTask` como base de cold outbound
- `Prospect`: o backend agora converte prospect em `Contato + Card`, com empresa opcional e etapa inicial do pipeline
- `Prospect`: o smoke autenticado importou prospects com dedupe, criou tarefas de pesquisa/enriquecimento, aplicou opt-out e converteu um prospect em contato/card
- `Prospect`: o backend agora processa `ResearchTask` e `EnrichmentTask` com runtime interno, `GET /prospects/runtime/status` e `POST /prospects/runtime/process-due`
- `Prospect`: o smoke autenticado processou as duas tarefas, atualizou `score/status/metadata` e a base de teste foi limpa depois
- `Prospect`: o backend ganhou BullMQ/Redis para executar tarefas com fallback em poller, snapshot operacional e `POST /prospects/runtime/requeue/:taskType/:taskId`
- `Prospect`: o smoke autenticado confirmou fila operacional, enfileiramento real e requeue de task; a base de teste foi limpa depois
- `Prospect`: o backend ganhou histórico persistido de eventos do runtime para enqueue, start, completion, failure e requeue
- `Prospect`: o smoke autenticado confirmou `ENQUEUED`, `STARTED`, `COMPLETED` e `REQUEUED` no histórico, e a base de teste foi limpa depois
- `Prospect`: o backend passou a agendar automaticamente o próximo `EnrichmentTask` depois de concluir a pesquisa quando há fit suficiente
- `Prospect`: o smoke autenticado confirmou o auto-follow-up de enriquecimento e a base de teste foi limpa depois
- `Prospect`: o backend agora produz `outreachBrief` estruturado no enriquecimento para orientar a abordagem comercial
- `Prospect`: o backend agora dispara o primeiro outreach real via WhatsApp quando outbound e cold outbound estao ativos, marcando o prospect como CONTACTED no envio bem sucedido
- `Prospect`: o backend agora evita duplicar outreach automatico em reprocessos e limita retry a duas tentativas totais
- `Prospect`: o backend agora classifica falhas de outreach em permanentes ou retryable e pode marcar o prospect como INVALID quando a falha e definitiva
- `Prospect`: o smoke autenticado confirmou o `outreachBrief` com `openingLine`, `cta`, `talkingPoints` e `riskFlags`, e a base de teste foi limpa depois
- `Prospect`: o smoke autenticado confirmou o primeiro outreach real via WhatsApp apos enriquecimento, com status CONTACTED e evento OUTBOUND_SEND persistido
- `Prospect`: o smoke autenticado confirmou idempotencia do outreach automatico, com apenas 1 `OUTBOUND_SEND` mesmo apos um segundo `process-due`

## Dados de smoke já criados

Durante a validação manual foram adicionados registros de demo:

- empresa `Atlas Health`
- contato `Carla Menezes`
- lead manual `Joao Barros`
- formulário `Diagnostico Atlas Site`
- lead de formulário `Rafael Noronha`
- lead WhatsApp `Bruna Salles`
- lead webhook `Paula Nogueira`
- lead pausado por agente `Daniel Prado`
- lead de jornada por formulário `Felipe Jornada`
- lead de jornada por WhatsApp `Laura Fluxo`
- knowledge base `Base Atlas Comercial`
- lead via webhook oficial `Camila Meta`
- execução manual `manual_scheduler_smoke` sobre o card `72a026ed-01ac-4f61-9629-a19cd1098aa1`
- mensagens outbound de smoke `Smoke outbound Cloud API via adapter operacional.` e `Smoke outbound sem direction para validar default server-side.`
- execução condicional positiva `1d741a47-8f0c-48e8-82a8-e0d671bc03f8`
- execução condicional negativa `d2a31b9b-2d00-47e8-8d91-064aa1c6c8f6`
- execução BullMQ `b4752afc-3482-4caa-bd07-4d62b4a283f9`
- audiência manual `Phase 5 Lista Manual 141216`
- campanha manual `Phase 5 Campanha Manual 141216`
- audiência manual `Phase 5 Lista Cadencia 142642`
- campanha com cadência `Phase 5 Cadencia 142642`

Esses dados aparecem em `Contatos`, `Empresas`, `Segmentos` e `Inbox`.

## Ambiente local

No momento do handoff, o ambiente foi deixado funcional com:

- Docker: `postgres` e `redis` via `docker compose up -d`
- API: `http://127.0.0.1:3001`
- Web: `http://127.0.0.1:3000`

Se outro modelo encontrar a web servindo versão antiga, basta reiniciar o processo do frontend.

## O que falta fazer agora

O próximo corte recomendado é este:

1. Endurecer ainda mais o runtime de `Réguas` em BullMQ com métricas históricas, dead-letter queue real e reprocessamento mais fino.
2. Fechar o canal `WhatsApp` com credenciais produtivas, verify token explícito e observabilidade do adapter oficial.
3. Consolidar `Campanhas` como runtime de outbound com mais observabilidade fina e integração produtiva do WhatsApp.
4. Evoluir a camada de `Prospect` para pesquisa/enriquecimento assistido e depois prospecção fria controlada por flag.
5. Continuar o alinhamento visual nas telas restantes, principalmente `Contatos`, `Empresas` e outros módulos com tabelas/formulários ainda em padrão anterior.
6. Consolidar melhor o centro de `Configurações` para reduzir dependência de páginas isoladas.

## Prioridade prática imediata

Se o próximo modelo for continuar direto do ponto certo, ele deve começar por:

1. revisar [revenue-ops-foundation.md](D:/Projetos/Saaso/revenue-ops-foundation.md)
2. revisar [prd_e_sprints.md](D:/Projetos/Saaso/docs/prd_e_sprints.md)
3. abrir [page.tsx](D:/Projetos/Saaso/apps/web/src/app/campanhas/page.tsx)
4. mapear [campaign.service.ts](D:/Projetos/Saaso/apps/api/src/campaign/campaign.service.ts), [useCampaignStore.ts](D:/Projetos/Saaso/apps/web/src/stores/useCampaignStore.ts) e [schema.prisma](D:/Projetos/Saaso/apps/api/prisma/schema.prisma)
5. revisar [journey.service.ts](D:/Projetos/Saaso/apps/api/src/journey/journey.service.ts) e [whatsapp.service.ts](D:/Projetos/Saaso/apps/api/src/whatsapp/whatsapp.service.ts)
6. seguir a partir da `Phase 5`, priorizando fechamento produtivo do canal WhatsApp, camada de `Prospect` e endurecimento fino do runtime de outbound

## Riscos em aberto

- adapter de WhatsApp já existe, com observabilidade de eventos, mas o fechamento produtivo ainda depende de credenciais válidas e verify token explícito
- runtime de réguas ainda não é o runtime final prometido no PRD
- o runtime atual já executa branching real e fila externa, mas ainda não tem dead-letter queue dedicada nem observabilidade histórica suficiente
- `Knowledge Base` já existe dentro de `Agentes`, mas ainda sem módulo visual dedicado fora desse fluxo
- outbound deixou de ser apenas provisionado, já possui audiências dinâmicas, listas manuais, builder de cadência por `steps`, runtime de `SequenceRun` com dead-letter/requeue e base arquitetural de `Prospect`, e já converte prospect em contato/card; ainda não possui prospecção fria exposta ao usuário final
- `Prospect` já processa tarefas de pesquisa/enriquecimento no backend, usa fila BullMQ com fallback, persiste eventos do runtime, agenda o próximo enriquecimento automaticamente e produz briefing estruturado de abordagem; a prospecção fria assistida ao usuário final ainda precisa de frontend e regras mais ricas
- o fluxo de deploy foi preparado para EasyPanel com Dockerfiles por app, `.dockerignore` raiz, exemplos de env e documentação operacional em `docs/easypanel-deploy.md`

