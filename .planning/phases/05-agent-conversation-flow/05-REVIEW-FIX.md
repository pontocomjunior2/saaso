---
phase: 05-agent-conversation-flow
fixed_at: 2026-04-17T00:00:00Z
review_path: .planning/phases/05-agent-conversation-flow/05-REVIEW.md
iteration: 1
fix_scope: critical_warning
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 05: Code Review Fix Report

**Fixed at:** 2026-04-17
**Source review:** `.planning/phases/05-agent-conversation-flow/05-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 6
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: Hardcoded webhook verify token fallback enables webhook spoofing

**Files modified:** `apps/api/src/whatsapp/whatsapp.service.ts`
**Commit:** `1464546`
**Applied fix:** Replaced the `|| 'saaso-dev-webhook-token'` fallback with a fail-closed `ForbiddenException` thrown when `WHATSAPP_WEBHOOK_VERIFY_TOKEN` is not set in the environment. `ForbiddenException` was already imported.

---

### CR-02: G7 commercial-deflection guard blocks all commercial replies when no knowledge base is linked

**Files modified:** `apps/api/src/agent/handlers/outbound.dispatcher.ts`
**Commit:** `e408f17`
**Applied fix:** Restructured the G7 guard so that `kbContent` is read via optional chaining (`input.agent.knowledgeBase?.content`) and the entire commercial-pattern check is wrapped in `if (kbContent != null)`. Agents with no linked knowledge base now bypass G7 entirely instead of always triggering `commercial_deflection`.

---

### WR-01: AgentRetryQueue.processJob always throws — retry worker is permanently broken

**Files modified:** `apps/api/src/agent/workers/agent-retry.queue.ts`
**Commit:** `a2caeeb`
**Applied fix:** Replaced the unsafe runtime-reflection pattern (`(this.runner as unknown as Record<string, unknown>).processInboundMessage`) and the guard that could throw unconditionally with a direct call `await this.runner.processInboundMessage(job.data)`. Also removed the now-unused `RunnerProcessInboundMessage` type alias.

---

### WR-02: Race condition in WhatsApp message attribution in `sendMessage`

**Files modified:** `apps/api/src/card/card.service.ts`
**Commit:** `db11704`
**Applied fix:** Added a 2-second timestamp window to the `cardActivity.findFirst` query (`createdAt: { gte: windowStart }`) so that concurrent `sendMessage` calls are far less likely to find and overwrite each other's activity records.

---

### WR-03: `card.service.ts remove()` manually deletes CardActivities that cascade automatically

**Files modified:** `apps/api/src/card/card.service.ts`
**Commit:** `2f4091d`
**Applied fix:** Removed the `$transaction` wrapper and the manual `tx.cardActivity.deleteMany` call. The method now calls `this.prisma.card.delete` directly; `onDelete: Cascade` on the Prisma schema handles child `CardActivity` rows automatically.

---

### WR-04: Timeline store `fetchMore` may append stale data after card switch

**Files modified:** `apps/web/src/stores/timeline-store.ts`
**Commit:** `8c06810`
**Applied fix:** Converted the `set(...)` call in `fetchMore` from an object literal to a state-updater function. The updater checks `state.currentCardId !== cardId` and returns only `{ isLoadingMore: false }` when the response belongs to a card the user has already navigated away from. `currentCardId` was already tracked in store state and set on every `fetchInitial` call.

---

_Fixed: 2026-04-17_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
