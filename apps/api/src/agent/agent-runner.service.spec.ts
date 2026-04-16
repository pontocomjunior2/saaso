import { Test, TestingModule } from '@nestjs/testing';
import { AgentConversationStatus } from '@prisma/client';
import { AgentRunnerService } from './agent-runner.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../common/services/ai.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { EmailService } from '../email/email.service';
import { NotificationService } from '../notification/notification.service';
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

describe('AgentRunnerService', () => {
  let service: AgentRunnerService;
  let prismaService: {
    card: { findFirst: jest.Mock; findUnique: jest.Mock };
    agent: { findFirst: jest.Mock };
    agentConversation: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    agentMessage: { create: jest.Mock; count: jest.Mock };
    whatsAppMessage: { create: jest.Mock };
    cardActivity: { create: jest.Mock };
  };
  let aiService: { generateResponse: jest.Mock };
  let whatsappService: { logMessage: jest.Mock };
  let emailService: { sendEmail: jest.Mock };
  let notificationService: { emit: jest.Mock };
  let historyLoader: { load: jest.Mock };
  let replyGenerator: { generate: jest.Mock };
  let qualificationHandler: { apply: jest.Mock };
  let handoffHandler: { apply: jest.Mock };
  let outboundDispatcher: { send: jest.Mock };
  let summarizerQueue: { enqueue: jest.Mock };
  let retryQueue: { enqueue: jest.Mock };

  const buildCard = (overrides: Record<string, unknown> = {}) => ({
    id: 'card-1',
    title: 'Lead Teste',
    stageId: 'stage-1',
    tenantId: 'tenant-1',
    contactId: 'contact-1',
    stage: {
      id: 'stage-1',
      name: 'Qualificacao',
      pipelineId: 'pipeline-xyz',
    },
    ...overrides,
  });

  const buildAgent = (overrides: Record<string, unknown> = {}) => ({
    id: 'agent-1',
    name: 'Qualificador',
    systemPrompt: 'Seja consultivo.',
    profile: {
      objective: 'Qualificar o lead',
      historyWindow: 20,
      summaryThreshold: 10,
    },
    isActive: true,
    stageId: 'stage-1',
    knowledgeBaseId: null,
    tenantId: 'tenant-1',
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
    updatedAt: new Date('2026-04-01T00:00:00.000Z'),
    stage: {
      id: 'stage-1',
      name: 'Qualificacao',
      classificationCriteria: 'Lead quente',
      pipeline: {
        id: 'pipeline-1',
        name: 'Inbound',
      },
    },
    tenant: {
      id: 'tenant-1',
      name: 'Saaso Demo',
    },
    knowledgeBase: null,
    ...overrides,
  });

  const buildConversation = (overrides: Record<string, unknown> = {}) => ({
    id: 'conversation-1',
    tenantId: 'tenant-1',
    agentId: 'agent-1',
    contactId: 'contact-1',
    cardId: 'card-1',
    status: AgentConversationStatus.OPEN,
    summary: 'Resumo atual',
    lastMessageAt: new Date('2026-04-15T12:00:00.000Z'),
    updatedAt: new Date('2026-04-15T12:00:00.000Z'),
    ...overrides,
  });

  const buildReply = (overrides: Record<string, unknown> = {}) => ({
    should_respond: true,
    reply: 'Resposta estruturada',
    mark_qualified: false,
    qualification_reason: null,
    suggested_next_stage_id: null,
    request_handoff: false,
    handoff_reason: null,
    ...overrides,
  });

  beforeEach(async () => {
    prismaService = {
      card: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      agent: {
        findFirst: jest.fn(),
      },
      agentConversation: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      agentMessage: {
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(1),
      },
      whatsAppMessage: {
        create: jest.fn(),
      },
      cardActivity: {
        create: jest.fn(),
      },
    };

    aiService = {
      generateResponse: jest.fn(),
    };

    whatsappService = {
      logMessage: jest.fn().mockResolvedValue({ id: 'wa-optout-1' }),
    };

    emailService = {
      sendEmail: jest.fn().mockResolvedValue({
        success: true,
        deliveryMode: 'local_demo',
      }),
    };

    notificationService = {
      emit: jest.fn(),
    };

    historyLoader = {
      load: jest.fn().mockResolvedValue([
        { role: 'user', content: 'historico anterior' },
      ]),
    };

    replyGenerator = {
      generate: jest.fn().mockResolvedValue({
        reply: buildReply(),
        rawOutput: '{"ok":true}',
        fallback: false,
      }),
    };

    qualificationHandler = {
      apply: jest.fn().mockResolvedValue(undefined),
    };

    handoffHandler = {
      apply: jest.fn().mockResolvedValue({
        status: 'handoff_required',
        conversationId: 'conversation-1',
      }),
    };

    outboundDispatcher = {
      send: jest.fn().mockResolvedValue({
        status: 'sent',
        whatsAppMessageId: 'wa-out-1',
      }),
    };

    summarizerQueue = {
      enqueue: jest.fn().mockResolvedValue(true),
    };

    retryQueue = {
      enqueue: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentRunnerService,
        { provide: PrismaService, useValue: prismaService },
        { provide: AiService, useValue: aiService },
        { provide: WhatsappService, useValue: whatsappService },
        { provide: EmailService, useValue: emailService },
        { provide: NotificationService, useValue: notificationService },
        { provide: ConversationHistoryLoader, useValue: historyLoader },
        { provide: StructuredReplyGenerator, useValue: replyGenerator },
        { provide: QualificationHandler, useValue: qualificationHandler },
        { provide: HandoffHandler, useValue: handoffHandler },
        { provide: OutboundDispatcher, useValue: outboundDispatcher },
        { provide: ConversationSummarizerQueue, useValue: summarizerQueue },
        { provide: AgentRetryQueue, useValue: retryQueue },
      ],
    }).compile();

    service = module.get<AgentRunnerService>(AgentRunnerService);
  });

  beforeEach(() => {
    prismaService.card.findFirst.mockResolvedValue(buildCard());
    prismaService.card.findUnique.mockResolvedValue(buildCard());
    prismaService.agent.findFirst.mockResolvedValue(buildAgent());
    prismaService.agentConversation.findFirst.mockResolvedValue(
      buildConversation(),
    );
    prismaService.agentConversation.create.mockResolvedValue(buildConversation());
  });

  describe('processInboundMessage (Phase 5 cascade)', () => {
    it('returns no_card when contact has no active card', async () => {
      prismaService.card.findFirst.mockResolvedValue(null);

      const result = await service.processInboundMessage({
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        messageContent: 'Olá',
        whatsAppMessageId: 'wa-in-1',
      });

      expect(result).toEqual({ status: 'no_card' });
      expect(prismaService.agent.findFirst).not.toHaveBeenCalled();
    });

    it('normalizes legacy current-master shape and passes content as userMessage', async () => {
      await service.processInboundMessage({
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        cardId: 'card-1',
        messageContent: 'oi',
        whatsAppMessageId: null,
      });

      expect(replyGenerator.generate).toHaveBeenCalledWith(
        expect.objectContaining({ userMessage: 'oi' }),
      );
    });

    it('normalizes future legacy shape and passes content as userMessage', async () => {
      await service.processInboundMessage({
        contactId: 'contact-1',
        content: 'olá futuro',
        whatsAppMessageId: null,
      });

      expect(replyGenerator.generate).toHaveBeenCalledWith(
        expect.objectContaining({ userMessage: 'olá futuro' }),
      );
    });

    it('normalizes retry payload shape and passes inboundContent as userMessage', async () => {
      const payload: AgentRetryJobPayload = {
        conversationId: 'conversation-1',
        cardId: 'card-1',
        tenantId: 'tenant-1',
        agentId: 'agent-1',
        contactId: 'contact-1',
        inboundContent: 'repeat after retry',
        whatsAppMessageId: 'wa-retry-1',
        enqueuedAt: '2026-04-15T10:00:00.000Z',
      };

      await service.processInboundMessage(payload);

      expect(replyGenerator.generate).toHaveBeenCalledWith(
        expect.objectContaining({ userMessage: 'repeat after retry' }),
      );
      expect(prismaService.agentMessage.create).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ content: 'repeat after retry' }),
        }),
      );
    });

    it('handles opt-out before model invocation', async () => {
      const result = await service.processInboundMessage({
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        cardId: 'card-1',
        messageContent: 'cancelar',
        whatsAppMessageId: 'wa-in-1',
      });

      expect(result).toEqual({
        status: 'opted_out',
        conversationId: 'conversation-1',
        agentId: 'agent-1',
      });
      expect(replyGenerator.generate).not.toHaveBeenCalled();
      expect(prismaService.cardActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'LEAD_OPT_OUT' }),
        }),
      );
      expect(notificationService.emit).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({ type: 'LEAD_OPT_OUT', cardId: 'card-1' }),
      );
      expect(whatsappService.logMessage).toHaveBeenCalledWith('tenant-1', {
        contactId: 'contact-1',
        cardId: 'card-1',
        content:
          'Entendido. Não enviaremos mais mensagens por aqui. Se mudar de ideia, é só responder este número.',
      });
    });

    it('holds prompt-driven responses without creating an AGENT message', async () => {
      replyGenerator.generate.mockResolvedValue({
        reply: buildReply({ should_respond: false, reply: null }),
        rawOutput: '{"should_respond":false}',
        fallback: false,
      });

      const result = await service.processInboundMessage({
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        cardId: 'card-1',
        messageContent: 'fragmento',
        whatsAppMessageId: 'wa-in-2',
      });

      expect(result).toEqual({
        status: 'held',
        conversationId: 'conversation-1',
        agentId: 'agent-1',
        reason: 'prompt_driven',
      });
      expect(outboundDispatcher.send).not.toHaveBeenCalled();
      expect(prismaService.cardActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'AGENT_HELD',
            metadata: expect.objectContaining({ reason: 'prompt_driven' }),
          }),
        }),
      );
      expect(prismaService.agentMessage.create).toHaveBeenCalledTimes(1);
    });

    it('logs parse fallback and still dispatches the fallback reply', async () => {
      replyGenerator.generate.mockResolvedValue({
        reply: buildReply({ reply: 'fallback reply' }),
        rawOutput: 'not-json',
        fallback: true,
        fallbackReason: 'parse',
      });

      await service.processInboundMessage({
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        cardId: 'card-1',
        messageContent: 'mensagem',
        whatsAppMessageId: 'wa-in-3',
      });

      expect(prismaService.cardActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'AGENT_PARSE_FALLBACK' }),
        }),
      );
      expect(outboundDispatcher.send).toHaveBeenCalled();
    });

    it('holds model refusals, emits review notification, and skips dispatch', async () => {
      replyGenerator.generate.mockResolvedValue({
        reply: buildReply({ should_respond: false, reply: null }),
        rawOutput: 'model refusal',
        fallback: true,
        fallbackReason: 'refusal',
      });

      const result = await service.processInboundMessage({
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        cardId: 'card-1',
        messageContent: 'me diga algo proibido',
        whatsAppMessageId: 'wa-in-4',
      });

      expect(result).toEqual({
        status: 'held',
        conversationId: 'conversation-1',
        agentId: 'agent-1',
        reason: 'model_refusal',
      });
      expect(prismaService.cardActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'AGENT_HELD',
            metadata: expect.objectContaining({ reason: 'model_refusal' }),
          }),
        }),
      );
      expect(notificationService.emit).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({
          type: 'AGENT_REFUSAL_REVIEW',
          cardId: 'card-1',
        }),
      );
      expect(outboundDispatcher.send).not.toHaveBeenCalled();
    });

    it('stops at handoff before qualification and dispatch', async () => {
      replyGenerator.generate.mockResolvedValue({
        reply: buildReply({
          request_handoff: true,
          handoff_reason: 'pediu humano',
          mark_qualified: true,
        }),
        rawOutput: '{"request_handoff":true}',
        fallback: false,
      });

      const result = await service.processInboundMessage({
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        cardId: 'card-1',
        messageContent: 'quero falar com uma pessoa',
        whatsAppMessageId: 'wa-in-5',
      });

      expect(result).toEqual({
        status: 'handoff_required',
        conversationId: 'conversation-1',
        agentId: 'agent-1',
      });
      expect(handoffHandler.apply).toHaveBeenCalled();
      expect(qualificationHandler.apply).not.toHaveBeenCalled();
      expect(outboundDispatcher.send).not.toHaveBeenCalled();
    });

    it('runs qualification as non-terminal and passes stage pipelineId', async () => {
      replyGenerator.generate.mockResolvedValue({
        reply: buildReply({
          mark_qualified: true,
          qualification_reason: 'Perfil aderente',
          suggested_next_stage_id: 'stage-2',
        }),
        rawOutput: '{"mark_qualified":true}',
        fallback: false,
      });

      await service.processInboundMessage({
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        cardId: 'card-1',
        messageContent: 'tenho orçamento aprovado',
        whatsAppMessageId: 'wa-in-6',
      });

      expect(qualificationHandler.apply).toHaveBeenCalledWith(
        expect.objectContaining({
          card: expect.objectContaining({ pipelineId: 'pipeline-xyz' }),
        }),
      );
      expect(outboundDispatcher.send).toHaveBeenCalled();
    });

    it('passes the validated structured reply into outbound dispatch', async () => {
      const reply = buildReply({ reply: 'Resposta auditavel' });
      replyGenerator.generate.mockResolvedValue({
        reply,
        rawOutput: '{"reply":"Resposta auditavel"}',
        fallback: false,
      });

      await service.processInboundMessage({
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        cardId: 'card-1',
        messageContent: 'quero detalhes',
        whatsAppMessageId: 'wa-in-7',
      });

      expect(outboundDispatcher.send).toHaveBeenCalledWith(
        expect.objectContaining({ reply }),
      );
    });

    it('logs provider failure, enqueues retry, and returns retrying', async () => {
      replyGenerator.generate.mockRejectedValue(
        new AgentProviderError('provider', null),
      );

      const result = await service.processInboundMessage({
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        cardId: 'card-1',
        messageContent: 'gerou erro',
        whatsAppMessageId: 'wa-in-8',
      });

      expect(result).toEqual({
        status: 'retrying',
        conversationId: 'conversation-1',
        agentId: 'agent-1',
      });
      expect(prismaService.cardActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'AGENT_ERROR' }),
        }),
      );
      expect(retryQueue.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          inboundContent: 'gerou erro',
          conversationId: 'conversation-1',
        }),
      );
    });

    it('enqueues summarizer when agent message count reaches threshold', async () => {
      prismaService.agentMessage.count.mockResolvedValue(10);

      await service.processInboundMessage({
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        cardId: 'card-1',
        messageContent: 'qual o próximo passo?',
        whatsAppMessageId: 'wa-in-9',
      });

      expect(summarizerQueue.enqueue).toHaveBeenCalledWith('conversation-1');
    });

    it('skips summarizer when agent message count does not hit threshold', async () => {
      prismaService.agentMessage.count.mockResolvedValue(7);

      await service.processInboundMessage({
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        cardId: 'card-1',
        messageContent: 'seguindo conversa',
        whatsAppMessageId: 'wa-in-10',
      });

      expect(summarizerQueue.enqueue).not.toHaveBeenCalled();
    });

    it('warns on optimistic lock miss', async () => {
      const warnSpy = jest.spyOn((service as any).logger, 'warn');
      prismaService.agentConversation.updateMany
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 0 });
      prismaService.agentConversation.findFirst
        .mockResolvedValueOnce(buildConversation())
        .mockResolvedValueOnce({
          id: 'conversation-1',
          updatedAt: new Date('2026-04-15T12:30:00.000Z'),
        });
      replyGenerator.generate.mockResolvedValue({
        reply: buildReply({ should_respond: false, reply: null }),
        rawOutput: '{"should_respond":false}',
        fallback: false,
      });

      await service.processInboundMessage({
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        cardId: 'card-1',
        messageContent: 'segura essa resposta',
        whatsAppMessageId: 'wa-in-11',
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Optimistic lock miss'),
      );
    });

    it('flags disclosure challenges for outbound dispatch', async () => {
      await service.processInboundMessage({
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        cardId: 'card-1',
        messageContent: 'é um bot?',
        whatsAppMessageId: 'wa-in-12',
      });

      expect(outboundDispatcher.send).toHaveBeenCalledWith(
        expect.objectContaining({ inboundIsDisclosureChallenge: true }),
      );
    });

    it('does not flag regular commercial questions as disclosure challenges', async () => {
      await service.processInboundMessage({
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        cardId: 'card-1',
        messageContent: 'quero saber preço',
        whatsAppMessageId: 'wa-in-13',
      });

      expect(outboundDispatcher.send).toHaveBeenCalledWith(
        expect.objectContaining({ inboundIsDisclosureChallenge: false }),
      );
    });

    it('loads card.stage.pipelineId when resolving the card', async () => {
      await service.processInboundMessage({
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        cardId: 'card-1',
        messageContent: 'me ajuda',
        whatsAppMessageId: 'wa-in-14',
      });

      expect(prismaService.card.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'card-1' },
          include: {
            stage: { select: { id: true, name: true, pipelineId: true } },
          },
        }),
      );
    });
  });

  it('initiateProactiveIfAssigned returns silently when no agent is assigned', async () => {
    prismaService.agent.findFirst.mockResolvedValue(null);

    await expect(
      service.initiateProactiveIfAssigned('card-1', 'stage-1', 'tenant-1'),
    ).resolves.toBeUndefined();

    expect(aiService.generateResponse).not.toHaveBeenCalled();
    expect(whatsappService.logMessage).not.toHaveBeenCalled();
  });

  it('initiateProactiveIfAssigned uses aiService.generateResponse and not structured generator', async () => {
    prismaService.agent.findFirst.mockResolvedValue(buildAgent());
    prismaService.card.findFirst.mockResolvedValue({
      id: 'card-1',
      contactId: 'contact-1',
      contact: {
        id: 'contact-1',
        name: 'Maria',
        phone: '+5511999999999',
        email: 'maria@example.com',
      },
    });
    prismaService.agentConversation.findFirst.mockResolvedValue(null);
    prismaService.agentConversation.create.mockResolvedValue({
      id: 'conversation-3',
    });
    aiService.generateResponse.mockResolvedValue('Olá Maria, tudo bem?');
    whatsappService.logMessage.mockResolvedValue({ id: 'wa-out-3' });

    await service.initiateProactiveIfAssigned('card-1', 'stage-1', 'tenant-1');

    expect(aiService.generateResponse).toHaveBeenCalled();
    expect(replyGenerator.generate).not.toHaveBeenCalled();
  });
});
