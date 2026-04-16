/**
 * AgentRetryJobPayload — serializable payload for the `agent_retry` BullMQ
 * queue. Lives in its own file (no `bullmq` / queue-class imports) so the
 * AgentRunnerService can `import type` it without dragging the queue class
 * into the module graph — avoids circular-dep between runner and retry queue
 * (per PATTERNS §S4).
 *
 * Enqueue call site: AgentRunnerService catches AgentProviderError (05-02)
 * and calls AgentRetryQueue.enqueue(payload). The worker re-invokes
 * AgentRunnerService.processInboundMessage(payload) with this exact shape
 * (signature introduced in plan 05-04).
 */
export interface AgentRetryJobPayload {
  /** AgentConversation.id — already persisted USER message belongs here. */
  conversationId: string;
  /** Card being qualified — required to write CardActivity on final failure. */
  cardId: string;
  /** Tenant boundary — required for NotificationService.emit routing. */
  tenantId: string;
  /** Agent that owns the conversation. */
  agentId: string;
  /** Contact the inbound came from. */
  contactId: string;
  /** Raw inbound text. Runner re-builds the full structured call from this. */
  inboundContent: string;
  /** WhatsApp provider message id — may be null for non-WhatsApp channels. */
  whatsAppMessageId: string | null;
  /** ISO timestamp of the original enqueue; useful for latency metrics. */
  enqueuedAt: string;
}
