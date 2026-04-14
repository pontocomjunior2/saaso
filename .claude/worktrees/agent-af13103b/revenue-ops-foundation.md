# Revenue Ops Foundation Plan

## Goal

Transformar o estado atual do projeto em uma base confiavel para o MVP de operacao inbound autonoma com inbox, agentes, reguas e takeover.

## Validation Cadence

- Default daqui em diante: `lint direcionado + build do workspace afetado + 1 smoke critico`
- Smokes amplos ficam reservados para milestones de phase, runtime de `Journeys`, integrações reais de canal e refactors com risco alto
- Cortes majoritariamente visuais devem preferir validacao enxuta para manter velocidade de entrega

## Approved Context

- Produto horizontal
- V1 com `formulario + entrada manual + WhatsApp`
- Navegacao principal enxuta
- `Knowledge Base` sob `Agentes`
- `Canais` fora da sidebar principal
- Foundation de `Campanhas` aberta na `Phase 5`
- Prospeccao fria continua provisionada para fase posterior
- Agency mode em roadmap, nao no primeiro corte

## Phase 1

### Foundation, Security and Shell

- [x] Adicionar `ValidationPipe` global na `api`
- [x] Remover armazenamento inseguro de sessao/senha no frontend
- [x] Consolidar shell principal com sidebar e header
- [x] Preparar modelo `workspace-ready` sem quebrar a V1
- [x] Definir componentes base de layout e navegacao

### Verify

- [x] `npm run build --workspace api`
- [x] `npm run build --workspace web`
- [x] Login continua funcional
- [x] Sidebar principal segue a IA aprovada

## Phase 2

### Inbox, Pipelines and Board

- [x] Criar `Inbox` como dominio principal
- [x] Melhorar board Kanban e interacao de drag
- [x] Consolidar pipeline, stage e card como operacao comercial
- [x] Garantir timeline de conversa e atividades

### Verify

- [x] Pipeline cria etapas dinamicas
- [x] Cards movem com fluidez
- [x] Inbox apresenta conversa e contexto operacional

### Smoke Notes

- [x] `Inbox` abriu com thread real, timeline e contexto lateral
- [x] Takeover manual mudou a conversa para `HANDOFF_REQUIRED`
- [x] Nova mensagem inbound em takeover manual nao gerou resposta automatica
- [x] `Pipelines` abriu board dedicado e exibiu detalhe lateral do card com atividades

## Phase 3

### Clients, Companies and Manual Capture

- [x] Separar `Clientes` em `Contatos`, `Empresas` e `Segmentos`
- [x] Formalizar entrada manual de lead/oportunidade
- [x] Garantir vinculacao `contato -> empresa -> card -> conversa`

### Verify

- [x] Lead manual entra no pipeline correto
- [x] Segmentacao basica funciona
- [x] Timeline consolida historico

### Smoke Notes

- [x] Criacao e edicao de empresa validadas manualmente em `Empresas`
- [x] Criacao e edicao de contato validadas manualmente em `Contatos`
- [x] Entrada manual criou `contato -> empresa -> card -> conversa`
- [x] `Inbox` exibiu a nova thread em takeover manual com card e pipeline corretos
- [x] `Segmentos` refletiu novas tags, cargos e industria sem refresh estrutural

## Phase 4

### Inbound Capture and Agent Runtime

- [x] Consolidar formularios publicados e embed
- [x] Implementar adapter operacional de WhatsApp com `Cloud API + fallback local`
- [ ] Fechar credenciais oficiais, verify token produtivo e observabilidade do canal WhatsApp
- [x] Criar builder de agentes com `prompt + temperatura + base`
- [x] Entregar runtime inicial de reguas com logs
- [x] Evoluir runtime de reguas para scheduling persistido com delays
- [x] Implementar takeover manual por conversa e por agente

### Progress Notes

