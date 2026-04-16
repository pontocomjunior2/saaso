---
phase: 03-agents-formularios-canais
plan: 05
subsystem: ui
tags: [react, zustand, whatsapp, evolution-api, qr-code, kanban, forms, analytics]

requires:
  - phase: 03-01
    provides: Evolution API backend endpoints and WhatsAppAccount model
  - phase: 03-02
    provides: Form submission endpoint and analytics endpoint
  - phase: 03-03
    provides: Public form UX and useLeadFormStore with analytics

provides:
  - WhatsAppSettingsSection component with provider toggle and QR code scan flow
  - AgentStatusBadge with active/paused/takeover states and compact/full variants
  - Form submission count and recent activity indicator in form list sidebar
  - conversationStatusToAgentStatus mapper helper

affects:
  - 04-form-editor-embed
  - 05-agent-conversation-flow

tech-stack:
  added: []
  patterns:
    - "WhatsApp QR polling: setInterval 3s, stop on connected or unmount"
    - "AgentStatusBadge: status-prop-driven display, compact flag for Kanban vs Sheet"
    - "Form list analytics: submissionCount + lastSubmissionAt optional on LeadForm"

key-files:
  created:
    - apps/web/src/components/configuracoes/WhatsAppSettingsSection.tsx
    - apps/web/src/components/board/AgentStatusBadge.tsx (rewritten)
  modified:
    - apps/web/src/app/configuracoes/page.tsx
    - apps/web/src/components/board/KanbanBoard.tsx
    - apps/web/src/components/board/CardDetailSheet.tsx
    - apps/web/src/stores/useLeadFormStore.ts
    - apps/web/src/app/formularios/page.tsx

key-decisions:
  - "AgentStatusBadge rewritten with status-prop interface (active/paused/takeover) replacing old conversation-toggle interface; conversationStatusToAgentStatus helper bridges existing CardDetailSheet usage"
  - "WhatsAppSettingsSection delegates CRUD to existing useWhatsAppAccountStore; no duplicate store created"
  - "submissionCount and lastSubmissionAt added as optional fields on LeadForm type — backend may return them in list response; defaults to 0 when absent"

patterns-established:
  - "Compact badge pattern: compact=true for Kanban card footer, compact=false (default) for detail sheet"
  - "QR polling: startPolling/stopPolling with cleanup on unmount; stops on connected state or delete"

requirements-completed: [REQ-09]

duration: 15min
completed: 2026-04-16
---

# Phase 03 Plan 05: Frontend WhatsApp Settings, Agent Badges, Form Analytics Summary

**Self-service WhatsApp QR code setup UI with Evolution API, compact AgentStatusBadge on Kanban cards, and form submission count in the form list sidebar**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-16T19:30:00Z
- **Completed:** 2026-04-16T19:45:00Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Created `WhatsAppSettingsSection` component: dark-surface panel with provider toggle (Evolution API / Meta Cloud API), Evolution instance name input, QR code display as base64 image, 3-second connection polling, and disconnect/delete actions
- Rewrote `AgentStatusBadge` with status-prop interface (`active`/`paused`/`takeover`), emerald/gray/amber color coding, and `compact` flag for Kanban card footer vs full-size for CardDetailSheet
- Added submission count badge (MessageSquare icon + "N envios") and recent activity green dot ("Recentemente") to each form item in the `/formularios` sidebar list

## Task Commits

1. **Task 1: WhatsApp Settings Section** - `6c5c2e8` (feat)
2. **Task 2: AgentStatusBadge active/paused/takeover** - `92a9647` (feat)
3. **Task 3: Form submission analytics in form list** - `c6ed111` (feat)

## Files Created/Modified

