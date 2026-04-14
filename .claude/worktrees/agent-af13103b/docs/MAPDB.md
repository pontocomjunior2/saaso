# MAPDB - Dicionário de Dados do Sistema

Este documento descreve as tabelas e relacionamentos criados no banco de dados Prisma para o sistema Saaso.
Foi criado/atualizado conforme regra de atualização obrigatória de banco de dados.

## Entidades Principais

| Tabela | Descrição | Principais Conexões |
|---|---|---|
| **Tenant** | Representa uma empresa cliente no SaaS. | Conecta-se com TODAS as estruturas, sendo o pivot do multi-tenancy. |
| **User** | Usuários do sistema (SDRs, gestores, admins). | Pertence a um `Tenant`. Atribuído a um `Card`. |
| **Pipeline** | Funil de vendas (CRM Visual). | Pertence a um `Tenant`. Tem muitas `Stage`. |
| **Stage** | Etapa de um funil (Ex: "Prospecção"). | Pertence a um `Pipeline`. Recebe `Cards` e tem `Agents`. |
| **Card** | Representa um lead na etapa do funil. | Pertence a um `Stage` e `Tenant`. Relacionado a `Contact` e `User`. |
| **CardActivity** | Atividades como comentários ou logs sistêmicos | Pertence a um `Card`. |
| **Contact** | Pessoa de contato do lead/cliente. | Pertence a um `Tenant`. Pode referenciar `Company` e vários `Card`. |
| **Company** | Empresa (para Vendas B2B). | Pode ter vários `Contact`. |
| **LeadForm** | Formulário hospedado no Saaso para captura pública de leads. | Pertence a um `Tenant`, aponta para uma `Stage` de entrada e registra `LeadFormSubmission`. |
| **LeadFormSubmission** | Submissão pública de um formulário. | Vincula `LeadForm` ao `Contact` e `Card` criados na captura. |
| **Agent** | Agente de IA para suporte/vendas em uma etapa. | Pertence a um `Tenant`. Pode herdar `KnowledgeBase` e pertencer a `Stage`. |
| **AgentConversation**| Histórico de conversas do agente (Sessão). | Pertence a um `Agent`. |
| **KnowledgeBase** | Fonte de dados do RAG para o Agente IA. | Pertence a um `Tenant`. |
| **WhatsAppAccount** | Conta WABA Cloud API configurada. | Pertence a um `Tenant`. |
| **WhatsAppMessage** | Histórico de mensagens transacionadas. | Pertence a um `Contact`. |
| **Subscription** | Dados do Stripe (Billing SaaS). | Pertence a um `Tenant`. |

> **Nota de Segurança:** Toda manipulação de dados em backend DEVE incluir filtro por `tenantId` recuperado do token logado.
