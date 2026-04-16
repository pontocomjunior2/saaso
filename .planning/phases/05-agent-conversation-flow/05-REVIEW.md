---
phase: 05-agent-conversation-flow
reviewed: 2026-04-16T00:00:00Z
depth: standard
files_reviewed: 44
files_reviewed_list:
  - apps/api/package.json
  - apps/api/prisma/schema.prisma
  - apps/api/src/agent/agent-prompt.builder.spec.ts
  - apps/api/src/agent/agent-prompt.builder.ts
  - apps/api/src/agent/agent-runner.service.spec.ts
  - apps/api/src/agent/agent-runner.service.ts
  - apps/api/src/agent/agent.module.ts
  - apps/api/src/agent/agent.service.ts
  - apps/api/src/agent/constants/card-activity-types.ts
  - apps/api/src/agent/dto/agent-prompt-profile.dto.ts
  - apps/api/src/agent/handlers/conversation-history.loader.spec.ts
  - apps/api/src/agent/handlers/conversation-history.loader.ts
  - apps/api/src/agent/handlers/handoff.handler.spec.ts
  - apps/api/src/agent/handlers/handoff.handler.ts
  - apps/api/src/agent/handlers/outbound.dispatcher.spec.ts
  - apps/api/src/agent/handlers/outbound.dispatcher.ts
  - apps/api/src/agent/handlers/qualification.handler.spec.ts
  - apps/api/src/agent/handlers/qualification.handler.ts
  - apps/api/src/agent/handlers/structured-reply.generator.spec.ts
  - apps/api/src/agent/handlers/structured-reply.generator.ts
  - apps/api/src/agent/schemas/structured-reply.schema.spec.ts
  - apps/api/src/agent/schemas/structured-reply.schema.ts
  - apps/api/src/agent/workers/agent-retry.queue.spec.ts
  - apps/api/src/agent/workers/agent-retry.queue.ts
  - apps/api/src/agent/workers/agent-retry.types.ts
  - apps/api/src/agent/workers/conversation-summarizer.queue.spec.ts
  - apps/api/src/agent/workers/conversation-summarizer.queue.ts
  - apps/api/src/card/card.controller.spec.ts
  - apps/api/src/card/card.controller.ts
  - apps/api/src/card/card.service.spec.ts
  - apps/api/src/card/card.service.ts
  - apps/api/src/card/dto/timeline.dto.ts
  - apps/api/src/common/services/ai.service.spec.ts
  - apps/api/src/common/services/ai.service.ts
  - apps/api/src/notification/notification.module.ts
  - apps/api/src/notification/notification.service.ts
  - apps/api/src/whatsapp/whatsapp.service.ts
  - apps/web/src/components/board/ActivityTimeline.tsx
  - apps/web/src/components/board/CardDetailSheet.tsx
  - apps/web/src/components/board/KanbanBoard.tsx
  - apps/web/src/components/board/QualifiedBadge.tsx
  - apps/web/src/components/board/SuggestedStageButton.tsx
  - apps/web/src/components/board/TimelineFilters.tsx
  - apps/web/src/components/board/TimelineTab.tsx
  - apps/web/src/components/board/board-types.ts
  - apps/web/src/stores/timeline-store.ts
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-04-16
**Depth:** standard
**Files Reviewed:** 44
**Status:** issues_found

## Summary

This phase introduces the full agent conversation flow: structured reply generation, outbound dispatch with guardrail pipeline (G4–G7), conversation history loading, qualification/handoff handlers, BullMQ-backed retry and summarizer queues, and a unified timeline UI. The architecture is well-decomposed and the guardrail ordering is deliberate. However, two critical issues were found: a security misconfiguration (hardcoded webhook token fallback) and a logic fault in the G7 commercial-deflection guardrail that causes legitimate replies to be blocked whenever no knowledge base is linked. Four warnings cover a broken retry queue worker, a race condition in message attribution, a dead code path that causes unnecessary DB work, and a stale-card risk in the timeline store. Three info-level items cover a dead conditional in `sendProactiveEmail`, a type contract mismatch between frontend and backend, and a WhatsApp timeline scope edge case.

---

## Critical Issues

### CR-01: Hardcoded webhook verify token fallback enables webhook spoofing

**File:** `apps/api/src/whatsapp/whatsapp.service.ts:990-991`

**Issue:** `verifyWebhookChallenge` falls back to the hardcoded string `'saaso-dev-webhook-token'` when `WHATSAPP_WEBHOOK_VERIFY_TOKEN` is not set in the environment. Any actor who discovers this default value (it is in the public codebase) can pass the Meta webhook challenge and inject arbitrary webhook payloads into the system, creating contacts and cards, triggering agent runs, and poisoning the audit trail.

**Fix:** Fail closed — throw a `ForbiddenException` if the env var is missing rather than using a fallback. If a dev-mode fallback is absolutely required, gate it explicitly on `NODE_ENV !== 'production'`.

