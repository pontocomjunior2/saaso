import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common';
import {
  AgentConversationStatus,
  JourneyExecutionJobStatus,
  JourneyExecutionLogLevel,
  JourneyExecutionStatus,
  Prisma,
  type Journey,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJourneyDto } from './dto/create-journey.dto';
import { UpdateJourneyDto } from './dto/update-journey.dto';
import {
  JourneyQueueService,
  type JourneyQueueRuntimeSnapshot,
} from './journey-queue.service';

interface JourneyFlowNodeData {
  label?: string;
  kind?: string;
  eventType?: string;
  actionType?: string;
  message?: string;
  conditionField?: string;
  conditionOperator?: string;
  conditionValue?: string | number | boolean;
  delayInSeconds?: number | string;
  delayInMinutes?: number | string;
  delayInHours?: number | string;
}

interface JourneyFlowEdgeData {
  branch?: string;
}

interface JourneyFlowNode {
  id: string;
  type?: string;
  position?: {
    x?: number;
    y?: number;
  };
  data?: JourneyFlowNodeData;
}

interface JourneyFlowEdge {
  id?: string;
  source: string;
  target: string;
  label?: string;
  data?: JourneyFlowEdgeData;
}

interface JourneyExecutionSummaryResponse {
  id: string;
  triggerSource: string;
  triggerPayload: unknown;
  contactId: string | null;
  cardId: string | null;
  status: JourneyExecutionStatus;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  pendingJobCount: number;
  runningJobCount: number;
  failedJobCount: number;
  nextScheduledAt: Date | null;
}

export interface JourneyExecutionLogResponse {
  id: string;
  level: JourneyExecutionLogLevel;
  nodeId: string | null;
  nodeLabel: string | null;
  message: string;
  details: unknown;
  createdAt: Date;
}

export interface JourneyExecutionJobResponse {
  id: string;
  nodeId: string;
  nodeLabel: string | null;
  nodeKind: string;
  actionType: string | null;
  delayInSeconds: number;
  status: JourneyExecutionJobStatus;
  scheduledFor: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  attempts: number;
  lastError: string | null;
  deadLetteredAt: Date | null;
  deadLetterReason: string | null;
  manuallyRequeuedAt: Date | null;
  manualRequeueCount: number;
  details: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface JourneyExecutionResponse extends JourneyExecutionSummaryResponse {
  logs: JourneyExecutionLogResponse[];
  jobs: JourneyExecutionJobResponse[];
}

export interface JourneyRuntimeProcessResponse {
  processedAt: Date;
  processedJobs: number;
  completedJobs: number;
  failedJobs: number;
  requeuedJobs: number;
  pendingJobs: number;
  nextScheduledAt: Date | null;
}

export interface JourneyRuntimeDeadLetterResponse {
  jobId: string;
  executionId: string;
  journeyId: string;
  journeyName: string;
  nodeId: string;
  nodeLabel: string | null;
  actionType: string | null;
  status: JourneyExecutionJobStatus;
  failedAt: Date | null;
  deadLetteredAt: Date | null;
  deadLetterReason: string | null;
  manualRequeueCount: number;
}

export interface JourneyRuntimeStatusResponse extends JourneyQueueRuntimeSnapshot {
  runtimePollMs: number;
  maxJobAttempts: number;
  retryDelayInSeconds: number;
  pendingJobs: number;
  runningJobs: number;
  failedJobs: number;
  deadLetterJobs: number;
  nextScheduledAt: Date | null;
  recentDeadLetters: JourneyRuntimeDeadLetterResponse[];
}

export interface JourneyManualRequeueResponse {
  requeuedJobs: number;
  execution: JourneyExecutionResponse;
}

export interface JourneySummaryResponse {
  id: string;
  name: string;
  isActive: boolean;
  nodes: JourneyFlowNode[];
  edges: JourneyFlowEdge[];
  createdAt: Date;
  updatedAt: Date;
  executionCount: number;
  lastExecutionAt: Date | null;
  lastExecutionStatus: JourneyExecutionStatus | null;
}

export interface JourneyDetailResponse extends JourneySummaryResponse {
  recentExecutions: JourneyExecutionResponse[];
}

interface TriggerContext {
  triggerSource: string;
  triggerPayload: Record<string, unknown>;
  matchingEventType?: string;
}

interface ExecutionRuntimeContext {
  tenantId: string;
  contactId: string | null;
  cardId: string | null;
  triggerPayload: Record<string, unknown>;
  contactRecord?: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    position: string | null;
    tags: string[];
    company: {
      id: string;
      name: string;
      industry: string | null;
      website: string | null;
    } | null;
  } | null;
  cardRecord?: {
    id: string;
    title: string;
    stageId: string;
    stage: {
      id: string;
      name: string;
      pipeline: {
        id: string;
        name: string;
      };
    };
  } | null;
}

type JobProcessResult = 'COMPLETED' | 'FAILED' | 'REQUEUED' | 'SKIPPED' | null;
type JourneyBranchKey = 'true' | 'false' | 'default';

interface NodeExecutionResult {
  branchKey?: JourneyBranchKey;
}

const journeyListInclude = Prisma.validator<Prisma.JourneyInclude>()({
  _count: {
    select: {
      executions: true,
    },
  },
  executions: {
    take: 1,
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      id: true,
      triggerSource: true,
      triggerPayload: true,
      contactId: true,
      cardId: true,
      status: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  },
});

const journeyExecutionInclude =
  Prisma.validator<Prisma.JourneyExecutionInclude>()({
    logs: {
      orderBy: {
        createdAt: 'asc',
      },
    },
    jobs: {
      orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'asc' }],
    },
  });

const journeyDetailInclude = Prisma.validator<Prisma.JourneyInclude>()({
  _count: {
    select: {
      executions: true,
    },
  },
  executions: {
    take: 8,
    orderBy: {
      createdAt: 'desc',
    },
    include: journeyExecutionInclude,
  },
});

const journeyJobRuntimeInclude =
  Prisma.validator<Prisma.JourneyExecutionJobInclude>()({
    execution: {
      include: {
        journey: true,
      },
    },
  });

type JourneyListRecord = Prisma.JourneyGetPayload<{
  include: typeof journeyListInclude;
}>;

type JourneyDetailRecord = Prisma.JourneyGetPayload<{
  include: typeof journeyDetailInclude;
}>;

type JourneyExecutionRecord = Prisma.JourneyExecutionGetPayload<{
  include: typeof journeyExecutionInclude;
}>;

type JourneyExecutionJobRuntimeRecord = Prisma.JourneyExecutionJobGetPayload<{
  include: typeof journeyJobRuntimeInclude;
}>;