- [x] `Configuracoes` agora funciona como centro de canais e prontidao inbound
- [x] Painel exibe estado da API, WhatsApp, formularios e entrada manual
- [x] Checklist operacional aponta lacunas reais da fase seguinte
- [x] Submissao publica de formulario agora cria thread operacional no `Inbox`
- [x] Tela dedicada de `WhatsApp` agora cobre credenciais, endpoint de webhook e simulador inbound
- [x] Webhook publico aceita payload simplificado e cria lead/thread mesmo sem agente disponivel
- [x] `Inbox` preserva contexto de card/pipeline mesmo quando a thread nao tem conversa de agente associada
- [x] `Agentes` agora permite desligar e religar operacao global de um agente sem entrar no wizard
- [x] Ao desligar um agente, conversas `OPEN` ligadas a ele entram em `HANDOFF_REQUIRED`
- [x] `Inbox` agora diferencia `Autonoma`, `Manual` e `Sem agente` com base em conversa e agente da etapa
- [x] `Journeys` agora persiste `JourneyExecution` e `JourneyExecutionLog` no banco
- [x] Runtime inicial de reguas cobre gatilho manual, formulario e WhatsApp inbound
- [x] Acoes iniciais suportadas: registrar atividade no card, mover card e solicitar handoff
- [x] Builder de `Journeys` agora exibe execucoes recentes e trilha operacional dentro da tela
- [x] DTOs de jornada foram ajustados para preservar os objetos do React Flow com `ValidationPipe` global
- [x] Rota `journeys/[id]` foi adaptada ao `params` assíncrono do Next 16 no ambiente de desenvolvimento
- [x] `KnowledgeBase` agora existe como dominio persistido por tenant no backend
- [x] `Agentes` agora permite criar, editar e remover bases sem sair do modulo principal
- [x] Wizard de `Agentes` passou a vincular `prompt + temperatura + knowledge base` no mesmo fluxo
- [x] Preview do agente e runtime do backend agora incorporam resumo e conteudo operacional da base no prompt compilado
- [x] Card da base sincroniza `agentCount` apos salvar/remover agentes e a navegacao passou a refletir que templates e bases vivem no modulo
- [x] Webhook `GET /whatsapp/webhook` agora responde ao challenge de verificacao da Meta
- [x] Webhook `POST /whatsapp/webhook` agora aceita envelope oficial da Meta para mensagens inbound
- [x] Webhook `POST /whatsapp/webhook` agora processa `statuses` oficiais da Meta para atualizar mensagens outbound
- [x] Tela `WhatsApp` passou a explicar verify token, payload oficial e status updates suportados
- [x] `JourneyExecutionJob` agora persiste fila por no com `scheduledFor`, `attempts` e `lastError`
- [x] `JourneyService` agora agenda nos, drena jobs elegiveis e mantem a execucao em `RUNNING` enquanto houver pendencias
- [x] Poller interno do runtime processa jobs pendentes em background e a API expõe `POST /journeys/runtime/process-due`
- [x] Builder de `Journeys` agora suporta nos de `Delay`, botao manual de processamento e leitura de jobs agendados
- [x] Execucao detalhada passou a expor `pendingJobCount`, `runningJobCount`, `failedJobCount` e `nextScheduledAt`
- [x] `WhatsAppService` agora calcula capacidades operacionais do canal com `connectionMode`, `isOperational`, `supportsSimulator` e readiness oficial
- [x] Envio outbound agora usa `Cloud API` quando `accessToken + phoneNumberId` estao presentes e cai para `local_demo` quando o workspace ainda nao esta completo
- [x] Tela `WhatsApp` passou a distinguir `Cloud API oficial`, `Demo local` e `Configuracao parcial` sem depender apenas do enum legado de status
- [x] `Configuracoes` agora resume o canal pelo modo operacional, nao apenas por `CONNECTED/PENDING`
- [x] Endpoint `POST /whatsapp/send` agora assume `OUTBOUND` por padrao quando o cliente nao informa `direction`
- [x] Runtime de `Journeys` agora suporta branching real por condicao com avaliacao sobre `triggerPayload`, `contact`, `company` e `card`
- [x] `JourneyService` passou a selecionar arestas por caminho `SIM/NAO/Sempre` e a registrar logs explicitos do branch liberado
- [x] Builder de `Journeys` agora permite configurar no de condicao com `campo + operador + valor`
- [x] Builder de `Journeys` agora permite selecionar arestas de condicao e marcar o caminho `SIM`, `NAO` ou `Sempre`
- [x] Canvas passou a exibir labels `SIM/NAO` nas arestas condicionais para leitura operacional imediata
- [x] Runtime de `Journeys` agora publica jobs em BullMQ/Redis quando a fila externa esta disponivel
- [x] Poller interno foi mantido como fallback operacional caso a fila externa falhe ou um enqueue nao aconteca
- [x] API agora expõe `GET /journeys/runtime/status` com driver, fila, retry, backlog e proximo disparo
- [x] Tela `Journeys` agora mostra o driver do runtime, o backlog e a politica operacional da fila
- [x] Runtime de `Journeys` agora marca jobs em `dead-letter` com metadados persistidos no `details`
- [x] API agora expõe `POST /journeys/runtime/jobs/:jobId/requeue` e `POST /journeys/runtime/executions/:executionId/requeue-failed`
- [x] `JourneyQueueService` agora expõe telemetria do worker com concorrencia, jobs enfileirados, processados e reenfileirados
- [x] Builder de `Journeys` agora mostra `dead-letter`, requeue manual e badges operacionais por job/execucao
- [x] `manual_trigger` sem `contactId/cardId` voltou a percorrer o fluxo completo da régua sob concorrencia do BullMQ
- [x] O runtime passou a marcar o job atual como `COMPLETED` antes de liberar nós de fan-in, evitando corrida entre pais paralelos
- [x] `GET /journeys/runtime/status` agora retorna `recentDeadLetters` com régua, execução, nó e motivo do dead-letter
- [x] Overview de `Journeys` agora mostra um bloco de `Dead-letter recente` com atalho para a régua afetada
- [x] Shell principal foi refinado para `sidebar compacta + topbar utilitaria + superfícies mais operacionais`
- [x] Dashboard ficou mais direto e menos promocional, com leitura rápida do pipeline e CTAs reais
- [x] Tela `Pipelines` foi alinhada ao novo shell, com menos hero e mais foco em seleção, board e detalhe lateral
- [x] Tela `Inbox` foi alinhada ao shell novo com barra-resumo compacta, lista de threads mais densa e painel lateral mais direto
- [x] Tela `Agentes` ganhou topo operacional com métricas rápidas e cards no mesmo padrão visual escuro do shell
- [x] `Configurações`, `WhatsApp` e overview de `Journeys` foram alinhados ao shell novo, reduzindo hero/blur e padronizando superfícies operacionais
- [x] `Formulários` e `journeys/[id]` passaram a seguir o shell novo com cabeçalhos operacionais, menos ruído visual e melhor leitura do fluxo

