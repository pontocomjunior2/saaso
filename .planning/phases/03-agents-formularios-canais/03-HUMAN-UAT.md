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

### 1. Evolution API WhatsApp Real Message Delivery
expected: Move a card with a phone-number contact to an agent-assigned stage on a tenant with `provider=evolution` and a live QR-connected Evolution API instance. Message delivered to phone, `AGENT_PROACTIVE_WHATSAPP` CardActivity created.
result: [pending]

### 2. Embedded Form postMessage Lifecycle
expected: Load the public form in an iframe with `embed=1` in a real browser. All four lifecycle events fire: `saaso:form-submitting`, `saaso:form-submitted` (with `cardId`), `saaso:form-error`, and height sync via `saaso:form-resize`.
result: [pending]

### 3. Mailtrap Email Delivery
expected: Create a contact with email but no phone; trigger D0 via card move to agent-assigned stage. HTML email arrives at Mailtrap, `AGENT_PROACTIVE_EMAIL` activity created on card.
result: [pending]

### 4. Meta Lead Forms Organic Webhook
expected: Send an organic Meta webhook payload (no `campaign_id`) with a `pageId`-matched mapping configured. `processOrganicLead` creates Contact + Card, CardActivity `META_LEAD_INGESTED` logged, and agent D0 fires.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
