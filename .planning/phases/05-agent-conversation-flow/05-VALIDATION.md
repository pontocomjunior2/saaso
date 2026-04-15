---
phase: 5
slug: agent-conversation-flow
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-15
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | apps/api/jest.config.js |
| **Quick run command** | `pnpm --filter @saaso/api test -- --testPathPattern={pattern}` |
| **Full suite command** | `pnpm --filter @saaso/api test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick command scoped to changed file
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | ❌ W0 | ⬜ pending |

*Filled by planner during plan generation. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `pnpm add zod@^3.25 zod-to-json-schema@^3.25 --filter @saaso/api` (Zod is NOT installed — research finding)
- [ ] Prisma migration: add `AgentMessage.metadata Json?` AND `CardActivity.metadata Json?`
- [ ] Test fixtures for OpenAI Responses API mocking (response stubs with previous_response_id)
- [ ] Test fixtures for structured-output decision schema (should_respond/mark_qualified/request_handoff/suggested_next_stage_id)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end multi-turn conversation via WhatsApp (Evolution API) | TBD | Requires live channel + real WhatsApp account | Send 3+ messages from test number, verify agent responds with context, verify timeline shows full audit trail |
| Hybrid qualification UX — agent suggests, human confirms in CardDetailSheet | TBD | UI interaction across two surfaces | Trigger qualification from agent, verify notification badge + confirmation modal in pipeline UI |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (Zod install, metadata columns)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