- `apps/web/src/components/configuracoes/WhatsAppSettingsSection.tsx` - Dark-surface WhatsApp settings with provider toggle, QR flow, polling, and account management
- `apps/web/src/app/configuracoes/page.tsx` - Imports and renders `<WhatsAppSettingsSection />` after MetaWebhookConfigSection
- `apps/web/src/components/board/AgentStatusBadge.tsx` - Rewritten: status-prop interface with compact flag; exports `conversationStatusToAgentStatus` helper
- `apps/web/src/components/board/KanbanBoard.tsx` - Wires compact `<AgentStatusBadge>` to card footer using conversation status
- `apps/web/src/components/board/CardDetailSheet.tsx` - Updated to use new AgentStatusBadge interface via conversationStatusToAgentStatus
- `apps/web/src/stores/useLeadFormStore.ts` - Added `submissionCount?` and `lastSubmissionAt?` optional fields to LeadForm type
- `apps/web/src/app/formularios/page.tsx` - Adds `isRecent()` helper, submission count badge, and Recentemente indicator to form list

## Decisions Made

- AgentStatusBadge was rewritten (old interface had `conversation`, `onUpdated` props for inline toggle). The new interface is display-only (`status` + `compact`). The takeover/pilot toggle action remains in `CardDetailSheet` via the existing conversation buttons. A `conversationStatusToAgentStatus` mapper was exported to bridge the gap.
- `WhatsAppSettingsSection` uses the existing `useWhatsAppAccountStore` (which was already comprehensive from Plan 03-01 frontend work). No duplicate store created.
- `submissionCount` defaulting to `0` when absent means the badge always shows "0 envios" for forms that haven't received data from the backend list response yet — acceptable for display purposes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] AgentStatusBadge interface mismatch**
- **Found during:** Task 2
- **Issue:** Existing `AgentStatusBadge.tsx` had `conversation`, `agentName`, `onUpdated` props (inline toggle UI) incompatible with the plan's `status`/`compact` interface
- **Fix:** Rewrote the component with new interface; exported `conversationStatusToAgentStatus` helper; updated `CardDetailSheet.tsx` import and usage to maintain existing behavior via the helper
- **Files modified:** `AgentStatusBadge.tsx`, `CardDetailSheet.tsx`
- **Committed in:** `92a9647`

**2. [Rule 1 - Bug] configuracoes/page.tsx already imports useWhatsAppAccountStore directly**
- **Found during:** Task 1
- **Issue:** The plan specified creating a separate `WhatsAppSettingsSection` and importing it into the page. The page already had extensive WhatsApp UI inline. Added the new component as an additional self-contained section at the bottom rather than replacing the existing inline WhatsApp multi-canal section.
- **Fix:** Created `WhatsAppSettingsSection` as standalone dark-surface component; appended import and `<WhatsAppSettingsSection />` to the page after `<MetaWebhookConfigSection />`
- **Files modified:** `configuracoes/page.tsx`, new `WhatsAppSettingsSection.tsx`
- **Committed in:** `6c5c2e8`

---

**Total deviations:** 2 auto-fixed (both Rule 1 — existing code state mismatches with plan assumptions)
**Impact on plan:** Both fixes necessary for correctness. All acceptance criteria met.

## Issues Encountered

None beyond the deviations documented above.

## Next Phase Readiness

- WhatsApp QR self-service flow ready for tenant use on `/configuracoes`
- AgentStatusBadge compact display ready for all Kanban cards with active agent conversations
- Form list analytics ready; backend needs to include `submissionCount`/`lastSubmissionAt` in GET /forms list response to populate counts (currently defaults to 0 if not present)

## Self-Check: PASSED

- WhatsAppSettingsSection.tsx: FOUND
- AgentStatusBadge.tsx: FOUND
- 03-05-SUMMARY.md: FOUND
- Commit 6c5c2e8 (Task 1): FOUND
- Commit 92a9647 (Task 2): FOUND
- Commit c6ed111 (Task 3): FOUND
- TypeScript: no errors

---
*Phase: 03-agents-formularios-canais*
*Completed: 2026-04-16*
