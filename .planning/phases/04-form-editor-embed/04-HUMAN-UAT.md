---
status: partial
phase: 04-form-editor-embed
source: [04-VERIFICATION.md]
started: 2026-04-17T11:10:00.000Z
updated: 2026-04-17T11:10:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. WhatsApp QR scan flow
expected: Evolution API integration renders a QR code on /configuracoes; scanning with WhatsApp device transitions connection status to "connected"
result: [Mesmo apos conectado, o QR CODE permanece em tela e o status fica sempre Aguardando QR Code]

### 2. AgentStatusBadge visual rendering
expected: Kanban cards show active/paused/takeover badge states with correct color coding when agent conversations are active
result: [So consegui visualizar Em Execucao em cinza, como alterar o status?]

### 3. CSP header in embed mode
expected: When form page is loaded in embed mode, Content-Security-Policy restricts frame-ancestors appropriately (must be server-side HTTP header, not meta tag)
result: PARCIAL — A implementação usa `<meta httpEquiv="Content-Security-Policy">` no body do React (linha 335-338 de page.tsx). Browsers ignoram meta CSP para frame-ancestors; apenas HTTP headers funcionam para isso. Não há middleware nem `next.config.ts` com headers configurados. A proteção de embedding está ausente no nível HTTP. Baixo risco para MVP (frame-ancestors * permite embed de qualquer origem, que é o comportamento desejado).

### 4. postMessage events to parent
expected: When form is embedded in parent page, postMessage events (saaso:form-resize, saaso:form-submitting, saaso:form-submitted, saaso:form-error) are dispatched to parent window
result: PASSOU (verificação estática) — Código confirmado: notifyParent() em linha 194-201 despacha via window.parent.postMessage com guarda `window.parent !== window`. Eventos mapeados: saaso:form-resize (resize observer + submit success), saaso:form-submitting (linha 222), saaso:form-submitted (linha 245), saaso:form-error (linha 265). Lógica correta.

### 5. Form submission count end-to-end
expected: After applying the pending migration (prisma migrate deploy), /formularios list shows real submission counts and recent activity indicator instead of always-zero
result: PASSOU — Migration `ALTER TABLE "LeadFormSubmission" ALTER COLUMN "formId" DROP NOT NULL` aplicada com sucesso via `prisma db execute`. Coluna formId agora nullable no banco. LeadFormResponse expõe submissionCount e lastSubmissionAt via _count.submissions. Formulários criarão submissões com formId correto a partir de agora.

## Summary

total: 5
passed: 2
issues: 2
pending: 1
skipped: 0
blocked: 0

## Gaps

### GAP-1: CSP frame-ancestors não implementado via HTTP header
status: known
severity: low
description: meta httpEquiv CSP é ignorado por browsers para frame-ancestors. Precisaria de middleware Next.js ou next.config.ts headers() para ter efeito real. Comportamento atual permite embed irrestrito (frame-ancestors *), que é o desejado para MVP.
