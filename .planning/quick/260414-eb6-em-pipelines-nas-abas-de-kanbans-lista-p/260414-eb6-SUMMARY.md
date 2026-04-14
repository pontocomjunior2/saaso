---
phase: quick-260414-eb6
plan: 01
subsystem: frontend/pipelines
tags: [delete, pipeline, confirmation-dialog, kanban]
key-files:
  modified:
    - apps/web/src/app/pipelines/page.tsx
decisions:
  - Used inline modal for confirmation (no @radix-ui/react-alert-dialog in project deps)
  - Trash icon hidden by default, revealed on group-hover to keep tabs uncluttered
metrics:
  duration: ~10min
  completed: 2026-04-14
---

# Quick Task 260414-eb6: Delete Pipeline Summary

**One-liner:** Trash icon per pipeline tab with inline confirmation modal calling DELETE /pipelines/:id and removing from local state.

## What Was Done

Added full delete pipeline capability to `/pipelines` page, scoped entirely to `apps/web/src/app/pipelines/page.tsx`.

### Changes

**State additions:**
- `deletingPipelineId: string | null` — tracks which pipeline is staged for deletion
- `isDeleteConfirmOpen: boolean` — controls visibility of the confirmation modal

**Handler:**
- `handleDeletePipeline(pipelineId)` — calls `api.delete('/pipelines/:id')`, filters pipeline from local state, shifts selection to first remaining pipeline if deleted pipeline was active

**Pipeline tab JSX:**
- Each pipeline tab wrapped in `<div className="group relative flex items-center">`
- Trash2 icon button (`opacity-0 group-hover:opacity-100`) positioned absolutely at right of tab text
- `e.stopPropagation()` prevents triggering pipeline selection when clicking trash
- Added `pr-6` padding to tab button so name text doesn't overlap the trash icon

**Confirmation modal:**
- Inline `fixed inset-0 z-50` overlay rendered at bottom of JSX tree
- Shows pipeline name in destructive message
- "Cancelar" closes modal without action; "Excluir" (rose-600) confirms deletion

## Deviations from Plan

None — plan executed exactly as written. AlertDialog branch not taken because `@radix-ui/react-alert-dialog` is not in `apps/web/package.json`; inline modal branch used as planned.

## Verification

- TypeScript compilation: `npx tsc --project apps/web/tsconfig.json --noEmit` exits 0
- No known stubs

## Commit

`adf7642` — feat(pipelines): add delete pipeline with confirmation dialog
