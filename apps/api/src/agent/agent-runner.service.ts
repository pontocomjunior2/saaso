import {
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
  Logger,
} from '@nestjs/common';
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
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { EmailService } from '../email/email.service';

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
      classificationCriteria: true,
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
  private readonly logger = new Logger(AgentRunnerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    @Inject(forwardRef(() => WhatsappService))
    private readonly whatsappService: WhatsappService,
    private readonly emailService: EmailService,
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
        classificationCriteria: agent.stage?.classificationCriteria ?? null,
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

  /**
   * Initiates a proactive conversation for a newly created card if an agent is
   * assigned to the card's stage. Called by MetaWebhookService after card creation
   * to trigger agent D0 fire for Meta Lead Ads entries.
   *
   * Full implementation added by Plan 04 (Wave 3). This stub logs the intent
   * and creates the conversation skeleton so that Plan 04 can wire the actual
   * first-message logic without data loss.
   */
  public async initiateProactiveIfAssigned(
    cardId: string,
    stageId: string,
    tenantId: string,
  ): Promise<void> {
    const agent = await this.prisma.agent.findFirst({
      where: { tenantId, stageId, isActive: true },
      include: agentRuntimeInclude,
      orderBy: { updatedAt: 'desc' },
    });

    if (!agent) {
      return;
    }

    const card = await this.prisma.card.findFirst({
      where: { id: cardId, tenantId },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
      },
    });

    if (!card?.contactId || !card.contact) {
      return;
    }

    const emailCard = card.contact.email
      ? {
          id: card.id,
          contactId: card.contactId,
          contact: {
            name: card.contact.name,
            email: card.contact.email,
          },
        }
      : null;

    const existingConversation = await this.prisma.agentConversation.findFirst({
      where: { cardId, tenantId },
    });

    if (existingConversation) {
      return;
    }

    const profile = normalizeAgentPromptProfile(agent.profile);
    const compiledPrompt = buildAgentCompiledPrompt({
      name: agent.name,
      systemPrompt: agent.systemPrompt,
      profile,
      context: {
        tenantName: agent.tenant.name,
        pipelineName: agent.stage?.pipeline.name ?? null,
        stageName: agent.stage?.name ?? null,
        classificationCriteria: agent.stage?.classificationCriteria ?? null,
        knowledgeBaseName: agent.knowledgeBase?.name ?? null,
        knowledgeBaseSummary: agent.knowledgeBase?.summary ?? null,
        knowledgeBaseContent: agent.knowledgeBase?.content ?? null,
      },
    });

    const contactName = card.contact.name ?? 'sem nome';
    const greeting = await this.aiService.generateResponse(
      compiledPrompt,
      `Inicie uma conversa proativa com o lead ${contactName} que acabou de entrar na etapa. Responda em uma única mensagem curta, natural e pronta para envio.`,
      {
        model: profile?.model,
        temperature: profile?.temperature,
        maxTokens: profile?.maxTokens,
      },
    );

    // Channel fallback: WhatsApp (phone) > Email (email) > CardActivity log (neither)
    let activityType: string;
    let activityContent: string;
    let whatsAppMessageId: string | null = null;

    if (card.contact.phone) {
      // Path 1: WhatsApp
      try {
        const outboundMessage = await this.whatsappService.logMessage(
          tenantId,
          {
            contactId: card.contactId,
            cardId,
            content: greeting,
          },
        );
        whatsAppMessageId = outboundMessage.id;
        activityType = 'AGENT_PROACTIVE_WHATSAPP';
        activityContent = `Agente ${agent.name} enviou WhatsApp proativo para ${card.contact.phone}: "${greeting.substring(0, 100)}..."`;
      } catch (error) {
        this.logger.error(
          '[initiateProactiveIfAssigned] WhatsApp failed, falling back to email',
          error instanceof Error ? error.stack : String(error),
        );
        if (emailCard) {
          await this.sendProactiveEmail(tenantId, emailCard, greeting, agent);
          return;
        }

        activityType = 'AGENT_PROACTIVE_LOGGED';
        activityContent = `Agente ${agent.name} gerou saudação proativa mas o WhatsApp falhou e não há email de fallback para o card ${cardId}.`;
        whatsAppMessageId = null;
      }
    } else if (emailCard) {
      // Path 2: Email
      await this.sendProactiveEmail(tenantId, emailCard, greeting, agent);
      return;
    } else {
      // Path 3: Log only — no channel available
      activityType = 'AGENT_PROACTIVE_LOGGED';
      activityContent = `Agente ${agent.name} gerou saudação proativa mas sem canal de envio (sem phone/email) para card ${cardId}.`;
      whatsAppMessageId = null;
    }

    // Create AgentConversation in all cases
    const conversation = await this.prisma.agentConversation.create({
      data: {
        tenantId,
        agentId: agent.id,
        contactId: card.contactId,
        cardId,
        status: AgentConversationStatus.OPEN,
        summary:
          'Conversa iniciada automaticamente pelo agente ao entrar na etapa.',
        lastMessageAt: new Date(),
      },
    });

    await this.prisma.agentMessage.create({
      data: {
        conversationId: conversation.id,
        role: AgentMessageRole.AGENT,
        content: greeting,
        whatsAppMessageId,
      },
    });

    await this.prisma.cardActivity.create({
      data: {
        cardId,
        type: activityType,
        content: activityContent,
      },
    });
  }

  private async sendProactiveEmail(
    tenantId: string,
    card: { id: string; contactId: string; contact: { name: string | null; email: string } },
    greeting: string,
    agent: { id: string; name: string },
  ): Promise<void> {
    const contactName = card.contact.name ?? 'sem nome';
    const htmlBody = this.wrapGreetingInHtml(greeting, contactName);

    const result = await this.emailService.sendEmail({
      to: card.contact.email,
      subject: `Olá, ${contactName}! Bem-vindo(a)!`,
      body: greeting,
      html: htmlBody,
    });

    const activityType = result.deliveryMode === 'smtp'
      ? 'AGENT_PROACTIVE_EMAIL'
      : 'AGENT_PROACTIVE_EMAIL';

    // Create AgentConversation
    const conversation = await this.prisma.agentConversation.create({
      data: {
        tenantId,
        agentId: agent.id,
        contactId: card.contactId,
        cardId: card.id,
        status: AgentConversationStatus.OPEN,
        summary:
          'Conversa iniciada automaticamente pelo agente via email ao entrar na etapa.',
        lastMessageAt: new Date(),
      },
    });

    await this.prisma.agentMessage.create({
      data: {
        conversationId: conversation.id,
        role: AgentMessageRole.AGENT,
        content: greeting,
      },
    });

    await this.prisma.cardActivity.create({
      data: {
        cardId: card.id,
        type: activityType,
        content: `Agente ${agent.name} enviou email proativo para ${card.contact.email}: "${greeting.substring(0, 100)}..."`,
      },
    });
  }

  private wrapGreetingInHtml(greeting: string, name?: string): string {
    const displayName = name ? name.split(' ')[0] : '';
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <p>Olá${displayName ? `, ${displayName}` : ''}!</p>
  <p>${greeting}</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
  <p style="font-size: 12px; color: #888;">Esta mensagem foi enviada automaticamente.</p>
</body>
</html>`;
  }

  public async toggleTakeover(
    conversationId: string,
    tenantId: string,
    userId?: string,
  ): Promise<{ status: AgentConversationStatus }> {
    const conversation = await this.prisma.agentConversation.findFirst({
      where: { id: conversationId, tenantId },
      select: {
        id: true,
        status: true,
        cardId: true,
      },
    });

    if (!conversation) {
      throw new NotFoundException(
        `Conversa com ID '${conversationId}' não encontrada neste tenant.`,
      );
    }

    const nextStatus =
      conversation.status === AgentConversationStatus.HANDOFF_REQUIRED
        ? AgentConversationStatus.OPEN
        : AgentConversationStatus.HANDOFF_REQUIRED;

    await this.prisma.agentConversation.update({
      where: { id: conversationId },
      data: {
        status: nextStatus,
        lastMessageAt: new Date(),
      },
    });

    if (conversation.cardId) {
      await this.prisma.cardActivity.create({
        data: {
          cardId: conversation.cardId,
          type:
            nextStatus === AgentConversationStatus.HANDOFF_REQUIRED
              ? 'AGENT_HANDOFF_MANUAL'
              : 'AGENT_RESUMED',
          content:
            nextStatus === AgentConversationStatus.HANDOFF_REQUIRED
              ? 'SDR assumiu conversa'
              : 'Conversa devolvida ao agente',
          actorId: userId,
        },
      });
    }

    return { status: nextStatus };
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
