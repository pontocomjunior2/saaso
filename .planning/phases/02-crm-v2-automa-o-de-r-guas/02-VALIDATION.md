---
phase: 2
slug: crm-v2-automa-o-de-r-guas
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest (NestJS API) + vitest (Next.js web) |
| **Config file** | `apps/api/jest.config.ts` / `apps/web/vitest.config.ts` |
| **Quick run command** | `cd apps/api && npx jest --testPathPattern=stage-rule --no-coverage` |
| **Full suite command** | `cd apps/api && npx jest --no-coverage && cd ../web && npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/api && npx jest --testPathPattern=stage-rule --no-coverage`
- **After every plan wave:** Run `cd apps/api && npx jest --no-coverage && cd ../web && npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | REQ-06 | T-2-01 / — | Prisma migration scoped to tenant | unit | `npx jest --testPathPattern=stage-rule.service` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 1 | REQ-06 | — | StageRule CRUD multi-tenant isolation | unit | `npx jest --testPathPattern=stage-rule.service` | ❌ W0 | ⬜ pending |
| 2-02-01 | 02 | 2 | REQ-07 | T-2-02 | Webhook hub.challenge verification | unit | `npx jest --testPathPattern=meta-webhook` | ❌ W0 | ⬜ pending |
| 2-02-02 | 02 | 2 | REQ-07 | T-2-02 | Lead idempotency via metaLeadId unique | unit | `npx jest --testPathPattern=meta-lead-ingestion` | ❌ W0 | ⬜ pending |
| 2-03-01 | 03 | 3 | REQ-06 | — | D0 rule fires on CARD_ENTERED event | unit | `npx jest --testPathPattern=stage-rule-queue` | ❌ W0 | ⬜ pending |
| 2-03-02 | 03 | 3 | REQ-06 | — | BullMQ job cancelled on card stage change | unit | `npx jest --testPathPattern=stage-rule-queue` | ❌ W0 | ⬜ pending |
| 2-04-01 | 04 | 4 | REQ-08 | — | Agent config stored per stage | unit | `npx jest --testPathPattern=agent-config` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/stage-rule/stage-rule.service.spec.ts` — stubs for REQ-06
- [ ] `apps/api/src/meta-webhook/meta-webhook.controller.spec.ts` — stubs for REQ-07
- [ ] `apps/api/src/stage-rule/stage-rule-queue.service.spec.ts` — stubs for REQ-06
- [ ] `apps/api/src/agent-config/agent-config.service.spec.ts` — stubs for REQ-08

*Existing jest/vitest infrastructure detected — no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Meta Lead Ads webhook end-to-end | REQ-07 | Requires real Meta developer account and campaign | Use Meta webhooks tester tool with a test lead form |
| WhatsApp AI agent responds to lead | REQ-08 | Requires live AI agent endpoint and WhatsApp sandbox | Send test message to WhatsApp sandbox number assigned to stage with agent |
| Régua D+1/D+3 fires on schedule | REQ-06 | BullMQ delayed jobs require time passage | Manually set D+1 delay to 1 minute and observe job execution in logs |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
