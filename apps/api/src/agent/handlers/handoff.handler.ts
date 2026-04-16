// [CITED: 05-CONTEXT.md D-10 (keyword-free), D-11 (hard-stop), 05-PATTERNS.md §S1]
// Hard-stop handler for reply.request_handoff. Sets AgentConversation.status →
// HANDOFF_REQUIRED and writes AGENT_HANDOFF activity. NO WhatsApp dispatch —
// human SDR takes over from here. NO keyword heuristic (D-10 deleted
// shouldRequireHandoff; single source of truth is the model's request_handoff).
import { Injectable, Logger } from '@nestjs/common';
import { AgentConversationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { StructuredReply } from '../schemas/structured-reply.schema';

export interface HandoffInput {
  reply: StructuredReply;
  conversation: { id: string };
  card: { id: string };
  agentName: string;
  rawOutput: string;
}

export interface HandoffResult {
  status: 'handoff_required';
  conversationId: string;
}

@Injectable()
export class HandoffHandler {
  private readonly logger = new Logger(HandoffHandler.name);

  constructor(private readonly prisma: PrismaService) {}

  async apply(input: HandoffInput): Promise<HandoffResult> {
    await this.prisma.agentConversation.update({
      where: { id: input.conversation.id },
      data: {
        status: AgentConversationStatus.HANDOFF_REQUIRED,
        lastMessageAt: new Date(),
      },
    });

    const reason = input.reply.handoff_reason?.trim();
    const content = reason
      ? `Agente ${input.agentName} solicitou handoff humano: ${reason}`
      : `Agente ${input.agentName} solicitou handoff humano.`;

    await this.prisma.cardActivity.create({
      data: {
        cardId: input.card.id,
        type: 'AGENT_HANDOFF',
        content,
        metadata: {
          handoff_reason: reason ?? null,
          raw_output: input.rawOutput,
        } as Prisma.InputJsonValue,
      },
    });

    return { status: 'handoff_required', conversationId: input.conversation.id };
  }
}
