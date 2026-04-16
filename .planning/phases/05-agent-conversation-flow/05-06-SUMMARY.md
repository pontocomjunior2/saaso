---
phase: 05-agent-conversation-flow
plan: 06
subsystem: web
tags: [frontend, ui, timeline, kanban, agent-editor]

requires:
  - phase: 05-agent-conversation-flow
    plan: 04
    provides: runner cascade and activity types used by the UI
  - phase: 05-agent-conversation-flow
    plan: 05
    provides: GET /cards/:id/timeline and latestAgentSuggestion payloads
provides:
  - Atendimento tab in CardDetailSheet
  - QualifiedBadge and SuggestedStageButton components
  - timeline store/types for unified timeline rendering
  - agent editor banner and advanced history/summary inputs
affects: [human-checkpoint]

tech-stack:
  added: []
  patterns:
    - "Zustand store for paginated timeline fetch state"
    - "UI adaptation against current master contracts rather than stale plan paths"
    - "PT-BR copy preserved verbatim for the IMPORTANTE banner"

key-files:
  created:
    - apps/web/src/components/board/QualifiedBadge.tsx
    - apps/web/src/components/board/SuggestedStageButton.tsx
    - apps/web/src/components/board/TimelineFilters.tsx
    - apps/web/src/components/board/TimelineTab.tsx
    - apps/web/src/stores/timeline-store.ts
    - .planning/phases/05-agent-conversation-flow/05-06-SUMMARY.md
  modified:
    - apps/web/src/components/board/ActivityTimeline.tsx
    - apps/web/src/components/board/CardDetailSheet.tsx
    - apps/web/src/components/board/KanbanBoard.tsx
    - apps/web/src/components/board/board-types.ts
    - apps/web/src/stores/useAgentStore.ts
    - apps/web/src/stores/useKanbanStore.ts
    - apps/web/src/app/agentes/page.tsx

completed: 2026-04-16
---

# Phase 05 Plan 06: Frontend Surface Summary

Implemented the frontend surface for Phase 5 on top of the current `master` contracts. The board now has a `QualifiedBadge`, the card detail sheet has an `Atendimento` tab backed by a dedicated timeline store, and the agent editor shows the mandatory human-in-the-loop warning plus advanced prompt-profile inputs for `historyWindow` and `summaryThreshold`.

The unified timeline UI is composed from `TimelineTab`, `TimelineFilters`, `SuggestedStageButton`, and the new board types. It renders WhatsApp, activity, and agent events from `/cards/:id/timeline`, supports source filtering, and exposes the stage-move CTA when the agent metadata contains `suggested_next_stage_id`. Because the current backend move endpoint on `master` uses `destinationStageId` and `destinationIndex`, the button was adapted to that live contract instead of the older plan wording.

The implementation also extends `ActivityTimeline.TYPE_LABELS` with the Phase 5 agent activity labels and threads `latestAgentSuggestion` through the board/store types so the Kanban surface can render qualification state immediately.

Plan drift handled explicitly:

- The current agent editor route is [apps/web/src/app/agentes/page.tsx](D:/Projetos/Saaso/apps/web/src/app/agentes/page.tsx), not `[id]/page.tsx`, so the banner/advanced inputs were applied there.
- The move endpoint currently expects `destinationStageId` and `destinationIndex`, so `SuggestedStageButton` uses that payload.
- `latestAgentSuggestion.confirmedAt` semantics on the backend do not fully match the prose in the original plan, so the UI uses the current payload shape as-is.

Verification:

- `pnpm exec tsc --noEmit` in `apps/web` passed

Known tooling blockers:

- Frontend Jest/RTL infrastructure is not available in the current workspace, so the plan's frontend test suite was not added/run.
- Frontend lint is also blocked by local tooling resolution: `pnpm lint` / `pnpm exec eslint .` cannot find the `eslint` binary in this environment.

Human checkpoint is still pending. The next step is the manual verification flow from the plan: inspect the Kanban badge, timeline tab, move CTA, and agent editor inputs/banner in a running app.
