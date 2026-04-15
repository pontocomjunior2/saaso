---
phase: 04-form-editor-embed
plan: 01
status: complete
completed: 2026-04-14
---

## 04-01: Form Submission UX + Embed Code Generator

### What was built
- Public form page (`apps/web/src/app/f/[tenantSlug]/[slug]/page.tsx`) now submits to backend POST endpoint with full lifecycle (idle/loading/success/error)
- Client-side validation for required fields, email format, phone format, and select options
- postMessage protocol for embed mode: `saaso:form-submitting`, `saaso:form-submitted`, `saaso:form-error`
- CSP meta tag added when embed=1
- Success/thank-you screen using form.successTitle and form.successMessage
- Error state with retry button
- Embed snippet generator updated with sandbox attribute and full postMessage protocol documentation

### Key files modified
- `apps/web/src/app/f/[tenantSlug]/[slug]/page.tsx` — submission handler, validation, postMessage, success/error screens
- `apps/web/src/app/formularios/page.tsx` — sandboxed embed snippet, protocol documentation

### Deviations from plan
- CSP meta tag implemented as `<meta http-equiv>` in client component (production should use Next.js middleware)

### Self-Check: PASSED
