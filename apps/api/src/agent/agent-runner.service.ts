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
import { NotificationService } from '../notification/notification.service';
import { AGENT_ACTIVITY_TYPES } from './constants/card-activity-types';
import { ConversationHistoryLoader } from './handlers/conversation-history.loader';
import {
  AgentProviderError,
  StructuredReplyGenerator,
} from './handlers/structured-reply.generator';
import { QualificationHandler } from './handlers/qualification.handler';
import { HandoffHandler } from './handlers/handoff.handler';
import { OutboundDispatcher } from './handlers/outbound.dispatcher';
import { ConversationSummarizerQueue } from './workers/conversation-summarizer.queue';
import { AgentRetryQueue } from './workers/agent-retry.queue';
import type { AgentRetryJobPayload } from './workers/agent-retry.types';

export interface AgentRunnerResult {
  status:
    | 'no_card'
    | 'no_agent'
    | 'handoff_required'
    | 'replied'
    | 'held'
    | 'opted_out'
    | 'retrying';
  conversationId?: string;
  agentId?: string;
  whatsAppMessageId?: string;
  reason?: string;
}

type LegacyInboundMessageInput = {
  tenantId: string;
  contactId: string;
  messageContent: string;
  whatsAppMessageId: string | null;
  cardId?: string;
};

type FutureInboundMessageInput = {
  contactId: string;
  content: string;
  whatsAppMessageId: string | null;
  tenantId?: string;
  cardId?: string;
};

type RunnerInboundInput =
  | LegacyInboundMessageInput
  | FutureInboundMessageInput
  | AgentRetryJobPayload;

const OPT_OUT_PATTERN =
  /\b(cancelar|descadastrar|parar de receber|não quero mais|unsubscribe|remover meus dados)\b/i;
const DISCLOSURE_CHALLENGE_PATTERN =
  /(é um (robô|bot|robo)|é (uma )?(ia|ai)|você é humano|é automático|isso é automatizado|fala(r)? com (pessoa|humano))/i;
const OPT_OUT_CONFIRMATION =
  'Entendido. Não enviaremos mais mensagens por aqui. Se mudar de ideia, é só responder este número.';

interface NormalizedInbound {
  contactId: string;
  content: string;
  whatsAppMessageId: string | null;
  preresolvedConversationId?: string;
  preresolvedCardId?: string;
  preresolvedTenantId?: string;
  preresolvedAgentId?: string;
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

type CardRuntime = Awaited<ReturnType<AgentRunnerService['resolveCard']>>;

function normalizeInbound(input: RunnerInboundInput): NormalizedInbound {
  if ('inboundContent' in input) {
    return {
      contactId: input.contactId,
      content: input.inboundContent.trim(),
      whatsAppMessageId: input.whatsAppMessageId ?? null,
      preresolvedConversationId: input.conversationId,
      preresolvedCardId: input.cardId,
      preresolvedTenantId: input.tenantId,
      preresolvedAgentId: input.agentId,
    };
  }

  if ('messageContent' in input) {
    return {
      contactId: input.contactId,
      content: input.messageContent.trim(),
      whatsAppMessageId: input.whatsAppMessageId ?? null,
      preresolvedCardId: input.cardId,
      preresolvedTenantId: input.tenantId,
    };
  }

  return {
    contactId: input.contactId,
    content: input.content.trim(),
    whatsAppMessageId: input.whatsAppMessageId ?? null,
    preresolvedCardId: input.cardId,
    preresolvedTenantId: input.tenantId,
  };
}

@Injectable()
export class AgentRunnerService {
  private readonly logger = new Logger(AgentRunnerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    @Inject(forwardRef(() => WhatsappService))
    private readonly whatsappService: WhatsappService,
    private readonly emailService: EmailService,
    private readonly historyLoader: ConversationHistoryLoader,
    private readonly replyGenerator: StructuredReplyGenerator,
    private readonly qualificationHandler: QualificationHandler,
    private readonly handoffHandler: HandoffHandler,
    private readonly outboundDispatcher: OutboundDispatcher,
    private readonly summarizerQueue: ConversationSummarizerQueue,
    @Inject(forwardRef(() => AgentRetryQueue))
    private readonly retryQueue: AgentRetryQueue,
    private readonly notifications: NotificationService,
  ) {}