### Verify

- [x] Lead vindo de formulario gera contato/card/conversa
- [x] Mensagem WhatsApp entra no inbox
- [x] Agente responde e pode ser pausado
- [x] Agente pode ser vinculado a uma base e refletir esse contexto no prompt compilado
- [x] Regua dispara e registra execucao
- [x] Regua manual mostra logs e avisos operacionais quando nao existe contexto de card
- [x] Regua disparada por formulario move card de `Qualificação` para `Proposta`
- [x] Regua disparada por WhatsApp inbound move card de `Lead` para `Qualificação`
- [x] Webhook oficial da Meta responde verify challenge e processa payload inbound real
- [x] Status update oficial da Meta atualiza mensagem outbound para `READ`
- [x] Regua com `Delay` entra em `RUNNING`, mantem job pendente e finaliza apos o agendamento
- [x] Builder de `Journeys` reflete jobs, proximo disparo e fila operacional no frontend
- [x] `GET /whatsapp/account` expõe `connectionMode`, readiness oficial e fallback local
- [x] `POST /whatsapp/send` persiste tentativa outbound oficial com `deliveryMode` e `deliveryError`
- [x] `POST /whatsapp/send` funciona sem `direction`, assumindo `OUTBOUND`
- [x] Regua condicional agenda somente o caminho `SIM` quando a condicao e satisfeita
- [x] Regua condicional agenda somente o caminho `NAO` quando a condicao falha
- [x] Builder de `Journeys` mostra inspector funcional para no selecionado e aresta selecionada
- [x] Canvas de `Journeys` exibe labels `SIM/NAO` nas arestas condicionais apos reload
- [x] `GET /journeys/runtime/status` expõe `driver=bullmq` quando Redis esta operacional
- [x] Delay de `7 segundos` conclui por BullMQ mesmo com `JOURNEY_RUNTIME_POLL_MS=60000`
- [x] Tela `Journeys` compila com cards de runtime e fila operacional
- [x] `POST /journeys/runtime/jobs/:jobId/requeue` recupera um job marcado em dead-letter e fecha novamente a execucao
- [x] `POST /journeys/runtime/executions/:executionId/requeue-failed` recupera todos os jobs falhos de uma execucao
- [x] Execucao detalhada expõe `deadLetteredAt`, `deadLetterReason`, `manuallyRequeuedAt` e `manualRequeueCount`
- [x] Trigger manual sem contexto agora materializa `condition_gate`, `append_activity`, `delay_short` e `move_stage`
- [x] `GET /journeys/runtime/status` lista dead-letters recentes e limpa a lista após requeue manual
- [x] `Inbox` compila no `web` já no padrão do shell novo
- [x] `Agentes` compila no `web` com topo operacional e cards visuais coerentes com o restante do painel
- [x] `Configurações`, `WhatsApp` e `Journeys` compilam no `web` com o mesmo padrão visual do shell principal
- [x] `Formulários` e `journeys/[id]` compilam no `web` no mesmo padrão do shell principal