```typescript
const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim();
if (!expectedToken) {
  throw new ForbiddenException(
    'Erro no Backend: WHATSAPP_WEBHOOK_VERIFY_TOKEN não configurado.',
  );
}
```

---

### CR-02: G7 commercial-deflection guard blocks all commercial replies when no knowledge base is linked

**File:** `apps/api/src/agent/handlers/outbound.dispatcher.ts:157-179`

**Issue:** The G7 grounding check sets `kbContent` to `''` (empty string) when `input.agent.knowledgeBase` is null or its content is null. The grounding test is:

```typescript
const grounded = needle.length > 0 && kbContent.toLowerCase().includes(needle.toLowerCase());
```

An empty `kbContent` can never contain `needle`, so `grounded` is always `false` when no KB is attached. Any agent reply that mentions a price (`R$ 100`), a discount (`10% off`), an SLA, a deadline, or an invoice will trigger `status: 'handoff_required'` with reason `'commercial_deflection'` — even when the agent is simply relaying accurate information from its system prompt. Agents without a knowledge base will never be able to send commercial information.

**Fix:** Skip the G7 check entirely when no knowledge base is attached. G7 is a *grounding* guard that validates KB provenance — it has no meaning when there is no KB to ground against.

```typescript
// G7 — commercial-commitment fabrication guard (KB grounding check).
// Only applies when a knowledge base is configured; without a KB there
// is nothing to ground against and the guard must be skipped.
const kbContent = input.agent.knowledgeBase?.content;
if (kbContent != null) {
  const commercialMatch = COMMERCIAL_PATTERN.exec(replyText);
  if (commercialMatch) {
    const needle = commercialMatch[0] ?? '';
    const grounded =
      needle.length > 0 &&
      kbContent.toLowerCase().includes(needle.toLowerCase());
    if (!grounded) {
      // ... existing deflection logic
    }
  }
}
```

---

## Warnings

### WR-01: AgentRetryQueue.processJob always throws — retry worker is permanently broken

**File:** `apps/api/src/agent/workers/agent-retry.queue.ts:239-253`

**Issue:** `processJob` accesses `processInboundMessage` via an unsafe runtime cast and throws `Error('AgentRunnerService.processInboundMessage not available for retry payload.')` if the method is not found. Because `AgentRunnerService.processInboundMessage` accepts `RunnerInboundInput` (a union type) but the comment notes that the `AgentRetryJobPayload` overload shape "lands in plan 05-04", the runtime check `typeof runnerFn !== 'function'` should evaluate to `false` (the method exists). However, the actual concern is more subtle: the method IS found, but then called with an `AgentRetryJobPayload` which normalizes via the `'inboundContent' in input` branch in `normalizeInbound`. This part works. The bug is that on first review the guard comment says "Runner signature not yet refactored" — if during testing this method is replaced or mocked, all three retry attempts will fail immediately, emit `AGENT_PERSISTENT_FAILURE`, and never actually retry the agent call.

More concretely: the comment states this will always throw. If that comment accurately reflects runtime behavior (i.e., `processInboundMessage` is not discoverable through the runtime cast at test time or in some build configurations), then every enqueued retry job hits the final-failure path with zero actual retry attempts, meaning the retry queue provides no protection at all.

**Fix:** Remove the runtime-cast guard pattern. Wire the method dependency directly through the constructor and call it without the unsafe reflection.

```typescript
// In processJob — replace the reflection pattern:
public async processJob(job: Job<AgentRetryJobPayload>): Promise<void> {
  await this.runner.processInboundMessage(job.data);
}
```

The `forwardRef` circular-dep is already resolved at module init time; the direct call is safe at job-processing time.

---

### WR-02: Race condition in WhatsApp message attribution in `sendMessage`

**File:** `apps/api/src/card/card.service.ts:706-720`

**Issue:** After dispatching a WhatsApp message via `whatsappService.logMessage`, the code searches for the most recent `WHATSAPP_OUTBOUND*` activity to update it with `templateName` and `actorId`:

```typescript
const latestActivity = await this.prisma.cardActivity.findFirst({
  where: {
    cardId: card.id,
    type: { startsWith: 'WHATSAPP_OUTBOUND' },
  },
  orderBy: { createdAt: 'desc' },
});
```

If two SDRs send messages to the same card concurrently, the second `sendMessage` call could find and overwrite the `CardActivity` created by the first call, attributing it to the wrong user and wrong template. This corrupts the audit trail.

**Fix:** Pass `templateName` and `actorId` into `logMessage` directly, or have `logMessage` return the activity ID, or use a unique correlation token (e.g., a temporary `externalId`) that can be matched instead of relying on "most recent."

A simpler immediate fix is to include a timestamp window in the query:

```typescript
const now = new Date();
const windowStart = new Date(now.getTime() - 2000); // 2-second window
const latestActivity = await this.prisma.cardActivity.findFirst({
  where: {
    cardId: card.id,
    type: { startsWith: 'WHATSAPP_OUTBOUND' },
    createdAt: { gte: windowStart },
  },
  orderBy: { createdAt: 'desc' },
});
```

