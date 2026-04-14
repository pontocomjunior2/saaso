---
phase: 01-crm-v1-funil-manual
plan: "04"
subsystem: ui
tags: [react, nextjs, zustand, kanban, card-detail, send-message, activity-log]
status: checkpoint-reached

# Dependency graph
requires:
  - phase: 01-crm-v1-funil-manual
    provides: "CardDetailSheet base, useKanbanStore, /cards/:id/send-message endpoint, /cards/:id/move endpoint (Plans 01-03)"
provides:
  - "SendMessageSection: template selector with variable preview and 1-click send"
  - "ActivityTimeline: pt-BR formatted activity log with channel badge and template name"
  - "MoveCardButtons: advance/retreat card between stages"
  - "CardDetailSheet: fully integrated with send message, activity timeline, move buttons"
  - "PipelineDetailPage: allStages from store, refreshSelectedCard callback"
affects: ["full CRM v1 end-to-end flow", "card detail UX"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Refresh callback pattern: onMessageSent/onCardMoved triggers re-fetch of card detail"
    - "Variable resolution in frontend: {{nome}}, {{email}}, {{telefone}} replaced before preview and sent resolved body from backend"
    - "Vertical timeline with connector line: absolute left line + relative dots pattern"

key-files:
  created:
    - apps/web/src/components/board/SendMessageSection.tsx
    - apps/web/src/components/board/ActivityTimeline.tsx
    - apps/web/src/components/board/MoveCardButtons.tsx
  modified:
    - apps/web/src/components/board/board-types.ts
    - apps/web/src/components/board/CardDetailSheet.tsx
    - apps/web/src/stores/useKanbanStore.ts
    - apps/web/src/app/pipelines/[id]/page.tsx

key-decisions:
  - "Backend card.service.ts findOne uses include without select for activities — all fields (channel, templateName, actorId) returned automatically, no backend change needed"
  - "MoveCardButtons placed in CardDetailSheet header beside close button for always-visible access"
  - "SendMessageSection uses window.alert for success feedback — project has no sonner/toast library installed"
  - "Variable preview resolved in frontend for UX; backend also resolves independently before sending"

# Metrics
duration: ~30min
completed: 2026-04-13
---

# Phase 01 Plan 04: CardDetailSheet Completo — Summary

**SendMessageSection with template selector and variable preview, ActivityTimeline with pt-BR type labels and channel badges, MoveCardButtons for stage navigation — all integrated into CardDetailSheet, completing the CRM v1 end-to-end manual flow**

## Status: CHECKPOINT REACHED

Tasks 1 and 2 are complete and committed. Awaiting human verification (Task 3 checkpoint).

## Performance

- **Duration:** ~30 min
- **Started:** 2026-04-13
- **Tasks completed:** 2/3 (checkpoint at Task 3)
- **Files modified:** 7

## Accomplishments

### Task 1 — Types + SendMessageSection + MoveCardButtons (commit `5d2b02f`)

- `board-types.ts`: Expanded `CardActivity` with `channel`, `templateName`, `actorId` optional fields; added `StageMessageTemplate` interface; added `messageTemplates?: StageMessageTemplate[]` to `DetailedCard.stage`
- `useKanbanStore.ts`: Added `sendMessage(cardId, templateId, channel)` action that calls `POST /cards/:id/send-message`
- `SendMessageSection.tsx` (144 lines): Template selector buttons with WHATSAPP/EMAIL badges; variable preview resolving `{{nome}}`, `{{email}}`, `{{telefone}}`; send button (green for WA, blue for Email) with loading state, success alert, and inline error; validations for missing phone/email and no contact
- `MoveCardButtons.tsx` (74 lines): Two buttons (Retroceder/Avancar) sorted by stage order; disabled at first/last stage; tooltip shows target stage name; calls `PATCH /cards/:id/move`

### Task 2 — ActivityTimeline + CardDetailSheet Integration (commit `0860d76`)

- `ActivityTimeline.tsx` (107 lines): Vertical timeline with left connector line; 8 activity types mapped to pt-BR labels with lucide icons and colors; channel badge (green WA / blue Email); template name display; `Intl.DateTimeFormat` for pt-BR timestamps
- `CardDetailSheet.tsx`: Integrated `SendMessageSection` between Contato and timeline sections; replaced raw activity list with `<ActivityTimeline>`; added `MoveCardButtons` in header next to close button; added `onRefreshCard` and `allStages` props
- `pipelines/[id]/page.tsx`: Extracts `allStages` from `useKanbanStore().pipeline.stages`; `refreshSelectedCard` callback re-fetches `GET /cards/:id`; passes both to `CardDetailSheet`

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Types + SendMessageSection + MoveCardButtons | `5d2b02f` | board-types.ts, SendMessageSection.tsx, MoveCardButtons.tsx, useKanbanStore.ts |
| 2 | ActivityTimeline + CardDetailSheet integration | `0860d76` | ActivityTimeline.tsx, CardDetailSheet.tsx, pipelines/[id]/page.tsx |
| 3 | Checkpoint: Human Verify | — | Awaiting |

## Deviations from Plan

None — both auto tasks executed exactly as planned.

Backend deviation check: `card.service.ts` `findOne` uses `include: { activities: { orderBy: ... } }` without a `select` clause, so all CardActivity fields (`channel`, `templateName`, `actorId`) are already returned automatically. No backend change was needed (plan noted to verify this).

## Known Stubs

None — all components are wired to real API endpoints.

## Threat Model Mitigations Applied

| Threat | Mitigation Applied |
|--------|-------------------|
| T-04-01 Spoofing | SendMessageSection calls via `api.post` which uses the axios instance with JWT Bearer token interceptor |
| T-04-02 Tampering | templateId sent to backend; backend validates template belongs to tenant via `stageMessageTemplate.findFirst({ where: { id, tenantId } })` |
| T-04-03 Repudiation | CardActivity is created by backend with `actorId`, `channel`, `templateName` — full audit trail visible in ActivityTimeline |

## Self-Check: PARTIAL (checkpoint not yet verified)

- `5d2b02f` confirmed in git log
- `0860d76` confirmed in git log
- Next.js build passed after both tasks (no errors)
- All 7 files created/modified as planned
- min_lines artifacts: SendMessageSection (144 > 80), ActivityTimeline (107 > 40), MoveCardButtons (74 > 30) — all satisfied
- Human verification pending (Task 3 checkpoint)
