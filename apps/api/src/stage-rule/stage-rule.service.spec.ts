import { Test, TestingModule } from '@nestjs/testing';
import { StageRuleService } from './stage-rule.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantService } from '../tenant/tenant.service';
import { StageRuleQueueService } from './stage-rule-queue.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockPrisma = Record<string, any>;

const buildMockPrisma = (): MockPrisma => {
  const m: MockPrisma = {
    stageRule: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    stage: {
      findFirst: jest.fn(),
    },
    stageRuleRun: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    stageRuleRunStep: {
      create: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
    },
    stageRuleStep: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
    cardActivity: {
      create: jest.fn(),
    },
    $transaction: jest.fn((callback: (tx: MockPrisma) => Promise<unknown>) => callback(m)),
  };
  return m;
};

let mockPrisma: MockPrisma;

const mockQueueService = {
  enqueueRuleStep: jest.fn(),
  removeJob: jest.fn(),
};

const mockTenantService = {
  getFeatureFlags: jest.fn(),
};

describe('StageRuleService', () => {
  let service: StageRuleService;

  beforeEach(async () => {
    mockPrisma = buildMockPrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StageRuleService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StageRuleQueueService, useValue: mockQueueService },
        { provide: TenantService, useValue: mockTenantService },
      ],
    }).compile();

    service = module.get<StageRuleService>(StageRuleService);
    jest.clearAllMocks();
    // Re-wire mocks after clearAllMocks (buildMockPrisma creates fresh fns each time)
    mockPrisma = buildMockPrisma();
    // Rebuild service with fresh mocks
    const freshModule: TestingModule = await Test.createTestingModule({
      providers: [
        StageRuleService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StageRuleQueueService, useValue: mockQueueService },
        { provide: TenantService, useValue: mockTenantService },
      ],
    }).compile();
    service = freshModule.get<StageRuleService>(StageRuleService);
  });

  it('startRuleRun returns null when no rule exists for stage', async () => {
    mockPrisma.stageRule.findFirst.mockResolvedValue(null);

    const result = await service.startRuleRun('card-1', 'stage-1', 'tenant-1', 'MANUAL');

    expect(result).toBeNull();
    expect(mockPrisma.stageRuleRun.create).not.toHaveBeenCalled();
  });

  it('startRuleRun creates run + steps with scheduledFor respecting business hours', async () => {
    const rule = {
      id: 'rule-1',
      isActive: true,
      steps: [
        { id: 'step-1', order: 0, dayOffset: 0, channel: 'WHATSAPP', messageTemplateId: 'tmpl-1' },
        { id: 'step-2', order: 1, dayOffset: 3, channel: 'WHATSAPP', messageTemplateId: 'tmpl-2' },
      ],
    };
    const run = { id: 'run-1', status: 'RUNNING' };
    const runStep1 = { id: 'runstep-1', scheduledFor: new Date() };
    const runStep2 = { id: 'runstep-2', scheduledFor: new Date() };

    mockPrisma.stageRule.findFirst.mockResolvedValue(rule);
    mockTenantService.getFeatureFlags.mockResolvedValue({ businessHours: null });
    mockPrisma.stageRuleRun.create.mockResolvedValue(run);
    mockPrisma.stageRuleRunStep.create
      .mockResolvedValueOnce(runStep1)
      .mockResolvedValueOnce(runStep2);
    mockQueueService.enqueueRuleStep.mockResolvedValue(true);

    const result = await service.startRuleRun('card-1', 'stage-1', 'tenant-1', 'MANUAL');

    expect(result).toEqual(run);
    expect(mockPrisma.stageRuleRun.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.stageRuleRunStep.create).toHaveBeenCalledTimes(2);
    expect(mockQueueService.enqueueRuleStep).toHaveBeenCalledTimes(2);
    expect(mockQueueService.enqueueRuleStep).toHaveBeenCalledWith('runstep-1', expect.any(Date));
    expect(mockQueueService.enqueueRuleStep).toHaveBeenCalledWith('runstep-2', expect.any(Date));
  });

  it('pauseRun sets status=PAUSED and calls queue.removeJob for pending steps', async () => {
    const run = { id: 'run-1', status: 'RUNNING', tenantId: 'tenant-1' };
    const pendingSteps = [
      { id: 'runstep-1', status: 'PENDING' },
      { id: 'runstep-2', status: 'PENDING' },
    ];

    mockPrisma.stageRuleRun.findFirst.mockResolvedValue(run);
    mockPrisma.stageRuleRunStep.findMany.mockResolvedValue(pendingSteps);
    mockPrisma.stageRuleRun.update.mockResolvedValue({ ...run, status: 'PAUSED' });
    mockQueueService.removeJob.mockResolvedValue(true);

    await service.pauseRun('run-1', 'tenant-1');

    expect(mockPrisma.stageRuleRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'run-1' },
        data: expect.objectContaining({ status: 'PAUSED' }),
      }),
    );
    expect(mockQueueService.removeJob).toHaveBeenCalledTimes(2);
    expect(mockQueueService.removeJob).toHaveBeenCalledWith('runstep-1');
    expect(mockQueueService.removeJob).toHaveBeenCalledWith('runstep-2');
  });

  it('resumeRun recomputes scheduledFor and re-enqueues steps', async () => {
    const run = {
      id: 'run-1',
      status: 'PAUSED',
      tenantId: 'tenant-1',
    };
    const pendingSteps = [
      {
        id: 'runstep-1',
        status: 'PENDING',
        ruleStep: { dayOffset: 1 },
        scheduledFor: new Date(),
      },
    ];

    mockPrisma.stageRuleRun.findFirst.mockResolvedValue(run);
    mockTenantService.getFeatureFlags.mockResolvedValue({ businessHours: null });
    mockPrisma.stageRuleRunStep.findMany.mockResolvedValue(pendingSteps);
    mockPrisma.stageRuleRunStep.update.mockResolvedValue({ id: 'runstep-1', scheduledFor: new Date() });
    mockPrisma.stageRuleRun.update.mockResolvedValue({ ...run, status: 'RUNNING' });
    mockQueueService.enqueueRuleStep.mockResolvedValue(true);

    await service.resumeRun('run-1', 'tenant-1');

    expect(mockPrisma.stageRuleRunStep.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'runstep-1' },
        data: expect.objectContaining({ scheduledFor: expect.any(Date) }),
      }),
    );
    expect(mockQueueService.enqueueRuleStep).toHaveBeenCalledTimes(1);
    expect(mockPrisma.stageRuleRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'run-1' },
        data: expect.objectContaining({ status: 'RUNNING' }),
      }),
    );
  });

  it('cancelRun sets status=CANCELED atomically', async () => {
    const run = { id: 'run-1', status: 'RUNNING', tenantId: 'tenant-1' };
    const pendingSteps = [{ id: 'runstep-1', status: 'PENDING' }];

    mockPrisma.stageRuleRun.findFirst.mockResolvedValue(run);
    mockPrisma.stageRuleRunStep.findMany.mockResolvedValue(pendingSteps);
    mockPrisma.stageRuleRun.update.mockResolvedValue({ ...run, status: 'CANCELED' });
    mockQueueService.removeJob.mockResolvedValue(true);

    await service.cancelRun('run-1', 'tenant-1');

    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(mockPrisma.stageRuleRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'run-1' },
        data: expect.objectContaining({ status: 'CANCELED' }),
      }),
    );
  });

  it('cancelActiveRunsForCard cancels all RUNNING and PAUSED runs for the card', async () => {
    const activeRuns = [
      { id: 'run-1', status: 'RUNNING', tenantId: 'tenant-1' },
      { id: 'run-2', status: 'PAUSED', tenantId: 'tenant-1' },
    ];

    mockPrisma.stageRuleRun.findMany.mockResolvedValue(activeRuns);
    mockPrisma.stageRuleRun.findFirst
      .mockResolvedValueOnce(activeRuns[0])
      .mockResolvedValueOnce(activeRuns[1]);
    mockPrisma.stageRuleRunStep.findMany.mockResolvedValue([]);
    mockPrisma.stageRuleRun.update.mockResolvedValue({});

    await service.cancelActiveRunsForCard('card-1', 'tenant-1');

    expect(mockPrisma.stageRuleRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          cardId: 'card-1',
          tenantId: 'tenant-1',
        }),
      }),
    );
    expect(mockPrisma.stageRuleRun.update).toHaveBeenCalledTimes(2);
  });
});