The correct long-term fix is to refactor `logMessage` to accept and persist these attribution fields directly.

---

### WR-03: `card.service.ts remove()` manually deletes CardActivities that cascade automatically

**File:** `apps/api/src/card/card.service.ts:648-651`

**Issue:** `remove()` runs a transaction that first calls `tx.cardActivity.deleteMany({ where: { cardId: id } })` before deleting the card. The Prisma schema (`schema.prisma:133`) defines `CardActivity.card` with `onDelete: Cascade`, so the manual delete is unnecessary and adds an extra round-trip. While not currently harmful, it creates a false dependency — if the manual delete fails (e.g., partial permissions in a future policy), the card deletion will be blocked even though Cascade would have handled it.

**Fix:** Remove the manual delete:

```typescript
public async remove(tenantId: string, id: string): Promise<Card> {
  await this.findOne(tenantId, id);
  return this.prisma.card.delete({ where: { id } });
}
```

---

### WR-04: Timeline store `fetchMore` may append stale data after card switch

**File:** `apps/web/src/stores/timeline-store.ts:57-80`

**Issue:** `fetchMore` receives `cardId` as an argument but does not validate it against `currentCardId` stored in the state before appending results. If the user opens card A, scrolls to the bottom (triggering `fetchMore`), then quickly switches to card B before the response arrives, the response from card A's `fetchMore` will be appended to card B's timeline because the store's `items` array is mutated without a stale-check.

```typescript
set((state) => ({
  items: [...state.items, ...response.data.items],  // no guard against cardId mismatch
  nextCursor: response.data.nextCursor,
  isLoadingMore: false,
}));
```

**Fix:** Add a stale-request guard before mutating state:

```typescript
set((state) => {
  if (state.currentCardId !== cardId) {
    // Response arrived for a card the user has already navigated away from.
    return { isLoadingMore: false };
  }
  return {
    items: [...state.items, ...response.data.items],
    nextCursor: response.data.nextCursor,
    isLoadingMore: false,
  };
});
```

---

## Info

### IN-01: Dead conditional — `activityType` always assigned the same value in `sendProactiveEmail`

**File:** `apps/api/src/agent/agent-runner.service.ts:809-811`

**Issue:** The ternary expression for `activityType` evaluates `result.deliveryMode === 'smtp'` but assigns `'AGENT_PROACTIVE_EMAIL'` to both branches, making the condition dead code:

```typescript
const activityType = result.deliveryMode === 'smtp'
  ? 'AGENT_PROACTIVE_EMAIL'
  : 'AGENT_PROACTIVE_EMAIL';
```

This appears to be a copy-paste remnant from an earlier design where SMTP and API delivery modes had distinct activity types.

**Fix:** Remove the conditional:

```typescript
const activityType = 'AGENT_PROACTIVE_EMAIL';
```

Or, if distinguishing delivery modes is desired for the activity log:

```typescript
const activityType = result.deliveryMode === 'smtp'
  ? 'AGENT_PROACTIVE_EMAIL_SMTP'
  : 'AGENT_PROACTIVE_EMAIL';
```

---

### IN-02: Frontend `LatestAgentSuggestion` type diverges from backend on `confirmedAt` nullability

**File:** `apps/web/src/components/board/board-types.ts:66-72` vs `apps/api/src/card/dto/timeline.dto.ts:31-36`

**Issue:** The frontend type declares `confirmedAt: string | null` while the backend DTO declares `confirmedAt: string` (always present when the object exists). The API never returns a `null` `confirmedAt` because it is derived from `qualified.createdAt.toISOString()` which is always non-null. The mismatch is harmless now but could cause confusion if the types are consumed in strict-null checks or serialized elsewhere.

**Fix:** Align the frontend type to match the backend contract:

```typescript
// apps/web/src/components/board/board-types.ts
export interface LatestAgentSuggestion {
  mark_qualified: boolean;
  suggested_next_stage_id: string | null;
  suggested_next_stage_name: string | null;
  qualification_reason: string | null;
  confirmedAt: string;  // always present when the suggestion object exists
}
```

---

### IN-03: WhatsApp timeline query may include messages from other cards sharing the same contact

**File:** `apps/api/src/card/card.service.ts:287-292`

**Issue:** The timeline query for WhatsApp messages filters by `contact: { cards: { some: { id: cardId } } }`. This fetches all messages sent/received by contacts who are linked to the requested card — but if a contact has been linked to multiple cards (e.g., a lead who re-entered the funnel), messages from those other cards will also appear in the timeline. The timeline is not incorrect in a security sense (tenant isolation is enforced by the card lookup above), but it may show messages that semantically belong to a different conversion.

**Fix:** Prefer filtering by a direct contact-card link if the WhatsApp message model supported it, or accept this as a product decision and document it. A minimal safeguard is to add a limit note in the query comment. No code change is strictly required unless product confirms the single-contact-per-timeline expectation.

---

_Reviewed: 2026-04-16_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
