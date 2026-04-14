import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { CardService } from './card.service';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { EmailService } from '../email/email.service';
import { StageRuleService } from '../stage-rule/stage-rule.service';
import { AgentRunnerService } from '../agent/agent-runner.service';

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
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      cardActivity: {
        create: jest.fn(),
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
});
