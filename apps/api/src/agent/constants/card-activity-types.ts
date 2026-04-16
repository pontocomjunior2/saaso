/**
 * String constants for CardActivity.type. CardActivity.type is a free-form String
 * in Prisma (NOT an enum) — these constants keep emitters and consumers in sync.
 *
 * Existing values (pre-Phase 5) continue to work without being listed here:
 *   CREATED, MOVED, MESSAGE_SENT, AGENT_RESPONSE, AGENT_HANDOFF,
 *   AGENT_HANDOFF_MANUAL, AGENT_RESUMED, AGENT_PROACTIVE_SENT,
 *   AGENT_PROACTIVE_SKIPPED, AGENT_PROACTIVE_FAILED, META_LEAD_ARRIVED, ...
 *
 * Phase 5 additions — see 05-CONTEXT.md D-13, D-14 and 05-RESEARCH.md Pitfall #1.
 */
export const AGENT_ACTIVITY_TYPES = {
  AGENT_QUALIFIED: 'AGENT_QUALIFIED',
  AGENT_HELD: 'AGENT_HELD',
  AGENT_PARSE_FALLBACK: 'AGENT_PARSE_FALLBACK',
  AGENT_ERROR: 'AGENT_ERROR',
  AGENT_DISCLOSURE_ENFORCED: 'AGENT_DISCLOSURE_ENFORCED',
  AGENT_COMMERCIAL_DEFLECTION: 'AGENT_COMMERCIAL_DEFLECTION',
  AGENT_REFUSAL_REVIEW: 'AGENT_REFUSAL_REVIEW',
  LEAD_OPT_OUT: 'LEAD_OPT_OUT',
} as const;

export type AgentActivityType =
  (typeof AGENT_ACTIVITY_TYPES)[keyof typeof AGENT_ACTIVITY_TYPES];
