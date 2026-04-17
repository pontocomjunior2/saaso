---
name: 03-02
phase: 03-agents-formularios-canais
status: complete
wave: 2
completed_at: 2026-04-14
---

# Summary: Rate Limiting + Agent Proactive Channel Fallback

## Objective
Add IP-based rate limiting to public form submissions and implement three-channel fallback for agent proactive outreach (WhatsApp > Email > Log).

## What was done

### New files
- `apps/api/src/lead-form/rate-limit.service.ts` — In-memory sliding window rate limiter (5 req/15 min per IP+tenant)
- `apps/api/src/lead-form/rate-limit.service.spec.ts` — 7 test cases: allows up to 5 requests, throws 429 on 6th, scopes by tenantId and IP, resets after window, reset() clears all

### Modified files
- `apps/api/src/lead-form/lead-form.service.ts` — Injected RateLimitService, added optional `ip` parameter to `submitPublicForm`, calls `rateLimitService.check(ip, tenantId)` after form lookup
- `apps/api/src/lead-form/public-lead-form.controller.ts` — Extracts client IP from Express request (`req.ip ?? req.socket.remoteAddress`), passes to service
- `apps/api/src/lead-form/lead-form.module.ts` — Added `RateLimitService` to providers
- `apps/api/src/agent/agent-runner.service.ts` — Rewrote `initiateProactiveIfAssigned` with three-channel fallback:
  - **WhatsApp (phone)**: Uses `whatsappService.logMessage`, creates `AGENT_PROACTIVE_WHATSAPP` activity
  - **Email (email, no phone)**: Calls `sendProactiveEmail` helper, creates `AGENT_PROACTIVE_EMAIL` activity
  - **Log only (neither)**: Creates `AGENT_PROACTIVE_LOGGED` activity — greeting generated but not sent
  - **Graceful fallback**: WhatsApp failure catches error and falls through to email
  - Added `sendProactiveEmail` private method: sends email with HTML wrapper, creates AgentConversation + AgentMessage + CardActivity
  - Added `wrapGreetingInHtml` private method: branded HTML email template
- `apps/api/src/agent/agent.module.ts` — Added `EmailModule` import
- `apps/api/src/agent/agent-runner.service.spec.ts` — Added EmailService mock, 5 new test cases for channel fallback and conversation creation

### New CardActivity types
- `AGENT_PROACTIVE_WHATSAPP` — Agent sent proactive WhatsApp message
- `AGENT_PROACTIVE_EMAIL` — Agent sent proactive email
- `AGENT_PROACTIVE_LOGGED` — Agent generated greeting but no channel available

## Verification
- `npx jest --testPathPatterns="lead-form|agent-runner|rate-limit" --no-coverage` — 23 tests, 3 suites, all passing

## Acceptance criteria
- [x] RateLimitService with sliding window (5 req/15 min per IP+tenant)
- [x] Rate limiting integrated into public form submission flow
- [x] Channel fallback: WhatsApp > Email > Log
- [x] New CardActivity types for each channel path
- [x] AgentConversation created with OPEN status in all paths
- [x] Graceful WhatsApp failure → email fallback
- [x] HTML email template with personalized greeting
- [x] All tests passing

## Next
- Wave 3 (03-03): Remaining agent + form + channel features
