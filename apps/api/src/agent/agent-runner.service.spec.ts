import { Test, TestingModule } from '@nestjs/testing';
import { AgentRunnerService } from './agent-runner.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../common/services/ai.service';

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
        pipeline: {
          id: 'pipeline-1',
          name: 'Inbound',
        },
      },
      tenant: {
        id: 'tenant-1',
        name: 'Saaso Demo',
      },
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
      expect.any(String),
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
    expect(prismaService.cardActivity.create).toHaveBeenCalledWith({
      data: {
        cardId: 'card-1',
        type: 'AGENT_RESPONSE',
        content: 'Agente Qualificador respondeu automaticamente via WhatsApp.',
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
        pipeline: {
          id: 'pipeline-1',
          name: 'Outbound',
        },
      },
      tenant: {
        id: 'tenant-1',
        name: 'Saaso Demo',
      },
    });
    prismaService.agentConversation.findFirst.mockResolvedValue({
      id: 'conversation-2',
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
});
