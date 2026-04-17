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
result: [pending]

### 2. AgentStatusBadge visual rendering
expected: Kanban cards show active/paused/takeover badge states with correct color coding when agent conversations are active
result: [pending]

### 3. CSP header in embed mode
expected: When form page is loaded in embed mode, Content-Security-Policy restricts frame-ancestors appropriately (must be server-side HTTP header, not meta tag)
result: [pending]

### 4. postMessage events to parent
expected: When form is embedded in parent page, postMessage events (saaso:form-resize, saaso:form-submitting, saaso:form-submitted, saaso:form-error) are dispatched to parent window
result: [pending]

### 5. Form submission count end-to-end
expected: After applying the pending migration (prisma migrate deploy), /formularios list shows real submission counts and recent activity indicator instead of always-zero
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