### Smoke Notes

- [x] Formulario `Diagnostico Atlas Site` criado e publicado
- [x] URL publica e embed passaram a refletir o formulario salvo
- [x] Lead `Rafael Noronha` enviado pela rota publica
- [x] Jornada `Reativação de Leads Quentes` atualizada para gatilhos `formulario + WhatsApp`
- [x] Teste manual da jornada gerou execucao concluida com avisos por falta de card
- [x] Lead `Felipe Jornada` submetido no formulario publico e avancou automaticamente para `Proposta`
- [x] Lead `Laura Fluxo` criado por simulacao WhatsApp e avancou automaticamente para `Qualificação`
- [x] Tela de `Journeys` passou a refletir `3` execucoes persistidas com logs e contexto de `contactId/cardId`
- [x] Lead apareceu no `Inbox` como thread autonoma com resumo, card e pipeline corretos
- [x] `Configuracoes` passou a mostrar `1` formulario ativo e a URL publicada
- [x] Simulador inbound do `WhatsApp` criou a thread `Bruna Salles` com card em `Vendas Inbound / Qualificacao`
- [x] `Inbox` mostrou a mensagem inbound, a resposta do agente e permitiu takeover manual na conversa
- [x] Webhook publico `POST /whatsapp/webhook` criou a thread `Paula Nogueira` com card em `Vendas Inbound / Lead`
- [x] `Inbox` passou a exibir card/pipeline mesmo quando o inbound entrou sem agente ativo
- [x] Agente `Qualificador Conversacional` foi desligado globalmente e reativado via tela `Agentes`
- [x] Thread `Bruna Salles` mudou para `MANUAL` no desligamento global e voltou para `AUTONOMA` apos reativacao manual
- [x] Thread `Daniel Prado` entrou sem resposta automatica enquanto o agente da etapa estava desligado
- [x] `Inbox` exibiu `MANUAL` para agente pausado e `SEM AGENTE` para etapas sem agente configurado
- [x] Base `Base Atlas Comercial` criada e ajustada no modulo `Agentes`
- [x] Agente `Qualificador Conversacional` vinculado a `Base Atlas Comercial`
- [x] Preview do wizard passou a exibir a secao `Base de conhecimento vinculada` e o `Contexto extra da base de conhecimento`
- [x] Card final do agente passou a refletir `Base Atlas Comercial` e o card da base sincronizou `1 agente vinculado`
- [x] Exclusao de base vinculada retornou bloqueio seguro com mensagem de erro do backend
- [x] Script de smoke oficial da Meta validou challenge `GET`, inbound com envelope real e status update `READ`
- [x] Lead `Camila Meta` entrou pelo webhook oficial e ficou com agente/card corretos
- [x] Jornada `Reativação de Leads Quentes` foi ajustada com `Delay · Esperar 7 segundos`
- [x] Trigger manual com `contactId/cardId` retornou execucao `RUNNING` com `delay_short` pendente
- [x] Poller automatico processou o delay, liberou `move_stage` e concluiu a execucao sem acao manual
- [x] Builder de `Journeys` exibiu fila, jobs concluídos e o proximo disparo do scheduler no painel lateral
- [x] Endpoint `POST /journeys/runtime/process-due` retornou resumo consistente do runtime apos o smoke
- [x] `GET /whatsapp/account` retornou `Cloud API oficial` com readiness explicita para outbound e webhook
- [x] Tela `WhatsApp` exibiu modo operacional, verify token em fallback local e capacidades reais do canal
- [x] `POST /whatsapp/send` para `Camila Meta` persistiu falha limpa em `cloud_api` com erro `401 Invalid OAuth access token`
- [x] Segundo smoke em `POST /whatsapp/send` sem `direction` confirmou default server-side para `OUTBOUND`
- [x] `Configuracoes` passou a mostrar `Cloud API` como modo do canal e atualizou o bloco de proximo corte
- [x] Jornada `Reativação de Leads Quentes` foi remodelada com o no `condition_gate` e arestas `SIM/NAO`
- [x] Trigger manual com `origin=manual_branch_true` gerou a execucao `1d741a47-8f0c-48e8-82a8-e0d671bc03f8` e percorreu `atividade -> delay -> mover etapa`
- [x] Trigger manual com `origin=manual_false` gerou a execucao `d2a31b9b-2d00-47e8-8d91-064aa1c6c8f6` e percorreu apenas `request_handoff`
- [x] Execucao `200323a9-e00c-44a5-839b-0bb84d666619` confirmou a semantica do operador ao cair no caminho `SIM` por input de smoke incorreto
- [x] Reload do builder em `journeys/[id]` exibiu labels `SIM/NAO` no canvas e inspector funcional para no de condicao e aresta condicional
- [x] API isolada em `:3101` iniciou com `JOURNEY_RUNTIME_POLL_MS=60000` e registrou `BullMQ operacional para Journeys em redis://127.0.0.1:6379/0`
- [x] `GET /journeys/runtime/status` retornou `driver=bullmq`, `queueOperational=true`, `queueName=journey_execute` e backlog zerado
- [x] Trigger manual com `origin=bullmq_smoke_true` gerou a execucao `b4752afc-3482-4caa-bd07-4d62b4a283f9` em `RUNNING`
- [x] A mesma execucao `b4752afc-3482-4caa-bd07-4d62b4a283f9` concluiu em ~8 segundos, apesar do poller estar em `60000ms`, validando processamento real pelo BullMQ
- [x] Tela `Journeys` passou a compilar com resumo de driver, backlog, retry e proximo disparo
- [x] A execucao `b4752afc-3482-4caa-bd07-4d62b4a283f9` teve o job `move_stage` forçado para `FAILED` no banco e foi recuperada por `POST /journeys/runtime/jobs/:jobId/requeue`
- [x] A mesma execucao `b4752afc-3482-4caa-bd07-4d62b4a283f9` teve `append_activity + move_stage` forçados para `FAILED` e foi recuperada por `POST /journeys/runtime/executions/:executionId/requeue-failed`
- [x] `GET /journeys/runtime/status` passou a refletir telemetria do worker apos o smoke com `totalEnqueuedJobs=5` e `totalProcessedJobs=2`
- [x] Trigger manual sem `contactId/cardId` gerou a execucao `c35ee396-a417-41be-b058-aa9cb973d4e6` com o fluxo completo `trigger -> condition -> activity -> delay -> move_stage`
- [x] A mesma execucao `c35ee396-a417-41be-b058-aa9cb973d4e6` concluiu com warnings operacionais esperados por ausencia de card, sem perder os nós intermediarios da régua
- [x] `GET /journeys/runtime/status` exibiu `deadLetterJobs=1` e a entrada recente do job `move_stage` da execucao `b4752afc-3482-4caa-bd07-4d62b4a283f9`
- [x] A mesma chamada voltou a `deadLetterJobs=0` e `recentDeadLetters=[]` após `POST /journeys/runtime/jobs/:jobId/requeue`

