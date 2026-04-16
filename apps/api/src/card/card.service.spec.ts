import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CardService } from './card.service';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { EmailService } from '../email/email.service';
import { StageRuleService } from '../stage-rule/stage-rule.service';
import { AgentRunnerService } from '../agent/agent-runner.service';
import { AGENT_ACTIVITY_TYPES } from '../agent/constants/card-activity-types';

describe('CardService', () => {
  let service: CardService;
  let prismaService: any;
  let stageRuleService: {
    startRuleRun: jest.Mock;
    cancelActiveRunsForCard: jest.Mock;
  };
  let agentRunnerService: {
    initiateProactiveIfAssigned: jest.Mock;
  };

  beforeEach(async () => {
    prismaService = {
      stage: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
      },
      agent: {
        findFirst: jest.fn(),
      },
      card: {
        aggregate: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      cardActivity: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      whatsAppMessage: {
        findMany: jest.fn(),
      },
      agentMessage: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    stageRuleService = {
      startRuleRun: jest.fn(),
      cancelActiveRunsForCard: jest.fn(),
    };

    agentRunnerService = {
      initiateProactiveIfAssigned: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CardService,
        { provide: PrismaService, useValue: prismaService },
        { provide: WhatsappService, useValue: { logMessage: jest.fn() } },
        { provide: EmailService, useValue: { sendEmail: jest.fn() } },
        { provide: StageRuleService, useValue: stageRuleService },
        { provide: AgentRunnerService, useValue: agentRunnerService },
      ],
    }).compile();

    service = module.get<CardService>(CardService);
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('create triggers stage rule run after persisting the card', async () => {
    prismaService.stage.findFirst.mockResolvedValue({ id: 'stage-1', name: 'Entrada' });
    prismaService.card.aggregate.mockResolvedValue({ _max: { position: 2 } });
    prismaService.$transaction.mockImplementation(async (callback: any) =>
      callback({
        card: {
          create: jest.fn().mockResolvedValue({
            id: 'card-1',
            stageId: 'stage-1',
          }),
        },
        cardActivity: {
          create: jest.fn().mockResolvedValue({}),
        },
      }),
    );

    const result = await service.create('tenant-1', {
      title: 'Novo lead',
      stageId: 'stage-1',
    });

    expect(result).toEqual({ id: 'card-1', stageId: 'stage-1' });
    expect(stageRuleService.startRuleRun).toHaveBeenCalledWith(
      'card-1',
      'stage-1',
      'tenant-1',
      'CARD_ENTERED',
    );
  });

  it('create triggers proactive agent flow after persisting the card', async () => {
    prismaService.stage.findFirst.mockResolvedValue({ id: 'stage-1', name: 'Entrada' });
    prismaService.card.aggregate.mockResolvedValue({ _max: { position: null } });
    prismaService.$transaction.mockImplementation(async (callback: any) =>
      callback({
        card: {
          create: jest.fn().mockResolvedValue({
            id: 'card-2',
            stageId: 'stage-1',
          }),
        },
        cardActivity: {
          create: jest.fn().mockResolvedValue({}),
        },
      }),
    );

    await service.create('tenant-1', {
      title: 'Lead com agente',
      stageId: 'stage-1',
    });

    expect(agentRunnerService.initiateProactiveIfAssigned).toHaveBeenCalledWith(
      'card-2',
      'stage-1',
      'tenant-1',
    );
  });

  it('create swallows hook failures and still returns the card', async () => {
    prismaService.stage.findFirst.mockResolvedValue({ id: 'stage-1', name: 'Entrada' });
    prismaService.card.aggregate.mockResolvedValue({ _max: { position: null } });
    prismaService.$transaction.mockImplementation(async (callback: any) =>
      callback({
        card: {
          create: jest.fn().mockResolvedValue({
            id: 'card-3',
            stageId: 'stage-1',
          }),
        },
        cardActivity: {
          create: jest.fn().mockResolvedValue({}),
        },
      }),
    );
    stageRuleService.startRuleRun.mockRejectedValue(new Error('queue down'));

    const result = await service.create('tenant-1', {
      title: 'Lead resiliente',
      stageId: 'stage-1',
    });

    expect(result).toEqual({ id: 'card-3', stageId: 'stage-1' });
    expect(agentRunnerService.initiateProactiveIfAssigned).toHaveBeenCalled();
  });

  it('moveCard across stages cancels active runs', async () => {
    prismaService.card.findFirst.mockResolvedValueOnce({
      id: 'card-1',
      tenantId: 'tenant-1',
      stageId: 'stage-1',
      position: 0,
      agentConversations: [],
      sequenceRuns: [],
      stage: { agents: [], pipeline: { id: 'pipe-1', name: 'Pipe' }, messageTemplates: [], id: 'stage-1', name: 'Origem' },
      activities: [],
    });
    prismaService.stage.findFirst.mockResolvedValue({ id: 'stage-2', name: 'Destino' });
    prismaService.$transaction.mockImplementation(async (callback: any) =>
      callback({
        card: {
          updateMany: jest.fn().mockResolvedValue({}),
          update: jest.fn().mockResolvedValue({}),
          findMany: jest.fn().mockResolvedValue([]),
        },
        stage: {
          findUnique: jest.fn().mockResolvedValue({ id: 'stage-1', name: 'Origem' }),
        },
        cardActivity: {
          create: jest.fn().mockResolvedValue({}),
        },
      }),
    );

    await service.moveCard('tenant-1', 'card-1', {
      destinationStageId: 'stage-2',
      destinationIndex: 0,
    });

    expect(stageRuleService.cancelActiveRunsForCard).toHaveBeenCalledWith(
      'card-1',
      'tenant-1',
    );
  });

  it('moveCard across stages starts a new rule run for destination stage', async () => {
    prismaService.card.findFirst.mockResolvedValueOnce({
      id: 'card-1',
      tenantId: 'tenant-1',
      stageId: 'stage-1',
      position: 0,
      agentConversations: [],
      sequenceRuns: [],
      stage: { agents: [], pipeline: { id: 'pipe-1', name: 'Pipe' }, messageTemplates: [], id: 'stage-1', name: 'Origem' },
      activities: [],
    });
    prismaService.stage.findFirst.mockResolvedValue({ id: 'stage-2', name: 'Destino' });
    prismaService.$transaction.mockImplementation(async (callback: any) =>
      callback({
        card: {
          updateMany: jest.fn().mockResolvedValue({}),
          update: jest.fn().mockResolvedValue({}),
          findMany: jest.fn().mockResolvedValue([]),
        },
        stage: {
          findUnique: jest.fn().mockResolvedValue({ id: 'stage-1', name: 'Origem' }),
        },
        cardActivity: {
          create: jest.fn().mockResolvedValue({}),
        },
      }),
    );

    await service.moveCard('tenant-1', 'card-1', {
      destinationStageId: 'stage-2',
      destinationIndex: 0,
    });

    expect(stageRuleService.startRuleRun).toHaveBeenCalledWith(
      'card-1',
      'stage-2',
      'tenant-1',
      'CARD_ENTERED',
    );
  });

  it('moveCard across stages triggers proactive agent flow', async () => {
    prismaService.card.findFirst.mockResolvedValueOnce({
      id: 'card-1',
      tenantId: 'tenant-1',
      stageId: 'stage-1',
      position: 0,
      agentConversations: [],
      sequenceRuns: [],
      stage: { agents: [], pipeline: { id: 'pipe-1', name: 'Pipe' }, messageTemplates: [], id: 'stage-1', name: 'Origem' },
      activities: [],
    });
    prismaService.stage.findFirst.mockResolvedValue({ id: 'stage-2', name: 'Destino' });
    prismaService.$transaction.mockImplementation(async (callback: any) =>
      callback({
        card: {
          updateMany: jest.fn().mockResolvedValue({}),
          update: jest.fn().mockResolvedValue({}),
          findMany: jest.fn().mockResolvedValue([]),
        },
        stage: {
          findUnique: jest.fn().mockResolvedValue({ id: 'stage-1', name: 'Origem' }),
        },
        cardActivity: {
          create: jest.fn().mockResolvedValue({}),
        },
      }),
    );

    await service.moveCard('tenant-1', 'card-1', {
      destinationStageId: 'stage-2',
      destinationIndex: 0,
    });

    expect(agentRunnerService.initiateProactiveIfAssigned).toHaveBeenCalledWith(
      'card-1',
      'stage-2',
      'tenant-1',
    );
  });

  it('moveCard within the same stage does not trigger lifecycle hooks', async () => {
    prismaService.card.findFirst.mockResolvedValueOnce({
      id: 'card-1',
      tenantId: 'tenant-1',
      stageId: 'stage-1',
      position: 0,
      agentConversations: [],
      sequenceRuns: [],
      stage: { agents: [], pipeline: { id: 'pipe-1', name: 'Pipe' }, messageTemplates: [], id: 'stage-1', name: 'Origem' },
      activities: [],
    });
    prismaService.stage.findFirst.mockResolvedValue({ id: 'stage-1', name: 'Origem' });
    prismaService.$transaction.mockImplementation(async (callback: any) =>
      callback({
        card: {
          findMany: jest.fn().mockResolvedValue([{ id: 'card-1' }]),
          update: jest.fn().mockResolvedValue({}),
        },
      }),
    );

    await service.moveCard('tenant-1', 'card-1', {
      destinationStageId: 'stage-1',
      destinationIndex: 0,
    });

    expect(stageRuleService.cancelActiveRunsForCard).not.toHaveBeenCalled();
    expect(stageRuleService.startRuleRun).not.toHaveBeenCalled();
    expect(agentRunnerService.initiateProactiveIfAssigned).not.toHaveBeenCalled();
  });

  it('moveCard swallows hook failures after the transaction commits', async () => {
    prismaService.card.findFirst.mockResolvedValueOnce({
      id: 'card-1',
      tenantId: 'tenant-1',
      stageId: 'stage-1',
      position: 0,
      agentConversations: [],
      sequenceRuns: [],
      stage: { agents: [], pipeline: { id: 'pipe-1', name: 'Pipe' }, messageTemplates: [], id: 'stage-1', name: 'Origem' },
      activities: [],
    });
    prismaService.stage.findFirst.mockResolvedValue({ id: 'stage-2', name: 'Destino' });
    prismaService.$transaction.mockImplementation(async (callback: any) =>
      callback({
        card: {
          updateMany: jest.fn().mockResolvedValue({}),
          update: jest.fn().mockResolvedValue({}),
          findMany: jest.fn().mockResolvedValue([]),
        },
        stage: {
          findUnique: jest.fn().mockResolvedValue({ id: 'stage-1', name: 'Origem' }),
        },
        cardActivity: {
          create: jest.fn().mockResolvedValue({}),
        },
      }),
    );
    stageRuleService.cancelActiveRunsForCard.mockRejectedValue(new Error('cancel failed'));

    await expect(
      service.moveCard('tenant-1', 'card-1', {
        destinationStageId: 'stage-2',
        destinationIndex: 0,
      }),
    ).resolves.toBeUndefined();
  });

  it('agentMove creates an AGENT_MOVED activity with agent name and reason', async () => {
    prismaService.agent.findFirst.mockResolvedValue({ id: 'agent-1', name: 'Bot SDR' });
    prismaService.stage.findFirst.mockResolvedValue({ id: 'stage-2', name: 'Qualificação' });
    prismaService.card.findFirst
      .mockResolvedValueOnce({ id: 'card-1' })
      .mockResolvedValueOnce({
        id: 'card-1',
        tenantId: 'tenant-1',
        stageId: 'stage-1',
        position: 0,
        agentConversations: [],
        sequenceRuns: [],
        stage: { agents: [], pipeline: { id: 'pipe-1', name: 'Pipe' }, messageTemplates: [], id: 'stage-1', name: 'Origem' },
        activities: [],
      });
    prismaService.card.count.mockResolvedValue(3);
    prismaService.$transaction.mockImplementation(async (callback: any) =>
      callback({
        card: {
          updateMany: jest.fn().mockResolvedValue({}),
          update: jest.fn().mockResolvedValue({}),
          findMany: jest.fn().mockResolvedValue([]),
        },
        stage: {
          findUnique: jest.fn().mockResolvedValue({ id: 'stage-1', name: 'Origem' }),
        },
        cardActivity: {
          create: jest.fn().mockResolvedValue({}),
        },
      }),
    );

    await service.agentMove('tenant-1', 'card-1', {
      destinationStageId: 'stage-2',
      reason: 'Lead respondeu positivamente',
      agentId: 'agent-1',
    });

    expect(prismaService.cardActivity.create).toHaveBeenCalledWith({
      data: {
        cardId: 'card-1',
        type: 'AGENT_MOVED',
        content: 'Agente Bot SDR moveu para Qualificação — Lead respondeu positivamente',
      },
    });
  });

  it('agentMove throws when agent does not belong to tenant', async () => {
    prismaService.agent.findFirst.mockResolvedValue(null);
    prismaService.stage.findFirst.mockResolvedValue({ id: 'stage-2', name: 'Qualificação' });
    prismaService.card.findFirst.mockResolvedValue({ id: 'card-1' });

    await expect(
      service.agentMove('tenant-1', 'card-1', {
        destinationStageId: 'stage-2',
        reason: 'Lead respondeu positivamente',
        agentId: 'agent-404',
      }),
    ).rejects.toThrow('Agent not found');
  });

  describe('getCardTimeline', () => {
    it('returns merged items sorted by createdAt DESC when all 3 sources have rows', async () => {
      const before = new Date('2026-04-15T10:00:00.000Z');
      prismaService.card.findUnique.mockResolvedValue({
        id: 'card-1',
        tenantId: 'tenant-1',
      });
      prismaService.whatsAppMessage.findMany.mockResolvedValue([
        { id: 'wa-1', createdAt: new Date('2026-04-15T09:58:00.000Z') },
      ]);
      prismaService.cardActivity.findMany.mockResolvedValue([
        { id: 'act-1', createdAt: new Date('2026-04-15T09:59:00.000Z') },
      ]);
      prismaService.agentMessage.findMany.mockResolvedValue([
        {
          id: 'agent-1',
          createdAt: new Date('2026-04-15T09:57:00.000Z'),
          metadata: { suggested_next_stage_id: 'stage-2' },
        },
      ]);

      const result = await service.getCardTimeline('card-1', 'tenant-1', 100, before);

      expect(result.items.map((item: any) => item.source)).toEqual([
        'activity',
        'whatsapp',
        'agent',
      ]);
      expect(result.nextCursor).toBeNull();
      expect(prismaService.whatsAppMessage.findMany).toHaveBeenCalledWith({
        where: {
          contact: { cards: { some: { id: 'card-1' } } },
          createdAt: { lt: before },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      expect(prismaService.cardActivity.findMany).toHaveBeenCalledWith({
        where: {
          cardId: 'card-1',
          createdAt: { lt: before },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      expect(prismaService.agentMessage.findMany).toHaveBeenCalledWith({
        where: {
          conversation: { cardId: 'card-1', tenantId: 'tenant-1' },
          createdAt: { lt: before },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
    });

    it('throws ForbiddenException when card tenant does not match', async () => {
      prismaService.card.findUnique.mockResolvedValue({
        id: 'card-1',
        tenantId: 'tenant-2',
      });

      await expect(
        service.getCardTimeline('card-1', 'tenant-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prismaService.whatsAppMessage.findMany).not.toHaveBeenCalled();
      expect(prismaService.cardActivity.findMany).not.toHaveBeenCalled();
      expect(prismaService.agentMessage.findMany).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when card does not exist', async () => {
      prismaService.card.findUnique.mockResolvedValue(null);

      await expect(
        service.getCardTimeline('missing-card', 'tenant-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('caps limit at 200 even if caller passes a larger number', async () => {
      prismaService.card.findUnique.mockResolvedValue({
        id: 'card-1',
        tenantId: 'tenant-1',
      });
      prismaService.whatsAppMessage.findMany.mockResolvedValue([]);
      prismaService.cardActivity.findMany.mockResolvedValue([]);
      prismaService.agentMessage.findMany.mockResolvedValue([]);

      await service.getCardTimeline('card-1', 'tenant-1', 10_000);

      expect(prismaService.whatsAppMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 200 }),
      );
      expect(prismaService.cardActivity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 200 }),
      );
      expect(prismaService.agentMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 200 }),
      );
    });

    it('returns nextCursor as the oldest merged createdAt ISO when merged length equals limit', async () => {
      prismaService.card.findUnique.mockResolvedValue({
        id: 'card-1',
        tenantId: 'tenant-1',
      });
      prismaService.whatsAppMessage.findMany.mockResolvedValue([
        { id: 'wa-1', createdAt: new Date('2026-04-15T09:59:00.000Z') },
      ]);
      prismaService.cardActivity.findMany.mockResolvedValue([
        { id: 'act-1', createdAt: new Date('2026-04-15T09:58:00.000Z') },
      ]);
      prismaService.agentMessage.findMany.mockResolvedValue([
        { id: 'agent-1', createdAt: new Date('2026-04-15T09:57:00.000Z') },
      ]);

      const result = await service.getCardTimeline('card-1', 'tenant-1', 2);

      expect(result.items).toHaveLength(2);
      expect(result.nextCursor).toBe('2026-04-15T09:58:00.000Z');
    });

    it('exposes agent message metadata in the payload', async () => {
      prismaService.card.findUnique.mockResolvedValue({
        id: 'card-1',
        tenantId: 'tenant-1',
      });
      prismaService.whatsAppMessage.findMany.mockResolvedValue([]);
      prismaService.cardActivity.findMany.mockResolvedValue([]);
      prismaService.agentMessage.findMany.mockResolvedValue([
        {
          id: 'agent-1',
          createdAt: new Date('2026-04-15T09:57:00.000Z'),
          metadata: {
            mark_qualified: true,
            qualification_reason: 'Lead pediu proposta',
          },
        },
      ]);

      const result = await service.getCardTimeline('card-1', 'tenant-1');

      expect(result.items[0]).toMatchObject({
        source: 'agent',
        data: {
          metadata: {
            mark_qualified: true,
            qualification_reason: 'Lead pediu proposta',
          },
        },
      });
    });

    it('returns an empty timeline when the card has no messages or activities', async () => {
      prismaService.card.findUnique.mockResolvedValue({
        id: 'card-1',
        tenantId: 'tenant-1',
      });
      prismaService.whatsAppMessage.findMany.mockResolvedValue([]);
      prismaService.cardActivity.findMany.mockResolvedValue([]);
      prismaService.agentMessage.findMany.mockResolvedValue([]);

      await expect(
        service.getCardTimeline('card-1', 'tenant-1'),
      ).resolves.toEqual({
        items: [],
        nextCursor: null,
      });
    });

    it('keeps tenantId out of WhatsAppMessage and CardActivity where clauses while keeping it in AgentMessage conversation scope', async () => {
      prismaService.card.findUnique.mockResolvedValue({
        id: 'card-1',
        tenantId: 'tenant-1',
      });
      prismaService.whatsAppMessage.findMany.mockResolvedValue([]);
      prismaService.cardActivity.findMany.mockResolvedValue([]);
      prismaService.agentMessage.findMany.mockResolvedValue([]);

      await service.getCardTimeline('card-1', 'tenant-1');

      expect(prismaService.whatsAppMessage.findMany.mock.calls[0][0].where).toEqual({
        contact: { cards: { some: { id: 'card-1' } } },
      });
      expect(prismaService.cardActivity.findMany.mock.calls[0][0].where).toEqual({
        cardId: 'card-1',
      });
      expect(prismaService.agentMessage.findMany.mock.calls[0][0].where).toEqual({
        conversation: { cardId: 'card-1', tenantId: 'tenant-1' },
      });
    });
  });

  describe('latestAgentSuggestion', () => {
    it('findAll returns latestAgentSuggestion as null when the card has no AGENT_QUALIFIED activity', async () => {
      prismaService.card.findMany.mockResolvedValue([{ id: 'card-1', tenantId: 'tenant-1' }]);
      prismaService.cardActivity.findFirst.mockResolvedValue(null);

      await expect(service.findAll('tenant-1')).resolves.toEqual([
        {
          id: 'card-1',
          tenantId: 'tenant-1',
          latestAgentSuggestion: null,
        },
      ]);
    });

    it('findAll returns a populated latestAgentSuggestion when no later MOVED activity exists', async () => {
      prismaService.card.findMany.mockResolvedValue([{ id: 'card-1', tenantId: 'tenant-1' }]);
      prismaService.cardActivity.findFirst
        .mockResolvedValueOnce({
          id: 'activity-1',
          createdAt: new Date('2026-04-15T10:00:00.000Z'),
          metadata: {
            qualification_reason: 'Lead pediu orçamento',
            suggested_next_stage_id: 'stage-2',
          },
        })
        .mockResolvedValueOnce(null);
      prismaService.stage.findUnique.mockResolvedValue({ name: 'Qualificado' });

      const result = await service.findAll('tenant-1');

      expect(prismaService.cardActivity.findFirst).toHaveBeenNthCalledWith(1, {
        where: {
          cardId: 'card-1',
          type: AGENT_ACTIVITY_TYPES.AGENT_QUALIFIED,
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, createdAt: true, metadata: true },
      });
      expect(prismaService.cardActivity.findFirst).toHaveBeenNthCalledWith(2, {
        where: {
          cardId: 'card-1',
          type: 'MOVED',
          createdAt: { gt: new Date('2026-04-15T10:00:00.000Z') },
        },
        select: { id: true },
      });
      expect(result[0].latestAgentSuggestion).toEqual({
        mark_qualified: true,
        qualification_reason: 'Lead pediu orçamento',
        suggested_next_stage_id: 'stage-2',
        suggested_next_stage_name: 'Qualificado',
        confirmedAt: '2026-04-15T10:00:00.000Z',
      });
    });

    it('findAll nulls latestAgentSuggestion when a later MOVED activity exists', async () => {
      prismaService.card.findMany.mockResolvedValue([{ id: 'card-1', tenantId: 'tenant-1' }]);
      prismaService.cardActivity.findFirst
        .mockResolvedValueOnce({
          id: 'activity-1',
          createdAt: new Date('2026-04-15T10:00:00.000Z'),
          metadata: {},
        })
        .mockResolvedValueOnce({ id: 'move-1' });

      const result = await service.findAll('tenant-1');

      expect(result[0].latestAgentSuggestion).toBeNull();
      expect(prismaService.stage.findUnique).not.toHaveBeenCalled();
    });

    it('findOne returns latestAgentSuggestion with null stage name when suggested stage is missing', async () => {
      prismaService.card.findFirst.mockResolvedValue({
        id: 'card-1',
        tenantId: 'tenant-1',
        stageId: 'stage-1',
        agentConversations: [],
        sequenceRuns: [],
        stage: {
          id: 'stage-1',
          name: 'Origem',
          stageRule: null,
          agents: [],
          pipeline: { id: 'pipe-1', name: 'Pipe' },
          messageTemplates: [],
        },
        activities: [],
      });
      prismaService.cardActivity.findFirst
        .mockResolvedValueOnce({
          id: 'activity-1',
          createdAt: new Date('2026-04-15T10:00:00.000Z'),
          metadata: {
            qualification_reason: 'Pronto para comercial',
            suggested_next_stage_id: 'missing-stage',
          },
        })
        .mockResolvedValueOnce(null);
      prismaService.stage.findUnique.mockResolvedValue(null);

      const result = await service.findOne('tenant-1', 'card-1');

      expect(result.latestAgentSuggestion).toEqual({
        mark_qualified: true,
        qualification_reason: 'Pronto para comercial',
        suggested_next_stage_id: 'missing-stage',
        suggested_next_stage_name: null,
        confirmedAt: '2026-04-15T10:00:00.000Z',
      });
    });

    it('findOne degrades gracefully when qualification metadata is null', async () => {
      prismaService.card.findFirst.mockResolvedValue({
        id: 'card-1',
        tenantId: 'tenant-1',
        stageId: 'stage-1',
        agentConversations: [],
        sequenceRuns: [],
        stage: {
          id: 'stage-1',
          name: 'Origem',
          stageRule: null,
          agents: [],
          pipeline: { id: 'pipe-1', name: 'Pipe' },
          messageTemplates: [],
        },
        activities: [],
      });
      prismaService.cardActivity.findFirst
        .mockResolvedValueOnce({
          id: 'activity-1',
          createdAt: new Date('2026-04-15T10:00:00.000Z'),
          metadata: null,
        })
        .mockResolvedValueOnce(null);

      const result = await service.findOne('tenant-1', 'card-1');

      expect(result.latestAgentSuggestion).toEqual({
        mark_qualified: true,
        qualification_reason: null,
        suggested_next_stage_id: null,
        suggested_next_stage_name: null,
        confirmedAt: '2026-04-15T10:00:00.000Z',
      });
    });
  });
});
