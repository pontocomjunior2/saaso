import { Test, TestingModule } from '@nestjs/testing';
import { AgentConversationStatus } from '@prisma/client';
import { AgentRunnerService } from './agent-runner.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../common/services/ai.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { EmailService } from '../email/email.service';

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
  let emailService: { sendEmail: jest.Mock };

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

    emailService = {
      sendEmail: jest.fn().mockResolvedValue({ success: true, deliveryMode: 'local_demo' }),
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
        {
          provide: EmailService,
          useValue: emailService,
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
        type: 'AGENT_PROACTIVE_WHATSAPP',
        content: expect.stringContaining('Agente Qualificador enviou WhatsApp proativo'),
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

  it('initiateProactiveIfAssigned sends WhatsApp when contact has phone (regardless of email)', async () => {
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
        name: 'João',
        phone: '+5511988888888',
        email: 'joao@example.com',
      },
    });
    prismaService.agentConversation.findFirst.mockResolvedValue(null);
    aiService.generateResponse.mockResolvedValue('Olá João!');
    whatsappService.logMessage.mockResolvedValue({ id: 'wa-out-1' });
    prismaService.agentConversation.create.mockResolvedValue({ id: 'conv-1' });

    await service.initiateProactiveIfAssigned('card-1', 'stage-1', 'tenant-1');

    expect(whatsappService.logMessage).toHaveBeenCalled();
    expect(emailService.sendEmail).not.toHaveBeenCalled();
    const activityCall = prismaService.cardActivity.create.mock.calls[0][0];
    expect(activityCall.data.type).toBe('AGENT_PROACTIVE_WHATSAPP');
  });

  it('initiateProactiveIfAssigned logs activity when WhatsApp fails and contact has no fallback email', async () => {
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
        name: 'João',
        phone: '+5511988888888',
        email: null,
      },
    });
    prismaService.agentConversation.findFirst.mockResolvedValue(null);
    aiService.generateResponse.mockResolvedValue('Olá João!');
    whatsappService.logMessage.mockRejectedValue(new Error('gateway offline'));
    prismaService.agentConversation.create.mockResolvedValue({ id: 'conv-1' });

    await service.initiateProactiveIfAssigned('card-1', 'stage-1', 'tenant-1');

    expect(emailService.sendEmail).not.toHaveBeenCalled();
    const activityCall = prismaService.cardActivity.create.mock.calls[0][0];
    expect(activityCall.data.type).toBe('AGENT_PROACTIVE_LOGGED');
    expect(activityCall.data.content).toContain('WhatsApp falhou');
  });

  it('initiateProactiveIfAssigned sends email when contact has email but no phone', async () => {
    prismaService.agent.findFirst.mockResolvedValue({
      id: 'agent-2',
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
      id: 'card-2',
      contactId: 'contact-2',
      contact: {
        id: 'contact-2',
        name: 'Ana',
        phone: null,
        email: 'ana@example.com',
      },
    });
    prismaService.agentConversation.findFirst.mockResolvedValue(null);
    aiService.generateResponse.mockResolvedValue('Olá Ana!');
    prismaService.agentConversation.create.mockResolvedValue({ id: 'conv-2' });

    await service.initiateProactiveIfAssigned('card-2', 'stage-1', 'tenant-1');

    expect(whatsappService.logMessage).not.toHaveBeenCalled();
    expect(emailService.sendEmail).toHaveBeenCalledWith({
      to: 'ana@example.com',
      subject: 'Olá, Ana! Bem-vindo(a)!',
      body: 'Olá Ana!',
      html: expect.stringContaining('Olá, Ana'),
    });
    const activityCall = prismaService.cardActivity.create.mock.calls[0][0];
    expect(activityCall.data.type).toBe('AGENT_PROACTIVE_EMAIL');
  });

  it('initiateProactiveIfAssigned logs CardActivity when contact has neither phone nor email', async () => {
    prismaService.agent.findFirst.mockResolvedValue({
      id: 'agent-3',
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
      id: 'card-3',
      contactId: 'contact-3',
      contact: {
        id: 'contact-3',
        name: 'Sem Canal',
        phone: null,
        email: null,
      },
    });
    prismaService.agentConversation.findFirst.mockResolvedValue(null);
    aiService.generateResponse.mockResolvedValue('Saudação sem canal.');
    prismaService.agentConversation.create.mockResolvedValue({ id: 'conv-3' });

    await service.initiateProactiveIfAssigned('card-3', 'stage-1', 'tenant-1');

    expect(whatsappService.logMessage).not.toHaveBeenCalled();
    expect(emailService.sendEmail).not.toHaveBeenCalled();
    const activityCall = prismaService.cardActivity.create.mock.calls[0][0];
    expect(activityCall.data.type).toBe('AGENT_PROACTIVE_LOGGED');
    expect(activityCall.data.content).toContain('sem canal de envio');
  });

  it('initiateProactiveIfAssigned creates AgentConversation with status OPEN in all paths', async () => {
    // WhatsApp path
    prismaService.agent.findFirst.mockResolvedValue({
      id: 'agent-1',
      name: 'Agent',
      systemPrompt: 'Test',
      profile: {},
      isActive: true,
      stageId: 'stage-1',
      knowledgeBaseId: null,
      tenantId: 'tenant-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      stage: {
        id: 'stage-1',
        name: 'Entrada',
        classificationCriteria: null,
        pipeline: { id: 'pipeline-1', name: 'Inbound' },
      },
      tenant: { id: 'tenant-1', name: 'Demo' },
      knowledgeBase: null,
    });

    // WhatsApp path test
    prismaService.card.findFirst.mockResolvedValue({
      id: 'card-wa',
      contactId: 'c1',
      contact: { id: 'c1', name: 'A', phone: '123', email: null },
    });
    prismaService.agentConversation.findFirst.mockResolvedValue(null);
    aiService.generateResponse.mockResolvedValue('Hello');
    whatsappService.logMessage.mockResolvedValue({ id: 'wa-1' });
    prismaService.agentConversation.create.mockResolvedValue({ id: 'conv-wa' });

    await service.initiateProactiveIfAssigned('card-wa', 'stage-1', 'tenant-1');

    expect(prismaService.agentConversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: AgentConversationStatus.OPEN }),
      }),
    );

    // Email path test (clear previous calls)
    prismaService.agentConversation.create.mockClear();
    prismaService.cardActivity.create.mockClear();
    whatsappService.logMessage.mockClear();
    prismaService.card.findFirst.mockResolvedValue({
      id: 'card-em',
      contactId: 'c2',
      contact: { id: 'c2', name: 'B', phone: null, email: 'b@test.com' },
    });
    prismaService.agentConversation.create.mockResolvedValue({ id: 'conv-em' });

    await service.initiateProactiveIfAssigned('card-em', 'stage-1', 'tenant-1');

    expect(prismaService.agentConversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: AgentConversationStatus.OPEN }),
      }),
    );

    // Logged path test
    prismaService.agentConversation.create.mockClear();
    prismaService.cardActivity.create.mockClear();
    prismaService.card.findFirst.mockResolvedValue({
      id: 'card-log',
      contactId: 'c3',
      contact: { id: 'c3', name: 'C', phone: null, email: null },
    });
    prismaService.agentConversation.create.mockResolvedValue({ id: 'conv-log' });

    await service.initiateProactiveIfAssigned('card-log', 'stage-1', 'tenant-1');

    expect(prismaService.agentConversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: AgentConversationStatus.OPEN }),
      }),
    );
  });
});
