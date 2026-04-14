import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common';
import {
  CampaignChannel,
  CampaignStatus,
  CampaignDelayUnit,
  MessageDirection,
  Prisma,
  SequenceRunStatus,
  SequenceRunStepStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignService } from './campaign.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import {
  CampaignQueueRuntimeSnapshot,
  CampaignQueueService,
} from './campaign-queue.service';

interface RuntimeStepRecord {
  id: string;
  runId: string;
  order: number;
  channel: CampaignChannel;
  messageTemplate: string;
  scheduledFor: Date;
  status: SequenceRunStepStatus;
  attempts: number;
  run: {
    id: string;
    tenantId: string;
    campaignId: string;
    contactId: string;
    cardId: string | null;
    status: SequenceRunStatus;
    campaign: {
      id: string;
      name: string;
      status: CampaignStatus;
    };
    contact: {
      id: string;
      name: string;
      phone: string | null;
    };
  };
}

interface CampaignDeadLetterRecord {
  id: string;
  runId: string;
  order: number;
  status: SequenceRunStepStatus;
  scheduledFor: Date;
  deadLetteredAt: Date | null;
  deadLetterReason: string | null;
  manualRequeueCount: number;
  run: {
    id: string;
    tenantId: string;
    campaignId: string;
    campaign: {
      id: string;
      name: string;
    };
    contact: {
      id: string;
      name: string;
    };
  };
}

export interface CampaignRuntimeStatusResponse extends CampaignQueueRuntimeSnapshot {
  runtimePollMs: number;
  queuedSteps: number;
  pendingRuns: number;
  runningRuns: number;
  failedRuns: number;
  completedRuns: number;
  pendingSteps: number;
  runningSteps: number;
  failedSteps: number;
  deadLetterSteps: number;
  nextScheduledAt: Date | null;
  lastProcessedAt: Date | null;
  recentDeadLetters: CampaignRuntimeDeadLetterResponse[];
}

export interface CampaignRuntimeDeadLetterResponse {
  stepId: string;
  runId: string;
  campaignId: string;
  campaignName: string;
  contactId: string;
  contactName: string;
  order: number;
  status: SequenceRunStepStatus;
  scheduledFor: Date;
  failedAt: Date | null;
  deadLetteredAt: Date | null;
  deadLetterReason: string | null;
  manualRequeueCount: number;
}

export interface CampaignRuntimeStartResponse {
  campaignId: string;
  campaignName: string;
  launchAt: Date;
  recipients: number;
  runsCreated: number;
  stepsCreated: number;
  skippedRecipients: number;
}

export interface CampaignRuntimeProcessResponse {
  processedAt: Date;
  processedSteps: number;
  queuedSteps: number;
  sentSteps: number;
  failedSteps: number;
  skippedSteps: number;
  nextScheduledAt: Date | null;
}

export interface CampaignRuntimeRequeueResponse {
  requeuedSteps: number;
  runId: string | null;
  requeuedAt: Date;
}

