---
phase: 01-crm-v1-funil-manual
plan: 03
subsystem: frontend
tags: [nextjs, kanban, empty-state, pipeline-templates, drag-and-drop, zustand]
dependency_graph:
  requires: [01-02]
  provides: [EmptyBoardState, AddStageButton, PipelineTemplateModal, /pipelines/[id] route]
  affects: [KanbanBoard, useKanbanStore, /pipelines page]
tech_stack:
  added: []
  patterns: [inline-input-expand pattern, Zustand action chaining (createStage calls fetchPipeline), Next.js dynamic route /pipelines/[id]]
key_files:
  created:
    - apps/web/src/components/board/EmptyBoardState.tsx
    - apps/web/src/components/board/AddStageButton.tsx
    - apps/web/src/components/board/PipelineTemplateModal.tsx
    - apps/web/src/app/pipelines/[id]/page.tsx
  modified:
    - apps/web/src/stores/useKanbanStore.ts
    - apps/web/src/components/board/KanbanBoard.tsx
    - apps/web/src/app/pipelines/page.tsx
decisions:
  - loadTemplate in store uses _pipelineId prefix (unused) since from-template creates a new pipeline and returns its id for redirect
  - PipelineTemplateModal handles both /pipelines (showCreateEmpty=true) and /pipelines/[id] (no empty option) contexts via showCreateEmpty prop
  - /pipelines/[id] is a dedicated dynamic route; the list page at /pipelines retains its combined view
  - AddStageButton expands inline to avoid a separate modal; same inline-input pattern as EmptyBoardState for consistency
metrics:
  duration: 20 min
  completed: 2026-04-13
  tasks_completed: 2
  files_created: 4
  files_modified: 3
---

# Phase 1 Plan 03: Frontend Kanban (empty state, stage creation inline, template loader modal) Summary

**One-liner:** EmptyBoardState with dual CTAs, AddStageButton with inline expand, and PipelineTemplateModal fetching 5 templates via GET /pipelines/templates — all wired into KanbanBoard and the new /pipelines/[id] dedicated board route.

**Status:** CHECKPOINT REACHED — awaiting human verification before plan is marked complete.

## What Was Built

### Task 1: Store actions + EmptyBoardState + AddStageButton + KanbanBoard integration

1. **`useKanbanStore.ts`** — Two new actions added:
   - `createStage(pipelineId, name)` — POSTs to `/stages`, then calls `fetchPipeline` to refresh the board
   - `loadTemplate(_pipelineId, templateId)` — POSTs to `/pipelines/from-template`, returns new pipeline data for caller to redirect

2. **`EmptyBoardState.tsx`** — Rendered when `pipeline.stages.length === 0`:
   - Centered card with LayoutGrid icon, title, subtitle
   - "Criar primeira etapa" button — expands to inline input with confirm (Enter or check button)
   - "Carregar template" button (solid violet) — calls `onLoadTemplate()` prop

3. **`AddStageButton.tsx`** — Slim column beside the last stage:
   - Collapsed: dashed border button with vertical "Nova Etapa" text and `+` icon
   - Expanded: inline input with confirm button, same UX pattern as EmptyBoardState

4. **`KanbanBoard.tsx`** — Updated:
   - Added `onLoadTemplate?: () => void` prop
   - Renders `<EmptyBoardState>` when `pipeline.stages.length === 0`
   - Renders `<AddStageButton>` after the last column in the flex container
   - Imports EmptyBoardState and AddStageButton

### Task 2: PipelineTemplateModal + page integration

1. **`PipelineTemplateModal.tsx`** — Overlay modal:
   - Fetches `GET /pipelines/templates` on open
   - Displays each template as a card with name, stage count badge, and stage name chips
   - Clicking a template POSTs `/pipelines/from-template` and redirects to `/pipelines/{newId}`
   - Optional `showCreateEmpty` prop shows a "Criar pipeline vazio" option that POSTs `/pipelines`
   - Loading states on each template button while creating

2. **`/pipelines/[id]/page.tsx`** — New dedicated board page:
   - Receives pipeline id from route params
   - Renders KanbanBoard with all callbacks wired
   - Includes CardFormModal, CardDetailSheet, and PipelineTemplateModal
   - Passes `onLoadTemplate` to KanbanBoard (for EmptyBoardState CTA)

3. **`/pipelines/page.tsx`** — Updated:
   - "Novo Pipeline" button now opens PipelineTemplateModal (was "New Task" opening CardFormModal)
   - PipelineTemplateModal rendered with `showCreateEmpty` to allow creating blank pipeline
   - KanbanBoard receives `onLoadTemplate` prop wired to template modal

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 2f5b490 | feat(01-03): add createStage/loadTemplate to store, EmptyBoardState, AddStageButton, KanbanBoard integration |
| 2 | 167b0d7 | feat(01-03): add PipelineTemplateModal and wire Novo Pipeline button + [id] board page |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all components are fully wired to real API endpoints.

## Threat Model Mitigations Applied

| Threat | Mitigation |
|--------|-----------|
| T-03-01 Spoofing | PipelineTemplateModal sends requests via the axios instance which includes the JWT Bearer token via interceptor |
| T-03-02 Tampering | Stage name input is free text; backend validation applies. No client-side security bypass possible. |

## Self-Check

- [x] `apps/web/src/components/board/EmptyBoardState.tsx` — created (min 30 lines: 115 lines)
- [x] `apps/web/src/components/board/AddStageButton.tsx` — created (min 20 lines: 96 lines)
- [x] `apps/web/src/components/board/PipelineTemplateModal.tsx` — created (min 60 lines: 170 lines)
- [x] `apps/web/src/app/pipelines/[id]/page.tsx` — created
- [x] `apps/web/src/stores/useKanbanStore.ts` — modified, createStage + loadTemplate added
- [x] `apps/web/src/components/board/KanbanBoard.tsx` — modified, onLoadTemplate prop + EmptyBoardState + AddStageButton
- [x] `apps/web/src/app/pipelines/page.tsx` — modified, Novo Pipeline button + PipelineTemplateModal
- [x] Commit 2f5b490 — Task 1
- [x] Commit 167b0d7 — Task 2
- [x] Next.js build passes with /pipelines/[id] listed as dynamic route

## Self-Check: PASSED