  public async processInboundMessage(
    input: RunnerInboundInput,
  ): Promise<AgentRunnerResult> {
    const normalized = normalizeInbound(input);
    const card = await this.resolveCard(normalized);
    if (!card) {
      return { status: 'no_card' };
    }

    const agent = await this.resolveAgent(card, normalized);
    if (!agent) {
      return { status: 'no_agent' };
    }

    const conversation = await this.findOrCreateConversation({
      preferredConversationId: normalized.preresolvedConversationId,
      tenantId: card.tenantId,
      agentId: agent.id,
      contactId: normalized.contactId,
      cardId: card.id,
    });
    const capturedAt = conversation.updatedAt;

    if (OPT_OUT_PATTERN.test(normalized.content)) {
      await this.prisma.cardActivity.create({
        data: {
          cardId: card.id,
          type: AGENT_ACTIVITY_TYPES.LEAD_OPT_OUT,
          content: `Lead solicitou parar de receber mensagens: "${normalized.content.slice(0, 120)}"`,
        },
      });
      await this.optimisticUpdate(conversation.id, capturedAt, {
        status: AgentConversationStatus.CLOSED,
        lastMessageAt: new Date(),
      });
      this.notifications.emit(card.tenantId, {
        type: 'LEAD_OPT_OUT',
        cardId: card.id,
        cardTitle: card.title ?? 'Lead',
        at: new Date().toISOString(),
      });
      try {
        await this.whatsappService.logMessage(card.tenantId, {
          contactId: normalized.contactId,
          cardId: card.id,
          content: OPT_OUT_CONFIRMATION,
        });
      } catch (error) {
        this.logger.warn(`Opt-out confirmation failed: ${String(error)}`);
      }
      return {
        status: 'opted_out',
        conversationId: conversation.id,
        agentId: agent.id,
      };
    }

    if (!normalized.preresolvedConversationId) {
      await this.prisma.agentMessage.create({
        data: {
          conversationId: conversation.id,
          role: AgentMessageRole.USER,
          content: normalized.content,
          whatsAppMessageId: normalized.whatsAppMessageId,
        },
      });
    }

    if (conversation.status === AgentConversationStatus.HANDOFF_REQUIRED) {
      await this.optimisticUpdate(conversation.id, capturedAt, {
        lastMessageAt: new Date(),
      });
      return {
        status: 'handoff_required',
        conversationId: conversation.id,
        agentId: agent.id,
      };
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
    const history = await this.historyLoader.load({
      conversationId: conversation.id,
      windowSize: profile?.historyWindow ?? 20,
    });

    let generated;
    try {
      generated = await this.replyGenerator.generate({
        compiledPrompt,
        userMessage: normalized.content,
        history,
        summary: conversation.summary,
        profile,
      });
    } catch (error) {
      if (!(error instanceof AgentProviderError)) {
        throw error;
      }

      await this.prisma.cardActivity.create({
        data: {
          cardId: card.id,
          type: AGENT_ACTIVITY_TYPES.AGENT_ERROR,
          content:
            'Erro transitório ao chamar o modelo; re-tentando em background.',
          metadata: {
            reason: error.reason,
            raw: error.raw,
          } as Prisma.InputJsonValue,
        },
      });
      await this.retryQueue.enqueue({
        conversationId: conversation.id,
        cardId: card.id,
        tenantId: card.tenantId,
        agentId: agent.id,
        contactId: normalized.contactId,
        inboundContent: normalized.content,
        whatsAppMessageId: normalized.whatsAppMessageId,
        enqueuedAt: new Date().toISOString(),
      });
      return {
        status: 'retrying',
        conversationId: conversation.id,
        agentId: agent.id,
      };
    }

    if (generated.fallback && generated.fallbackReason === 'parse') {
      await this.prisma.cardActivity.create({
        data: {
          cardId: card.id,
          type: AGENT_ACTIVITY_TYPES.AGENT_PARSE_FALLBACK,
          content: 'Modelo retornou JSON inválido; usando fallback.',
          metadata: {
            raw_output: generated.rawOutput,
          } as Prisma.InputJsonValue,
        },
      });
    }

    if (generated.fallback && generated.fallbackReason === 'refusal') {
      await this.prisma.cardActivity.create({
        data: {
          cardId: card.id,
          type: AGENT_ACTIVITY_TYPES.AGENT_HELD,
          content: 'Modelo recusou a resposta.',
          metadata: {
            reason: 'model_refusal',
            raw_output: generated.rawOutput,
          } as Prisma.InputJsonValue,
        },
      });
      this.notifications.emit(card.tenantId, {
        type: 'AGENT_REFUSAL_REVIEW',
        cardId: card.id,
        cardTitle: card.title ?? 'Lead',
        at: new Date().toISOString(),
      });
      await this.optimisticUpdate(conversation.id, capturedAt, {
        lastMessageAt: new Date(),
      });
      return {
        status: 'held',
        conversationId: conversation.id,
        agentId: agent.id,
        reason: 'model_refusal',
      };
    }

    if (generated.reply.request_handoff) {
      const handoff = await this.handoffHandler.apply({
        reply: generated.reply,
        conversation: { id: conversation.id },
        card: { id: card.id },
        agentName: agent.name,
        rawOutput: generated.rawOutput,
      });
      return {
        status: 'handoff_required',
        conversationId: handoff.conversationId,
        agentId: agent.id,
      };
    }

    if (generated.reply.mark_qualified) {
      await this.qualificationHandler.apply({
        reply: generated.reply,
        card: {
          id: card.id,
          pipelineId: card.stage.pipelineId,
          title: card.title,
          tenantId: card.tenantId,
        },
        rawOutput: generated.rawOutput,
      });
    }

    if (!generated.reply.should_respond) {
      await this.prisma.cardActivity.create({
        data: {
          cardId: card.id,
          type: AGENT_ACTIVITY_TYPES.AGENT_HELD,
          content: 'Agente segurou resposta (fragmentação).',
          metadata: {
            reason: 'prompt_driven',
            held_output: generated.reply as unknown as Prisma.InputJsonValue,
            raw_output: generated.rawOutput,
          } as Prisma.InputJsonValue,
        },
      });
      await this.optimisticUpdate(conversation.id, capturedAt, {
        lastMessageAt: new Date(),
      });
      return {
        status: 'held',
        conversationId: conversation.id,
        agentId: agent.id,
        reason: 'prompt_driven',
      };
    }

    const dispatch = await this.outboundDispatcher.send({
      reply: generated.reply,
      conversation: {
        id: conversation.id,
        contactId: normalized.contactId,
      },
      card: { id: card.id, tenantId: card.tenantId },
      agent: {
        id: agent.id,
        name: agent.name,
        knowledgeBase: agent.knowledgeBase
          ? { content: agent.knowledgeBase.content ?? null }
          : null,
      },
      tenant: { name: agent.tenant.name },
      profile,
      inboundIsDisclosureChallenge: DISCLOSURE_CHALLENGE_PATTERN.test(
        normalized.content,
      ),
      rawOutput: generated.rawOutput,
    });

    if (dispatch.status === 'sent') {
      const agentMessageCount = await this.prisma.agentMessage.count({
        where: {
          conversationId: conversation.id,
          role: AgentMessageRole.AGENT,
        },
      });
      const summaryThreshold = profile?.summaryThreshold ?? 10;
      if (
        agentMessageCount > 0 &&
        agentMessageCount % summaryThreshold === 0
      ) {
        await this.summarizerQueue
          .enqueue(conversation.id)
          .catch((error) =>
            this.logger.warn(`Summarizer enqueue failed: ${String(error)}`),
          );
      }
      return {
        status: 'replied',
        conversationId: conversation.id,
        agentId: agent.id,
        whatsAppMessageId: dispatch.whatsAppMessageId,
      };
    }

    if (dispatch.status === 'handoff_required') {
      await this.optimisticUpdate(conversation.id, capturedAt, {
        status: AgentConversationStatus.HANDOFF_REQUIRED,
        lastMessageAt: new Date(),
      });
      return {
        status: 'handoff_required',
        conversationId: conversation.id,
        agentId: agent.id,
      };
    }

    await this.optimisticUpdate(conversation.id, capturedAt, {
      lastMessageAt: new Date(),
    });
    return {
      status: 'held',
      conversationId: conversation.id,
      agentId: agent.id,
      reason: dispatch.reason,
    };
  }

  private async resolveCard(normalized: NormalizedInbound) {
    if (normalized.preresolvedCardId) {
      const card = await this.prisma.card.findUnique({
        where: { id: normalized.preresolvedCardId },
        include: {
          stage: { select: { id: true, name: true, pipelineId: true } },
        },
      });
      if (
        card &&
        card.contactId === normalized.contactId &&
        (!normalized.preresolvedTenantId ||
          card.tenantId === normalized.preresolvedTenantId)
      ) {
        return card;
      }
      return null;
    }

    return this.prisma.card.findFirst({
      where: {
        contactId: normalized.contactId,
        ...(normalized.preresolvedTenantId
          ? { tenantId: normalized.preresolvedTenantId }
          : {}),
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        stage: { select: { id: true, name: true, pipelineId: true } },
      },
    });
  }

  private async resolveAgent(
    card: NonNullable<CardRuntime>,
    normalized: NormalizedInbound,
  ): Promise<AgentRuntime | null> {
    if (normalized.preresolvedAgentId) {
      return this.prisma.agent.findFirst({
        where: {
          id: normalized.preresolvedAgentId,
          tenantId: card.tenantId,
          isActive: true,
        },
        include: agentRuntimeInclude,
      });
    }

    return this.prisma.agent.findFirst({
      where: {
        tenantId: card.tenantId,
        stageId: card.stageId,
        isActive: true,
      },
      include: agentRuntimeInclude,
      orderBy: { updatedAt: 'desc' },
    });
  }

  private async findOrCreateConversation(input: {
    preferredConversationId?: string;
    tenantId: string;
    agentId: string;
    contactId: string;
    cardId: string;
  }) {
    if (input.preferredConversationId) {
      const preferred = await this.prisma.agentConversation.findFirst({
        where: {
          id: input.preferredConversationId,
          tenantId: input.tenantId,
          agentId: input.agentId,
          contactId: input.contactId,
          cardId: input.cardId,
        },
      });
      if (preferred) {
        return preferred;
      }
    }

    const existingConversation = await this.prisma.agentConversation.findFirst({
      where: {
        tenantId: input.tenantId,
        agentId: input.agentId,
        contactId: input.contactId,
        cardId: input.cardId,
        status: { not: AgentConversationStatus.CLOSED },
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

  private async optimisticUpdate(
    conversationId: string,
    capturedAt: Date,
    data: Prisma.AgentConversationUpdateManyMutationInput,
  ): Promise<void> {
    const initial = await this.prisma.agentConversation.updateMany({
      where: { id: conversationId, updatedAt: capturedAt },
      data,
    });
    if (initial.count > 0) {
      return;
    }

    const fresh = await this.prisma.agentConversation.findFirst({
      where: { id: conversationId },
      select: { updatedAt: true },
    });
    if (!fresh) {
      this.logger.warn(
        `Optimistic lock miss on conversation ${conversationId}; conversation no longer exists.`,
      );
      return;
    }

    const retried = await this.prisma.agentConversation.updateMany({
      where: { id: conversationId, updatedAt: fresh.updatedAt },
      data,
    });
    if (retried.count === 0) {
      this.logger.warn(
        `Optimistic lock miss on conversation ${conversationId}; state advanced concurrently.`,
      );
    }
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
}