## Phase 5

### Campaigns Foundation and Outbound Staging

- [x] Criar dominio real de `Audience` e `Campaign` no schema e backend
- [x] Ligar `Campanhas` na navegação principal com rota dedicada
- [x] Entregar tela operacional de `Campanhas` no shell novo
- [x] Permitir audiencias dinamicas por `tag`, `industria`, `cargo`, `empresa`, `busca`, `telefone` e `email`
- [x] Permitir listas manuais com contatos selecionados diretamente da base comercial
- [x] Permitir campanhas com `canal`, `status`, `audiencia`, `mensagem base` e `agendamento`
- [x] Entregar foundation de cadencia com `steps` por campanha no builder e no backend
- [x] Evoluir para `SequenceRun` e runtime de outbound
- [x] Provisionar feature flags explicitas para `outbound_enabled` e `cold_outbound_enabled`
- [x] Criar persistencia de `SequenceRun` e `SequenceRunStep` para execução outbound por contato
- [x] Criar runtime backend de campanhas com poller interno e envio via WhatsApp existente
- [x] Endurecer o runtime de campanhas com BullMQ/Redis e status operacional autenticado
- [x] Persistir dead-letter/requeue manual em `SequenceRunStep` com observabilidade no runtime de campanhas
- [x] Persistir eventos de WhatsApp em `WhatsAppEvent` com listagem operacional por tenant
- [x] Provisionar `Prospect`, `ResearchTask` e `EnrichmentTask` para arquitetura de cold outbound
- [x] Converter `Prospect` em `Contato + Card` com empresa opcional e etapa inicial do pipeline
- [x] `Prospect` agora executa `ResearchTask` e `EnrichmentTask` com runtime interno, status e processamento manual
- [x] `Prospect` ganhou BullMQ/Redis com fallback em poller, fila operacional e requeue de tarefa
- [x] `Prospect` ganhou histórico persistido de eventos do runtime para enqueue/start/completion/failure/requeue
- [x] `Prospect` passou a agendar automaticamente o `EnrichmentTask` seguinte após concluir a pesquisa quando o prospect tem fit
- [x] `Prospect` agora produz `outreachBrief` estruturado no enriquecimento para orientar a abordagem comercial
- [x] `Prospect` agora dispara o primeiro outreach real via WhatsApp quando `outboundEnabled` e `coldOutboundEnabled` estao ativos, marcando o prospect como `CONTACTED` quando o envio acontece
- [x] `Prospect` agora evita disparo duplicado do outreach automatico e limita retry a duas tentativas totais antes de parar
- [x] `Prospect` agora classifica falhas de outreach em `permanent` ou `retryable`, marcando prospect como `INVALID` quando o erro e definitivo