@Injectable()
export class JourneyService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JourneyService.name);
  private runtimeInterval: ReturnType<typeof setInterval> | null = null;
  private pollingTickRunning = false;
  private readonly runtimePollMs = this.parsePositiveInteger(
    process.env.JOURNEY_RUNTIME_POLL_MS,
    5000,
  );
  private readonly maxJobAttempts = Math.max(
    1,
    this.parsePositiveInteger(process.env.JOURNEY_RUNTIME_MAX_ATTEMPTS, 2),
  );
  private readonly retryDelayInSeconds = Math.max(
    5,
    this.parsePositiveInteger(
      process.env.JOURNEY_RUNTIME_RETRY_DELAY_SECONDS,
      30,
    ),
  );

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => JourneyQueueService))
    private readonly journeyQueueService: JourneyQueueService,
  ) {}

  public onModuleInit(): void {
    if (process.env.NODE_ENV === 'test' || this.runtimePollMs <= 0) {
      return;
    }

    this.runtimeInterval = setInterval(() => {
      void this.runPollingTick();
    }, this.runtimePollMs);
  }

  public onModuleDestroy(): void {
    if (this.runtimeInterval) {
      clearInterval(this.runtimeInterval);
      this.runtimeInterval = null;
    }
  }

  public async create(
    tenantId: string,
    dto: CreateJourneyDto,
  ): Promise<JourneyDetailResponse> {
    const nodesJson = Array.isArray(dto.nodes) ? dto.nodes : [];
    const edgesJson = Array.isArray(dto.edges) ? dto.edges : [];

    const journey = await this.prisma.journey.create({
      data: {
        name: dto.name,
        isActive: dto.isActive ?? false,
        nodes: this.toJsonValue(nodesJson) ?? [],
        edges: this.toJsonValue(edgesJson) ?? [],
        tenantId,
      },
    });

    return this.findOne(tenantId, journey.id);
  }

  public async findAll(tenantId: string): Promise<JourneySummaryResponse[]> {
    const journeys = await this.prisma.journey.findMany({
      where: { tenantId },
      include: journeyListInclude,
      orderBy: { createdAt: 'desc' },
    });

    return journeys.map((journey) => this.mapJourneySummary(journey));
  }

  public async findOne(
    tenantId: string,
    id: string,
  ): Promise<JourneyDetailResponse> {
    const journey = await this.findJourneyDetail(tenantId, id);
    return this.mapJourneyDetail(journey);
  }

  public async update(
    tenantId: string,
    id: string,
    dto: UpdateJourneyDto,
  ): Promise<JourneyDetailResponse> {
    await this.findJourneyEntity(tenantId, id);

    const updateData: Prisma.JourneyUpdateInput = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.nodes !== undefined) {
      updateData.nodes = this.toJsonValue(
        Array.isArray(dto.nodes) ? dto.nodes : [],
      );
    }
    if (dto.edges !== undefined) {
      updateData.edges = this.toJsonValue(
        Array.isArray(dto.edges) ? dto.edges : [],
      );
    }

    await this.prisma.journey.update({
      where: { id },
      data: updateData,
    });

    return this.findOne(tenantId, id);
  }

  public async remove(tenantId: string, id: string): Promise<Journey> {
    await this.findJourneyEntity(tenantId, id);

    return this.prisma.journey.delete({
      where: { id },
    });
  }

  public async triggerJourney(
    tenantId: string,
    journeyId: string,
    payload: Record<string, unknown>,
  ): Promise<JourneyExecutionResponse> {
    const journey = await this.findJourneyEntity(tenantId, journeyId);
    if (!journey.isActive) {
      throw new NotFoundException('Erro no Backend: A jornada nao esta ativa.');
    }

    return this.executeJourney(journey, {
      triggerSource: 'manual_trigger',
      triggerPayload: payload,
      matchingEventType: 'manual_trigger',
    });
  }

  public async triggerJourneysForEvent(
    tenantId: string,
    eventType: 'lead_form_submitted' | 'whatsapp_inbound_received',
    payload: Record<string, unknown>,
  ): Promise<JourneyExecutionResponse[]> {
    const journeys = await this.prisma.journey.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const matchingJourneys = journeys.filter((journey) =>
      this.hasMatchingTrigger(journey, eventType),
    );
    const executions: JourneyExecutionResponse[] = [];

    for (const journey of matchingJourneys) {
      const execution = await this.executeJourney(journey, {
        triggerSource: eventType,
        triggerPayload: payload,
        matchingEventType: eventType,
      });
      executions.push(execution);
    }

    return executions;
  }

  public async processDueJobs(
    tenantId?: string,
  ): Promise<JourneyRuntimeProcessResponse> {
    return this.drainDueJobs({ tenantId });
  }

  public async getRuntimeStatus(
    tenantId?: string,
  ): Promise<JourneyRuntimeStatusResponse> {
    const [
      pendingJobs,
      runningJobs,
      failedJobs,
      nextPendingJob,
      recentDeadLetterJobs,
    ] = await Promise.all([
      this.prisma.journeyExecutionJob.count({
        where: {
          status: JourneyExecutionJobStatus.PENDING,
          ...(tenantId ? { tenantId } : {}),
        },
      }),
      this.prisma.journeyExecutionJob.count({
        where: {
          status: JourneyExecutionJobStatus.RUNNING,
          ...(tenantId ? { tenantId } : {}),
        },
      }),
      this.prisma.journeyExecutionJob.count({
        where: {
          status: JourneyExecutionJobStatus.FAILED,
          ...(tenantId ? { tenantId } : {}),
        },
      }),
      this.prisma.journeyExecutionJob.findFirst({
        where: {
          status: JourneyExecutionJobStatus.PENDING,
          ...(tenantId ? { tenantId } : {}),
        },
        orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'asc' }],
        select: {
          scheduledFor: true,
        },
      }),
      this.prisma.journeyExecutionJob.findMany({
        where: {
          status: JourneyExecutionJobStatus.FAILED,
          ...(tenantId ? { tenantId } : {}),
        },
        include: {
          execution: {
            select: {
              id: true,
              journey: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        take: 5,
      }),
    ]);

    return {
      ...this.journeyQueueService.getRuntimeSnapshot(),
      runtimePollMs: this.runtimePollMs,
      maxJobAttempts: this.maxJobAttempts,
      retryDelayInSeconds: this.retryDelayInSeconds,
      pendingJobs,
      runningJobs,
      failedJobs,
      deadLetterJobs: failedJobs,
      nextScheduledAt: nextPendingJob?.scheduledFor ?? null,
      recentDeadLetters: recentDeadLetterJobs.map((job) => {
        const details = this.asRecord(job.details);

        return {
          jobId: job.id,
          executionId: job.executionId,
          journeyId: job.execution.journey.id,
          journeyName: job.execution.journey.name,
          nodeId: job.nodeId,
          nodeLabel: job.nodeLabel,
          actionType: job.actionType,
          status: job.status,
          failedAt: job.completedAt,
          deadLetteredAt: this.pickOptionalDate(details.deadLetteredAt),
          deadLetterReason:
            this.pickOptionalString(details.deadLetterReason) ?? job.lastError,
          manualRequeueCount: this.pickNumber(details.manualRequeueCount),
        };
      }),
    };
  }

  public async processQueuedJobById(jobId: string): Promise<JobProcessResult> {
    const job = await this.prisma.journeyExecutionJob.findUnique({
      where: { id: jobId },
      include: journeyJobRuntimeInclude,
    });

    if (!job) {
      return null;
    }

    return this.processJob(job);
  }

  public async requeueFailedExecutionJobs(
    tenantId: string,
    executionId: string,
  ): Promise<JourneyManualRequeueResponse> {
    const execution = await this.findExecutionRecord(executionId);

    if (execution.tenantId !== tenantId) {
      throw new NotFoundException(
        `Erro no Backend: Execucao de jornada '${executionId}' nao encontrada neste tenant.`,
      );
    }

    const failedJobs = await this.prisma.journeyExecutionJob.findMany({
      where: {
        executionId,
        tenantId,
        status: JourneyExecutionJobStatus.FAILED,
      },
      include: journeyJobRuntimeInclude,
      orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'asc' }],
    });

    if (failedJobs.length === 0) {
      return {
        requeuedJobs: 0,
        execution: this.mapExecution(execution),
      };
    }

    for (const job of failedJobs) {
      await this.requeueFailedJobInternal(job);
    }

    const refreshedExecution = await this.findExecutionRecord(executionId);
    return {
      requeuedJobs: failedJobs.length,
      execution: this.mapExecution(refreshedExecution),
    };
  }

  public async requeueFailedJob(
    tenantId: string,
    jobId: string,
  ): Promise<JourneyManualRequeueResponse> {
    const job = await this.prisma.journeyExecutionJob.findUnique({
      where: { id: jobId },
      include: journeyJobRuntimeInclude,
    });

    if (!job || job.tenantId !== tenantId) {
      throw new NotFoundException(
        `Erro no Backend: Job de jornada '${jobId}' nao encontrado neste tenant.`,
      );
    }

    if (job.status !== JourneyExecutionJobStatus.FAILED) {
      const execution = await this.findExecutionRecord(job.executionId);
      return {
        requeuedJobs: 0,
        execution: this.mapExecution(execution),
      };
    }

    await this.requeueFailedJobInternal(job);

    const refreshedExecution = await this.findExecutionRecord(job.executionId);
    return {
      requeuedJobs: 1,
      execution: this.mapExecution(refreshedExecution),
    };
  }

  private async runPollingTick(): Promise<void> {
    if (this.pollingTickRunning) {
      return;
    }

    this.pollingTickRunning = true;
    try {
      const summary = await this.processDueJobs();
      if (
        summary.processedJobs > 0 ||
        summary.failedJobs > 0 ||
        summary.requeuedJobs > 0
      ) {
        this.logger.log(
          `Journey runtime processou ${summary.processedJobs} job(s), concluiu ${summary.completedJobs}, reencolou ${summary.requeuedJobs} e falhou ${summary.failedJobs}.`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Falha ao processar jobs pendentes de journeys.',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.pollingTickRunning = false;
    }
  }

  private async findJourneyEntity(
    tenantId: string,
    id: string,
  ): Promise<Journey> {
    const journey = await this.prisma.journey.findFirst({
      where: { id, tenantId },
    });

    if (!journey) {
      throw new NotFoundException(
        `Erro no Backend: Journey com ID '${id}' nao encontrada neste tenant.`,
      );
    }

    return journey;
  }

  private async findJourneyDetail(
    tenantId: string,
    id: string,
  ): Promise<JourneyDetailRecord> {
    const journey = await this.prisma.journey.findFirst({
      where: { id, tenantId },
      include: journeyDetailInclude,
    });

    if (!journey) {
      throw new NotFoundException(
        `Erro no Backend: Journey com ID '${id}' nao encontrada neste tenant.`,
      );
    }

    return journey;
  }

  private async findExecutionRecord(
    executionId: string,
  ): Promise<JourneyExecutionRecord> {
    const execution = await this.prisma.journeyExecution.findUnique({
      where: { id: executionId },
      include: journeyExecutionInclude,
    });

    if (!execution) {
      throw new NotFoundException(
        `Erro no Backend: Execucao de jornada '${executionId}' nao encontrada.`,
      );
    }

    return execution;
  }

  private async executeJourney(
    journey: Journey,
    trigger: TriggerContext,
  ): Promise<JourneyExecutionResponse> {
    const execution = await this.prisma.journeyExecution.create({
      data: {
        journeyId: journey.id,
        tenantId: journey.tenantId,
        triggerSource: trigger.triggerSource,
        triggerPayload: this.toJsonValue(trigger.triggerPayload),
        contactId: this.pickOptionalString(trigger.triggerPayload.contactId),
        cardId: this.pickOptionalString(trigger.triggerPayload.cardId),
        status: JourneyExecutionStatus.RUNNING,
        startedAt: new Date(),
      },
      include: journeyExecutionInclude,
    });

    try {
      await this.appendExecutionLog(execution.id, {
        message: `Execucao iniciada por ${trigger.triggerSource}.`,
        details: {
          payload: trigger.triggerPayload,
        },
      });

      const nodes = this.normalizeFlowNodes(journey.nodes);
      const edges = this.normalizeFlowEdges(journey.edges);
      const startingNodes = this.resolveStartingNodes(
        nodes,
        edges,
        trigger.matchingEventType,
      ).sort((left, right) => this.compareNodePosition(left, right));

      if (startingNodes.length === 0) {
        await this.appendExecutionLog(execution.id, {
          level: JourneyExecutionLogLevel.WARN,
          message: 'Nenhum no elegivel foi encontrado para esta execucao.',
          details: {
            matchingEventType: trigger.matchingEventType ?? null,
          },
        });

        await this.prisma.journeyExecution.update({
          where: { id: execution.id },
          data: {
            status: JourneyExecutionStatus.SKIPPED,
            completedAt: new Date(),
          },
        });

        return this.mapExecution(await this.findExecutionRecord(execution.id));
      }

      for (const node of startingNodes) {
        await this.scheduleNodeJob(execution.id, journey.tenantId, node);
      }

      await this.processExecutionDueJobs(execution.id);
      await this.finalizeExecutionIfTerminal(execution.id);

      return this.mapExecution(await this.findExecutionRecord(execution.id));
    } catch (error) {
      await this.appendExecutionLog(execution.id, {
        level: JourneyExecutionLogLevel.ERROR,
        message: 'Execucao finalizada com falha.',
        details: {
          error:
            error instanceof Error
              ? error.message
              : 'Erro desconhecido no runtime da jornada.',
        },
      });

      await this.prisma.journeyExecution.update({
        where: { id: execution.id },
        data: {
          status: JourneyExecutionStatus.FAILED,
          completedAt: new Date(),
        },
      });

      return this.mapExecution(await this.findExecutionRecord(execution.id));
    }
  }

  private async processExecutionDueJobs(
    executionId: string,
  ): Promise<JourneyRuntimeProcessResponse> {
    return this.drainDueJobs({ executionId });
  }

  private async drainDueJobs(filter: {
    tenantId?: string;
    executionId?: string;
  }): Promise<JourneyRuntimeProcessResponse> {
    const summary: JourneyRuntimeProcessResponse = {
      processedAt: new Date(),
      processedJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      requeuedJobs: 0,
      pendingJobs: 0,
      nextScheduledAt: null,
    };

    let iterations = 0;
    while (iterations < 24) {
      const dueJobs = await this.prisma.journeyExecutionJob.findMany({
        where: {
          status: JourneyExecutionJobStatus.PENDING,
          scheduledFor: {
            lte: new Date(),
          },
          ...(filter.tenantId ? { tenantId: filter.tenantId } : {}),
          ...(filter.executionId ? { executionId: filter.executionId } : {}),
        },
        include: journeyJobRuntimeInclude,
        orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'asc' }],
        take: 24,
      });

      if (dueJobs.length === 0) {
        break;
      }

      for (const job of dueJobs) {
        const result = await this.processJob(job);
        if (!result) {
          continue;
        }

        summary.processedJobs += 1;
        if (result === 'COMPLETED') summary.completedJobs += 1;
        if (result === 'FAILED') summary.failedJobs += 1;
        if (result === 'REQUEUED') summary.requeuedJobs += 1;
      }

      iterations += 1;
    }

    summary.pendingJobs = await this.prisma.journeyExecutionJob.count({
      where: {
        status: JourneyExecutionJobStatus.PENDING,
        ...(filter.tenantId ? { tenantId: filter.tenantId } : {}),
        ...(filter.executionId ? { executionId: filter.executionId } : {}),
      },
    });

    const nextPendingJob = await this.prisma.journeyExecutionJob.findFirst({
      where: {
        status: JourneyExecutionJobStatus.PENDING,
        ...(filter.tenantId ? { tenantId: filter.tenantId } : {}),
        ...(filter.executionId ? { executionId: filter.executionId } : {}),
      },
      orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'asc' }],
      select: {
        scheduledFor: true,
      },
    });

    summary.nextScheduledAt = nextPendingJob?.scheduledFor ?? null;
    return summary;
  }

  private async processJob(
    job: JourneyExecutionJobRuntimeRecord,
  ): Promise<JobProcessResult> {
    const claimedCount = await this.prisma.journeyExecutionJob.updateMany({
      where: {
        id: job.id,
        status: JourneyExecutionJobStatus.PENDING,
      },
      data: {
        status: JourneyExecutionJobStatus.RUNNING,
        startedAt: new Date(),
        attempts: {
          increment: 1,
        },
        lastError: null,
      },
    });

    if (claimedCount.count === 0) {
      return null;
    }

    const claimedJob = await this.prisma.journeyExecutionJob.findUnique({
      where: { id: job.id },
      include: journeyJobRuntimeInclude,
    });

    if (!claimedJob) {
      return null;
    }

    const journey = claimedJob.execution.journey;
    const nodes = this.normalizeFlowNodes(journey.nodes);
    const edges = this.normalizeFlowEdges(journey.edges);
    const node = nodes.find((candidate) => candidate.id === claimedJob.nodeId);

    if (!node) {
      await this.appendExecutionLog(claimedJob.executionId, {
        level: JourneyExecutionLogLevel.WARN,
        nodeId: claimedJob.nodeId,
        nodeLabel: claimedJob.nodeLabel,
        message:
          'O no desta execucao nao existe mais na jornada. O job foi ignorado.',
      });

      await this.updateJobStatus(
        claimedJob.id,
        JourneyExecutionJobStatus.SKIPPED,
      );
      await this.finalizeExecutionIfTerminal(claimedJob.executionId);
      return 'SKIPPED';
    }

    const runtime: ExecutionRuntimeContext = {
      tenantId: claimedJob.tenantId,
      contactId: claimedJob.execution.contactId,
      cardId: claimedJob.execution.cardId,
      triggerPayload: this.asRecord(claimedJob.execution.triggerPayload),
    };

    try {
      const executionResult = await this.executeNode(
        claimedJob.executionId,
        node,
        runtime,
      );
      // Under concurrent workers, fan-in nodes must see the current parent as completed.
      await this.updateJobStatus(
        claimedJob.id,
        JourneyExecutionJobStatus.COMPLETED,
      );
      await this.scheduleReadyOutgoingJobs(
        claimedJob.executionId,
        node,
        nodes,
        edges,
        executionResult,
      );
      await this.finalizeExecutionIfTerminal(claimedJob.executionId);
      return 'COMPLETED';
    } catch (error) {
      return this.handleJobFailure(claimedJob, node, error);
    }
  }

  private async handleJobFailure(
    job: JourneyExecutionJobRuntimeRecord,
    node: JourneyFlowNode,
    error: unknown,
  ): Promise<JobProcessResult> {
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Erro desconhecido no job da jornada.';

    if (job.attempts < this.maxJobAttempts) {
      const retryAt = new Date(Date.now() + this.retryDelayInSeconds * 1000);

      await this.prisma.journeyExecutionJob.update({
        where: { id: job.id },
        data: {
          status: JourneyExecutionJobStatus.PENDING,
          scheduledFor: retryAt,
          startedAt: null,
          completedAt: null,
          lastError: errorMessage,
          details: this.toJsonValue({
            ...this.asRecord(job.details),
            retryAt: retryAt.toISOString(),
            retryDelayInSeconds: this.retryDelayInSeconds,
          }),
        },
      });

      await this.enqueueRuntimeJob(job.id, retryAt);

      await this.appendExecutionLog(job.executionId, {
        level: JourneyExecutionLogLevel.WARN,
        nodeId: node.id,
        nodeLabel: this.resolveNodeLabel(node),
        message: 'Falha ao processar no. O job foi reagendado para retry.',
        details: {
          error: errorMessage,
          attempt: job.attempts,
          maxAttempts: this.maxJobAttempts,
          retryAt,
        },
      });

      await this.finalizeExecutionIfTerminal(job.executionId);
      return 'REQUEUED';
    }

    await this.prisma.journeyExecutionJob.update({
      where: { id: job.id },
      data: {
        status: JourneyExecutionJobStatus.FAILED,
        completedAt: new Date(),
        lastError: errorMessage,
        details: this.toJsonValue({
          ...this.asRecord(job.details),
          deadLetteredAt: new Date().toISOString(),
          deadLetterReason: errorMessage,
          deadLetterAttempts: job.attempts,
        }),
      },
    });
    await this.appendExecutionLog(job.executionId, {
      level: JourneyExecutionLogLevel.ERROR,
      nodeId: node.id,
      nodeLabel: this.resolveNodeLabel(node),
      message:
        'Falha definitiva ao processar no da jornada. O job entrou em dead-letter.',
      details: {
        error: errorMessage,
        attempts: job.attempts,
      },
    });

    await this.finalizeExecutionIfTerminal(job.executionId);
    return 'FAILED';
  }

  private async requeueFailedJobInternal(
    job: JourneyExecutionJobRuntimeRecord,
  ): Promise<void> {
    const requeueAt = new Date();
    const currentDetails = this.asRecord(job.details);
    const nextManualRequeueCount =
      this.pickNumber(currentDetails.manualRequeueCount) + 1;

    await this.prisma.journeyExecutionJob.update({
      where: { id: job.id },
      data: {
        status: JourneyExecutionJobStatus.PENDING,
        scheduledFor: requeueAt,
        startedAt: null,
        completedAt: null,
        attempts: 0,
        lastError: null,
        details: this.toJsonValue({
          ...currentDetails,
          manuallyRequeuedAt: requeueAt.toISOString(),
          manualRequeueCount: nextManualRequeueCount,
          previousDeadLetteredAt:
            this.pickOptionalString(currentDetails.deadLetteredAt) ?? null,
          previousDeadLetterReason:
            this.pickOptionalString(currentDetails.deadLetterReason) ?? null,
          deadLetteredAt: null,
          deadLetterReason: null,
        }),
      },
    });

    await this.prisma.journeyExecution.update({
      where: { id: job.executionId },
      data: {
        status: JourneyExecutionStatus.RUNNING,
        completedAt: null,
      },
    });

    await this.enqueueRuntimeJob(job.id, requeueAt);

    await this.appendExecutionLog(job.executionId, {
      level: JourneyExecutionLogLevel.INFO,
      nodeId: job.nodeId,
      nodeLabel: job.nodeLabel,
      message: 'Job reenfileirado manualmente após dead-letter.',
      details: {
        jobId: job.id,
        requeueAt,
        manualRequeueCount: nextManualRequeueCount,
      },
    });
  }

  private async scheduleReadyOutgoingJobs(
    executionId: string,
    node: JourneyFlowNode,
    nodes: JourneyFlowNode[],
    edges: JourneyFlowEdge[],
    executionResult?: NodeExecutionResult,
  ): Promise<void> {
    const outgoingEdges = this.selectOutgoingEdgesForNode(
      node,
      edges.filter((edge) => edge.source === node.id),
      executionResult,
    );
    const outgoingNodeIds = outgoingEdges.map((edge) => edge.target);

    if (outgoingNodeIds.length === 0) {
      if (
        this.resolveNodeKind(node) === 'condition' &&
        executionResult?.branchKey
      ) {
        await this.appendExecutionLog(executionId, {
          level: JourneyExecutionLogLevel.WARN,
          nodeId: node.id,
          nodeLabel: this.resolveNodeLabel(node),
          message:
            'A condição foi avaliada, mas nenhum caminho elegível foi encontrado para o resultado.',
          details: {
            branchKey: executionResult.branchKey,
          },
        });
      }
      return;
    }

    const execution = await this.prisma.journeyExecution.findUnique({
      where: { id: executionId },
      select: {
        tenantId: true,
      },
    });

    if (!execution) {
      return;
    }

    const outgoingNodes = nodes
      .filter((candidate) => outgoingNodeIds.includes(candidate.id))
      .sort((left, right) => this.compareNodePosition(left, right));

    for (const targetNode of outgoingNodes) {
      const isReady = await this.isTargetNodeReady(
        executionId,
        targetNode.id,
        edges,
        node.id,
      );
      if (!isReady) {
        continue;
      }

      await this.scheduleNodeJob(executionId, execution.tenantId, targetNode);
    }
  }

  private async isTargetNodeReady(
    executionId: string,
    targetNodeId: string,
    edges: JourneyFlowEdge[],
    currentNodeId: string,
  ): Promise<boolean> {
    const requiredSourceIds = edges
      .filter((edge) => edge.target === targetNodeId)
      .map((edge) => edge.source);

    if (requiredSourceIds.length === 0) {
      return true;
    }

    const parentJobs = await this.prisma.journeyExecutionJob.findMany({
      where: {
        executionId,
        nodeId: {
          in: requiredSourceIds,
        },
      },
      select: {
        nodeId: true,
        status: true,
      },
    });

    const parentStatusByNodeId = new Map(
      parentJobs.map((parentJob) => [parentJob.nodeId, parentJob.status]),
    );

    return requiredSourceIds.every((sourceId) => {
      if (sourceId === currentNodeId) {
        return true;
      }

      const status = parentStatusByNodeId.get(sourceId);
      return (
        status === JourneyExecutionJobStatus.COMPLETED ||
        status === JourneyExecutionJobStatus.SKIPPED
      );
    });
  }

  private async scheduleNodeJob(
    executionId: string,
    tenantId: string,
    node: JourneyFlowNode,
  ): Promise<void> {
    const nodeLabel = this.resolveNodeLabel(node);
    const nodeKind = this.resolveNodeKind(node);
    const actionType =
      nodeKind === 'action' ? this.resolveNodeActionType(node) : null;
    const delayInSeconds = this.resolveNodeDelayInSeconds(node);
    const scheduledFor = new Date(Date.now() + delayInSeconds * 1000);

    try {
      const createdJob = await this.prisma.journeyExecutionJob.create({
        data: {
          executionId,
          tenantId,
          nodeId: node.id,
          nodeLabel,
          nodeKind,
          actionType:
            actionType && actionType !== 'unknown' ? actionType : null,
          delayInSeconds,
          scheduledFor,
          details: this.toJsonValue({
            eventType: this.resolveNodeEventType(node),
            message: node.data?.message ?? null,
          }),
        },
      });

      await this.enqueueRuntimeJob(createdJob.id, scheduledFor);

      await this.appendExecutionLog(executionId, {
        nodeId: node.id,
        nodeLabel,
        message:
          delayInSeconds > 0
            ? 'No agendado para execucao futura.'
            : 'No liberado para execucao imediata.',
        details: {
          nodeKind,
          actionType:
            actionType && actionType !== 'unknown' ? actionType : null,
          scheduledFor,
          delayInSeconds,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return;
      }

      throw error;
    }
  }

  private async enqueueRuntimeJob(
    journeyJobId: string,
    scheduledFor: Date,
  ): Promise<void> {
    await this.journeyQueueService.enqueueJourneyJob(
      journeyJobId,
      scheduledFor,
    );
  }

  private async executeNode(
    executionId: string,
    node: JourneyFlowNode,
    runtime: ExecutionRuntimeContext,
  ): Promise<NodeExecutionResult> {
    const nodeKind = this.resolveNodeKind(node);
    const nodeLabel = this.resolveNodeLabel(node);

    if (nodeKind === 'trigger') {
      await this.appendExecutionLog(executionId, {
        nodeId: node.id,
        nodeLabel,
        message: `Gatilho reconhecido: ${nodeLabel}.`,
        details: {
          eventType: this.resolveNodeEventType(node),
        },
      });
      return {};
    }

    if (nodeKind === 'condition') {
      const evaluation = await this.evaluateConditionNode(node, runtime);
      await this.appendExecutionLog(executionId, {
        nodeId: node.id,
        nodeLabel,
        message: evaluation.matched
          ? `Condicao satisfeita. Caminho SIM liberado: ${nodeLabel}.`
          : `Condicao nao satisfeita. Caminho NAO liberado: ${nodeLabel}.`,
        details: evaluation,
      });
      return {
        branchKey: evaluation.matched ? 'true' : 'false',
      };
    }

    if (nodeKind === 'delay') {
      await this.appendExecutionLog(executionId, {
        nodeId: node.id,
        nodeLabel,
        message: 'Delay concluido. O fluxo pode seguir para os proximos nos.',
        details: {
          delayInSeconds: this.resolveNodeDelayInSeconds(node),
        },
      });
      return {};
    }

    if (nodeKind !== 'action') {
      await this.appendExecutionLog(executionId, {
        level: JourneyExecutionLogLevel.WARN,
        nodeId: node.id,
        nodeLabel,
        message: `Tipo de no nao suportado para execucao: ${nodeLabel}.`,
      });
      return {};
    }

    const actionType = this.resolveNodeActionType(node);

    switch (actionType) {
      case 'append_card_activity':
      case 'log_note':
        await this.executeAppendCardActivity(executionId, node, runtime);
        return {};
      case 'move_card_to_next_stage':
        await this.executeMoveCardToNextStage(executionId, node, runtime);
        return {};
      case 'request_handoff':
        await this.executeRequestHandoff(executionId, node, runtime);
        return {};
      default:
        await this.appendExecutionLog(executionId, {
          level: JourneyExecutionLogLevel.WARN,
          nodeId: node.id,
          nodeLabel,
          message: `Acao ainda nao suportada pelo runtime: ${actionType}.`,
        });
        return {};
    }
  }

  private async executeAppendCardActivity(
    executionId: string,
    node: JourneyFlowNode,
    runtime: ExecutionRuntimeContext,
  ): Promise<void> {
    const nodeLabel = this.resolveNodeLabel(node);
    const cardId = await this.resolveCardId(runtime);
    const message = this.resolveNodeMessage(
      node,
      'Regua executada automaticamente pela jornada.',
    );

    if (!cardId) {
      await this.appendExecutionLog(executionId, {
        level: JourneyExecutionLogLevel.WARN,
        nodeId: node.id,
        nodeLabel,
        message:
          'Nao foi possivel anexar atividade porque nenhum card foi encontrado no contexto.',
      });
      return;
    }

    await this.prisma.cardActivity.create({
      data: {
        cardId,
        type: 'JOURNEY_ACTIVITY',
        content: message,
      },
    });

    await this.appendExecutionLog(executionId, {
      nodeId: node.id,
      nodeLabel,
      message: 'Atividade registrada no card com sucesso.',
      details: {
        cardId,
        content: message,
      },
    });
  }

  private async executeMoveCardToNextStage(
    executionId: string,
    node: JourneyFlowNode,
    runtime: ExecutionRuntimeContext,
  ): Promise<void> {
    const nodeLabel = this.resolveNodeLabel(node);
    const cardId = await this.resolveCardId(runtime);

    if (!cardId) {
      await this.appendExecutionLog(executionId, {
        level: JourneyExecutionLogLevel.WARN,
        nodeId: node.id,
        nodeLabel,
        message:
          'Nao foi possivel mover o card porque nenhum card foi encontrado no contexto.',
      });
      return;
    }

    const card = await this.prisma.card.findFirst({
      where: {
        id: cardId,
        tenantId: runtime.tenantId,
      },
      include: {
        stage: {
          include: {
            pipeline: {
              include: {
                stages: {
                  orderBy: {
                    order: 'asc',
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!card) {
      await this.appendExecutionLog(executionId, {
        level: JourneyExecutionLogLevel.WARN,
        nodeId: node.id,
        nodeLabel,
        message: 'Card do contexto nao existe mais neste tenant.',
        details: {
          cardId,
        },
      });
      return;
    }

    const stages = card.stage.pipeline.stages;
    const currentStageIndex = stages.findIndex(
      (stage) => stage.id === card.stageId,
    );
    const nextStage =
      currentStageIndex >= 0 ? stages[currentStageIndex + 1] : null;

    if (!nextStage) {
      await this.appendExecutionLog(executionId, {
        level: JourneyExecutionLogLevel.WARN,
        nodeId: node.id,
        nodeLabel,
        message: 'O card ja esta na ultima etapa do pipeline.',
        details: {
          cardId,
          stageId: card.stageId,
          stageName: card.stage.name,
        },
      });
      return;
    }

    const lastPosition = await this.prisma.card.aggregate({
      where: {
        stageId: nextStage.id,
      },
      _max: {
        position: true,
      },
    });

    await this.prisma.card.update({
      where: { id: card.id },
      data: {
        stageId: nextStage.id,
        position:
          lastPosition._max.position !== null
            ? lastPosition._max.position + 1
            : 0,
      },
    });

    runtime.cardRecord = {
      id: card.id,
      title: card.title,
      stageId: nextStage.id,
      stage: {
        id: nextStage.id,
        name: nextStage.name,
        pipeline: {
          id: card.stage.pipeline.id,
          name: card.stage.pipeline.name,
        },
      },
    };

    await this.prisma.cardActivity.create({
      data: {
        cardId: card.id,
        type: 'JOURNEY_STAGE_MOVED',
        content: `Card movido automaticamente de ${card.stage.name} para ${nextStage.name} pela jornada.`,
      },
    });

    await this.appendExecutionLog(executionId, {
      nodeId: node.id,
      nodeLabel,
      message: 'Card movido para a proxima etapa.',
      details: {
        cardId: card.id,
        fromStageId: card.stage.id,
        fromStageName: card.stage.name,
        toStageId: nextStage.id,
        toStageName: nextStage.name,
      },
    });
  }

  private async executeRequestHandoff(
    executionId: string,
    node: JourneyFlowNode,
    runtime: ExecutionRuntimeContext,
  ): Promise<void> {
    const nodeLabel = this.resolveNodeLabel(node);
    const cardId = await this.resolveCardId(runtime);

    const conversation = await this.prisma.agentConversation.findFirst({
      where: {
        tenantId: runtime.tenantId,
        ...(cardId ? { cardId } : {}),
        ...(runtime.contactId ? { contactId: runtime.contactId } : {}),
        status: {
          in: [
            AgentConversationStatus.OPEN,
            AgentConversationStatus.HANDOFF_REQUIRED,
          ],
        },
      },
      orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
    });

    if (!conversation) {
      await this.appendExecutionLog(executionId, {
        level: JourneyExecutionLogLevel.WARN,
        nodeId: node.id,
        nodeLabel,
        message:
          'Nenhuma conversa elegivel foi encontrada para solicitar handoff.',
        details: {
          cardId,
          contactId: runtime.contactId,
        },
      });
      return;
    }

    await this.prisma.agentConversation.update({
      where: { id: conversation.id },
      data: {
        status: AgentConversationStatus.HANDOFF_REQUIRED,
      },
    });

    if (conversation.cardId) {
      await this.prisma.cardActivity.create({
        data: {
          cardId: conversation.cardId,
          type: 'JOURNEY_HANDOFF',
          content: 'A jornada solicitou takeover manual desta conversa.',
        },
      });
    }

    await this.appendExecutionLog(executionId, {
      nodeId: node.id,
      nodeLabel,
      message: 'Conversa enviada para takeover manual.',
      details: {
        conversationId: conversation.id,
        cardId: conversation.cardId,
        contactId: conversation.contactId,
      },
    });
  }

  private async evaluateConditionNode(
    node: JourneyFlowNode,
    runtime: ExecutionRuntimeContext,
  ): Promise<{
    matched: boolean;
    mode: string;
    fieldPath: string | null;
    operator: string;
    expected: unknown;
    actual: unknown;
  }> {
    const fieldPath = this.resolveConditionField(node);
    const operator = this.resolveConditionOperator(node);
    const expected = this.resolveConditionExpectedValue(node);

    if (!fieldPath) {
      return {
        matched: true,
        mode: 'truthy_by_default',
        fieldPath: null,
        operator: 'always_true',
        expected: null,
        actual: true,
      };
    }

    const actual = await this.resolveConditionFieldValue(fieldPath, runtime);
    return {
      matched: this.applyConditionOperator(actual, operator, expected),
      mode: 'evaluated',
      fieldPath,
      operator,
      expected,
      actual,
    };
  }

  private async resolveConditionFieldValue(
    fieldPath: string,
    runtime: ExecutionRuntimeContext,
  ): Promise<unknown> {
    const normalizedPath = fieldPath
      .split('.')
      .map((part) => part.trim())
      .filter(Boolean);

    if (normalizedPath.length === 0) {
      return null;
    }

    const [root, ...rest] = normalizedPath;
    const normalizedRoot = root.toLowerCase();

    if (
      normalizedRoot === 'triggerpayload' ||
      normalizedRoot === 'payload' ||
      normalizedRoot === 'trigger'
    ) {
      return this.getValueAtPath(runtime.triggerPayload, rest);
    }

    if (normalizedRoot === 'contact') {
      return this.getValueAtPath(
        await this.resolveContactRecord(runtime),
        rest,
      );
    }

    if (normalizedRoot === 'company') {
      const contact = await this.resolveContactRecord(runtime);
      return this.getValueAtPath(contact?.company ?? null, rest);
    }

    if (normalizedRoot === 'card') {
      return this.getValueAtPath(await this.resolveCardRecord(runtime), rest);
    }

    const contact = await this.resolveContactRecord(runtime);
    const rootContext = {
      contactId: runtime.contactId,
      cardId: await this.resolveCardId(runtime),
      triggerPayload: runtime.triggerPayload,
      contact,
      company: contact?.company ?? null,
      card: await this.resolveCardRecord(runtime),
    };

    return this.getValueAtPath(rootContext, normalizedPath);
  }

  private async resolveContactRecord(
    runtime: ExecutionRuntimeContext,
  ): Promise<ExecutionRuntimeContext['contactRecord']> {
    if (runtime.contactRecord !== undefined) {
      return runtime.contactRecord;
    }

    if (!runtime.contactId) {
      runtime.contactRecord = null;
      return runtime.contactRecord;
    }

    runtime.contactRecord = await this.prisma.contact.findFirst({
      where: {
        id: runtime.contactId,
        tenantId: runtime.tenantId,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        position: true,
        tags: true,
        company: {
          select: {
            id: true,
            name: true,
            industry: true,
            website: true,
          },
        },
      },
    });

    return runtime.contactRecord;
  }

  private async resolveCardRecord(
    runtime: ExecutionRuntimeContext,
  ): Promise<ExecutionRuntimeContext['cardRecord']> {
    if (runtime.cardRecord !== undefined) {
      return runtime.cardRecord;
    }

    const cardId = await this.resolveCardId(runtime);
    if (!cardId) {
      runtime.cardRecord = null;
      return runtime.cardRecord;
    }

    runtime.cardRecord = await this.prisma.card.findFirst({
      where: {
        id: cardId,
        tenantId: runtime.tenantId,
      },
      select: {
        id: true,
        title: true,
        stageId: true,
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
      },
    });

    return runtime.cardRecord;
  }

  private async finalizeExecutionIfTerminal(
    executionId: string,
  ): Promise<void> {
    const execution = await this.findExecutionRecord(executionId);
    const pendingOrRunningJobs = execution.jobs.filter(
      (job) =>
        job.status === JourneyExecutionJobStatus.PENDING ||
        job.status === JourneyExecutionJobStatus.RUNNING,
    );

    if (pendingOrRunningJobs.length > 0) {
      if (execution.status !== JourneyExecutionStatus.RUNNING) {
        await this.prisma.journeyExecution.update({
          where: { id: executionId },
          data: {
            status: JourneyExecutionStatus.RUNNING,
            completedAt: null,
          },
        });
      }
      return;
    }

    const failedJobs = execution.jobs.filter(
      (job) => job.status === JourneyExecutionJobStatus.FAILED,
    );
    const completedJobs = execution.jobs.filter(
      (job) => job.status === JourneyExecutionJobStatus.COMPLETED,
    );

    const nextStatus =
      failedJobs.length > 0
        ? JourneyExecutionStatus.FAILED
        : completedJobs.length > 0
          ? JourneyExecutionStatus.COMPLETED
          : JourneyExecutionStatus.SKIPPED;

    if (execution.completedAt && execution.status === nextStatus) {
      return;
    }

    await this.appendExecutionLog(executionId, {
      level:
        nextStatus === JourneyExecutionStatus.FAILED
          ? JourneyExecutionLogLevel.ERROR
          : JourneyExecutionLogLevel.INFO,
      message:
        nextStatus === JourneyExecutionStatus.FAILED
          ? 'Execucao finalizada com falha.'
          : nextStatus === JourneyExecutionStatus.SKIPPED
            ? 'Execucao encerrada sem acoes efetivas.'
            : 'Execucao finalizada com sucesso.',
      details: {
        completedJobs: completedJobs.length,
        failedJobs: failedJobs.length,
      },
    });

    await this.prisma.journeyExecution.update({
      where: { id: executionId },
      data: {
        status: nextStatus,
        completedAt: new Date(),
      },
    });
  }

  private async updateJobStatus(
    jobId: string,
    status: JourneyExecutionJobStatus,
    input?: {
      lastError?: string | null;
    },
  ): Promise<void> {
    await this.prisma.journeyExecutionJob.update({
      where: { id: jobId },
      data: {
        status,
        completedAt:
          status === JourneyExecutionJobStatus.PENDING ? null : new Date(),
        lastError: input?.lastError ?? null,
      },
    });
  }

  private async appendExecutionLog(
    executionId: string,
    input: {
      level?: JourneyExecutionLogLevel;
      nodeId?: string;
      nodeLabel?: string | null;
      message: string;
      details?: unknown;
    },
  ): Promise<void> {
    await this.prisma.journeyExecutionLog.create({
      data: {
        executionId,
        level: input.level ?? JourneyExecutionLogLevel.INFO,
        nodeId: input.nodeId,
        nodeLabel: input.nodeLabel,
        message: input.message,
        details: this.toJsonValue(input.details),
      },
    });
  }

  private hasMatchingTrigger(journey: Journey, eventType: string): boolean {
    const nodes = this.normalizeFlowNodes(journey.nodes);
    return nodes.some(
      (node) =>
        this.resolveNodeKind(node) === 'trigger' &&
        this.resolveNodeEventType(node) === eventType,
    );
  }

  private resolveStartingNodes(
    nodes: JourneyFlowNode[],
    edges: JourneyFlowEdge[],
    matchingEventType?: string,
  ): JourneyFlowNode[] {
    const triggerNodes = nodes.filter(
      (node) => this.resolveNodeKind(node) === 'trigger',
    );
    if (matchingEventType) {
      const matchingTriggerNodes = triggerNodes.filter(
        (node) => this.resolveNodeEventType(node) === matchingEventType,
      );

      if (matchingTriggerNodes.length > 0) {
        return matchingTriggerNodes;
      }

      if (matchingEventType === 'manual_trigger' && triggerNodes.length > 0) {
        return triggerNodes;
      }
    }

    if (triggerNodes.length > 0 && !matchingEventType) {
      return triggerNodes;
    }

    const incomingTargets = new Set(edges.map((edge) => edge.target));
    const rootNodes = nodes.filter((node) => !incomingTargets.has(node.id));
    return rootNodes.length > 0 ? rootNodes : nodes;
  }

  private selectOutgoingEdgesForNode(
    node: JourneyFlowNode,
    outgoingEdges: JourneyFlowEdge[],
    executionResult?: NodeExecutionResult,
  ): JourneyFlowEdge[] {
    if (this.resolveNodeKind(node) !== 'condition') {
      return outgoingEdges;
    }

    const explicitBranchEdges = outgoingEdges.filter(
      (edge) => this.resolveEdgeBranch(edge) !== 'default',
    );

    if (explicitBranchEdges.length === 0) {
      return outgoingEdges;
    }

    const branchKey = executionResult?.branchKey === 'false' ? 'false' : 'true';

    return outgoingEdges.filter((edge) => {
      const edgeBranch = this.resolveEdgeBranch(edge);
      return edgeBranch === 'default' || edgeBranch === branchKey;
    });
  }

  private async resolveCardId(
    runtime: ExecutionRuntimeContext,
  ): Promise<string | null> {
    if (runtime.cardId) {
      return runtime.cardId;
    }

    if (!runtime.contactId) {
      return null;
    }

    const latestCard = await this.prisma.card.findFirst({
      where: {
        tenantId: runtime.tenantId,
        contactId: runtime.contactId,
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
      },
    });

    runtime.cardId = latestCard?.id ?? null;
    return runtime.cardId;
  }

  private resolveNodeKind(node: JourneyFlowNode): string {
    const explicitKind = node.data?.kind?.trim().toLowerCase();
    if (explicitKind) {
      return explicitKind;
    }

    const label = this.resolveNodeLabel(node).toLowerCase();
    if (label.includes('gatilho') || label.includes('trigger')) {
      return 'trigger';
    }
    if (label.includes('condi') || label.includes('condition')) {
      return 'condition';
    }
    if (label.includes('delay') || label.includes('espera')) {
      return 'delay';
    }
    if (
      label.includes('acao') ||
      label.includes('ação') ||
      label.includes('action')
    ) {
      return 'action';
    }

    return 'unknown';
  }

  private resolveNodeEventType(node: JourneyFlowNode): string | null {
    const explicitEventType = node.data?.eventType?.trim();
    if (explicitEventType) {
      return explicitEventType;
    }

    const label = this.resolveNodeLabel(node).toLowerCase();
    if (label.includes('whatsapp')) {
      return 'whatsapp_inbound_received';
    }
    if (label.includes('form')) {
      return 'lead_form_submitted';
    }
    if (label.includes('manual') || label.includes('teste')) {
      return 'manual_trigger';
    }

    return null;
  }

  private resolveNodeActionType(node: JourneyFlowNode): string {
    const explicitActionType = node.data?.actionType?.trim();
    if (explicitActionType) {
      return explicitActionType;
    }

    const label = this.resolveNodeLabel(node).toLowerCase();
    if (label.includes('mover') || label.includes('move')) {
      return 'move_card_to_next_stage';
    }
    if (
      label.includes('handoff') ||
      label.includes('takeover') ||
      label.includes('assumir')
    ) {
      return 'request_handoff';
    }
    if (
      label.includes('atividade') ||
      label.includes('activity') ||
      label.includes('nota') ||
      label.includes('note')
    ) {
      return 'append_card_activity';
    }
    if (label.includes('agente')) {
      return 'log_note';
    }

    return 'unknown';
  }

  private resolveNodeLabel(node: JourneyFlowNode): string {
    return node.data?.label?.trim() || node.id;
  }

  private resolveNodeMessage(node: JourneyFlowNode, fallback: string): string {
    return node.data?.message?.trim() || fallback;
  }

  private resolveConditionField(node: JourneyFlowNode): string | null {
    const rawValue = node.data?.conditionField;
    return typeof rawValue === 'string' && rawValue.trim().length > 0
      ? rawValue.trim()
      : null;
  }

  private resolveConditionOperator(node: JourneyFlowNode): string {
    const explicitOperator =
      typeof node.data?.conditionOperator === 'string'
        ? node.data.conditionOperator.trim().toLowerCase()
        : '';

    if (explicitOperator) {
      return explicitOperator;
    }

    return node.data?.conditionValue !== undefined ? 'equals' : 'exists';
  }

  private resolveConditionExpectedValue(
    node: JourneyFlowNode,
  ): string | number | boolean | null {
    const rawValue = node.data?.conditionValue;
    if (
      typeof rawValue === 'string' ||
      typeof rawValue === 'number' ||
      typeof rawValue === 'boolean'
    ) {
      return rawValue;
    }

    return null;
  }

  private resolveNodeDelayInSeconds(node: JourneyFlowNode): number {
    const explicitSeconds = this.coercePositiveNumber(
      node.data?.delayInSeconds,
    );
    if (explicitSeconds !== null) {
      return explicitSeconds;
    }

    const explicitMinutes = this.coercePositiveNumber(
      node.data?.delayInMinutes,
    );
    if (explicitMinutes !== null) {
      return explicitMinutes * 60;
    }

    const explicitHours = this.coercePositiveNumber(node.data?.delayInHours);
    if (explicitHours !== null) {
      return explicitHours * 3600;
    }

    const label = this.resolveNodeLabel(node).toLowerCase();
    const hoursMatch = label.match(/(\d+)\s*(h|hora|horas)/);
    if (hoursMatch?.[1]) {
      return Number.parseInt(hoursMatch[1], 10) * 3600;
    }

    const minutesMatch = label.match(/(\d+)\s*(m|min|mins|minuto|minutos)/);
    if (minutesMatch?.[1]) {
      return Number.parseInt(minutesMatch[1], 10) * 60;
    }

    if (this.resolveNodeKind(node) === 'delay') {
      return 300;
    }

    return 0;
  }

  private compareNodePosition(
    left: JourneyFlowNode,
    right: JourneyFlowNode,
  ): number {
    const leftY = left.position?.y ?? 0;
    const rightY = right.position?.y ?? 0;
    if (leftY !== rightY) {
      return leftY - rightY;
    }

    const leftX = left.position?.x ?? 0;
    const rightX = right.position?.x ?? 0;
    return leftX - rightX;
  }

  private resolveEdgeBranch(edge: JourneyFlowEdge): JourneyBranchKey {
    const explicitBranch =
      typeof edge.data?.branch === 'string'
        ? edge.data.branch.trim().toLowerCase()
        : '';
    if (
      explicitBranch === 'true' ||
      explicitBranch === 'sim' ||
      explicitBranch === 'yes'
    ) {
      return 'true';
    }
    if (
      explicitBranch === 'false' ||
      explicitBranch === 'nao' ||
      explicitBranch === 'não' ||
      explicitBranch === 'no'
    ) {
      return 'false';
    }

    const label =
      typeof edge.label === 'string' ? edge.label.trim().toLowerCase() : '';
    if (label === 'sim' || label === 'true' || label === 'yes') {
      return 'true';
    }
    if (
      label === 'nao' ||
      label === 'não' ||
      label === 'false' ||
      label === 'no'
    ) {
      return 'false';
    }

    return 'default';
  }

  private normalizeFlowNodes(value: Prisma.JsonValue): JourneyFlowNode[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter(
      (item) => Boolean(item) && typeof item === 'object',
    ) as unknown as JourneyFlowNode[];
  }

  private normalizeFlowEdges(value: Prisma.JsonValue): JourneyFlowEdge[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((item) => Boolean(item) && typeof item === 'object')
      .map((item) => item as unknown as JourneyFlowEdge)
      .filter(
        (edge) =>
          typeof edge.source === 'string' && typeof edge.target === 'string',
      );
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined) {
      return undefined;
    }

    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private pickOptionalString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0
      ? value.trim()
      : null;
  }

  private pickNumber(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return 0;
  }

  private pickOptionalDate(value: unknown): Date | null {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value;
    }

    if (typeof value === 'string' && value.trim().length > 0) {
      const parsedDate = new Date(value);
      if (!Number.isNaN(parsedDate.getTime())) {
        return parsedDate;
      }
    }

    return null;
  }

  private parsePositiveInteger(
    value: string | undefined,
    fallback: number,
  ): number {
    if (!value) {
      return fallback;
    }

    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }

    return parsed;
  }

  private coercePositiveNumber(value: unknown): number | null {
    const normalized =
      typeof value === 'string'
        ? Number.parseInt(value, 10)
        : typeof value === 'number'
          ? Math.floor(value)
          : Number.NaN;

    if (!Number.isFinite(normalized) || normalized < 0) {
      return null;
    }

    return normalized;
  }

  private applyConditionOperator(
    actual: unknown,
    operator: string,
    expected: unknown,
  ): boolean {
    switch (operator) {
      case 'exists':
        return this.hasConditionValue(actual);
      case 'not_exists':
        return !this.hasConditionValue(actual);
      case 'not_equals':
        return !this.conditionValuesEqual(actual, expected);
      case 'contains':
        return this.conditionContains(actual, expected);
      case 'not_contains':
        return !this.conditionContains(actual, expected);
      case 'greater_than':
        return this.compareConditionNumbers(actual, expected, '>');
      case 'less_than':
        return this.compareConditionNumbers(actual, expected, '<');
      case 'equals':
      default:
        return this.conditionValuesEqual(actual, expected);
    }
  }

  private hasConditionValue(value: unknown): boolean {
    if (value === null || value === undefined) {
      return false;
    }

    if (typeof value === 'string') {
      return value.trim().length > 0;
    }

    if (Array.isArray(value)) {
      return value.length > 0;
    }

    if (typeof value === 'object') {
      return Object.keys(value).length > 0;
    }

    return true;
  }

  private conditionValuesEqual(left: unknown, right: unknown): boolean {
    const normalizedLeft = this.toComparableConditionValue(left);
    const normalizedRight = this.toComparableConditionValue(right);

    if (
      typeof normalizedLeft === 'string' &&
      typeof normalizedRight === 'string'
    ) {
      return normalizedLeft.toLowerCase() === normalizedRight.toLowerCase();
    }

    return normalizedLeft === normalizedRight;
  }

  private conditionContains(actual: unknown, expected: unknown): boolean {
    const normalizedExpected = this.toComparableConditionValue(expected);

    if (Array.isArray(actual)) {
      return actual.some((item) =>
        this.conditionValuesEqual(item, normalizedExpected),
      );
    }

    if (typeof actual === 'string') {
      const expectedText =
        normalizedExpected === null || normalizedExpected === undefined
          ? ''
          : String(normalizedExpected).toLowerCase();

      return actual.toLowerCase().includes(expectedText);
    }

    return false;
  }

  private compareConditionNumbers(
    actual: unknown,
    expected: unknown,
    operator: '>' | '<',
  ): boolean {
    const actualNumber = this.toComparableNumber(actual);
    const expectedNumber = this.toComparableNumber(expected);

    if (actualNumber === null || expectedNumber === null) {
      return false;
    }

    return operator === '>'
      ? actualNumber > expectedNumber
      : actualNumber < expectedNumber;
  }

  private toComparableConditionValue(
    value: unknown,
  ): string | number | boolean | null {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        return '';
      }

      const lowered = trimmed.toLowerCase();
      if (lowered === 'true') {
        return true;
      }
      if (lowered === 'false') {
        return false;
      }

      if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
        return Number.parseFloat(trimmed);
      }

      return trimmed;
    }

    return null;
  }

  private toComparableNumber(value: unknown): number | null {
    const comparable = this.toComparableConditionValue(value);
    return typeof comparable === 'number' ? comparable : null;
  }

  private getValueAtPath(root: unknown, path: string[]): unknown {
    return path.reduce<unknown>((current, segment) => {
      if (!current || typeof current !== 'object' || Array.isArray(current)) {
        return null;
      }

      return (current as Record<string, unknown>)[segment] ?? null;
    }, root);
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }

  private mapJourneySummary(
    journey: JourneyListRecord,
  ): JourneySummaryResponse {
    const latestExecution = journey.executions[0] ?? null;

    return {
      id: journey.id,
      name: journey.name,
      isActive: journey.isActive,
      nodes: this.normalizeFlowNodes(journey.nodes),
      edges: this.normalizeFlowEdges(journey.edges),
      createdAt: journey.createdAt,
      updatedAt: journey.updatedAt,
      executionCount: journey._count.executions,
      lastExecutionAt:
        latestExecution?.completedAt ??
        latestExecution?.startedAt ??
        latestExecution?.createdAt ??
        null,
      lastExecutionStatus: latestExecution?.status ?? null,
    };
  }

  private mapJourneyDetail(
    journey: JourneyDetailRecord,
  ): JourneyDetailResponse {
    const summary = this.mapJourneySummary(journey);

    return {
      ...summary,
      recentExecutions: journey.executions.map((execution) =>
        this.mapExecution(execution),
      ),
    };
  }

  private mapExecution(
    execution: JourneyExecutionRecord,
  ): JourneyExecutionResponse {
    const pendingJobs = execution.jobs.filter(
      (job) => job.status === JourneyExecutionJobStatus.PENDING,
    );
    const runningJobs = execution.jobs.filter(
      (job) => job.status === JourneyExecutionJobStatus.RUNNING,
    );
    const failedJobs = execution.jobs.filter(
      (job) => job.status === JourneyExecutionJobStatus.FAILED,
    );

    return {
      id: execution.id,
      triggerSource: execution.triggerSource,
      triggerPayload: execution.triggerPayload,
      contactId: execution.contactId,
      cardId: execution.cardId,
      status: execution.status,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      createdAt: execution.createdAt,
      updatedAt: execution.updatedAt,
      pendingJobCount: pendingJobs.length,
      runningJobCount: runningJobs.length,
      failedJobCount: failedJobs.length,
      nextScheduledAt:
        pendingJobs.sort(
          (left, right) =>
            left.scheduledFor.getTime() - right.scheduledFor.getTime(),
        )[0]?.scheduledFor ?? null,
      logs: execution.logs.map((log) => ({
        id: log.id,
        level: log.level,
        nodeId: log.nodeId,
        nodeLabel: log.nodeLabel,
        message: log.message,
        details: log.details,
        createdAt: log.createdAt,
      })),
      jobs: execution.jobs.map((job) => {
        const details = this.asRecord(job.details);

        return {
          id: job.id,
          nodeId: job.nodeId,
          nodeLabel: job.nodeLabel,
          nodeKind: job.nodeKind,
          actionType: job.actionType,
          delayInSeconds: job.delayInSeconds,
          status: job.status,
          scheduledFor: job.scheduledFor,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
          attempts: job.attempts,
          lastError: job.lastError,
          deadLetteredAt: this.pickOptionalDate(details.deadLetteredAt),
          deadLetterReason:
            this.pickOptionalString(details.deadLetterReason) ?? job.lastError,
          manuallyRequeuedAt: this.pickOptionalDate(details.manuallyRequeuedAt),
          manualRequeueCount: this.pickNumber(details.manualRequeueCount),
          details: job.details,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
        };
      }),
    };
  }
}
