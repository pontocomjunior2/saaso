---
name: Pipeline Templates — Catálogo
description: Templates de pipeline disponíveis para carregar no Kanban. Do mais simples ao mais completo, baseados no SERVUS Blueprint
type: project
---

# Pipeline Templates — Catálogo

Templates prontos que o usuário pode carregar no Kanban vazio. Cada template define etapas com nome, cor, canal padrão, SLA e critérios de transição.

---

## Template 1 — Funil Simples (3 etapas)
**Caso de uso:** Negócios diretos, prestadores de serviço, pequenos times

| # | Etapa | Cor | Canal | SLA | Avança para | Se não avançar |
|---|-------|-----|-------|-----|-------------|----------------|
| 1 | Novo Lead | Azul | WhatsApp | 7 dias | → Em Contato | → Perdido |
| 2 | Em Contato | Amarelo | WhatsApp | 14 dias | → Fechado | → Perdido |
| 3 | Fechado | Verde | — | ∞ | — | — |
| 4 | Perdido | Vermelho | Email | 60 dias | → Novo Lead | — |

**Templates de mensagem incluídos por etapa:**
- Novo Lead: "Boas-vindas", "Follow-up D+1", "Follow-up D+3"
- Em Contato: "Proposta enviada", "Follow-up proposta", "Última tentativa"

---

## Template 2 — Funil Comercial Médio (5 etapas)
**Caso de uso:** Serviços B2B, agências, consultoras

| # | Etapa | Cor | Canal | SLA | Avança para | Se não avançar |
|---|-------|-----|-------|-----|-------------|----------------|
| 1 | Lead | Azul | WhatsApp | 30 dias | → Qualificado | → Perdido |
| 2 | Qualificado | Ciano | WhatsApp | 14 dias | → Proposta | → Lead |
| 3 | Proposta | Amarelo | WhatsApp + Email | 15 dias | → Cliente | → Qualificado |
| 4 | Cliente Ativo | Verde | WhatsApp + Email | ∞ | Upsell | → Em Risco |
| 5 | Perdido | Vermelho | Email | 90 dias | → Lead | — |

**Templates de mensagem incluídos por etapa:**
- Lead: "Boas-vindas", "Vídeo demo", "Prova social", "Follow-up D+7", "Reengajamento D+14"
- Qualificado: "Contato SDR", "Qualificação 3 perguntas", "Agendamento demo"
- Proposta: "Proposta enviada", "Follow-up proposta", "Urgência/benefício", "Último contato"
- Cliente Ativo: "Check-in mensal", "Upsell", "NPS", "Indicação"
- Perdido: "Reativação D+60", "Oferta especial D+90", "Última tentativa D+120"

---

## Template 3 — Funil SaaS Completo (7 etapas) — Baseado no SERVUS Blueprint
**Caso de uso:** SaaS B2B, produtos digitais com ciclo de vendas consultivo

| # | Etapa | Cor | Agente | Canal | SLA | Avança para | Se não avançar |
|---|-------|-----|--------|-------|-----|-------------|----------------|
| 1 | Lead | Azul claro | SDR | WhatsApp | 90 dias | → Lead Qualificado | → Perdido |
| 2 | Lead Qualificado | Verde claro | SDR | WhatsApp | 30 dias | → Em Negociação | → Lead ou Perdido |
| 3 | Em Negociação | Amarelo | Closer | WhatsApp + Call | 15 dias | → Cliente Novo | → Lead Qualificado |
| 4 | Cliente Novo | Laranja | Onboarding | WhatsApp | 30 dias | → Cliente Ativo | → Em Risco |
| 5 | Cliente Ativo | Verde | Sucesso | WhatsApp + Email | ∞ | Upsell / Indicação | → Em Risco |
| 6 | Em Risco | Roxo | Retenção | WhatsApp | 15 dias | → Cliente Ativo | → Churned |
| 7 | Perdido/Churned | Vermelho | Reativação | Email | 120 dias | → Lead / Cliente | Remove |

**Templates de mensagem por etapa (baseados no SERVUS Blueprint):**

### Etapa 1 — Lead
- D0: "Boas-vindas + Gancho" (WhatsApp) — primeira mensagem de apresentação
- D+1: "Follow-up suave" (WhatsApp) — se não respondeu
- D+3: "Prova social" (WhatsApp) — depoimento de cliente
- D+7: "Conteúdo educativo" (Email) — caso/artigo relevante
- D+14: "Reengajamento" (WhatsApp) — última tentativa automática
- D+30, D+60: "Nutrição passiva" (Email) — conteúdo de valor sem venda

