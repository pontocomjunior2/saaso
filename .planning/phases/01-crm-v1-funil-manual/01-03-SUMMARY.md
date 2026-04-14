---
phase: 01-crm-v1-funil-manual
plan: "03"
subsystem: ui
tags: [react, nextjs, zustand, kanban, drag-and-drop]

# Dependency graph
requires:
  - phase: 01-crm-v1-funil-manual
    provides: "KanbanBoard base, useKanbanStore, pipeline/stages API endpoints (Plan 02)"
provides:
  - "EmptyBoardState: zero-stage board UI with two CTAs"
  - "AddStageButton: inline stage creation beside last Kanban column"
  - "PipelineTemplateModal: template picker fetching GET /pipelines/templates, POST /pipelines/from-template"
  - "Inline stage rename: click-to-edit stage title with Enter/blur save and Escape cancel"
  - "useKanbanStore actions: createStage, loadTemplate, renameStage"
  - "/pipelines/[id]/page.tsx: dedicated board page wiring all board components"
  - "Novo Pipeline button on /pipelines list opens PipelineTemplateModal"
affects: ["01-04", "future board plans", "pipeline management"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inline editing pattern: click label -> show input -> Enter/blur saves, Escape cancels"
    - "Empty-state CTA pattern: two-button layout (outline + solid) directing user to first action"
    - "Store-driven refetch: mutating actions call fetchPipeline to sync UI from server"

key-files:
  created:
    - apps/web/src/components/board/EmptyBoardState.tsx
    - apps/web/src/components/board/AddStageButton.tsx
    - apps/web/src/components/board/PipelineTemplateModal.tsx
    - apps/web/src/app/pipelines/[id]/page.tsx
  modified:
    - apps/web/src/stores/useKanbanStore.ts
    - apps/web/src/components/board/KanbanBoard.tsx
    - apps/web/src/app/pipelines/page.tsx

key-decisions:
  - "Inline stage rename added post-checkpoint at user request — PATCH /stages/:id, ring-[#594ded] focus style"
  - "Template modal redirects to new pipeline ID returned by POST /pipelines/from-template rather than reloading current pipeline"
  - "Store actions refetch full pipeline after mutating (createStage, renameStage) to keep UI consistent with server state"
  - "loadTemplate uses _pipelineId prefix (unused) since from-template creates a new pipeline and returns its id for redirect"
  - "PipelineTemplateModal handles both /pipelines (showCreateEmpty=true) and /pipelines/[id] contexts via showCreateEmpty prop"

patterns-established:
  - "Inline edit pattern: click -> input with ring-[#594ded] -> Enter/blur saves -> Escape restores original"
  - "Board empty-state: EmptyBoardState renders when stages.length === 0, AddStageButton renders after last column otherwise"

requirements-completed: [REQ-01, REQ-05]

# Metrics
duration: ~90min
completed: 2026-04-13
---

# Phase 01 Plan 03: Kanban Empty State, Stage Creation & Template Picker Summary

**EmptyBoardState with dual CTAs, AddStageButton with inline expand, PipelineTemplateModal for 5 templates, and click-to-rename stage titles — all wired to live API endpoints on the new /pipelines/[id] board route**

## Performance

- **Duration:** ~90 min
- **Started:** 2026-04-13
- **Completed:** 2026-04-13
- **Tasks:** 2 auto tasks + 1 checkpoint (human-verified) + 1 post-checkpoint addition
- **Files modified:** 7

## Accomplishments

- Board zero-stage renders EmptyBoardState with "Criar primeira etapa" (inline input) and "Carregar template" (solid violet) CTAs
- AddStageButton renders as a slim dashed column after the last stage, expanding to inline input on click — same UX pattern as EmptyBoardState
- PipelineTemplateModal fetches GET /pipelines/templates, shows stage-chip previews for each template, POSTs to create the pipeline, and redirects to the new board URL via router.push
- "Novo Pipeline" button on the /pipelines list page now opens PipelineTemplateModal with showCreateEmpty option (previously a no-op)
- Inline stage rename: clicking any stage title replaces it with a text input styled ring-[#594ded]; Enter or blur PATCHes /stages/:id; Escape cancels — added after user checkpoint approval
- useKanbanStore gained createStage, loadTemplate, and renameStage actions with error handling and post-mutate fetchPipeline

## Task Commits

Each task was committed atomically:

1. **Task 1: Store actions + EmptyBoardState + AddStageButton + KanbanBoard integration** - `2f5b490` (feat)
2. **Task 2: PipelineTemplateModal + /pipelines/[id]/page + Novo Pipeline wiring** - `167b0d7` (feat)
3. **Post-checkpoint addition: Inline stage rename** - `2bcbd86` (feat)

## Files Created/Modified

- `apps/web/src/stores/useKanbanStore.ts` - Added createStage, loadTemplate, renameStage actions with error handling and post-mutate fetchPipeline
- `apps/web/src/components/board/EmptyBoardState.tsx` - Zero-stage board UI: icon, heading, two-button layout with inline input for first stage creation (115 lines)
- `apps/web/src/components/board/AddStageButton.tsx` - Slim dashed button at end of stage columns, expands to inline input on click (96 lines)
- `apps/web/src/components/board/PipelineTemplateModal.tsx` - Template picker: fetches templates, previews stage chips, creates pipeline on select, redirects (170 lines)
- `apps/web/src/components/board/KanbanBoard.tsx` - Integrated EmptyBoardState and AddStageButton; stage titles are now click-to-rename inputs with ring-[#594ded]
- `apps/web/src/app/pipelines/[id]/page.tsx` - New dedicated board page wiring KanbanBoard, PipelineTemplateModal, CardFormModal, CardDetailSheet, and modal state
- `apps/web/src/app/pipelines/page.tsx` - "Novo Pipeline" button now opens PipelineTemplateModal with showCreateEmpty prop

## Decisions Made

- Template modal creates a new pipeline via POST /pipelines/from-template and redirects to its ID, rather than loading template stages into the current empty pipeline — keeps pipeline identity clean
- loadTemplate uses `_pipelineId` prefix (unused param) since from-template creates a new pipeline and returns the new id for redirect
- PipelineTemplateModal handles both /pipelines (showCreateEmpty=true) and /pipelines/[id] (no empty option) contexts via a single showCreateEmpty prop
- AddStageButton and EmptyBoardState share the same inline-input UX pattern for consistency
- Post-rename the store calls PATCH /stages/:id then refetches pipeline to confirm the rename persisted

## Deviations from Plan

### User-requested Addition (Post-checkpoint)

**Inline stage rename — explicitly requested by user after checkpoint approval**
- **Requested during:** Checkpoint human-verify — user approved ("funcionou") and requested this feature
- **What was added:** Clicking a stage title in KanbanBoard replaces it with a text input (ring-[#594ded]); Enter or blur calls PATCH /stages/:id to persist the new name; Escape restores the original name without saving
- **Files modified:** `apps/web/src/components/board/KanbanBoard.tsx`, `apps/web/src/stores/useKanbanStore.ts`
- **Committed in:** `2bcbd86`

---

**Total deviations:** 1 user-requested addition (not an auto-fix — explicitly requested post-checkpoint)
**Impact on plan:** Additive only. All original success criteria were already met before this addition. No regression to existing functionality.

## Issues Encountered

None — plan executed cleanly. Checkpoint was approved by user ("funcionou"). Post-checkpoint addition was implemented as a discrete commit without any rework of earlier tasks.

## Known Stubs

None — all components are fully wired to real API endpoints.

## Threat Model Mitigations Applied

| Threat | Mitigation |
|--------|-----------|
| T-03-01 Spoofing | PipelineTemplateModal sends requests via the axios instance which includes the JWT Bearer token via interceptor |
| T-03-02 Tampering | Stage name input is free text; backend validation applies — no client-side bypass possible |

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Board interaction layer is complete: empty-state, inline stage creation, template loading, and inline stage rename all wired to live API
- Drag-and-drop (implemented in Plan 02) remains fully functional alongside the new stage management controls
- Plan 04 can build on top of this: card CRUD, lead capture form, and pipeline settings

---
*Phase: 01-crm-v1-funil-manual*
*Completed: 2026-04-13*

## Self-Check: PASSED

- User verified in browser and approved checkpoint ("funcionou")
- All three commits confirmed on master branch: 2f5b490, 167b0d7, 2bcbd86
- All 7 files created/modified accounted for across the three commits
- Next.js build passed with /pipelines/[id] listed as dynamic route
- min_lines artifacts all satisfied: EmptyBoardState (115 > 30), AddStageButton (96 > 20), PipelineTemplateModal (170 > 60)
