---
name: CRM v2 — Automação de Réguas e Integrações
description: Seed para fase de automação — réguas automáticas, webhook Meta, agente IA por etapa. Trigger: v1 validada em produção
type: project
trigger_condition: v1 manual validada com ao menos 1 tenant em produção
planted_date: 2026-04-13
---

# CRM v2 — Automação de Réguas e Integrações

## Trigger
Iniciar quando a v1 manual estiver validada com pelo menos 1 tenant real usando o sistema.

## O que entra nesta fase

### Entrada Automática de Leads
- Webhook Meta Lead Ads → cria card no Kanban automaticamente
- Webhook Google Ads (futuramente)
- Mapeamento de campos do formulário Meta → campos do card/contato

### Réguas Automáticas por Etapa
- Cada etapa do pipeline tem uma régua configurável (dias, canal, template)
- BullMQ agenda disparos automáticos (D0, D+1, D+3, D+7...)
- Tenant configura frequência e conteúdo por etapa
- Sistema respeita horário comercial (não dispara de madrugada)

### Agente IA por Etapa
- Tenant atribui um agente IA a cada etapa do Kanban
- Agente responde conversas via WhatsApp automaticamente
- SDR recebe alerta para takeover quando necessário
- Lógica de classificação (qualificado / não qualificado) pelo agente

### Movimentação Semi-Automática
- Agente IA pode mover card para próxima etapa ao classificar positivo
- Movimentação auditável com log de quem/o que moveu

## Dependências da v1
- Templates de mensagem por etapa (configurados na v1)
- Activity log funcionando (base para auditoria)
- WhatsApp Evolution API conectado e testado
- Email Mailtrap funcionando

## Canais Adicionais (fase posterior)
- SMS
- Instagram DM
- Email marketing (além do transacional)