### Progress Notes

- [x] Schema ganhou `Audience`, `Campaign`, enums de canal/status e relacoes por tenant
- [x] Backend ganhou `CampaignModule` com CRUD protegido para `audiences` e `campaigns`
- [x] `Audience` calcula `contactCount`, `campaignCount` e `sampleContacts` a partir da base comercial real
- [x] Filtros dinamicos agora suportam `search`, `tags`, `industries`, `positions`, `companyIds`, `onlyWithPhone` e `onlyWithEmail`
- [x] Exclusao de audiencia agora e bloqueada quando existem campanhas vinculadas
- [x] Rota `/campanhas` entrou no shell principal e substituiu o item apenas provisionado
- [x] Tela `Campanhas` abriu no mesmo padrão visual do shell novo, com cards densos para campanhas e audiencias
- [x] Drawer lateral agora permite criar/editar campanhas e audiencias sem sair do modulo
- [x] Store de `Campanhas` agora consolida `campaigns + audiences + segments + companies + contacts` em um unico carregamento
- [x] Schema ganhou `AudienceKind.MANUAL` e tabela `AudienceContact` para materializar listas manuais por tenant
- [x] Backend de `Audience` passou a aceitar `kind` e `contactIds`, sincronizando listas manuais com validacao multi-tenant
- [x] `Campanhas` agora alterna entre audiencia `Dinamica` e `Lista manual` no drawer lateral
- [x] O modulo passou a permitir busca e selecao direta de contatos para listas manuais, com resumo dos selecionados antes do save
- [x] Cards de audiencia agora distinguem visualmente `Dinamica` e `Lista manual`, com resumo e amostra coerentes para cada modo
- [x] Schema ganhou `CampaignStep` e `CampaignDelayUnit` para persistir a cadencia inicial da campanha
- [x] Backend de `Campaign` passou a aceitar `steps` e sincronizar a sequencia no create/update
- [x] A resposta de `campaigns` agora expõe `steps` ordenados com `delayAmount`, `delayUnit`, `channel` e `messageTemplate`
- [x] Drawer de `Campanhas` passou a editar a cadencia inicial no mesmo fluxo de criação/edição
- [x] Cards de campanha agora mostram quantidade de etapas e o atraso do primeiro touch

