---
phase: 04-form-editor-embed
plan: 03
subsystem: ui
status: complete
completed: 2026-04-17
tags: [react, zustand, whatsapp, evolution-api, qr-code, kanban, agent-badge, forms, analytics]

# Dependency graph
requires:
  - phase: 03-agents-formularios-canais
    provides: Evolution API backend endpoints, WhatsApp account CRUD, form analytics endpoint
provides:
  - WhatsApp self-service UI with QR code scan flow on /configuracoes
  - AgentStatusBadge with active/paused/takeover states for Kanban cards
  - Form submission count and recent activity indicator on /formularios
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Zustand store pattern: WhatsApp account CRUD + QR polling with setInterval/clearInterval cleanup
    - Dark surface section: rounded-[30px] border border-white/10 bg-[rgba(8,18,34,0.82)]
    - Connection state polling: 3s interval with auto-stop on connected/error state
    - Compact badge variant: compact=true for Kanban cards (10px font), compact=false for CardDetailSheet
    - Recent activity indicator: animate-pulse green dot with isRecent() time helper

key-files:
  created: []
  modified:
    - apps/web/src/stores/useWhatsAppAccountStore.ts
    - apps/web/src/components/configuracoes/WhatsAppSettingsSection.tsx
    - apps/web/src/app/configuracoes/page.tsx
    - apps/web/src/components/board/AgentStatusBadge.tsx
    - apps/web/src/components/board/KanbanBoard.tsx
    - apps/web/src/components/board/CardDetailSheet.tsx
    - apps/web/src/app/formularios/page.tsx
    - apps/web/src/stores/useLeadFormStore.ts

key-decisions:
  - "All three tasks were pre-implemented in Phase 03-05 — verified complete with zero code changes needed"
  - "WhatsApp polling uses 3s setInterval with cleanup on unmount and auto-stop on connected state"
  - "AgentStatusBadge uses conversationStatusToAgentStatus() helper to map OPEN->active, HANDOFF_REQUIRED->takeover"
  - "QR code rendered as <img> with base64 data URI; refreshed on-demand via handleRefreshQr"

# Metrics
duration: 5min
completed: 2026-04-17
tasks_completed: 3
tasks_total: 3
---

# Phase 04 Plan 03: WhatsApp Settings, Agent Badges, Form Analytics Summary

**One-liner:** WhatsApp QR-scan self-service UI, Kanban agent status badges (emerald/gray/amber), and form submission count indicators — all pre-implemented in Phase 03-05 and verified complete.

## What Was Built

### Task 1: WhatsApp Settings Section

**`apps/web/src/stores/useWhatsAppAccountStore.ts`**
Full Zustand store for WhatsApp account management:
- `fetchAccounts()` — GET /whatsapp/accounts
- `createAccount(dto)`, `updateAccount(id, dto)`, `deleteAccount(id)` — CRUD
- `disconnectAccount(id)` — POST /whatsapp/accounts/:id/disconnect
- `createEvolutionInstance(dto)` — POST /whatsapp/evolution/instance
- `fetchQrCode(instanceName)` — GET /whatsapp/evolution/instance/:name/qr
- `fetchConnectionState(instanceName)` — GET /whatsapp/evolution/instance/:name/connection-state
- `simulateInbound(dto)` — POST /whatsapp/simulate-inbound
- `switchProvider(provider)` — local state toggle; `clearQrCode()` — cleanup

**`apps/web/src/components/configuracoes/WhatsAppSettingsSection.tsx`**
Dark-surface section (`rounded-[30px] border border-white/10 bg-[rgba(8,18,34,0.82)]`):
- Provider selector: Evolution API / Meta Cloud API toggle buttons
- Evolution API path: instance name input → "Criar instancia" → QR code display → polling every 3s → connected state
- QR code rendered as `<img src="data:image/png;base64,...">`
- Status indicators: CONNECTED (emerald), DISCONNECTED (gray), QR_READY (amber), ERROR (rose)
- Connection state labels: "Escaneie o QR Code abaixo" (amber), "Conectando..." (blue), "WhatsApp conectado!" (emerald)
- Disconnect + "Remover conta" buttons for existing Evolution accounts
- Meta Cloud path: read-only with env var guidance, lists existing meta accounts
- Polling cleanup on component unmount (useEffect return)