@Injectable()
export class CampaignRuntimeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CampaignRuntimeService.name);
  private readonly runtimePollMs = this.parsePositiveInteger(
    process.env.CAMPAIGN_RUNTIME_POLL_MS,
    10000,
  );
  private runtimeInterval: ReturnType<typeof setInterval> | null = null;
  private pollingTickRunning = false;
  private lastProcessedAt: Date | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly campaignService: CampaignService,
    private readonly whatsappService: WhatsappService,
    @Inject(forwardRef(() => CampaignQueueService))
    private readonly campaignQueueService: CampaignQueueService,
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

  public async startCampaignRuntime(
    tenantId: string,
    campaignId: string,
  ): Promise<CampaignRuntimeStartResponse> {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, tenantId },
      include: {
        audience: true,
        steps: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException(
        `Erro no Backend: Campanha com ID '${campaignId}' nao encontrada neste tenant.`,
      );
    }

    if (campaign.status !== CampaignStatus.ACTIVE) {
      throw new BadRequestException(
        'Erro no Backend: A campanha precisa estar ativa para iniciar o runtime.',
      );
    }

    const featureFlags = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { featureFlags: true },
    });
    const normalizedFlags = this.normalizeFeatureFlags(
      featureFlags?.featureFlags,
    );

    if (!normalizedFlags.outboundEnabled) {
      throw new BadRequestException(
        'Erro no Backend: Outbound esta desabilitado para este tenant.',
      );
    }

    if (!campaign.audienceId || !campaign.audience) {
      throw new BadRequestException(
        'Erro no Backend: A campanha precisa de uma audiencia vinculada.',
      );
    }

    const materialization =
      await this.campaignService.resolveAudienceMaterialization(
        tenantId,
        campaign.audienceId,
      );

    if (materialization.contactCount === 0) {
      return {
        campaignId: campaign.id,
        campaignName: campaign.name,
        launchAt: campaign.launchAt ?? new Date(),
        recipients: 0,
        runsCreated: 0,
        stepsCreated: 0,
        skippedRecipients: 0,
      };
    }

    const contacts = await this.prisma.contact.findMany({
      where: {
        tenantId,
        id: {
          in: materialization.contactIds,
        },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        cards: {
          take: 1,
          orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
          select: {
            id: true,
          },
        },
      },
    });

    const activeRunContacts = await this.prisma.sequenceRun.findMany({
      where: {
        tenantId,
        campaignId,
        status: {
          in: [SequenceRunStatus.PENDING, SequenceRunStatus.RUNNING],
        },
        contactId: {
          in: contacts.map((contact) => contact.id),
        },
      },
      select: { contactId: true },
    });
    const activeRunContactIds = new Set(
      activeRunContacts.map((item) => item.contactId),
    );

    const startAt = campaign.launchAt ?? new Date();
    let runsCreated = 0;
    let stepsCreated = 0;
    let skippedRecipients = 0;

    for (const contact of contacts) {
      if (activeRunContactIds.has(contact.id)) {
        skippedRecipients += 1;
        continue;
      }

      const run = await this.prisma.sequenceRun.create({
        data: {
          tenantId,
          campaignId: campaign.id,
          audienceId: campaign.audienceId,
          contactId: contact.id,
          cardId: contact.cards[0]?.id ?? null,
          status: SequenceRunStatus.PENDING,
          triggerSource: 'campaign_runtime_start',
          nextRunAt: startAt,
          steps: {
            create: campaign.steps.map((step, index) => ({
              tenantId,
              order: step.order,
              channel: step.channel,
              delayAmount: step.delayAmount,
              delayUnit: step.delayUnit,
              messageTemplate: step.messageTemplate,
              scheduledFor: this.resolveStepSchedule(
                startAt,
                campaign.steps,
                index,
              ),
            })),
          },
        },
        include: {
          steps: {
            orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
          },
        },
      });

      runsCreated += 1;
      stepsCreated += campaign.steps.length;

      await this.enqueueCampaignRunSteps(run.steps);

      await this.prisma.sequenceRun.update({
        where: { id: run.id },
        data: {
          status:
            campaign.steps.length > 0
              ? SequenceRunStatus.PENDING
              : SequenceRunStatus.COMPLETED,
          startedAt: campaign.steps.length > 0 ? null : new Date(),
          completedAt: campaign.steps.length > 0 ? null : new Date(),
          nextRunAt: campaign.steps.length > 0 ? startAt : null,
        },
      });
    }

    return {
      campaignId: campaign.id,
      campaignName: campaign.name,
      launchAt: startAt,
      recipients: contacts.length,
      runsCreated,
      stepsCreated,
      skippedRecipients,
    };
  }

  public async processDueRuns(
    tenantId?: string,
  ): Promise<CampaignRuntimeProcessResponse> {
    const now = new Date();
    const dueSteps = await this.prisma.sequenceRunStep.findMany({
      where: {
        status: SequenceRunStepStatus.PENDING,
        scheduledFor: {
          lte: now,
        },
        ...(tenantId ? { tenantId } : {}),
        run: {
          ...(tenantId ? { tenantId } : {}),
          status: {
            in: [SequenceRunStatus.PENDING, SequenceRunStatus.RUNNING],
          },
        },
      },
      include: {
        run: {
          include: {
            campaign: true,
            contact: true,
          },
        },
      },
      orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'asc' }],
      take: 25,
    });

    let processedSteps = 0;
    let queuedSteps = 0;
    let sentSteps = 0;
    let failedSteps = 0;
    let skippedSteps = 0;

    for (const step of dueSteps) {
      const enqueued = await this.enqueueCampaignStep(
        step.id,
        step.scheduledFor,
      );
      if (enqueued) {
        queuedSteps += 1;
        await this.prisma.sequenceRunStep.update({
          where: { id: step.id },
          data: {
            status: SequenceRunStepStatus.QUEUED,
            lastError: null,
          },
        });
        continue;
      }

      const result = await this.processStep(step);
      processedSteps += 1;

      if (result === 'SENT') {
        sentSteps += 1;
      } else if (result === 'FAILED') {
        failedSteps += 1;
      } else if (result === 'SKIPPED') {
        skippedSteps += 1;
      }
    }

    const nextPending = await this.prisma.sequenceRunStep.findFirst({
      where: {
        status: SequenceRunStepStatus.PENDING,
        scheduledFor: {
          lte: now,
        },
        ...(tenantId ? { tenantId } : {}),
      },
      orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'asc' }],
      select: {
        scheduledFor: true,
      },
    });

    this.lastProcessedAt = processedSteps > 0 ? now : this.lastProcessedAt;

    return {
      processedAt: now,
      processedSteps,
      queuedSteps,
      sentSteps,
      failedSteps,
      skippedSteps,
      nextScheduledAt: nextPending?.scheduledFor ?? null,
    };
  }

  public async getRuntimeStatus(
    tenantId?: string,
  ): Promise<CampaignRuntimeStatusResponse> {
    const [
      queuedSteps,
      pendingRuns,
      runningRuns,
      failedRuns,
      completedRuns,
      pendingSteps,
      runningSteps,
      failedSteps,
      deadLetterSteps,
      nextPendingStep,
      recentDeadLetters,
    ] = await Promise.all([
      this.prisma.sequenceRunStep.count({
        where: {
          status: SequenceRunStepStatus.QUEUED,
          ...(tenantId ? { tenantId } : {}),
        },
      }),
      this.prisma.sequenceRun.count({
        where: {
          status: SequenceRunStatus.PENDING,
          ...(tenantId ? { tenantId } : {}),
        },
      }),
      this.prisma.sequenceRun.count({
        where: {
          status: SequenceRunStatus.RUNNING,
          ...(tenantId ? { tenantId } : {}),
        },
      }),
      this.prisma.sequenceRun.count({
        where: {
          status: SequenceRunStatus.FAILED,
          ...(tenantId ? { tenantId } : {}),
        },
      }),
      this.prisma.sequenceRun.count({
        where: {
          status: SequenceRunStatus.COMPLETED,
          ...(tenantId ? { tenantId } : {}),
        },
      }),
      this.prisma.sequenceRunStep.count({
        where: {
          status: SequenceRunStepStatus.PENDING,
          ...(tenantId ? { tenantId } : {}),
        },
      }),
      this.prisma.sequenceRunStep.count({
        where: {
          status: SequenceRunStepStatus.RUNNING,
          ...(tenantId ? { tenantId } : {}),
        },
      }),
      this.prisma.sequenceRunStep.count({
        where: {
          status: SequenceRunStepStatus.FAILED,
          ...(tenantId ? { tenantId } : {}),
        },
      }),
      this.prisma.sequenceRunStep.count({
        where: {
          status: SequenceRunStepStatus.FAILED,
          deadLetteredAt: { not: null },
          ...(tenantId ? { tenantId } : {}),
        },
      }),
      this.prisma.sequenceRunStep.findFirst({
        where: {
          status: {
            in: [SequenceRunStepStatus.PENDING, SequenceRunStepStatus.QUEUED],
          },
          ...(tenantId ? { tenantId } : {}),
        },
        orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'asc' }],
        select: {
          scheduledFor: true,
        },
      }),
      this.prisma.sequenceRunStep.findMany({
        where: {
          status: SequenceRunStepStatus.FAILED,
          deadLetteredAt: { not: null },
          ...(tenantId ? { tenantId } : {}),
        },
        select: {
          id: true,
          runId: true,
          order: true,
          status: true,
          scheduledFor: true,
          deadLetteredAt: true,
          deadLetterReason: true,
          manualRequeueCount: true,
          run: {
            select: {
              id: true,
              tenantId: true,
              campaignId: true,
              campaign: {
                select: {
                  id: true,
                  name: true,
                },
              },
              contact: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: [{ deadLetteredAt: 'desc' }, { updatedAt: 'desc' }],
        take: 5,
      }),
    ]);

    return {
      ...this.campaignQueueService.getRuntimeSnapshot(),
      runtimePollMs: this.runtimePollMs,
      queuedSteps,
      pendingRuns,
      runningRuns,
      failedRuns,
      completedRuns,
      pendingSteps,
      runningSteps,
      failedSteps,
      deadLetterSteps,
      nextScheduledAt: nextPendingStep?.scheduledFor ?? null,
      lastProcessedAt: this.lastProcessedAt,
      recentDeadLetters: recentDeadLetters.map((step) =>
        this.toDeadLetterResponse(step),
      ),
    };
  }

  public async requeueFailedStep(
    tenantId: string,
    stepId: string,
  ): Promise<CampaignRuntimeRequeueResponse> {
    const step = await this.prisma.sequenceRunStep.findFirst({
      where: {
        id: stepId,
        tenantId,
        status: SequenceRunStepStatus.FAILED,
      },
    });

    if (!step) {
      throw new NotFoundException(
        `Erro no Backend: Step '${stepId}' nao encontrado ou nao esta falhado neste tenant.`,
      );
    }

    return this.requeueStepInternal(step.id);
  }

  public async requeueFailedRunSteps(
    tenantId: string,
    campaignId: string,
    runId: string,
  ): Promise<CampaignRuntimeRequeueResponse> {
    const run = await this.prisma.sequenceRun.findFirst({
      where: {
        id: runId,
        tenantId,
        campaignId,
      },
      include: {
        steps: {
          where: {
            status: SequenceRunStepStatus.FAILED,
          },
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!run) {
      throw new NotFoundException(
        `Erro no Backend: Execucao '${runId}' nao encontrada neste tenant/campanha.`,
      );
    }

    let requeuedSteps = 0;
    for (const step of run.steps) {
      const result = await this.requeueStepInternal(step.id);
      if (result.requeuedSteps > 0) {
        requeuedSteps += 1;
      }
    }

    return {
      requeuedSteps,
      runId: run.id,
      requeuedAt: new Date(),
    };
  }

  public async listCampaignRuns(tenantId: string, campaignId: string) {
    const runs = await this.prisma.sequenceRun.findMany({
      where: { tenantId, campaignId },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        steps: {
          orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'asc' }],
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return runs;
  }

  public async processQueuedStepById(
    stepId: string,
  ): Promise<'SENT' | 'FAILED' | 'SKIPPED' | null> {
    const step = await this.prisma.sequenceRunStep.findUnique({
      where: { id: stepId },
      include: {
        run: {
          include: {
            campaign: true,
            contact: true,
          },
        },
      },
    });

    if (!step) {
      return null;
    }

    return this.processStep(step as RuntimeStepRecord);
  }

  private async runPollingTick(): Promise<void> {
    if (this.pollingTickRunning) {
      return;
    }

    this.pollingTickRunning = true;
    try {
      const summary = await this.processDueRuns();
      if (summary.processedSteps > 0) {
        this.logger.log(
          `Campaign runtime processou ${summary.processedSteps} step(s), enviou ${summary.sentSteps}, falhou ${summary.failedSteps} e ignorou ${summary.skippedSteps}.`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Falha ao processar jobs pendentes de campanhas.',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.pollingTickRunning = false;
    }
  }

  private async processStep(
    step: RuntimeStepRecord,
  ): Promise<'SENT' | 'FAILED' | 'SKIPPED'> {
    const processableStatuses: SequenceRunStepStatus[] = [
      SequenceRunStepStatus.PENDING,
      SequenceRunStepStatus.QUEUED,
      SequenceRunStepStatus.RUNNING,
    ];

    if (!processableStatuses.includes(step.status)) {
      return 'SKIPPED';
    }

    await this.prisma.sequenceRunStep.update({
      where: { id: step.id },
      data: {
        status: SequenceRunStepStatus.RUNNING,
        startedAt: new Date(),
        attempts: {
          increment: 1,
        },
      },
    });

    if (step.run.campaign.status !== CampaignStatus.ACTIVE) {
      await this.markStepFailed(step.id, 'A campanha deixou de estar ativa.');
      return 'FAILED';
    }

    if (step.channel !== CampaignChannel.WHATSAPP) {
      await this.markStepSkipped(step.id, 'Canal nao suportado neste corte.');
      return 'SKIPPED';
    }

    if (!step.run.contact.phone?.trim()) {
      await this.markStepFailed(step.id, 'Contato sem telefone para outbound.');
      return 'FAILED';
    }

    try {
      const runRecord = await this.prisma.sequenceRun.findUnique({
        where: { id: step.runId },
        select: {
          startedAt: true,
        },
      });

      await this.prisma.sequenceRun.update({
        where: { id: step.runId },
        data: {
          status: SequenceRunStatus.RUNNING,
          startedAt: runRecord?.startedAt ?? new Date(),
          nextRunAt: step.scheduledFor,
        },
      });

      const message = await this.whatsappService.logMessage(step.run.tenantId, {
        contactId: step.run.contactId,
        content: step.messageTemplate,
        direction: MessageDirection.OUTBOUND,
        cardId: step.run.cardId ?? undefined,
        externalId: `sequence-run-${step.id}`,
      });

      await this.prisma.sequenceRunStep.update({
        where: { id: step.id },
        data: {
          status: SequenceRunStepStatus.SENT,
          completedAt: new Date(),
          externalMessageId: message.externalId ?? message.id,
          deliveryMode: message.deliveryMode ?? null,
          deliveryError: message.deliveryError ?? null,
          lastError: null,
          deadLetteredAt: null,
          deadLetterReason: null,
          manuallyRequeuedAt: null,
        },
      });

      await this.refreshRunProgress(step.runId);
      return 'SENT';
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Erro desconhecido no outbound.';
      await this.markStepFailed(step.id, errorMessage);
      await this.refreshRunProgress(step.runId);
      return 'FAILED';
    }
  }

  private async markStepFailed(stepId: string, errorMessage: string) {
    await this.prisma.sequenceRunStep.update({
      where: { id: stepId },
      data: {
        status: SequenceRunStepStatus.FAILED,
        completedAt: new Date(),
        lastError: errorMessage,
        deliveryError: errorMessage,
        deadLetteredAt: new Date(),
        deadLetterReason: errorMessage,
      },
    });
  }

  private async markStepSkipped(stepId: string, reason: string) {
    await this.prisma.sequenceRunStep.update({
      where: { id: stepId },
      data: {
        status: SequenceRunStepStatus.SKIPPED,
        completedAt: new Date(),
        lastError: reason,
      },
    });
  }

  private async refreshRunProgress(runId: string) {
    const [
      pendingCount,
      queuedCount,
      runningCount,
      failedCount,
      nextPendingStep,
    ] = await Promise.all([
      this.prisma.sequenceRunStep.count({
        where: {
          runId,
          status: SequenceRunStepStatus.PENDING,
        },
      }),
      this.prisma.sequenceRunStep.count({
        where: {
          runId,
          status: SequenceRunStepStatus.QUEUED,
        },
      }),
      this.prisma.sequenceRunStep.count({
        where: {
          runId,
          status: SequenceRunStepStatus.RUNNING,
        },
      }),
      this.prisma.sequenceRunStep.count({
        where: {
          runId,
          status: SequenceRunStepStatus.FAILED,
        },
      }),
      this.prisma.sequenceRunStep.findFirst({
        where: {
          runId,
          status: {
            in: [SequenceRunStepStatus.PENDING, SequenceRunStepStatus.QUEUED],
          },
        },
        orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'asc' }],
        select: {
          scheduledFor: true,
        },
      }),
    ]);

    const nextRunAt = nextPendingStep?.scheduledFor ?? null;
    const status =
      failedCount > 0
        ? SequenceRunStatus.FAILED
        : pendingCount > 0 || queuedCount > 0 || runningCount > 0
          ? SequenceRunStatus.RUNNING
          : SequenceRunStatus.COMPLETED;

    await this.prisma.sequenceRun.update({
      where: { id: runId },
      data: {
        status,
        completedAt: status === SequenceRunStatus.COMPLETED ? new Date() : null,
        nextRunAt,
        currentStepIndex: await this.resolveCurrentStepIndex(runId),
      },
    });
  }

  private async resolveCurrentStepIndex(runId: string): Promise<number> {
    const lastSentStep = await this.prisma.sequenceRunStep.findFirst({
      where: {
        runId,
        status: SequenceRunStepStatus.SENT,
      },
      orderBy: [{ order: 'desc' }, { completedAt: 'desc' }],
      select: {
        order: true,
      },
    });

    return lastSentStep?.order ?? 0;
  }

  private async requeueStepInternal(
    stepId: string,
  ): Promise<CampaignRuntimeRequeueResponse> {
    const step = await this.prisma.sequenceRunStep.findUnique({
      where: { id: stepId },
      select: {
        id: true,
        runId: true,
        tenantId: true,
        scheduledFor: true,
      },
    });

    if (!step) {
      throw new NotFoundException(
        `Erro no Backend: Step '${stepId}' nao encontrado.`,
      );
    }

    const requeueAt = new Date();
    const enqueued = await this.enqueueCampaignStep(step.id, requeueAt);
    this.campaignQueueService.recordManualRequeue();

    await this.prisma.sequenceRunStep.update({
      where: { id: step.id },
      data: {
        status: enqueued
          ? SequenceRunStepStatus.QUEUED
          : SequenceRunStepStatus.PENDING,
        scheduledFor: requeueAt,
        startedAt: null,
        completedAt: null,
        lastError: null,
        deliveryError: null,
        deadLetteredAt: null,
        deadLetterReason: null,
        manuallyRequeuedAt: requeueAt,
        manualRequeueCount: {
          increment: 1,
        },
      },
    });

    await this.prisma.sequenceRun.update({
      where: { id: step.runId },
      data: {
        status: SequenceRunStatus.RUNNING,
        completedAt: null,
        nextRunAt: requeueAt,
      },
    });

    await this.refreshRunProgress(step.runId);

    return {
      requeuedSteps: 1,
      runId: step.runId,
      requeuedAt: requeueAt,
    };
  }

  private toDeadLetterResponse(
    step: CampaignDeadLetterRecord,
  ): CampaignRuntimeDeadLetterResponse {
    return {
      stepId: step.id,
      runId: step.runId,
      campaignId: step.run.campaignId,
      campaignName: step.run.campaign.name,
      contactId: step.run.contact.id,
      contactName: step.run.contact.name,
      order: step.order,
      status: step.status,
      scheduledFor: step.scheduledFor,
      failedAt: step.deadLetteredAt,
      deadLetteredAt: step.deadLetteredAt,
      deadLetterReason: step.deadLetterReason,
      manualRequeueCount: step.manualRequeueCount,
    };
  }

  private resolveStepSchedule(
    startAt: Date,
    steps: Array<{
      delayAmount: number;
      delayUnit: CampaignDelayUnit;
    }>,
    index: number,
  ): Date {
    const seconds = steps
      .slice(0, index + 1)
      .reduce(
        (total, step) =>
          total + this.toSeconds(step.delayAmount, step.delayUnit),
        0,
      );
    return new Date(startAt.getTime() + seconds * 1000);
  }

  private toSeconds(amount: number, unit: CampaignDelayUnit): number {
    switch (unit) {
      case CampaignDelayUnit.MINUTES:
        return amount * 60;
      case CampaignDelayUnit.HOURS:
        return amount * 60 * 60;
      case CampaignDelayUnit.DAYS:
        return amount * 60 * 60 * 24;
      default:
        return amount;
    }
  }

  private normalizeFeatureFlags(value: Prisma.JsonValue | null | undefined): {
    outboundEnabled: boolean;
    coldOutboundEnabled: boolean;
  } {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {
        outboundEnabled: false,
        coldOutboundEnabled: false,
      };
    }

    const record = value as Record<string, unknown>;
    return {
      outboundEnabled: record.outboundEnabled === true,
      coldOutboundEnabled: record.coldOutboundEnabled === true,
    };
  }

  private parsePositiveInteger(
    rawValue: string | undefined,
    fallback: number,
  ): number {
    const parsedValue = Number(rawValue);
    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
      return fallback;
    }

    return Math.trunc(parsedValue);
  }

  private async enqueueCampaignRunSteps(
    steps: Array<{
      id: string;
      scheduledFor: Date;
    }>,
  ): Promise<void> {
    for (const step of steps) {
      const enqueued = await this.enqueueCampaignStep(
        step.id,
        step.scheduledFor,
      );
      if (!enqueued) {
        continue;
      }

      await this.prisma.sequenceRunStep.updateMany({
        where: {
          id: step.id,
          status: SequenceRunStepStatus.PENDING,
        },
        data: {
          status: SequenceRunStepStatus.QUEUED,
          lastError: null,
        },
      });
    }
  }

  private async enqueueCampaignStep(
    campaignStepId: string,
    scheduledFor: Date,
  ): Promise<boolean> {
    return this.campaignQueueService.enqueueCampaignStep(
      campaignStepId,
      scheduledFor,
    );
  }
}
