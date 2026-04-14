import { Test, TestingModule } from '@nestjs/testing';
import { AgentConversationStatus } from '@prisma/client';
import { AgentRunnerService } from './agent-runner.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../common/services/ai.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';

describe('AgentRunnerService', () => {
  let service: AgentRunnerService;
  let prismaService: {
    card: { findFirst: jest.Mock };
    agent: { findFirst: jest.Mock };
    agentConversation: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    agentMessage: { create: jest.Mock };
    whatsAppMessage: { create: jest.Mock };
    cardActivity: { create: jest.Mock };
  };
  let aiService: { generateResponse: jest.Mock };
  let whatsappService: { logMessage: jest.Mock };

  beforeEach(async () => {
    prismaService = {
      card: {
        findFirst: jest.fn(),
      },
      agent: {
        findFirst: jest.fn(),
      },
      agentConversation: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      agentMessage: {
        create: jest.fn(),
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
      logMessage: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentRunnerService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
        {
          provide: AiService,
          useValue: aiService,
        },
        {
          provide: WhatsappService,
          useValue: whatsappService,
        },
      ],
    }).compile();

    service = module.get<AgentRunnerService>(AgentRunnerService);
  });

  it('returns no_card when contact has no card in pipeline', async () => {
    prismaService.card.findFirst.mockResolvedValue(null);

    const result = await service.processInboundMessage({
      tenantId: 'tenant-1',
      contactId: 'contact-1',
      messageContent: 'Olá',
      whatsAppMessageId: 'wa-1',
    });

    expect(result).toEqual({ status: 'no_card' });
    expect(prismaService.agent.findFirst).not.toHaveBeenCalled();
  });

  it('creates conversation, agent messages and outbound response when an active agent exists', async () => {
    prismaService.card.findFirst.mockResolvedValue({
      id: 'card-1',
      stageId: 'stage-1',
    });
    prismaService.agent.findFirst.mockResolvedValue({
      id: 'agent-1',
      name: 'Qualificador',
      systemPrompt: 'Faça perguntas objetivas.',
      profile: {
        objective: 'Qualificar o lead',
      },
      isActive: true,
      stageId: 'stage-1',
      knowledgeBaseId: null,
      tenantId: 'tenant-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      stage: {
        id: 'stage-1',
        name: 'Qualificação',
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
    });
    prismaService.agentConversation.findFirst.mockResolvedValue(null);
    prismaService.agentConversation.create.mockResolvedValue({
      id: 'conversation-1',
    });
    aiService.generateResponse.mockResolvedValue('Resposta automática');
    prismaService.whatsAppMessage.create.mockResolvedValue({
      id: 'wa-out-1',
      createdAt: new Date('2026-03-16T12:00:00.000Z'),
    });

    const result = await service.processInboundMessage({
      tenantId: 'tenant-1',
      contactId: 'contact-1',
      messageContent: 'Quero entender melhor',
      whatsAppMessageId: 'wa-in-1',
    });

    expect(result.status).toBe('agent_replied');
    expect(aiService.generateResponse).toHaveBeenCalledWith(
      expect.stringContaining('Lead quente'),
      'Quero entender melhor',
      {
        model: undefined,
        temperature: undefined,
        maxTokens: undefined,
      },
    );
    expect(prismaService.agentMessage.create).toHaveBeenCalledTimes(2);
    expect(prismaService.whatsAppMessage.create).toHaveBeenCalledWith({
      data: {
        contactId: 'contact-1',
        content: 'Resposta automática',
        direction: 'OUTBOUND',
        status: 'SENT',
      },
    });
  });

  it('passes model controls from agent profile to ai service', async () => {
    prismaService.card.findFirst.mockResolvedValue({
      id: 'card-1',
      stageId: 'stage-1',
    });
    prismaService.agent.findFirst.mockResolvedValue({
      id: 'agent-2',
      name: 'Closer IA',
      systemPrompt: 'Seja objetivo.',
      profile: {
        objective: 'Avancar o deal',
        model: 'gpt-4.1-mini',
        temperature: 0.6,
        maxTokens: 320,
      },
      isActive: true,
      stageId: 'stage-1',
      knowledgeBaseId: null,
      tenantId: 'tenant-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      stage: {
        id: 'stage-1',
        name: 'Proposta',
        classificationCriteria: null,
        pipeline: {
          id: 'pipeline-1',
          name: 'Outbound',
        },
      },
      tenant: {
        id: 'tenant-1',
        name: 'Saaso Demo',
      },
      knowledgeBase: null,
    });
    prismaService.agentConversation.findFirst.mockResolvedValue({
      id: 'conversation-2',
      status: AgentConversationStatus.OPEN,
    });
    aiService.generateResponse.mockResolvedValue('Resposta parametrizada');
    prismaService.whatsAppMessage.create.mockResolvedValue({
      id: 'wa-out-2',
      createdAt: new Date('2026-03-16T12:10:00.000Z'),
    });

    await service.processInboundMessage({
      tenantId: 'tenant-1',
      contactId: 'contact-1',
      messageContent: 'Pode mandar uma proposta?',
      whatsAppMessageId: 'wa-in-2',
    });

    expect(aiService.generateResponse).toHaveBeenCalledWith(
      expect.any(String),
      'Pode mandar uma proposta?',
      {
        model: 'gpt-4.1-mini',
        temperature: 0.6,
        maxTokens: 320,
      },
    );
  });

  it('initiateProactiveIfAssigned returns silently when no agent is assigned', async () => {
    prismaService.agent.findFirst.mockResolvedValue(null);

    await expect(
      service.initiateProactiveIfAssigned('card-1', 'stage-1', 'tenant-1'),
    ).resolves.toBeUndefined();

    expect(aiService.generateResponse).not.toHaveBeenCalled();
    expect(whatsappService.logMessage).not.toHaveBeenCalled();
  });

  it('initiateProactiveIfAssigned sends message and records conversation + activity when agent exists', async () => {
    prismaService.agent.findFirst.mockResolvedValue({
      id: 'agent-1',
      name: 'Qualificador',
      systemPrompt: 'Seja consultivo.',
      profile: { objective: 'Abrir a conversa' },
      isActive: true,
      stageId: 'stage-1',
      knowledgeBaseId: null,
      tenantId: 'tenant-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      stage: {
        id: 'stage-1',
        name: 'Entrada',
        classificationCriteria: 'Leads Meta',
        pipeline: { id: 'pipeline-1', name: 'Inbound' },
      },
      tenant: { id: 'tenant-1', name: 'Saaso Demo' },
      knowledgeBase: null,
    });
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
    aiService.generateResponse.mockResolvedValue('Olá Maria, tudo bem?');
    whatsappService.logMessage.mockResolvedValue({ id: 'wa-out-3' });
    prismaService.agentConversation.create.mockResolvedValue({
      id: 'conversation-3',
    });

    await service.initiateProactiveIfAssigned('card-1', 'stage-1', 'tenant-1');

    expect(aiService.generateResponse).toHaveBeenCalledWith(
      expect.stringContaining('Leads Meta'),
      expect.stringContaining('Maria'),
      {
        model: undefined,
        temperature: undefined,
        maxTokens: undefined,
      },
    );
    expect(whatsappService.logMessage).toHaveBeenCalledWith('tenant-1', {
      contactId: 'contact-1',
      cardId: 'card-1',
      content: 'Olá Maria, tudo bem?',
    });
    expect(prismaService.agentMessage.create).toHaveBeenCalledWith({
      data: {
        conversationId: 'conversation-3',
        role: 'AGENT',
        content: 'Olá Maria, tudo bem?',
        whatsAppMessageId: 'wa-out-3',
      },
    });
    expect(prismaService.cardActivity.create).toHaveBeenCalledWith({
      data: {
        cardId: 'card-1',
        type: 'AGENT_PROACTIVE',
        content: 'Agente Qualificador iniciou conversa automaticamente (D0).',
      },
    });
  });

  it('toggleTakeover flips OPEN to HANDOFF_REQUIRED and logs manual takeover activity', async () => {
    prismaService.agentConversation.findFirst.mockResolvedValue({
      id: 'conversation-1',
      status: AgentConversationStatus.OPEN,
      cardId: 'card-1',
    });

    const result = await service.toggleTakeover('conversation-1', 'tenant-1');

    expect(result).toEqual({ status: AgentConversationStatus.HANDOFF_REQUIRED });
    expect(prismaService.agentConversation.update).toHaveBeenCalledWith({
      where: { id: 'conversation-1' },
      data: {
        status: AgentConversationStatus.HANDOFF_REQUIRED,
        lastMessageAt: expect.any(Date),
      },
    });
    expect(prismaService.cardActivity.create).toHaveBeenCalledWith({
      data: {
        cardId: 'card-1',
        type: 'AGENT_HANDOFF_MANUAL',
        content: 'SDR assumiu conversa',
        actorId: undefined,
      },
    });
  });

  it('toggleTakeover flips HANDOFF_REQUIRED back to OPEN and logs resumed activity', async () => {
    prismaService.agentConversation.findFirst.mockResolvedValue({
      id: 'conversation-2',
      status: AgentConversationStatus.HANDOFF_REQUIRED,
      cardId: 'card-2',
    });

    const result = await service.toggleTakeover('conversation-2', 'tenant-1');

    expect(result).toEqual({ status: AgentConversationStatus.OPEN });
    expect(prismaService.cardActivity.create).toHaveBeenCalledWith({
      data: {
        cardId: 'card-2',
        type: 'AGENT_RESUMED',
        content: 'Conversa devolvida ao agente',
        actorId: undefined,
      },
    });
  });
});