**`apps/web/src/app/configuracoes/page.tsx`**
`<WhatsAppSettingsSection />` rendered at the bottom of /configuracoes after `<MetaWebhookConfigSection />`.

### Task 2: Agent Status Badge

**`apps/web/src/components/board/AgentStatusBadge.tsx`**
Badge component with CONFIG object for three states:
- `active`: `bg-emerald-500` dot, emerald text/background
- `paused`: `bg-gray-400` dot, gray text/background  
- `takeover`: `bg-amber-500` dot, amber text/background
- `compact=true`: small inline badge (10px font, 1.5px dot) for Kanban cards
- `compact=false` (default): full-size badge (14px font, 2px dot) for CardDetailSheet
- Returns `null` when status is `null` — hidden by default
- `conversationStatusToAgentStatus()` helper: OPEN→active, HANDOFF_REQUIRED→takeover, others→null

**`apps/web/src/components/board/KanbanBoard.tsx`**
`<AgentStatusBadge status={...} agentName={...} compact />` wired to each Kanban card. Uses `conversationStatusToAgentStatus(card.agentConversations?.[0]?.status)` to derive badge state. Badge only renders when there is an active conversation.

**`apps/web/src/components/board/CardDetailSheet.tsx`**
`<AgentStatusBadge status={...} agentName={...} />` (without compact) for the full-size agent status display in the card detail panel.

### Task 3: Form Submission Analytics

**`apps/web/src/stores/useLeadFormStore.ts`**
`LeadForm` interface includes:
- `submissionCount?: number` — total submission count from list response
- `lastSubmissionAt?: string | null` — ISO datetime of most recent submission

**`apps/web/src/app/formularios/page.tsx`**
In the form list sidebar, each form row shows:
- `<MessageSquare />` icon + `{form.submissionCount ?? 0} envios` (submission count badge)
- Green animated dot + "Recentemente" when `isRecent(form.lastSubmissionAt, 24)` returns true
- `isRecent(dateStr, hours)` helper: compares dates using timestamp arithmetic

## Deviations from Plan

### Pre-Implementation from Phase 03-05

All three tasks were built in Phase 03-05 (Plan `03-05-PLAN.md` — "Frontend: WhatsApp settings, QR code, agent badges"). The 04-03 plan overlaps completely with what was delivered earlier. On execution:

- TypeScript compilation (`npx tsc --noEmit`) passes with exit code 0, zero errors
- All acceptance criteria verified against existing code — 100% pass rate
- No code changes were required — implementation already in repo

This is not a deviation from correctness but from execution order: the frontend was built during Phase 03 before Phase 04 was formally planned.

## Threat Mitigations Applied

| Threat ID | Status | Implementation |
|-----------|--------|----------------|
| T-3-20 | Mitigated | QR code only fetched via authenticated API; cleared via `clearQrCode()` after connection |
| T-3-21 | Mitigated | Connection state comes from backend proxy (Evolution API), not directly from client |
| T-3-22 | Mitigated | Polling stops on `connected` state; `useEffect` cleanup calls `stopPolling()` on unmount |
| T-3-23 | Accepted | Submission count is tenant-scoped, only visible to authenticated users |
| T-3-24 | Mitigated | AgentStatusBadge is read-only display; state changes go through API (Phase 02) |

## Verification Results

- `npx tsc --noEmit` in apps/web: exit code 0, no errors
- `useWhatsAppAccountStore.ts`: all required API calls present (`/whatsapp/accounts`, `/whatsapp/evolution/instance`, `/qr`, `/connection-state`)
- `WhatsAppSettingsSection.tsx`: dark surface, provider toggle, QR display with base64 img, 3s polling, connection labels, disconnect/remove buttons
- `AgentStatusBadge.tsx`: CONFIG with active/paused/takeover, compact prop, null guard
- `KanbanBoard.tsx`: imports and renders `<AgentStatusBadge compact>`
- `CardDetailSheet.tsx`: imports and renders `<AgentStatusBadge>` (full size)
- `formularios/page.tsx`: MessageSquare + "envios", isRecent helper, green dot for recent activity
- `useLeadFormStore.ts`: `submissionCount?` and `lastSubmissionAt?` in LeadForm interface

## Self-Check

All files verified present and correct. All acceptance criteria pass.

## Self-Check: PASSED

All task implementations verified in existing codebase. TypeScript compilation clean. No missing files.
