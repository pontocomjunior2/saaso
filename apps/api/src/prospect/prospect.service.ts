import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common';
import {
  MessageDirection,
  MessageStatus,
  ProspectStatus,
  ProspectTaskStatus,
  ProspectTaskEventType,
  ProspectTaskType,
  Company,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeTenantFeatureFlags } from '../tenant/tenant-feature-flags';
import {
  ProspectQueueRuntimeSnapshot,
  ProspectQueueService,
} from './prospect-queue.service';
import {
  ImportProspectsDto,
  ProspectInputDto,
} from './dto/import-prospects.dto';
import { UpdateProspectDto } from './dto/update-prospect.dto';
import { CreateProspectTaskDto } from './dto/create-prospect-task.dto';
import { ConvertProspectDto } from './dto/convert-prospect.dto';
import { WhatsappService } from '../whatsapp/whatsapp.service';

export interface ProspectTaskResponse {
  id: string;
  prospectId: string;
  status: ProspectTaskStatus;
  prompt: string | null;
  result: unknown;
  lastError: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProspectResponse {
  id: string;
  name: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  source: string;
  status: ProspectStatus;
  score: number;
  metadata: unknown;
  optedOutAt: Date | null;
  optedOutReason: string | null;
  convertedContactId: string | null;
  researchTasks: ProspectTaskResponse[];
  enrichmentTasks: ProspectTaskResponse[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ProspectConversionResponse {
  prospect: ProspectResponse;
  company: {
    id: string;
    name: string;
  } | null;
  contact: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  };
  card: {
    id: string;
    title: string;
    stageId: string;
    stageName: string;
    pipelineName: string;
  } | null;
}

interface ConversionStageRecord {
  id: string;
  name: string;
  order: number;
  pipelineId: string;
  pipeline: {
    id: string;
    name: string;
  };
}

export interface ProspectRuntimeStatusResponse extends ProspectQueueRuntimeSnapshot {
  runtimePollMs: number;
  pendingResearchTasks: number;
  runningResearchTasks: number;
  failedResearchTasks: number;
  completedResearchTasks: number;
  pendingEnrichmentTasks: number;
  runningEnrichmentTasks: number;
  failedEnrichmentTasks: number;
  completedEnrichmentTasks: number;
  lastProcessedAt: Date | null;
  nextScheduledAt: Date | null;
  recentEvents: ProspectRuntimeEventResponse[];
}

export interface ProspectRuntimeEventResponse {
  id: string;
  prospectId: string | null;
  taskType: ProspectTaskType;
  eventType: ProspectTaskEventType;
  taskId: string;
  title: string;
  payload: unknown;
  createdAt: Date;
}

export interface ProspectRuntimeProcessResponse {
  processedAt: Date;
  processedTasks: number;
  completedTasks: number;
  failedTasks: number;
  skippedTasks: number;
  nextScheduledAt: Date | null;
}

type ProspectRuntimeTaskOutcome = 'COMPLETED' | 'FAILED' | 'SKIPPED';

interface ProspectResearchOutcome {
  taskType: 'research';
  prospectId: string;
  summary: string;
  prompt: string | null;
  signals: {
    hasCompany: boolean;
    hasEmail: boolean;
    hasPhone: boolean;
    hasTitle: boolean;
    source: string;
  };
  nextAction: 'enrichment' | 'manual_review';
  scoreDelta: number;
}

interface ProspectEnrichmentOutcome {
  taskType: 'enrichment';
  prospectId: string;
  summary: string;
  prompt: string | null;
  companyName: string | null;
  title: string | null;
  outreachBrief: ProspectOutreachBrief;
  insights: {
    source: string;
    existingMetadata: Record<string, unknown>;
  };
  nextAction: 'ready_for_outreach';
  scoreDelta: number;
}

interface ProspectOutreachBrief {
  angle: string;
  openingLine: string;
  cta: string;
  talkingPoints: string[];
  riskFlags: string[];
  suggestedTone: string;
}

interface ProspectOutreachMetadata {
  state?: 'sent' | 'failed' | 'pending';
  sentAt?: string | null;
  attemptedAt?: string | null;
  lastAttemptAt?: string | null;
  retryCount?: number | null;
  contactId?: string | null;
  messageId?: string | null;
  deliveryMode?: 'cloud_api' | 'local_demo' | null;
  status?: MessageStatus | null;
  error?: string | null;
  failureKind?: 'permanent' | 'retryable' | 'unknown' | null;
  retryable?: boolean | null;
}

interface ProspectOutreachDispatchOutcome {
  attempted: boolean;
  sent: boolean;
  status: MessageStatus | null;
  deliveryMode: 'cloud_api' | 'local_demo' | null;
  externalId: string | null;
  contactId: string | null;
  contactCreated: boolean;
  error: string | null;
  prospectStatus: ProspectStatus;
}

@Injectable()
export class ProspectService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProspectService.name);
  private readonly runtimePollMs = this.parsePositiveInteger(
    process.env.PROSPECT_RUNTIME_POLL_MS,
    15000,
  );
  private runtimeInterval: ReturnType<typeof setInterval> | null = null;
  private pollingTickRunning = false;
  private lastProcessedAt: Date | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ProspectQueueService))
    private readonly prospectQueueService: ProspectQueueService,
    private readonly whatsappService: WhatsappService,
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

  public async importProspects(
    tenantId: string,
    dto: ImportProspectsDto,
  ): Promise<{ importedCount: number; prospects: ProspectResponse[] }> {
    await this.ensureColdOutboundEnabled(tenantId);

    const uniqueInputs = this.deduplicateProspects(dto.prospects);
    const importedProspects: ProspectResponse[] = [];

    for (const input of uniqueInputs) {
      const prospect = await this.prisma.prospect.create({
        data: {
          tenantId,
          name: input.name.trim(),
          companyName: this.normalizeOptionalText(input.companyName),
          email: this.normalizeOptionalText(input.email),
          phone: this.normalizePhone(input.phone),
          title: this.normalizeOptionalText(input.title),
          source: input.source?.trim() || 'manual',
          score: input.score ?? 0,
        },
        include: {
          researchTasks: true,
          enrichmentTasks: true,
        },
      });

      importedProspects.push(this.mapProspect(prospect));
    }

    return {
      importedCount: importedProspects.length,
      prospects: importedProspects,
    };
  }

  public async findAllProspects(
    tenantId: string,
    search?: string,
  ): Promise<ProspectResponse[]> {
    const prospects = await this.prisma.prospect.findMany({
      where: {
        tenantId,
        ...(search?.trim()
          ? {
              OR: [
                { name: { contains: search.trim(), mode: 'insensitive' } },
                {
                  companyName: { contains: search.trim(), mode: 'insensitive' },
                },
                { email: { contains: search.trim(), mode: 'insensitive' } },
                { phone: { contains: search.trim(), mode: 'insensitive' } },
                { source: { contains: search.trim(), mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        researchTasks: true,
        enrichmentTasks: true,
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return prospects.map((prospect) => this.mapProspect(prospect));
  }

  public async updateProspect(
    tenantId: string,
    prospectId: string,
    dto: UpdateProspectDto,
  ): Promise<ProspectResponse> {
    const prospect = await this.findProspectRecord(tenantId, prospectId);

    const updated = await this.prisma.prospect.update({
      where: { id: prospect.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.companyName !== undefined
          ? { companyName: this.normalizeOptionalText(dto.companyName) }
          : {}),
        ...(dto.phone !== undefined
          ? { phone: this.normalizePhone(dto.phone) }
          : {}),
        ...(dto.title !== undefined
          ? { title: this.normalizeOptionalText(dto.title) }
          : {}),
        ...(dto.source !== undefined
          ? { source: dto.source.trim() || 'manual' }
          : {}),
      },
      include: {
        researchTasks: true,
        enrichmentTasks: true,
      },
    });

    return this.mapProspect(updated);
  }

  public async findOneProspect(
    tenantId: string,
    prospectId: string,
  ): Promise<ProspectResponse> {
    return this.mapProspect(
      await this.findProspectRecord(tenantId, prospectId),
    );
  }

  public async optOutProspect(
    tenantId: string,
    prospectId: string,
    reason?: string,
  ): Promise<ProspectResponse> {
    const prospect = await this.findProspectRecord(tenantId, prospectId);
    const updated = await this.prisma.prospect.update({
      where: { id: prospect.id },
      data: {
        status: ProspectStatus.OPTED_OUT,
        optedOutAt: new Date(),
        optedOutReason: this.normalizeOptionalText(reason) ?? 'Opt-out manual.',
      },
      include: {
        researchTasks: true,
        enrichmentTasks: true,
      },
    });

    return this.mapProspect(updated);
  }

  public async createResearchTask(
    tenantId: string,
    prospectId: string,
    dto: CreateProspectTaskDto,
  ): Promise<ProspectTaskResponse> {
    await this.ensureColdOutboundEnabled(tenantId);
    await this.findProspectRecord(tenantId, prospectId);

    const task = await this.prisma.researchTask.create({
      data: {
        tenantId,
        prospectId,
        prompt: this.normalizeOptionalText(dto.prompt),
      },
    });

    await this.promoteProspectStatus(
      tenantId,
      prospectId,
      ProspectStatus.RESEARCHING,
    );
    await this.prospectQueueService.enqueueProspectTask('research', task.id);
    await this.recordTaskEvent(
      tenantId,
      prospectId,
      'research',
      ProspectTaskEventType.ENQUEUED,
      task.id,
      'Tarefa de pesquisa enfileirada',
      { prompt: this.normalizeOptionalText(dto.prompt) },
    );

    return this.mapTask(task);
  }

  public async createEnrichmentTask(
    tenantId: string,
    prospectId: string,
    dto: CreateProspectTaskDto,
  ): Promise<ProspectTaskResponse> {
    await this.ensureColdOutboundEnabled(tenantId);
    await this.findProspectRecord(tenantId, prospectId);

    const task = await this.prisma.enrichmentTask.create({
      data: {
        tenantId,
        prospectId,
        prompt: this.normalizeOptionalText(dto.prompt),
      },
    });

    await this.prospectQueueService.enqueueProspectTask('enrichment', task.id);
    await this.recordTaskEvent(
      tenantId,
      prospectId,
      'enrichment',
      ProspectTaskEventType.ENQUEUED,
      task.id,
      'Tarefa de enriquecimento enfileirada',
      { prompt: this.normalizeOptionalText(dto.prompt) },
    );

    return this.mapTask(task);
  }

  public async getRuntimeStatus(
    tenantId?: string,
  ): Promise<ProspectRuntimeStatusResponse> {
    const [
      pendingResearchTasks,
      runningResearchTasks,
      failedResearchTasks,
      completedResearchTasks,
      pendingEnrichmentTasks,
      runningEnrichmentTasks,
      failedEnrichmentTasks,
      completedEnrichmentTasks,
      nextResearchTask,
      nextEnrichmentTask,
      recentEvents,
    ] = await Promise.all([
      this.prisma.researchTask.count({
        where: {
          status: ProspectTaskStatus.PENDING,
          ...(tenantId ? { tenantId } : {}),
        },
      }),
      this.prisma.researchTask.count({
        where: {
          status: ProspectTaskStatus.RUNNING,
          ...(tenantId ? { tenantId } : {}),
        },
      }),
      this.prisma.researchTask.count({
        where: {
          status: ProspectTaskStatus.FAILED,
          ...(tenantId ? { tenantId } : {}),
        },
      }),
      this.prisma.researchTask.count({
        where: {
          status: ProspectTaskStatus.COMPLETED,
          ...(tenantId ? { tenantId } : {}),
        },
      }),
      this.prisma.enrichmentTask.count({
        where: {
          status: ProspectTaskStatus.PENDING,
          ...(tenantId ? { tenantId } : {}),
        },
      }),
      this.prisma.enrichmentTask.count({
        where: {
          status: ProspectTaskStatus.RUNNING,
          ...(tenantId ? { tenantId } : {}),
        },
      }),
      this.prisma.enrichmentTask.count({
        where: {
          status: ProspectTaskStatus.FAILED,
          ...(tenantId ? { tenantId } : {}),
        },
      }),
      this.prisma.enrichmentTask.count({
        where: {
          status: ProspectTaskStatus.COMPLETED,
          ...(tenantId ? { tenantId } : {}),
        },
      }),
      this.prisma.researchTask.findFirst({
        where: {
          status: ProspectTaskStatus.PENDING,
          ...(tenantId ? { tenantId } : {}),
        },
        select: { createdAt: true },
        orderBy: [{ createdAt: 'asc' }],
      }),
      this.prisma.enrichmentTask.findFirst({
        where: {
          status: ProspectTaskStatus.PENDING,
          ...(tenantId ? { tenantId } : {}),
        },
        select: { createdAt: true },
        orderBy: [{ createdAt: 'asc' }],
      }),
      this.prisma.prospectTaskEvent.findMany({
        where: tenantId ? { tenantId } : {},
        orderBy: [{ createdAt: 'desc' }],
        take: 10,
      }),
    ]);

    return {
      ...this.prospectQueueService.getRuntimeSnapshot(),
      runtimePollMs: this.runtimePollMs,
      pendingResearchTasks,
      runningResearchTasks,
      failedResearchTasks,
      completedResearchTasks,
      pendingEnrichmentTasks,
      runningEnrichmentTasks,
      failedEnrichmentTasks,
      completedEnrichmentTasks,
      lastProcessedAt: this.lastProcessedAt,
      nextScheduledAt:
        this.pickEarlierDate(
          nextResearchTask?.createdAt ?? null,
          nextEnrichmentTask?.createdAt ?? null,
        ) ?? null,
      recentEvents: recentEvents.map((event) => ({
        id: event.id,
        prospectId: event.prospectId,
        taskType: event.taskType,
        eventType: event.eventType,
        taskId: event.taskId,
        title: event.title,
        payload: event.payload,
        createdAt: event.createdAt,
      })),
    };
  }

  public async processDueTasks(
    tenantId?: string,
  ): Promise<ProspectRuntimeProcessResponse> {
    const dueResearchTasks = await this.prisma.researchTask.findMany({
      where: {
        status: ProspectTaskStatus.PENDING,
        ...(tenantId ? { tenantId } : {}),
      },
      include: {
        prospect: true,
      },
      orderBy: [{ createdAt: 'asc' }],
      take: 10,
    });

    const dueEnrichmentTasks = await this.prisma.enrichmentTask.findMany({
      where: {
        status: ProspectTaskStatus.PENDING,
        ...(tenantId ? { tenantId } : {}),
      },
      include: {
        prospect: true,
      },
      orderBy: [{ createdAt: 'asc' }],
      take: 10,
    });

    let processedTasks = 0;
    let completedTasks = 0;
    let failedTasks = 0;
    let skippedTasks = 0;

    for (const task of dueResearchTasks) {
      const result = await this.processResearchTask(task.id);
      processedTasks += 1;
      if (result === 'COMPLETED') {
        completedTasks += 1;
      } else if (result === 'FAILED') {
        failedTasks += 1;
      } else {
        skippedTasks += 1;
      }
    }

    for (const task of dueEnrichmentTasks) {
      const result = await this.processEnrichmentTask(task.id);
      processedTasks += 1;
      if (result === 'COMPLETED') {
        completedTasks += 1;
      } else if (result === 'FAILED') {
        failedTasks += 1;
      } else {
        skippedTasks += 1;
      }
    }

    this.lastProcessedAt =
      processedTasks > 0 ? new Date() : this.lastProcessedAt;

    return {
      processedAt: new Date(),
      processedTasks,
      completedTasks,
      failedTasks,
      skippedTasks,
      nextScheduledAt: null,
    };
  }

  public async processQueuedTaskById(
    taskType: 'research' | 'enrichment',
    taskId: string,
  ): Promise<ProspectRuntimeTaskOutcome | null> {
    if (taskType === 'research') {
      return this.processResearchTask(taskId);
    }

    return this.processEnrichmentTask(taskId);
  }

  public async requeueTask(
    tenantId: string,
    taskType: 'research' | 'enrichment',
    taskId: string,
  ): Promise<{
    taskType: 'research' | 'enrichment';
    taskId: string;
    status: ProspectTaskStatus;
    requeuedAt: Date;
  }> {
    await this.ensureColdOutboundEnabled(tenantId);

    const record =
      taskType === 'research'
        ? await this.prisma.researchTask.findFirst({
            where: { id: taskId, tenantId },
          })
        : await this.prisma.enrichmentTask.findFirst({
            where: { id: taskId, tenantId },
          });

    if (!record) {
      throw new NotFoundException(
        `Erro no Backend: Tarefa de prospect '${taskId}' nao encontrada neste tenant.`,
      );
    }

    const updated =
      taskType === 'research'
        ? await this.prisma.researchTask.update({
            where: { id: taskId },
            data: {
              status: ProspectTaskStatus.PENDING,
              startedAt: null,
              completedAt: null,
              lastError: null,
            },
          })
        : await this.prisma.enrichmentTask.update({
            where: { id: taskId },
            data: {
              status: ProspectTaskStatus.PENDING,
              startedAt: null,
              completedAt: null,
              lastError: null,
            },
          });

    this.prospectQueueService.recordManualRequeue();
    await this.prospectQueueService.enqueueProspectTask(taskType, taskId);
    await this.recordTaskEvent(
      tenantId,
      record.prospectId,
      taskType,
      ProspectTaskEventType.REQUEUED,
      taskId,
      'Tarefa reprocessada manualmente',
      { previousStatus: record.status },
    );

    return {
      taskType,
      taskId: updated.id,
      status: updated.status,
      requeuedAt: new Date(),
    };
  }

  public async convertProspect(
    tenantId: string,
    prospectId: string,
    dto: ConvertProspectDto,
  ): Promise<ProspectConversionResponse> {
    await this.ensureColdOutboundEnabled(tenantId);
    const prospect = await this.findProspectRecord(tenantId, prospectId);
    const stage = await this.resolveConversionStage(tenantId, dto.stageId);

    const result = await this.prisma.$transaction(async (tx) => {
      let company: Company | null = null;

      if (dto.companyId) {
        company = await tx.company.findFirst({
          where: {
            id: dto.companyId,
            tenantId,
          },
        });

        if (!company) {
          throw new BadRequestException(
            'Erro no Backend: A empresa informada nao pertence a este tenant.',
          );
        }
      } else if (dto.companyName?.trim() || prospect.companyName?.trim()) {
        const normalizedCompanyName =
          dto.companyName?.trim() || prospect.companyName?.trim() || '';
        const existingCompany = await tx.company.findFirst({
          where: {
            tenantId,
            name: {
              equals: normalizedCompanyName,
              mode: 'insensitive',
            },
          },
        });

        company =
          existingCompany ??
          (await tx.company.create({
            data: {
              tenantId,
              name: normalizedCompanyName,
            },
          }));
      }

      const existingContact = await tx.contact.findFirst({
        where: {
          tenantId,
          OR: [
            prospect.email
              ? {
                  email: {
                    equals: prospect.email,
                    mode: 'insensitive',
                  },
                }
              : undefined,
            prospect.phone ? { phone: prospect.phone } : undefined,
          ].filter(Boolean) as Prisma.ContactWhereInput[],
        },
        include: {
          company: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      const contact = existingContact
        ? await tx.contact.update({
            where: { id: existingContact.id },
            data: {
              name: prospect.name,
              email: prospect.email || existingContact.email,
              phone: prospect.phone || existingContact.phone,
              position: prospect.title || existingContact.position,
              companyId: company?.id ?? existingContact.companyId,
              tags: Array.from(
                new Set([...(existingContact.tags ?? []), 'prospect']),
              ),
            },
          })
        : await tx.contact.create({
            data: {
              tenantId,
              name: prospect.name,
              email: prospect.email || undefined,
              phone: prospect.phone || undefined,
              position: prospect.title || undefined,
              companyId: company?.id ?? undefined,
              tags: ['prospect'],
            },
          });

      const existingCard = await tx.card.findFirst({
        where: {
          tenantId,
          contactId: contact.id,
        },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          title: true,
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

      let card: {
        id: string;
        title: string;
        stageId: string;
        stageName: string;
        pipelineName: string;
      } | null = null;

      if (existingCard) {
        card = {
          id: existingCard.id,
          title: existingCard.title,
          stageId: existingCard.stage.id,
          stageName: existingCard.stage.name,
          pipelineName: existingCard.stage.pipeline.name,
        };
      } else {
        const lastCardInfo = await tx.card.aggregate({
          where: { stageId: stage.id },
          _max: { position: true },
        });

        const createdCard = await tx.card.create({
          data: {
            title:
              dto.cardTitle?.trim() ||
              `Prospect · ${contact.name} · ${stage.pipeline.name}`,
            stageId: stage.id,
            tenantId,
            contactId: contact.id,
            position:
              lastCardInfo._max.position !== null
                ? lastCardInfo._max.position + 1
                : 0,
            customFields: {
              source: prospect.source,
              prospectId: prospect.id,
              conversionType: 'prospect',
            } as Prisma.InputJsonValue,
          },
        });

        await tx.cardActivity.create({
          data: {
            cardId: createdCard.id,
            type: 'PROSPECT_CONVERTED',
            content: `Prospect convertido para ${stage.pipeline.name} > ${stage.name}.`,
          },
        });

        card = {
          id: createdCard.id,
          title: createdCard.title,
          stageId: stage.id,
          stageName: stage.name,
          pipelineName: stage.pipeline.name,
        };
      }

      const updatedProspect = await tx.prospect.update({
        where: { id: prospect.id },
        data: {
          status: ProspectStatus.CONVERTED,
          convertedContactId: contact.id,
          optedOutAt: null,
          optedOutReason: null,
          metadata: {
            ...(typeof prospect.metadata === 'object' && prospect.metadata
              ? (prospect.metadata as Record<string, unknown>)
              : {}),
            convertedAt: new Date().toISOString(),
            convertedContactId: contact.id,
            convertedCardId: card?.id ?? null,
          } as Prisma.InputJsonValue,
        },
        include: {
          researchTasks: true,
          enrichmentTasks: true,
        },
      });

      return {
        prospect: this.mapProspect(updatedProspect),
        company: company ? { id: company.id, name: company.name } : null,
        contact: {
          id: contact.id,
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
        },
        card,
      };
    });

    return result;
  }

  private async ensureColdOutboundEnabled(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { featureFlags: true },
    });
    const featureFlags = normalizeTenantFeatureFlags(tenant?.featureFlags);

    if (!featureFlags.coldOutboundEnabled) {
      throw new BadRequestException(
        'Erro no Backend: Prospecção fria está desabilitada para este tenant.',
      );
    }
  }

  private async processResearchTask(
    taskId: string,
  ): Promise<ProspectRuntimeTaskOutcome> {
    const claim = await this.prisma.researchTask.updateMany({
      where: {
        id: taskId,
        status: ProspectTaskStatus.PENDING,
      },
      data: {
        status: ProspectTaskStatus.RUNNING,
        startedAt: new Date(),
        lastError: null,
      },
    });

    if (claim.count === 0) {
      return 'SKIPPED';
    }

    const task = await this.prisma.researchTask.findUnique({
      where: { id: taskId },
      include: {
        prospect: true,
      },
    });

    if (!task) {
      return 'FAILED';
    }

    if (this.shouldSkipTask(task.prospect)) {
      await this.prisma.researchTask.update({
        where: { id: taskId },
        data: {
          status: ProspectTaskStatus.SKIPPED,
          completedAt: new Date(),
          result: {
            skipped: true,
            reason: 'Prospect nao esta mais elegivel para execucao.',
          } as Prisma.InputJsonValue,
        },
      });
      await this.recordTaskEvent(
        task.prospect.tenantId,
        task.prospectId,
        'research',
        ProspectTaskEventType.SKIPPED,
        taskId,
        'Tarefa de pesquisa ignorada',
        { reason: 'Prospect nao esta mais elegivel para execucao.' },
      );
      return 'SKIPPED';
    }

    try {
      await this.recordTaskEvent(
        task.prospect.tenantId,
        task.prospectId,
        'research',
        ProspectTaskEventType.STARTED,
        taskId,
        'Tarefa de pesquisa iniciada',
      );
      const outcome = this.buildResearchOutcome(task);
      await this.prisma.$transaction([
        this.prisma.researchTask.update({
          where: { id: taskId },
          data: {
            status: ProspectTaskStatus.COMPLETED,
            completedAt: new Date(),
            result: outcome as unknown as Prisma.InputJsonValue,
            lastError: null,
          },
        }),
        this.prisma.prospect.update({
          where: { id: task.prospectId },
          data: {
            status: ProspectStatus.RESEARCHING,
            score: {
              increment: outcome.scoreDelta,
            },
            metadata: this.mergeProspectMetadata(task.prospect.metadata, {
              research: outcome,
            }),
          },
        }),
      ]);

      await this.ensureFollowUpEnrichmentTask(
        task.prospectId,
        task.prospect.tenantId,
        taskId,
        outcome,
      );
      await this.refreshProspectLifecycleStatus(task.prospectId);
      await this.recordTaskEvent(
        task.prospect.tenantId,
        task.prospectId,
        'research',
        ProspectTaskEventType.COMPLETED,
        taskId,
        'Tarefa de pesquisa concluida',
        outcome,
      );
      return 'COMPLETED';
    } catch (error) {
      const message = this.extractErrorMessage(error);
      await this.prisma.researchTask.update({
        where: { id: taskId },
        data: {
          status: ProspectTaskStatus.FAILED,
          completedAt: new Date(),
          lastError: message,
        },
      });
      await this.recordTaskEvent(
        task.prospect.tenantId,
        task.prospectId,
        'research',
        ProspectTaskEventType.FAILED,
        taskId,
        'Tarefa de pesquisa falhou',
        { error: message },
      );
      return 'FAILED';
    }
  }

  private async processEnrichmentTask(
    taskId: string,
  ): Promise<ProspectRuntimeTaskOutcome> {
    const claim = await this.prisma.enrichmentTask.updateMany({
      where: {
        id: taskId,
        status: ProspectTaskStatus.PENDING,
      },
      data: {
        status: ProspectTaskStatus.RUNNING,
        startedAt: new Date(),
        lastError: null,
      },
    });

    if (claim.count === 0) {
      return 'SKIPPED';
    }

    const task = await this.prisma.enrichmentTask.findUnique({
      where: { id: taskId },
      include: {
        prospect: true,
      },
    });

    if (!task) {
      return 'FAILED';
    }

    if (this.shouldSkipTask(task.prospect)) {
      await this.prisma.enrichmentTask.update({
        where: { id: taskId },
        data: {
          status: ProspectTaskStatus.SKIPPED,
          completedAt: new Date(),
          result: {
            skipped: true,
            reason: 'Prospect nao esta mais elegivel para execucao.',
          } as Prisma.InputJsonValue,
        },
      });
      await this.recordTaskEvent(
        task.prospect.tenantId,
        task.prospectId,
        'enrichment',
        ProspectTaskEventType.SKIPPED,
        taskId,
        'Tarefa de enriquecimento ignorada',
        { reason: 'Prospect nao esta mais elegivel para execucao.' },
      );
      return 'SKIPPED';
    }

    try {
      await this.recordTaskEvent(
        task.prospect.tenantId,
        task.prospectId,
        'enrichment',
        ProspectTaskEventType.STARTED,
        taskId,
        'Tarefa de enriquecimento iniciada',
      );
      const outcome = this.buildEnrichmentOutcome(task);
      await this.prisma.$transaction([
        this.prisma.enrichmentTask.update({
          where: { id: taskId },
          data: {
            status: ProspectTaskStatus.COMPLETED,
            completedAt: new Date(),
            result: outcome as unknown as Prisma.InputJsonValue,
            lastError: null,
          },
        }),
        this.prisma.prospect.update({
          where: { id: task.prospectId },
          data: {
            status: ProspectStatus.READY,
            score: {
              increment: outcome.scoreDelta,
            },
            companyName: outcome.companyName ?? undefined,
            title: outcome.title ?? undefined,
            metadata: this.mergeProspectMetadata(task.prospect.metadata, {
              enrichment: outcome,
            }),
          },
        }),
      ]);

      const nextProspectMetadata = this.mergeProspectMetadata(
        task.prospect.metadata,
        { enrichment: outcome },
      );

      await this.refreshProspectLifecycleStatus(task.prospectId);
      const outreachDispatch = await this.dispatchProspectOutreach(
        task.prospect.tenantId,
        {
          ...task.prospect,
          companyName: outcome.companyName ?? task.prospect.companyName,
          title: outcome.title ?? task.prospect.title,
          metadata: nextProspectMetadata,
        },
        outcome,
      );

      await this.prisma.enrichmentTask.update({
        where: { id: taskId },
        data: {
          result: {
            ...(outcome as unknown as Record<string, unknown>),
            outreachDispatch,
          } as unknown as Prisma.InputJsonValue,
        },
      });

      if (outreachDispatch.prospectStatus !== ProspectStatus.READY) {
        await this.prisma.prospect.update({
          where: { id: task.prospectId },
          data: {
            status: outreachDispatch.prospectStatus,
          },
        });
      }

      await this.recordTaskEvent(
        task.prospect.tenantId,
        task.prospectId,
        'enrichment',
        ProspectTaskEventType.COMPLETED,
        taskId,
        'Tarefa de enriquecimento concluida',
        {
          ...outcome,
          outreachDispatch,
        },
      );
      return 'COMPLETED';
    } catch (error) {
      const message = this.extractErrorMessage(error);
      await this.prisma.enrichmentTask.update({
        where: { id: taskId },
        data: {
          status: ProspectTaskStatus.FAILED,
          completedAt: new Date(),
          lastError: message,
        },
      });
      await this.recordTaskEvent(
        task.prospect.tenantId,
        task.prospectId,
        'enrichment',
        ProspectTaskEventType.FAILED,
        taskId,
        'Tarefa de enriquecimento falhou',
        { error: message },
      );
      return 'FAILED';
    }
  }

  private async ensureFollowUpEnrichmentTask(
    prospectId: string,
    tenantId: string,
    sourceTaskId: string,
    researchOutcome: ProspectResearchOutcome,
  ): Promise<void> {
    if (researchOutcome.nextAction !== 'enrichment') {
      return;
    }

    const existingTask = await this.prisma.enrichmentTask.findFirst({
      where: {
        tenantId,
        prospectId,
        status: {
          in: [ProspectTaskStatus.PENDING, ProspectTaskStatus.RUNNING],
        },
      },
      select: { id: true },
    });

    if (existingTask) {
      return;
    }

    const prompt = this.composeFollowUpEnrichmentPrompt(researchOutcome);
    const task = await this.prisma.enrichmentTask.create({
      data: {
        tenantId,
        prospectId,
        prompt,
      },
    });

    await this.prospectQueueService.enqueueProspectTask('enrichment', task.id);
    await this.recordTaskEvent(
      tenantId,
      prospectId,
      'enrichment',
      ProspectTaskEventType.ENQUEUED,
      task.id,
      'Enriquecimento automatico agendado',
      {
        prompt,
        sourceTask: sourceTaskId,
        reason: 'follow_up_after_research',
      },
    );
  }

  private composeFollowUpEnrichmentPrompt(
    researchOutcome: ProspectResearchOutcome,
  ): string {
    const signals = researchOutcome.signals;
    const signalSummary = [
      signals.hasCompany ? 'empresa presente' : 'sem empresa',
      signals.hasEmail ? 'email presente' : 'sem email',
      signals.hasPhone ? 'telefone presente' : 'sem telefone',
      signals.hasTitle ? 'cargo presente' : 'sem cargo',
    ].join(', ');

    return `Enriquecer o prospect apos triagem inicial. Sinais: ${signalSummary}. Proxima acao sugerida: ${researchOutcome.nextAction}.`;
  }

  private async runPollingTick(): Promise<void> {
    if (this.pollingTickRunning) {
      return;
    }

    this.pollingTickRunning = true;

    try {
      const result = await this.processDueTasks();
      if (result.processedTasks > 0) {
        this.logger.log(
          `Prospect runtime processou ${result.processedTasks} tarefa(s) em ${result.processedAt.toISOString()}.`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Erro ao processar o runtime de prospect.',
        this.extractErrorMessage(error),
      );
    } finally {
      this.pollingTickRunning = false;
    }
  }

  private buildResearchOutcome(task: {
    prompt: string | null;
    prospect: {
      id: string;
      name: string;
      companyName: string | null;
      email: string | null;
      phone: string | null;
      title: string | null;
      source: string;
      score: number;
    };
  }): ProspectResearchOutcome {
    const prospect = task.prospect;
    const signalCount = [
      prospect.companyName,
      prospect.email,
      prospect.phone,
      prospect.title,
    ].filter(Boolean).length;
    const scoreDelta = Math.max(1, Math.min(8, signalCount * 2));

    return {
      taskType: 'research',
      prospectId: prospect.id,
      summary: `${prospect.name} passou por triagem inicial com ${signalCount} sinais úteis.`,
      prompt: task.prompt,
      signals: {
        hasCompany: Boolean(prospect.companyName),
        hasEmail: Boolean(prospect.email),
        hasPhone: Boolean(prospect.phone),
        hasTitle: Boolean(prospect.title),
        source: prospect.source,
      },
      nextAction:
        prospect.email || prospect.phone ? 'enrichment' : 'manual_review',
      scoreDelta,
    };
  }

  private buildEnrichmentOutcome(task: {
    prompt: string | null;
    prospect: {
      id: string;
      name: string;
      companyName: string | null;
      email: string | null;
      phone: string | null;
      title: string | null;
      source: string;
      score: number;
      metadata: unknown;
    };
  }): ProspectEnrichmentOutcome {
    const prospect = task.prospect;
    const companyName =
      prospect.companyName ?? this.inferEnrichedCompanyName(task.prompt);
    const title = prospect.title ?? this.inferEnrichedTitle(task.prompt);
    const scoreDelta = Math.max(1, companyName || title ? 4 : 2);
    const outreachBrief = this.buildOutreachBrief(prospect, task.prompt, {
      companyName,
      title,
    });

    return {
      taskType: 'enrichment',
      prospectId: prospect.id,
      summary: `${prospect.name} recebeu enriquecimento com contexto adicional e próxima melhor ação.`,
      prompt: task.prompt,
      companyName,
      title,
      outreachBrief,
      insights: {
        source: prospect.source,
        existingMetadata:
          typeof prospect.metadata === 'object' && prospect.metadata
            ? (prospect.metadata as Record<string, unknown>)
            : {},
      },
      nextAction: 'ready_for_outreach',
      scoreDelta,
    };
  }

  private inferEnrichedCompanyName(prompt: string | null): string | null {
    if (!prompt?.trim()) {
      return null;
    }

    const firstLine = prompt
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean);

    return firstLine && firstLine.length <= 80 ? firstLine : null;
  }

  private inferEnrichedTitle(prompt: string | null): string | null {
    if (!prompt?.trim()) {
      return null;
    }

    const lowered = prompt.toLowerCase();

    if (lowered.includes('diretor')) {
      return 'Diretor';
    }

    if (lowered.includes('ceo') || lowered.includes('founder')) {
      return 'Founder';
    }

    if (lowered.includes('marketing')) {
      return 'Marketing';
    }

    if (lowered.includes('comercial') || lowered.includes('vendas')) {
      return 'Comercial';
    }

    return null;
  }

  private buildOutreachBrief(
    prospect: {
      name: string;
      companyName: string | null;
      email: string | null;
      phone: string | null;
      title: string | null;
      source: string;
    },
    prompt: string | null,
    context: {
      companyName: string | null;
      title: string | null;
    },
  ): ProspectOutreachBrief {
    const fitSignals = [
      prospect.companyName ?? context.companyName,
      prospect.email,
      prospect.phone,
      prospect.title ?? context.title,
    ].filter(Boolean).length;

    const angle =
      fitSignals >= 4
        ? 'Alta aderencia comercial'
        : fitSignals >= 2
          ? 'Oportunidade para qualificação rápida'
          : 'Abordagem consultiva leve';

    const openingLine = this.composeOpeningLine(prospect, context);
    const talkingPoints = [
      context.companyName
        ? `Confirmar contexto na ${context.companyName}`
        : 'Confirmar contexto da empresa',
      (prospect.title ?? context.title)
        ? `Validar papel de ${prospect.title ?? context.title}`
        : 'Identificar decisor e papel no processo',
      prompt?.trim()
        ? `Retomar intenção: ${this.truncateText(prompt.trim(), 80)}`
        : 'Retomar intenção original do contato',
    ];
    const riskFlags = [
      !prospect.email ? 'Sem email' : null,
      !prospect.phone ? 'Sem telefone' : null,
      fitSignals < 3 ? 'Sinais de fit limitados' : null,
    ].filter((value): value is string => Boolean(value));

    return {
      angle,
      openingLine,
      cta: 'Pedir permissão para avançar para uma conversa de diagnóstico.',
      talkingPoints,
      riskFlags,
      suggestedTone:
        fitSignals >= 3 ? 'Direto e consultivo' : 'Curto e exploratório',
    };
  }

  private async dispatchProspectOutreach(
    tenantId: string,
    prospect: {
      id: string;
      name: string;
      companyName: string | null;
      email: string | null;
      phone: string | null;
      title: string | null;
      source: string;
      status: ProspectStatus;
      metadata: unknown;
    },
    outcome: ProspectEnrichmentOutcome,
  ): Promise<ProspectOutreachDispatchOutcome> {
    const baseResult: ProspectOutreachDispatchOutcome = {
      attempted: false,
      sent: false,
      status: null,
      deliveryMode: null,
      externalId: null,
      contactId: null,
      contactCreated: false,
      error: null,
      prospectStatus: ProspectStatus.READY,
    };

    const hasPhone = Boolean(prospect.phone?.trim());
    if (!hasPhone) {
      return baseResult;
    }

    const outreachMetadata = this.readOutreachMetadata(prospect.metadata);
    if (outreachMetadata?.sentAt) {
      return {
        ...baseResult,
        contactId: outreachMetadata.contactId ?? null,
        prospectStatus: ProspectStatus.CONTACTED,
      };
    }

    const retryCount = this.normalizeRetryCount(outreachMetadata?.retryCount);
    if (retryCount >= 2) {
      return {
        ...baseResult,
        contactId: outreachMetadata?.contactId ?? null,
      };
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { featureFlags: true },
    });
    const featureFlags = normalizeTenantFeatureFlags(tenant?.featureFlags);
    if (!featureFlags.outboundEnabled || !featureFlags.coldOutboundEnabled) {
      return baseResult;
    }

    const existingContact = await this.prisma.contact.findFirst({
      where: {
        tenantId,
        OR: [
          prospect.email
            ? {
                email: {
                  equals: prospect.email,
                  mode: 'insensitive',
                },
              }
            : undefined,
          prospect.phone
            ? {
                phone: this.normalizePhone(prospect.phone),
              }
            : undefined,
        ].filter(Boolean) as Prisma.ContactWhereInput[],
      },
      select: { id: true },
    });

    let contactId = existingContact?.id ?? null;
    if (!contactId) {
      let companyId: string | null = null;
      const companyName = prospect.companyName?.trim();
      if (companyName) {
        const existingCompany = await this.prisma.company.findFirst({
          where: {
            tenantId,
            name: {
              equals: companyName,
              mode: 'insensitive',
            },
          },
          select: { id: true },
        });

        const company = existingCompany
          ? existingCompany
          : await this.prisma.company.create({
              data: {
                tenantId,
                name: companyName,
              },
              select: { id: true },
            });

        companyId = company.id;
      }

      const createdContact = await this.prisma.contact.create({
        data: {
          tenantId,
          name: prospect.name,
          email: prospect.email || undefined,
          phone: this.normalizePhone(prospect.phone) || undefined,
          position: prospect.title || undefined,
          companyId: companyId ?? undefined,
          tags: ['prospect', 'outbound'],
        },
        select: { id: true },
      });

      contactId = createdContact.id;
    }

    const brief = outcome.outreachBrief;
    const message = [
      brief.openingLine,
      brief.angle,
      `CTA: ${brief.cta}`,
      `Abordagem: ${brief.suggestedTone}`,
    ]
      .filter(Boolean)
      .join('\n');

    if (!contactId) {
      throw new BadRequestException(
        'Erro no Backend: Nao foi possivel criar ou localizar o contato de outbound.',
      );
    }

    try {
      const sentMessage = await this.whatsappService.logMessage(tenantId, {
        contactId,
        content: message,
        direction: MessageDirection.OUTBOUND,
      });

      await this.prisma.prospect.update({
        where: { id: prospect.id },
        data: {
          status: ProspectStatus.CONTACTED,
          metadata: this.mergeProspectMetadata(prospect.metadata, {
            outreach: {
              state: 'sent',
              sentAt: new Date().toISOString(),
              attemptedAt: new Date().toISOString(),
              lastAttemptAt: new Date().toISOString(),
              retryCount: retryCount + 1,
              contactId,
              messageId: sentMessage.id,
              deliveryMode: sentMessage.deliveryMode ?? 'local_demo',
              status: sentMessage.status,
              error: null,
            },
          }),
        },
      });

      return {
        attempted: true,
        sent: true,
        status: sentMessage.status,
        deliveryMode: sentMessage.deliveryMode ?? 'local_demo',
        externalId: sentMessage.externalId ?? null,
        contactId,
        contactCreated: !existingContact,
        error: null,
        prospectStatus: ProspectStatus.CONTACTED,
      };
    } catch (error) {
      const messageError = this.extractErrorMessage(error);
      const failureKind = this.classifyOutreachFailure(messageError);
      const retryable = failureKind === 'retryable';
      this.logger.warn(
        `Falha ao disparar outreach para prospect ${prospect.id}: ${messageError}`,
      );

      await this.prisma.prospect.update({
        where: { id: prospect.id },
        data: {
          metadata: this.mergeProspectMetadata(prospect.metadata, {
            outreach: {
              state: 'failed',
              attemptedAt: new Date().toISOString(),
              lastAttemptAt: new Date().toISOString(),
              retryCount: retryCount + 1,
              contactId,
              sentAt: null,
              error: messageError,
              failureKind,
              retryable,
            },
          }),
        },
      });

      return {
        attempted: true,
        sent: false,
        status: MessageStatus.FAILED,
        deliveryMode: null,
        externalId: null,
        contactId,
        contactCreated: !existingContact,
        error: messageError,
        prospectStatus:
          failureKind === 'permanent'
            ? ProspectStatus.INVALID
            : ProspectStatus.READY,
      };
    }
  }

  private readOutreachMetadata(
    metadata: unknown,
  ): ProspectOutreachMetadata | null {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return null;
    }

    const value = (metadata as Record<string, unknown>).outreach;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as ProspectOutreachMetadata;
  }

  private normalizeRetryCount(value: number | null | undefined): number {
    if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
      return 0;
    }

    return Math.trunc(value);
  }

  private classifyOutreachFailure(
    message: string,
  ): 'permanent' | 'retryable' | 'unknown' {
    const normalized = message.toLowerCase();

    if (
      normalized.includes('invalid oauth') ||
      normalized.includes('cannot parse access token') ||
      normalized.includes('invalid token') ||
      normalized.includes('contato precisa de telefone') ||
      normalized.includes('telefone válido') ||
      normalized.includes('nao está operacional') ||
      normalized.includes('não está operacional') ||
      normalized.includes('403') ||
      normalized.includes('401') ||
      normalized.includes('404')
    ) {
      return 'permanent';
    }

    if (
      normalized.includes('429') ||
      normalized.includes('rate limit') ||
      normalized.includes('timeout') ||
      normalized.includes('etimedout') ||
      normalized.includes('econnreset') ||
      normalized.includes('eai_again') ||
      normalized.includes('500') ||
      normalized.includes('502') ||
      normalized.includes('503') ||
      normalized.includes('504')
    ) {
      return 'retryable';
    }

    return 'unknown';
  }

  private composeOpeningLine(
    prospect: {
      name: string;
      companyName: string | null;
      title: string | null;
    },
    context: {
      companyName: string | null;
      title: string | null;
    },
  ): string {
    const companyLabel = prospect.companyName ?? context.companyName;
    const titleLabel = prospect.title ?? context.title;

    if (companyLabel && titleLabel) {
      return `Olá ${prospect.name}, vi o contexto de ${titleLabel} na ${companyLabel}.`;
    }

    if (companyLabel) {
      return `Olá ${prospect.name}, vi o contexto da ${companyLabel}.`;
    }

    if (titleLabel) {
      return `Olá ${prospect.name}, vi que seu papel é ${titleLabel}.`;
    }

    return `Olá ${prospect.name}, quero entender melhor seu contexto.`;
  }

  private truncateText(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
      return value;
    }

    return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
  }

  private mergeProspectMetadata(
    currentMetadata: unknown,
    patch: Record<string, unknown>,
  ): Prisma.InputJsonValue {
    const base =
      typeof currentMetadata === 'object' &&
      currentMetadata &&
      !Array.isArray(currentMetadata)
        ? (currentMetadata as Record<string, unknown>)
        : {};

    return {
      ...base,
      ...patch,
    } as Prisma.InputJsonValue;
  }

  private async refreshProspectLifecycleStatus(
    prospectId: string,
  ): Promise<void> {
    const prospect = await this.prisma.prospect.findUnique({
      where: { id: prospectId },
      select: {
        status: true,
        optedOutAt: true,
        convertedContactId: true,
        tenantId: true,
      },
    });

    if (!prospect) {
      return;
    }

    if (prospect.optedOutAt || prospect.convertedContactId) {
      return;
    }

    const [pendingResearchTasks, pendingEnrichmentTasks] = await Promise.all([
      this.prisma.researchTask.count({
        where: {
          prospectId,
          status: {
            in: [ProspectTaskStatus.PENDING, ProspectTaskStatus.RUNNING],
          },
        },
      }),
      this.prisma.enrichmentTask.count({
        where: {
          prospectId,
          status: {
            in: [ProspectTaskStatus.PENDING, ProspectTaskStatus.RUNNING],
          },
        },
      }),
    ]);

    const nextStatus =
      pendingResearchTasks > 0
        ? ProspectStatus.RESEARCHING
        : pendingEnrichmentTasks > 0
          ? ProspectStatus.READY
          : prospect.status === ProspectStatus.CONVERTED ||
              prospect.status === ProspectStatus.OPTED_OUT
            ? prospect.status
            : ProspectStatus.READY;

    await this.prisma.prospect.update({
      where: { id: prospectId },
      data: {
        status: nextStatus,
      },
    });
  }

  private shouldSkipTask(prospect: {
    status: ProspectStatus;
    optedOutAt: Date | null;
    convertedContactId: string | null;
  }): boolean {
    return (
      Boolean(prospect.optedOutAt) ||
      Boolean(prospect.convertedContactId) ||
      prospect.status === ProspectStatus.OPTED_OUT ||
      prospect.status === ProspectStatus.CONVERTED ||
      prospect.status === ProspectStatus.INVALID
    );
  }

  private async promoteProspectStatus(
    tenantId: string,
    prospectId: string,
    status: ProspectStatus,
  ): Promise<void> {
    await this.prisma.prospect.updateMany({
      where: {
        id: prospectId,
        tenantId,
        status: {
          notIn: [
            ProspectStatus.OPTED_OUT,
            ProspectStatus.CONVERTED,
            ProspectStatus.INVALID,
          ],
        },
      },
      data: {
        status,
      },
    });
  }

  private pickEarlierDate(
    first: Date | null,
    second: Date | null,
  ): Date | null {
    if (!first) {
      return second;
    }

    if (!second) {
      return first;
    }

    return first.getTime() <= second.getTime() ? first : second;
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Erro desconhecido ao processar tarefa de prospect.';
  }

  private parsePositiveInteger(
    value: string | undefined,
    fallback: number,
  ): number {
    const parsed = Number.parseInt(value ?? '', 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }

    return parsed;
  }

  private async recordTaskEvent(
    tenantId: string,
    prospectId: string | null,
    taskType: 'research' | 'enrichment',
    eventType: ProspectTaskEventType,
    taskId: string,
    title: string,
    payload?: unknown,
  ): Promise<void> {
    await this.prisma.prospectTaskEvent.create({
      data: {
        tenantId,
        prospectId,
        taskType:
          taskType === 'research'
            ? ProspectTaskType.RESEARCH
            : ProspectTaskType.ENRICHMENT,
        eventType,
        taskId,
        title,
        payload:
          payload === undefined
            ? undefined
            : (payload as Prisma.InputJsonValue),
      },
    });
  }

  private async findProspectRecord(tenantId: string, prospectId: string) {
    const prospect = await this.prisma.prospect.findFirst({
      where: { id: prospectId, tenantId },
      include: {
        researchTasks: true,
        enrichmentTasks: true,
      },
    });

    if (!prospect) {
      throw new NotFoundException(
        `Erro no Backend: Prospect '${prospectId}' não encontrado neste tenant.`,
      );
    }

    return prospect;
  }

  private async resolveConversionStage(
    tenantId: string,
    stageId?: string,
  ): Promise<ConversionStageRecord> {
    if (stageId) {
      const stage = await this.prisma.stage.findFirst({
        where: {
          id: stageId,
          pipeline: {
            tenantId,
          },
        },
        select: {
          id: true,
          name: true,
          order: true,
          pipelineId: true,
          pipeline: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!stage) {
        throw new BadRequestException(
          'Erro no Backend: A etapa informada nao existe ou nao pertence a este tenant. ',
        );
      }

      return stage;
    }

    const stage = await this.prisma.stage.findFirst({
      where: {
        pipeline: {
          tenantId,
        },
      },
      select: {
        id: true,
        name: true,
        order: true,
        pipelineId: true,
        pipeline: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });

    if (!stage) {
      throw new BadRequestException(
        'Erro no Backend: Nao existe nenhuma etapa disponivel para conversao neste tenant.',
      );
    }

    return stage;
  }

  private deduplicateProspects(inputs: ProspectInputDto[]): ProspectInputDto[] {
    const seen = new Set<string>();
    const uniqueInputs: ProspectInputDto[] = [];

    for (const input of inputs) {
      const key =
        input.email?.trim().toLowerCase() ||
        this.normalizePhone(input.phone) ||
        input.name.trim().toLowerCase();

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      uniqueInputs.push(input);
    }

    return uniqueInputs;
  }

  private normalizeOptionalText(value?: string | null): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private normalizePhone(value?: string | null): string | null {
    const normalized = (value ?? '').replace(/\D/g, '');
    return normalized.length > 0 ? normalized : null;
  }

  private mapProspect(record: {
    id: string;
    name: string;
    companyName: string | null;
    email: string | null;
    phone: string | null;
    title: string | null;
    source: string;
    status: ProspectStatus;
    score: number;
    metadata: unknown;
    optedOutAt: Date | null;
    optedOutReason: string | null;
    convertedContactId: string | null;
    researchTasks: Array<{
      id: string;
      prospectId: string;
      status: ProspectTaskStatus;
      prompt: string | null;
      result: unknown;
      lastError: string | null;
      startedAt: Date | null;
      completedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    }>;
    enrichmentTasks: Array<{
      id: string;
      prospectId: string;
      status: ProspectTaskStatus;
      prompt: string | null;
      result: unknown;
      lastError: string | null;
      startedAt: Date | null;
      completedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    }>;
    createdAt: Date;
    updatedAt: Date;
  }): ProspectResponse {
    return {
      ...record,
      researchTasks: record.researchTasks.map((task) => this.mapTask(task)),
      enrichmentTasks: record.enrichmentTasks.map((task) => this.mapTask(task)),
    };
  }

  private mapTask(task: {
    id: string;
    prospectId: string;
    status: ProspectTaskStatus;
    prompt: string | null;
    result: unknown;
    lastError: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): ProspectTaskResponse {
    return {
      ...task,
      result: task.result ?? null,
    };
  }
}