### Etapa 2 — Lead Qualificado
- D0: "Contato humano SDR" (WhatsApp) — apresentação personalizada
- Qualificação: "3 perguntas SDR" (WhatsApp) — script de qualificação
- D+1: "Follow-up se não respondeu" (WhatsApp)
- D+3: "Ângulo diferente" (WhatsApp) — abordagem com prova social
- D+7: "Email formal" (Email) — convite para demo
- D+14: "Última tentativa SDR" (WhatsApp)

### Etapa 3 — Em Negociação
- D0: "Confirmação da demo" (WhatsApp)
- D+1 pós-demo: "Follow-up pós-demo" (WhatsApp)
- D+3 pós-demo: "Urgência suave + benefício anual" (WhatsApp)
- D+7 pós-demo: "Último contato Closer" (WhatsApp)
- No-show: "Remarcação" (WhatsApp)

### Etapa 4 — Cliente Novo (Onboarding)
- D0: "Boas-vindas + acesso" (WhatsApp)
- D+1: "Primeiro uso guiado" (WhatsApp)
- D+3: "Cases de uso práticos" (WhatsApp)
- D+7: "Check-in 1 semana" (WhatsApp)
- D+14: "NPS + grupo VIP" (WhatsApp)
- D+30: "Relatório do primeiro mês" (WhatsApp + Email)

### Etapa 5 — Cliente Ativo
- Quinzenal: "Conteúdo de valor" (WhatsApp)
- Mensal: "Relatório de uso" (Email)
- Mês 2: "Upsell mensal → anual" (WhatsApp)
- Mês 3: "Upsell plano básico → pro" (WhatsApp)
- Trimestral: "Programa de indicação" (WhatsApp)
- Semestral: "NPS" (WhatsApp)

### Etapa 6 — Em Risco
- Imediato: "Check-in pessoal" (WhatsApp)
- D+3: "Áudio personalizado" (WhatsApp)
- D+7: "Oferta de resgate" (WhatsApp)
- D+15: "Despedida respeitosa" (WhatsApp)

### Etapa 7 — Perdido/Churned
- D+60: "Reativação suave" (Email) — após quarentena
- D+90: "Oferta especial de retorno" (WhatsApp)
- D+120: "Última tentativa" (Email)

---

## Template 4 — Funil E-commerce/Produto (4 etapas)
**Caso de uso:** Lojas online, infoprodutos, cursos

| # | Etapa | Cor | Canal | SLA | Avança para | Se não avançar |
|---|-------|-----|-------|-----|-------------|----------------|
| 1 | Interesse | Azul | WhatsApp + Email | 14 dias | → Carrinho | → Frio |
| 2 | Carrinho Abandonado | Laranja | Email + WhatsApp | 7 dias | → Comprou | → Frio |
| 3 | Comprou | Verde | Email | ∞ | Recompra | → Inativo |
| 4 | Frio/Inativo | Cinza | Email | 90 dias | → Interesse | — |

**Templates por etapa:**
- Interesse: "Apresentação do produto", "Benefícios principais", "Depoimento", "Oferta com prazo"
- Carrinho Abandonado: "Lembrete D0", "Urgência D+1", "Desconto D+3", "Último aviso D+6"
- Comprou: "Confirmação + boas-vindas", "Tutorial/uso", "Upsell semana 2", "Avaliação mês 1"
- Frio: "Novidade do produto D+30", "Oferta de retorno D+60", "Última chance D+90"

---

## Template 5 — Pós-venda e CS (3 etapas)
**Caso de uso:** Times de Customer Success, suporte, retenção

| # | Etapa | Cor | Canal | SLA | Avança para | Se não avançar |
|---|-------|-----|-------|-----|-------------|----------------|
| 1 | Onboarding | Amarelo | WhatsApp | 30 dias | → Ativo | → Em Risco |
| 2 | Ativo | Verde | Email + WhatsApp | ∞ | Upsell | → Em Risco |
| 3 | Em Risco | Vermelho | WhatsApp | 15 dias | → Ativo | → Churned |

---

## Como os templates são usados

1. Usuário abre o Kanban (vazio)
2. Vê botão "Carregar template" ou "Criar etapa"
3. Ao clicar em "Carregar template": modal com lista de templates, preview das etapas
4. Seleciona o template → etapas criadas com configurações pré-definidas
5. Pode editar qualquer etapa inline após carregar
6. Templates de mensagem de cada etapa ficam disponíveis no click-to-send

**Regra:** Template carrega as etapas. O usuário pode renomear, reordenar, deletar e adicionar etapas livremente após isso. Os templates de mensagem são sugestões, não obrigações.
