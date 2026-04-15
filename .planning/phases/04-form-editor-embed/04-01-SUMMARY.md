---
phase: 04-form-editor-embed
plan: 01
subsystem: ui
tags: [react, nextjs, postmessage, iframe, csp, form-validation]

# Dependency graph
requires:
  - phase: 03-agents-formularios-canais
    provides: backend POST /forms/:slug/submit endpoint, public form GET endpoint, LeadFormField types
provides:
  - Client-side form submission with validation and lifecycle states
  - postMessage protocol for embedded forms with source validation
  - Sandboxed iframe embed snippets with sandbox attribute
  - CSP meta tag for embedded form mode
affects: [04-02, 04-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Submission state machine: idle -> loading -> success/error
    - postMessage lifecycle events: saaso:form-resize/submitting/submitted/error
    - window.saasoFormCallbacks for parent-side event handling
    - iframe sandbox: allow-scripts allow-same-origin allow-forms (no popups/top-navigation)

key-files:
  created: []
  modified:
    - apps/web/src/app/f/[tenantSlug]/[slug]/page.tsx
    - apps/web/src/app/formularios/page.tsx

key-decisions:
  - "CSP meta tag implemented as http-equiv in client component; production should use Next.js middleware"
  - "Client validation is UX-only; server validates all submissions authoritatively (from Plan 03-02)"
  - "postMessage uses '*' as targetOrigin since embed can be cross-origin; source validation (event.source === iframe.contentWindow) prevents spoofing"

patterns-established:
  - "Submission state machine: idle/loading/success/error with distinct UI for each state"
  - "postMessage protocol: resize + submitting/submitted/error events with optional cardId"
  - "Embed sandbox: allow-scripts allow-same-origin allow-forms (excludes popups and top-navigation)"

requirements-completed: [REQ-10]

# Metrics
duration: 15min
completed: 2026-04-14
---

# Phase 04: Form Editor + Embed + Frontend Summary

**Public form submission UX with client validation, postMessage lifecycle protocol, and sandboxed iframe embed code generator**

## Performance

- **Duration:** 15 min
- **Started:** 2026-04-14T23:10:00Z
- **Completed:** 2026-04-14T23:25:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Public form page submits to backend POST endpoint with full submission lifecycle (idle/loading/success/error)
- Client-side validation prevents invalid submissions (required, email, phone, select options)
- postMessage protocol for embed mode with source validation (saaso:form-submitting/submitted/error/resize)
- CSP meta tag when embed=1 restricts embedded page resources
- Embed snippet generator produces sandboxed iframe with documented postMessage protocol
- window.saasoFormCallbacks callback registration for parent-side event handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Public Form Submission UX** - `d8b454c` (feat)
2. **Task 2: Embed Code Generator Improvements** - `f5d946e` (feat)

## Files Created/Modified
- `apps/web/src/app/f/[tenantSlug]/[slug]/page.tsx` — submission handler, client validation, postMessage events, success/error screens, CSP meta tag
- `apps/web/src/app/formularios/page.tsx` — sandboxed embed snippet, expanded embed script with lifecycle handlers, postMessage protocol documentation UI

## Decisions Made
None - followed plan as specified.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Form submission UX complete with validation and embed protocol
- Embed code generator produces secure sandboxed snippets with full documentation
- Ready for 04-02 (Meta Lead Forms webhook) and 04-03 (WhatsApp Evolution frontend)

---
*Phase: 04-form-editor-embed*
*Completed: 2026-04-14*
