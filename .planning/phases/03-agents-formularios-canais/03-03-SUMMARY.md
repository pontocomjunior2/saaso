---
phase: 03-agents-formularios-canais
plan: 03
subsystem: ui
tags: [react, nextjs, postmessage, iframe, csp, form-validation]

# Dependency graph
requires:
  - phase: 03-agents-formularios-canais
    plan: 02
    provides: backend POST /public/forms/:tenantSlug/:slug/submit endpoint, public form GET endpoint, LeadFormField types
provides:
  - Client-side form submission with validation and lifecycle states
  - postMessage protocol for embedded forms with source validation
  - Sandboxed iframe embed snippets with sandbox attribute
  - CSP meta tag for embedded form mode
  - postMessage protocol documentation in form builder UI
affects: [03-04, 03-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Submission state machine: idle -> loading -> success/error
    - postMessage lifecycle events: saaso:form-resize/submitting/submitted/error
    - window.saasoFormCallbacks for parent-side event handling
    - iframe sandbox: allow-scripts allow-same-origin allow-forms (no popups/top-navigation)
    - Client-side validation: required, email regex, phone regex, select options

key-files:
  created: []
  modified:
    - apps/web/src/app/f/[tenantSlug]/[slug]/page.tsx
    - apps/web/src/app/formularios/page.tsx

key-decisions:
  - "CSP meta tag implemented as http-equiv in client component; production should use Next.js middleware for header-based CSP"
  - "Client validation is UX-only; server validates all submissions authoritatively (from Plan 03-02)"
  - "postMessage uses '*' as targetOrigin since embed can be cross-origin; source validation (event.source === iframe.contentWindow) prevents spoofing"
  - "Public form API path uses /public/forms/:tenantSlug/:slug/submit to match backend route from 03-02"

patterns-established:
  - "Submission state machine: idle/loading/success/error with distinct UI for each state"
  - "postMessage protocol: resize + submitting/submitted/error events with optional cardId"
  - "Embed sandbox: allow-scripts allow-same-origin allow-forms (excludes popups and top-navigation)"
  - "window.saasoFormCallbacks optional callback registration pattern for parent-side event handling"

requirements-completed: [REQ-10]

# Metrics
duration: 15min
completed: 2026-04-14
---

# Phase 03 Plan 03: Public Form UX + Embed postMessage + CSP Summary

**Public form submission UX with idle/loading/success/error states, client validation, postMessage lifecycle protocol, and sandboxed iframe embed code generator**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-04-14
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Public form page submits to backend POST `/public/forms/:tenantSlug/:slug/submit` with full submission lifecycle (idle -> loading -> success/error)
- Client-side validation for required fields (trimmed empty check), email format (regex), phone format (lenient regex), and select options (value in options list)
- postMessage protocol for embed mode with `event.source === iframe.contentWindow` origin validation
- Lifecycle events: `saaso:form-submitting` (on submit start), `saaso:form-submitted` (on success + cardId), `saaso:form-error` (on failure)
- Height sync via `saaso:form-resize` after success screen renders
- CSP meta tag (`frame-ancestors *`) when embed=1 restricts embedded page resources
- Embed snippet generator produces sandboxed iframe: `sandbox="allow-scripts allow-same-origin allow-forms"`
- Embed script includes `referrerPolicy: strict-origin-when-cross-origin`
- `window.saasoFormCallbacks` registration: onSubmitting, onSubmit(cardId), onError
- postMessage protocol documentation displayed in form builder embed section with copy button

## Task Commits

Each task was committed atomically:

1. **Task 1: Public Form Submission UX** — `d8b454c` (feat)
   - Submission state machine, client validation, postMessage events, success/error screens, CSP meta tag
2. **Task 2: Embed Code Generator Improvements** — `f5d946e` (feat)
   - Sandboxed embed snippet, expanded embed script with lifecycle event handlers, postMessageProtocolDoc UI

## Files Created/Modified

- `apps/web/src/app/f/[tenantSlug]/[slug]/page.tsx` — submission handler, client validation, postMessage events (submitting/submitted/error/resize), success/thank-you screen with form.successTitle/successMessage, error state with retry button, CSP meta tag when embed=1, field error display below inputs
- `apps/web/src/app/formularios/page.tsx` — sandboxed iframe embed snippet, expanded embed script with all lifecycle event handlers + saasoFormCallbacks, postMessageProtocolDoc computed constant, protocol documentation displayed in embed section

## Decisions Made

- **CSP meta tag vs middleware:** Used `<meta httpEquiv="Content-Security-Policy">` in the client component since the page is a client component (`'use client'`). Production should use Next.js middleware for proper header-based CSP. Documented in plan.
- **postMessage targetOrigin `'*'`:** Used `'*'` because the embedded form can be hosted on any parent origin. Source validation (`event.source === iframe.contentWindow`) prevents spoofed events from other iframes.
- **Public form API path:** Used `/public/forms/${tenantSlug}/${slug}/submit` matching the backend route structure from 03-02 (which uses `/public/forms/:tenantSlug/:slug` GET and POST).

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface

All threats in plan's STRIDE register were addressed:
- T-3-31: `event.source === iframe.contentWindow` in embed script prevents spoofed postMessage
- T-3-32: Client validation is UX-only; server validates authoritatively (Plan 03-02)
- T-3-33: CSP meta tag present when embed=1 (`frame-ancestors *`, `script-src 'self' 'unsafe-inline'`)
- T-3-34: `sandbox="allow-scripts allow-same-origin allow-forms"` — no allow-popups, no allow-top-navigation
- T-3-35: Accepted — parent caps min height at 520px
- T-3-36: Backend creates LeadFormSubmission record; parent callbacks can forward to analytics

## Known Stubs

None — all data flows are wired. Form loads from backend, submits to backend, success/error reflect real server responses.

## Self-Check

- [x] `apps/web/src/app/f/[tenantSlug]/[slug]/page.tsx` exists with full submission logic
- [x] `apps/web/src/app/formularios/page.tsx` has sandboxed embed snippets and protocol docs
- [x] Task commits `d8b454c` and `f5d946e` exist in git history
- [x] Next.js build passes without errors

## Self-Check: PASSED

---
*Phase: 03-agents-formularios-canais*
*Plan: 03*
*Completed: 2026-04-14*
