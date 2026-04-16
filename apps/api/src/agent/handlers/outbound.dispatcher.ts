// [CITED: 05-CONTEXT.md D-11 (dispatch ordering), D-12 (metadata persistence),
// 05-AI-SPEC.md §6 guardrails G4/G5/G6/G7, 05-PATTERNS.md §S1 + §S3]
// Single outbound-message writer. Evaluates guardrails pre-dispatch
// (empty-reply → G5 → G4 → G6 → G7 → happy path) and, on the happy path,
// performs the Prisma write triad (whatsAppMessage + agentMessage + conversation
// update + cardActivity) with AgentMessage.metadata carrying the validated
// StructuredReply JSON (D-12).
//
// Note — deviation from PLAN's action block: PLAN calls
// `this.whatsappService.sendMessage(...)` but WhatsappService only exposes
// `logMessage`. We follow the existing agent-runner.service.ts line 196-228
// pattern (direct prisma.whatsAppMessage.create with MessageDirection.OUTBOUND
// + MessageStatus.SENT) which matches PATTERNS.md §S3 verbatim. Summary.md
// documents this as Rule 3 (blocking).
import { Injectable, Logger } from '@nestjs/common';
import {
  AgentConversationStatus,
  AgentMessageRole,
  MessageDirection,
  MessageStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../../notification/notification.service';
import { AGENT_ACTIVITY_TYPES } from '../constants/card-activity-types';
import type { StructuredReply } from '../schemas/structured-reply.schema';
import type { AgentPromptProfile } from '../agent-prompt.builder';

const AI_DISCLOSURE_AFFIRMATION = /sou.*(ia|assistente|agente|virtual|automatizado)/i;
const COMMERCIAL_PATTERN =
  /R\$\s*\d+(?:[.,]\d+)*|%\s*(desconto|off)|\bsla\b|prazo de (entrega|implantação|pagamento)|emit[ei](mos|e)\s+(nf|nota)/i;

export interface DispatchInput {
  reply: StructuredReply;
  conversation: { id: string; contactId: string };
  card: { id: string; tenantId: string };
  agent: {
    id: string;
    name: string;
    knowledgeBase?: { content?: string | null } | null;
  };
  tenant: { name: string };
  profile: AgentPromptProfile | null;
  inboundIsDisclosureChallenge: boolean;
  rawOutput: string;
}

export type DispatchResult =
  | { status: 'sent'; whatsAppMessageId: string }
  | { status: 'held'; reason: string }
  | { status: 'handoff_required'; reason: string };

@Injectable()
export class OutboundDispatcher {
  private readonly logger = new Logger(OutboundDispatcher.name);
  private static readonly CONSECUTIVE_WINDOW_MS = 10_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  async send(input: DispatchInput): Promise<DispatchResult> {
    if (!input.reply.reply || input.reply.reply.trim().length === 0) {
      await this.writeHeld(input, 'empty_reply');
      return { status: 'held', reason: 'empty_reply' };
    }

    // G5 — consecutive-reply throttle (no intervening USER + <10s since last AGENT).
    const lastAgent = await this.prisma.agentMessage.findFirst({
      where: {
        conversationId: input.conversation.id,
        role: AgentMessageRole.AGENT,
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (lastAgent) {
      const interveningUser = await this.prisma.agentMessage.findFirst({
        where: {
          conversationId: input.conversation.id,
          role: { not: AgentMessageRole.AGENT },
          createdAt: { gt: lastAgent.createdAt },
        },
        select: { id: true },
      });
      const sinceLast = Date.now() - lastAgent.createdAt.getTime();
      if (
        !interveningUser &&
        sinceLast < OutboundDispatcher.CONSECUTIVE_WINDOW_MS
      ) {
        await this.writeHeld(input, 'throttle_consecutive');
        return { status: 'held', reason: 'throttle_consecutive' };
      }
    }

    let replyText = input.reply.reply;

    // G4 — AI-disclosure honesty gate (rewrite, CONTINUE).
    if (
      input.inboundIsDisclosureChallenge &&
      !AI_DISCLOSURE_AFFIRMATION.test(replyText)
    ) {
      const originalReply = replyText;
      replyText = `Oi! Sou um agente virtual do time da ${input.tenant.name}, respondendo aqui no WhatsApp. Posso continuar te ajudando ou prefere falar com um atendente humano?`;
      await this.prisma.cardActivity.create({
        data: {
          cardId: input.card.id,
          type: AGENT_ACTIVITY_TYPES.AGENT_DISCLOSURE_ENFORCED,
          content: 'Aviso de IA inserido automaticamente na resposta ao lead.',
          metadata: {
            original_reply: originalReply,
            rewritten_reply: replyText,
          } as Prisma.InputJsonValue,
        },
      });
    }

    // G6 — moderation / blocked terms (from Agent.profile JSON; no migration).
    const blockedTerms = Array.isArray(input.profile?.blockedTerms)
      ? input.profile.blockedTerms
      : [];
    if (blockedTerms.length > 0) {
      const lower = replyText.toLowerCase();
      const matched = blockedTerms.find(
        (term) =>
          typeof term === 'string' &&
          term.length > 0 &&
          lower.includes(term.toLowerCase()),
      );
      if (matched) {
        await this.prisma.cardActivity.create({
          data: {
            cardId: input.card.id,
            type: AGENT_ACTIVITY_TYPES.AGENT_REFUSAL_REVIEW,
            content: `Resposta contém termo bloqueado ("${matched}"); segurada para revisão humana.`,
            metadata: {
              reason: 'blocked_term',
              matched_term: matched,
              reply_redacted: replyText,
              raw_output: input.rawOutput,
            } as Prisma.InputJsonValue,
          },
        });
        this.notifications.emit(input.card.tenantId, {
          type: 'AGENT_REFUSAL_REVIEW',
          cardId: input.card.id,
          at: new Date().toISOString(),
          reason: 'blocked_term',
          matchedTerm: matched,
        });
        return { status: 'held', reason: 'blocked_term' };
      }
    }

    // G7 — commercial-commitment fabrication guard (KB grounding check).
    const commercialMatch = COMMERCIAL_PATTERN.exec(replyText);
    if (commercialMatch) {
      const kbContent = input.agent.knowledgeBase?.content ?? '';
      const needle = commercialMatch[0] ?? '';
      const grounded =
        needle.length > 0 &&
        kbContent.toLowerCase().includes(needle.toLowerCase());
      if (!grounded) {
        await this.prisma.cardActivity.create({
          data: {
            cardId: input.card.id,
            type: AGENT_ACTIVITY_TYPES.AGENT_COMMERCIAL_DEFLECTION,
            content:
              'Resposta com compromisso comercial não confirmado — encaminhado para humano.',
            metadata: {
              matched_pattern: needle,
              reply_redacted: replyText,
              raw_output: input.rawOutput,
            } as Prisma.InputJsonValue,
          },
        });
        return { status: 'handoff_required', reason: 'commercial_deflection' };
      }
    }

    // Happy path — Prisma write triad matching PATTERNS.md §S3 (existing
    // agent-runner.service.ts lines 196-228 verbatim, + D-12 metadata).
    const outboundMessage = await this.prisma.whatsAppMessage.create({
      data: {
        contactId: input.conversation.contactId,
        content: replyText,
        direction: MessageDirection.OUTBOUND,
        status: MessageStatus.SENT,
      },
    });

    await this.prisma.agentMessage.create({
      data: {
        conversationId: input.conversation.id,
        role: AgentMessageRole.AGENT,
        content: replyText,
        whatsAppMessageId: outboundMessage.id,
        // D-12: persist validated StructuredReply JSON as-is for audit.
        metadata: input.reply as unknown as Prisma.InputJsonValue,
      },
    });

    await this.prisma.agentConversation.update({
      where: { id: input.conversation.id },
      data: {
        status: AgentConversationStatus.OPEN,
        lastMessageAt: outboundMessage.createdAt,
      },
    });

    await this.prisma.cardActivity.create({
      data: {
        cardId: input.card.id,
        type: 'AGENT_RESPONSE',
        content: `Agente ${input.agent.name} respondeu automaticamente via WhatsApp.`,
        metadata: {
          raw_output: input.rawOutput,
        } as Prisma.InputJsonValue,
      },
    });

    return { status: 'sent', whatsAppMessageId: outboundMessage.id };
  }

  private async writeHeld(input: DispatchInput, reason: string): Promise<void> {
    await this.prisma.cardActivity.create({
      data: {
        cardId: input.card.id,
        type: AGENT_ACTIVITY_TYPES.AGENT_HELD,
        content: `Agente segurou resposta (motivo: ${reason}).`,
        metadata: {
          reason,
          held_output: input.reply as unknown as Prisma.InputJsonValue,
          raw_output: input.rawOutput,
        } as Prisma.InputJsonValue,
      },
    });
  }
}
