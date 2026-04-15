---
created: "2026-04-14"
phase: "03"
status: decisions-captured
---

# Discussion Log: Phase 03 — Agentes Efetivos + Formulários + Canais

## Decisions Captured

### 1. WhatsApp Provider Architecture
**Decision:** Provider Abstraction (Option B)
- WhatsAppService becomes a facade delegating to provider implementations
- WhatsAppAccount gains `provider: 'meta_cloud' | 'evolution'` field
- Evolution API is the new default for Phase 03
- Cloud API preserved for backwards compatibility (existing tenants)
- Interface: sendMessage, receiveWebhook, getAccountStatus, disconnect, connect

### 2. Evolution API Connection Model
- Each WhatsAppAccount = one Evolution API instance
- Connection via QR code scan (frontend displays QR, user scans)
- Webhook: Evolution API sends to `POST /whatsapp/evolution-webhook`
- After scan, webhook notifies Saaso of received messages
- Routed to AgentRunnerService (if agent active) or inbox

### 3. Form Submission → Agent Trigger
- Unified trigger: card creation from ANY source triggers agent proactive D0
- CardService checks for active agent in stage
- If exists, calls `AgentRunnerService.initiateProactiveIfAssigned`
- Full implementation already exists (not stub — confirmed by code review)

### 4. Form Submission Flow (Backend)
- Public endpoint: `POST /forms/:slug/submit` (no JWT auth)
- Payload validation: JSON matching form fields
- Fields with `mapTo` → creates Contact + Card + LeadFormSubmission
- Rate limiting per IP required
- After card creation → trigger agent proactiva

### 5. Form Embed Security
- Existing postMessage validation is sufficient
- Add CSP header on public form page when `embed=1`
- No `target="_blank"` without `rel="noopener noreferrer"`

### 6. Meta Lead Forms vs Meta Lead Ads
- Same webhook endpoint (Meta Platform Webhooks)
- Reuse MetaWebhookMapping and MetaWebhookService from Phase 02
- Difference: Lead Forms (organic, no campaign_id) vs Lead Ads (paid campaigns)
- Same flow: webhook → map pipeline/stage → create card → trigger agent D0

### 7. Email Service Evolution
- Mailtrap remains the SMTP provider (no change)
- Add HTML body support to email service
- StageMessageTemplate.body validated as HTML

### 8. Agent Proactive Message Channel
- WhatsApp first (if contact.phone exists)
- Email fallback (if contact.email exists)
- If neither, log to card and do not send
