---
name: CRM v1 — Escopo e Decisões
description: Contexto do funil CRM manual v1 — plataforma multi-tenant, Kanban vazio por padrão, templates selecionáveis, config por etapa
type: project
---

# CRM v1 — Escopo e Decisões

## Contexto

Plataforma SaaS multi-tenant para CRM com Kanban. Cada cliente (tenant) tem seu próprio pipeline completamente personalizável. **Não é exclusiva de nenhum segmento** — tudo é configurável por tenant.

Primeiro cenário real: **Pontocom Audio** (produtora), recebendo leads de campanhas Meta Ads e Google Ads. Usado como referência de fluxo, não como modelo fixo.

---

## Decisões Tomadas

### Regra fundamental do Kanban
- **Kanban nasce vazio** — sem etapas pré-definidas
- Usuário cria suas próprias etapas diretamente no Kanban
- **OU** seleciona um template de pipeline disponível na tela do Kanban, que carrega as etapas automaticamente
- Configuração de nutrição acontece **inline ao criar/editar cada etapa** (não em tela separada)

### Configuração por etapa (inline no Kanban)
Ao criar ou editar uma etapa, o usuário configura:
- Nome da etapa e cor
- Canal padrão (WhatsApp / Email / Nenhum)
- Templates de mensagem para esta etapa (mensagens pré-configuradas que o SDR pode disparar com 1 clique)
- Critério de saída positiva (label: "Avança para...")
- Critério de saída negativa (label: "Se não avançar...")
- SLA máximo (opcional — quantos dias o card pode ficar nesta etapa)

### Templates de Pipeline
- Disponíveis na tela do Kanban (quando ainda está vazio, ou via botão "Carregar template")
- Ao selecionar um template, as etapas são criadas com configurações pré-definidas
- Usuário pode editar livremente após carregar
- Templates disponíveis: ver `.planning/notes/pipeline-templates.md`

### Acesso
- Admin cria o tenant e senha manualmente por enquanto
- Sistema de cadastro/onboarding self-service vem numa fase posterior (pós-validação)

### Canais disponíveis na v1
- **WhatsApp** via Evolution API (já parcialmente integrado)
- **Email** via Mailtrap (precisa ser conectado)

### Entrada de Leads na v1
- Manual pelo operador no Kanban
- Landing page form (já existe no sistema — `/formularios`)
- Meta Lead Ads webhook — **fase v2**

### Fluxo Manual v1 (click-to-send)
1. Lead entra (manual ou via form)
2. Card criado no Kanban na primeira etapa
3. SDR abre o card
4. Seleciona template de mensagem para a etapa atual (WhatsApp ou Email)
5. Clica para disparar — confirmação antes de enviar
6. Ação registrada no activity log do card (quem enviou, quando, qual template)
7. SDR move o card manualmente para a próxima etapa quando pronto

---

## Fronteira v1 / v2

| Feature | v1 | v2 |
|---------|----|----|
| Entrada de leads | Manual + form | + Meta/Google webhook |
| Disparo de mensagens | Click-to-send (manual) | Automático por régua |
| Agente IA por etapa | Não | Sim |
| Movimentação de cards | Manual | Semi-automática |
| Cadastro de clientes | Admin cria | Self-service |

---

## Stack Relevante
- Backend: NestJS + Prisma + PostgreSQL (sólido, multi-tenant)
- Frontend: Next.js + Zustand
- Kanban: @hello-pangea/dnd (funcionando)
- WhatsApp: Evolution API
- Email: Mailtrap