### Verify

- [x] `npx prisma generate --schema prisma/schema.prisma`
- [x] `npx prisma db push --schema prisma/schema.prisma`
- [x] `npx eslint src/campaign/**/*.ts src/app.module.ts`
- [x] `npx eslint src/app/campanhas/page.tsx src/stores/useCampaignStore.ts src/components/layout/shell-config.ts`
- [x] `npm run build --workspace api`
- [x] `npm run build --workspace web`
- [x] Rota `/campanhas` compila e entra no build do `web`
- [x] API expõe `GET/POST/PATCH/DELETE` para `campaigns` e `audiences`
- [x] API expõe audiencias `DYNAMIC` e `MANUAL` com `contactIds` e `contactCount` consistentes
- [x] API expõe campanhas com `steps` persistidos e ordenados
- [x] Lint direcionado do backend passou para o runtime de campanhas, tenant flags e auth
- [x] Build do backend passou com `SequenceRun` e `SequenceRunStep` no schema
- [x] `prisma db push` aplicou o schema novo com sucesso no Postgres local
- [x] Smoke direto do runtime criou `SequenceRun`, processou `2` steps e fechou a execucao como `COMPLETED`

### Smoke Notes

- [x] API isolada em `:3201` iniciou com o novo `CampaignModule` carregado
- [x] Login real em `POST /auth/login` retornou token valido para o tenant `saaso-demo`
- [x] `POST /audiences` criou a audiencia `Phase 5 Clinicas WhatsApp`
- [x] A audiencia criada retornou `contactCount=1` usando filtro real por `industry + onlyWithPhone`
- [x] `POST /campaigns` criou a campanha `Phase 5 Reengajamento` vinculada a essa audiencia
- [x] `GET /campaigns` refletiu a campanha criada com `campaignAudience=Phase 5 Clinicas WhatsApp`
- [x] API isolada em `:3201` iniciou novamente para o corte de listas manuais
- [x] `POST /audiences` criou a audiencia manual `Phase 5 Lista Manual 141216`
- [x] A audiencia manual retornou `kind=MANUAL` com `contactCount=2`
- [x] A lista manual foi materializada com os contatos `Bruna Salles` e `Camila Meta`
- [x] `POST /campaigns` criou a campanha `Phase 5 Campanha Manual 141216` vinculada a essa audiencia
- [x] `GET /campaigns` refletiu a campanha manual criada e o total de campanhas passou para `2`
- [x] API isolada em `:3201` iniciou novamente para o corte de cadencia
- [x] `POST /campaigns` criou a campanha `Phase 5 Cadencia 142642` com `2` steps
- [x] `GET /campaigns/:id` refletiu os steps `step1:0-HOURS` e `step2:24-HOURS`
- [x] As mensagens `Primeiro toque imediato.` e `Follow-up apos 24 horas.` voltaram consistentes na leitura da campanha
- [x] `GET /campaigns/runtime/status` retornou `driver=bullmq`, `queueOperational=true`, `queueName=campaign_execute` e backlog zerado com o tenant demo autenticado
- [x] Smoke autenticado gerou dead-letter por falta de telefone, reprocessou o step via `POST /campaigns/runtime/steps/:stepId/requeue` e limpou o estado com a fila operacional
- [x] Smoke autenticado de WhatsApp registrou inbound/outbound em `GET /whatsapp/events` com `WEBHOOK_SIMULATOR` e `OUTBOUND_SEND`
- [x] Smoke autenticado de `Prospect` importou lista com dedupe, criou tarefas de pesquisa/enriquecimento e aplicou opt-out
- [x] Smoke autenticado de `Prospect` converteu prospect em contato/card e marcou o status como `CONVERTED`
- [x] Smoke autenticado de `Prospect` processou `ResearchTask` e `EnrichmentTask` via runtime, atualizou score/status e depois foi limpo da base demo
- [x] Smoke autenticado de `Prospect` confirmou `driver=bullmq`, enfileiramento real e consumo do job no runtime de filas
- [x] Smoke autenticado de `Prospect` confirmou eventos persistidos no runtime, com `ENQUEUED`, `STARTED`, `COMPLETED` e `REQUEUED`
- [x] Smoke autenticado de `Prospect` confirmou auto-follow-up de enriquecimento apos pesquisa concluida
- [x] Smoke autenticado de `Prospect` confirmou briefing estruturado de abordagem no `outreachBrief`
- [x] Smoke autenticado de `Prospect` confirmou o primeiro outreach real via WhatsApp apos enriquecimento, com `ProspectStatus.CONTACTED`, evento `OUTBOUND_SEND` e metadata de despacho persistida
- [x] Smoke autenticado de `Prospect` confirmou idempotencia do outreach automatico: um segundo `process-due` nao gerou novo `OUTBOUND_SEND`, mantendo apenas 1 evento outbound para o contact smoke

## Deferred But Provisioned

- [ ] Estrutura multi-workspace real para modo agencia
- [ ] Billing e limites por plano

## Blockers To Track

- Testes backend ainda nao estabilizados
- Canal WhatsApp ainda depende de credenciais oficiais validas e observabilidade de producao
- Arquitetura tecnica ainda precisa ser alinhada ao PRD revisado

## Deploy Prep

- [x] Logs de smoke removidos do repositório
- [x] Dockerfiles criados para `apps/api` e `apps/web`
- [x] `.dockerignore` raiz criado para reduzir contexto e evitar lixo de build
- [x] Exemplo de env atualizado para backend e frontend
- [x] Documentacao de deploy no EasyPanel criada em `docs/easypanel-deploy.md`
- [x] Build de `api` e `web` validado apos os ajustes de deploy

