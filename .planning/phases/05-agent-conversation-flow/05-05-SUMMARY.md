---
phase: 05-agent-conversation-flow
plan: 05
subsystem: card
tags: [timeline, card, api, read-only, qualification]

requires:
  - phase: 05-agent-conversation-flow
    plan: 01
    provides: Agent/CardActivity metadata columns, AGENT_ACTIVITY_TYPES
  - phase: 05-agent-conversation-flow
    plan: 02
    provides: StructuredReply metadata persisted on AgentMessage
provides:
  - GET /cards/:id/timeline read model
  - TimelineQueryDto + TimelineResponse + LatestAgentSuggestion types
  - latestAgentSuggestion attached to card list/detail payloads
affects: [05-06-plan]

tech-stack:
  added: []
  patterns:
    - "Tenant isolation by card ownership check first, then relation-scoped fan-out queries"
    - "Read-only merge endpoint using Promise.all over WhatsAppMessage, CardActivity, AgentMessage"
    - "Suggestion invalidation by later MOVED activity"

key-files:
  created:
    - apps/api/src/card/dto/timeline.dto.ts
    - .planning/phases/05-agent-conversation-flow/05-05-SUMMARY.md
  modified:
    - apps/api/src/card/card.service.ts
    - apps/api/src/card/card.service.spec.ts
    - apps/api/src/card/card.controller.ts
    - apps/api/src/card/card.controller.spec.ts

requirements-completed:
  - D-05
  - D-23
  - D-24

completed: 2026-04-16
---

# Phase 05 Plan 05: Timeline + Latest Suggestion Summary

Built the backend read surface for Phase 5 UI consumption. `CardService.getCardTimeline()` now returns a unified reverse-chronological timeline merged from WhatsApp messages, card activities, and agent messages, with tenant safety enforced by a card ownership check before any fan-out query. The merged payload preserves `AgentMessage.metadata`, so the frontend can read structured-reply fields such as `qualification_reason` and `suggested_next_stage_id`.

Card list and detail responses now attach `latestAgentSuggestion`, derived from the newest `AGENT_QUALIFIED` activity unless a later `MOVED` activity consumed that suggestion. Stage-name resolution is best-effort: missing or invalid stage IDs degrade to `suggested_next_stage_name: null` without breaking the payload.

Controller work added `GET /cards/:id/timeline` with `TimelineQueryDto` validation for `limit` and `before`. Focused verification passed:

- `pnpm jest src/card/card.service.spec.ts src/card/card.controller.spec.ts --runInBand`

Type-check verification remains blocked by pre-existing unrelated errors outside this plan:

- `src/lead-form/lead-form.service.spec.ts(31,15): TS2554`
- `src/whatsapp/evolution.service.spec.ts(22,7): TS2352`

No new writes were introduced in the timeline endpoint itself; all behavior is read-only.
