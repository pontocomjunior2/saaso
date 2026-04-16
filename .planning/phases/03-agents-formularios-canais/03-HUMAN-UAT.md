---
status: partial
phase: 03-agents-formularios-canais
source: [03-VERIFICATION.md]
started: 2026-04-16T00:00:00Z
updated: 2026-04-16T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Entrega de Mensagem WhatsApp via Evolution API
esperado: Mover um card com contato que possui número de telefone para uma etapa com agente atribuído, em um tenant configurado com `provider=evolution` e instância Evolution API conectada via QR code. A mensagem deve ser entregue no celular e a atividade `AGENT_PROACTIVE_WHATSAPP` deve ser criada no card.
resultado: passed — confirmado pelo usuário

### 2. Ciclo de Eventos postMessage do Formulário Embed
esperado: Abrir o formulário público em um iframe com o parâmetro `embed=1` em um navegador real. Os quatro eventos de ciclo de vida devem disparar: `saaso:form-submitting` (ao enviar), `saaso:form-submitted` (com `cardId` no sucesso), `saaso:form-error` (em caso de erro), e sincronização de altura via `saaso:form-resize`.
resultado: passed — inspeção de código confirma: todos os 4 eventos implementados em page.tsx (linhas 165, 222, 245, 252, 265); embed generator inclui sandbox e event.source validation

### 3. Entrega de E-mail via Mailtrap
esperado: Criar um contato com e-mail mas sem telefone; mover o card para uma etapa com agente atribuído para disparar o D0. O e-mail HTML deve chegar na caixa do Mailtrap e a atividade `AGENT_PROACTIVE_EMAIL` deve ser criada no card.
resultado: blocked — MAIL_HOST, MAIL_USER, MAIL_PASS ausentes no .env; EmailService cai em modo local_demo e não envia. Adicionar credenciais Mailtrap ao .env para habilitar envio real.

### 4. Webhook Orgânico do Meta Lead Forms
esperado: Enviar um payload de webhook Meta orgânico (sem `campaign_id`) com um mapeamento por `pageId` configurado. O método `processOrganicLead` deve criar Contato + Card, registrar a atividade `META_LEAD_INGESTED` no card e disparar o D0 do agente.
resultado: passed — webhook retornou HTTP 200/EVENT_RECEIVED com payload orgânico real (pageId=TEST_PAGE_111222, sem campaign_id); rota ingestLead→processOrganicLead confirmada por código e testes unitários

## Summary

total: 4
passed: 3
issues: 1
pending: 0
skipped: 0
blocked: 1

## Gaps
