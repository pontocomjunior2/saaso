import { Injectable } from '@nestjs/common';
import {
  AgentConversationStatus,
  AgentMessageRole,
  MessageDirection,
  MessageStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../common/services/ai.service';
import {
  buildAgentCompiledPrompt,
  normalizeAgentPromptProfile,
} from './agent-prompt.builder';

export interface AgentRunnerResult {
  status:
    | 'agent_replied'
    | 'no_card'
    | 'no_agent'
    | 'conversation_updated'
    | 'handoff_required';
  conversationId?: string;
  agentId?: string;
  responseMessageId?: string;
}

const agentRuntimeInclude = Prisma.validator<Prisma.AgentInclude>()({
  stage: {
    select: {
      id: true,
      name: true,
      pipeline: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  tenant: {
    select: {
      id: true,
      name: true,
    },
  },
  knowledgeBase: {
    select: {
      id: true,
      name: true,
      summary: true,
      content: true,
    },
  },
});

type AgentRuntime = Prisma.AgentGetPayload<{
  include: typeof agentRuntimeInclude;
}>;

@Injectable()
export class AgentRunnerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  public async processInboundMessage(input: {
    tenantId: string;
    contactId: string;
    messageContent: string;
    whatsAppMessageId: string;
    cardId?: string;
  }): Promise<AgentRunnerResult> {
    const activeCard = await this.resolveActiveCard(
      input.tenantId,
      input.contactId,
      input.cardId,
    );
    if (!activeCard) {
      return { status: 'no_card' };
    }

    const agent = await this.prisma.agent.findFirst({
      where: {
        tenantId: input.tenantId,
        stageId: activeCard.stageId,
        isActive: true,
      },
      include: agentRuntimeInclude,
      orderBy: { updatedAt: 'desc' },
    });

    if (!agent) {
      return { status: 'no_agent' };
    }

    const conversation = await this.findOrCreateConversation({
      tenantId: input.tenantId,
      agentId: agent.id,
      contactId: input.contactId,
      cardId: activeCard.id,
    });

    const normalizedMessage = input.messageContent.trim();
    const handoffRequired = this.shouldRequireHandoff(normalizedMessage);
    const profile = normalizeAgentPromptProfile(agent.profile);

    await this.prisma.agentMessage.create({
      data: {
        conversationId: conversation.id,
        role: AgentMessageRole.USER,
        content: normalizedMessage,
        whatsAppMessageId: input.whatsAppMessageId,
      },
    });

    if (conversation.status === AgentConversationStatus.HANDOFF_REQUIRED) {
      await this.prisma.agentConversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
        },
      });

      return {
        status: 'conversation_updated',
        conversationId: conversation.id,
        agentId: agent.id,
      };
    }

    if (handoffRequired) {
      await this.prisma.agentConversation.update({
        where: { id: conversation.id },
        data: {
          status: AgentConversationStatus.HANDOFF_REQUIRED,
          lastMessageAt: new Date(),
        },
      });

      await this.prisma.cardActivity.create({
        data: {
          cardId: activeCard.id,
          type: 'AGENT_HANDOFF',
          content: `Lead solicitou handoff humano na conversa do agente ${agent.name}.`,
        },
      });

      return {
        status: 'handoff_required',
        conversationId: conversation.id,
        agentId: agent.id,
      };
    }

    const compiledPrompt = buildAgentCompiledPrompt({
      name: agent.name,
      systemPrompt: agent.systemPrompt,
      profile,
      context: {
        tenantName: agent.tenant.name,
        pipelineName: agent.stage?.pipeline.name ?? null,
        stageName: agent.stage?.name ?? null,
        knowledgeBaseName: agent.knowledgeBase?.name ?? null,
        knowledgeBaseSummary: agent.knowledgeBase?.summary ?? null,
        knowledgeBaseContent: agent.knowledgeBase?.content ?? null,
      },
    });

    const aiReply = await this.aiService.generateResponse(
      compiledPrompt,
      normalizedMessage,
      {
        model: profile?.model,
        temperature: profile?.temperature,
        maxTokens: profile?.maxTokens,
      },
    );

    const outboundMessage = await this.prisma.whatsAppMessage.create({
      data: {
        contactId: input.contactId,
        content: aiReply,
        direction: MessageDirection.OUTBOUND,
        status: MessageStatus.SENT,
      },
    });

    await this.prisma.agentMessage.create({
      data: {
        conversationId: conversation.id,
        role: AgentMessageRole.AGENT,
        content: aiReply,
        whatsAppMessageId: outboundMessage.id,
      },
    });

    await this.prisma.agentConversation.update({
      where: { id: conversation.id },
      data: {
        status: AgentConversationStatus.OPEN,
        lastMessageAt: outboundMessage.createdAt,
      },
    });

    await this.prisma.cardActivity.create({
      data: {
        cardId: activeCard.id,
        type: 'AGENT_RESPONSE',
        content: `Agente ${agent.name} respondeu automaticamente via WhatsApp.`,
      },
    });

    return {
      status: 'agent_replied',
      conversationId: conversation.id,
      agentId: agent.id,
      responseMessageId: outboundMessage.id,
    };
  }

  private async resolveActiveCard(
    tenantId: string,
    contactId: string,
    cardId?: string,
  ): Promise<{ id: string; stageId: string } | null> {
    if (cardId) {
      return this.prisma.card.findFirst({
        where: {
          id: cardId,
          tenantId,
          contactId,
        },
        select: {
          id: true,
          stageId: true,
        },
      });
    }

    return this.prisma.card.findFirst({
      where: {
        tenantId,
        contactId,
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        stageId: true,
      },
    });
  }

  private async findOrCreateConversation(input: {
    tenantId: string;
    agentId: string;
    contactId: string;
    cardId: string;
  }) {
    const existingConversation = await this.prisma.agentConversation.findFirst({
      where: {
        tenantId: input.tenantId,
        agentId: input.agentId,
        contactId: input.contactId,
        cardId: input.cardId,
        status: {
          in: [
            AgentConversationStatus.OPEN,
            AgentConversationStatus.HANDOFF_REQUIRED,
          ],
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (existingConversation) {
      return existingConversation;
    }

    return this.prisma.agentConversation.create({
      data: {
        tenantId: input.tenantId,
        agentId: input.agentId,
        contactId: input.contactId,
        cardId: input.cardId,
        status: AgentConversationStatus.OPEN,
        lastMessageAt: new Date(),
      },
    });
  }

  private shouldRequireHandoff(content: string): boolean {
    const normalizedContent = content.toLowerCase();
    const handoffKeywords = [
      'humano',
      'atendente',
      'pessoa',
      'consultor',
      'ligacao',
      'ligação',
    ];

    return handoffKeywords.some((keyword) =>
      normalizedContent.includes(keyword),
    );
  }
}
