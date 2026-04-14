import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import IORedis, { type RedisOptions } from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { StageRuleService } from './stage-rule.service';

interface StageRuleQueuePayload {
  stepId: string;
}

export interface StageRuleQueueRuntimeSnapshot {
  driver: 'bullmq' | 'poller';
  queueConfigured: boolean;
  queueOperational: boolean;
  queueName: string | null;
  redisHost: string | null;
  redisPort: number | null;
  workerConcurrency: number;
  lastQueueError: string | null;
  lastEnqueuedAt: Date | null;
  lastProcessedAt: Date | null;
  totalEnqueuedJobs: number;
  totalProcessedJobs: number;
  totalFailedJobs: number;
}

@Injectable()
export class StageRuleQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StageRuleQueueService.name);
  private readonly queueName = 'stage_rule_execute';
  private readonly queueDriverPreference =
    (process.env.STAGE_RULE_RUNTIME_DRIVER?.trim().toLowerCase() ?? 'bullmq') as
      | 'bullmq'
      | 'poller';
  private readonly redisHost = process.env.REDIS_HOST?.trim() || '127.0.0.1';
  private readonly redisPort = this.parsePositiveInteger(
    process.env.REDIS_PORT,
    6379,
  );
  private readonly redisDb = this.parsePositiveInteger(process.env.REDIS_DB, 0);
  private readonly redisPassword = process.env.REDIS_PASSWORD?.trim() || null;
  private readonly workerConcurrency = Math.max(
    1,
    this.parsePositiveInteger(
      process.env.STAGE_RULE_WORKER_CONCURRENCY,
      4,
    ),
  );
  private queue: Queue<StageRuleQueuePayload> | null = null;
  private worker: Worker<StageRuleQueuePayload> | null = null;
  private queueOperational = false;
  private lastQueueError: string | null = null;
  private lastEnqueuedAt: Date | null = null;
  private lastProcessedAt: Date | null = null;
  private totalEnqueuedJobs = 0;
  private totalProcessedJobs = 0;
  private totalFailedJobs = 0;
  private pollerInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    @Inject(forwardRef(() => StageRuleService))
    private readonly stageRuleService: StageRuleService,
    private readonly prisma: PrismaService,
  ) {}

  public async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    if (this.queueDriverPreference === 'poller') {
      this.logger.log(
        'StageRule runtime configurado para usar apenas o poller interno.',
      );
      this.startPoller();
      return;
    }

    const redisOptions = this.createRedisOptions();
    const healthConnection = new IORedis(redisOptions);

    try {
      await healthConnection.ping();

      this.queue = new Queue<StageRuleQueuePayload>(this.queueName, {
        connection: redisOptions,
        defaultJobOptions: {
          removeOnComplete: 500,
          removeOnFail: 500,
        },
      });

      this.worker = new Worker<StageRuleQueuePayload>(
        this.queueName,
        async (job) => {
          this.lastProcessedAt = new Date();
          try {
            await this.stageRuleService.executeStep(job.data.stepId);
            this.totalProcessedJobs += 1;
          } catch (err) {
            this.totalFailedJobs += 1;
            throw err;
          }
        },
        {
          connection: redisOptions,
          concurrency: this.workerConcurrency,
        },
      );

      this.worker.on('error', (error) => {
        this.lastQueueError = error.message;
        this.queueOperational = false;
        this.logger.error(
          'Worker do runtime de StageRule falhou. O poller interno permanece como fallback.',
          error.stack,
        );
      });

      await this.queue.waitUntilReady();
      await this.worker.waitUntilReady();

      this.queueOperational = true;
      this.lastQueueError = null;
      this.logger.log(
        `BullMQ operacional para StageRule em redis://${this.redisHost}:${this.redisPort}/${this.redisDb}.`,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Erro desconhecido ao iniciar BullMQ.';
      this.lastQueueError = message;
      this.queueOperational = false;
      this.logger.warn(
        `BullMQ indisponivel para StageRule (${message}). O runtime segue com o poller interno.`,
      );
      await this.safeCloseQueueArtifacts();
      this.startPoller();
    } finally {
      await healthConnection.quit().catch(() => undefined);
    }
  }

  public async onModuleDestroy(): Promise<void> {
    if (this.pollerInterval) {
      clearInterval(this.pollerInterval);
      this.pollerInterval = null;
    }
    await this.safeCloseQueueArtifacts();
  }

  public async enqueueRuleStep(
    stepId: string,
    scheduledFor: Date,
  ): Promise<boolean> {
    if (!this.queueOperational || !this.queue) {
      return false;
    }

    const delayInMs = Math.max(0, scheduledFor.getTime() - Date.now());

    try {
      await this.queue.add(
        'stage_rule.execute',
        { stepId },
        {
          jobId: stepId,
          delay: delayInMs,
        },
      );
      this.lastEnqueuedAt = new Date();
      this.lastQueueError = null;
      this.totalEnqueuedJobs += 1;
      return true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Erro desconhecido ao enfileirar job.';
      this.lastQueueError = message;
      this.logger.error(
        `Falha ao enfileirar StageRuleRunStep ${stepId} no BullMQ. O poller interno segue como fallback.`,
      );
      return false;
    }
  }

  public async removeJob(stepId: string): Promise<boolean> {
    if (!this.queue) {
      return false;
    }

    try {
      const job = await this.queue.getJob(stepId);
      if (!job) {
        return false;
      }
      await job.remove();
      return true;
    } catch {
      return false;
    }
  }

  public getRuntimeSnapshot(): StageRuleQueueRuntimeSnapshot {
    return {
      driver: this.queueOperational ? 'bullmq' : 'poller',
      queueConfigured: this.queueDriverPreference !== 'poller',
      queueOperational: this.queueOperational,
      queueName:
        this.queueDriverPreference !== 'poller' ? this.queueName : null,
      redisHost:
        this.queueDriverPreference !== 'poller' ? this.redisHost : null,
      redisPort:
        this.queueDriverPreference !== 'poller' ? this.redisPort : null,
      workerConcurrency:
        this.queueDriverPreference !== 'poller' ? this.workerConcurrency : 0,
      lastQueueError: this.lastQueueError,
      lastEnqueuedAt: this.lastEnqueuedAt,
      lastProcessedAt: this.lastProcessedAt,
      totalEnqueuedJobs: this.totalEnqueuedJobs,
      totalProcessedJobs: this.totalProcessedJobs,
      totalFailedJobs: this.totalFailedJobs,
    };
  }

  private startPoller(): void {
    this.pollerInterval = setInterval(() => {
      void this.runPoller();
    }, 10_000);
  }

  private async runPoller(): Promise<void> {
    try {
      const dueSteps = await this.prisma.stageRuleRunStep.findMany({
        where: {
          status: 'PENDING',
          scheduledFor: { lte: new Date() },
        },
        take: 50,
        orderBy: { scheduledFor: 'asc' },
      });

      for (const step of dueSteps) {
        try {
          // Mark as QUEUED to avoid double processing
          await this.prisma.stageRuleRunStep.update({
            where: { id: step.id },
            data: { status: 'QUEUED' },
          });
          this.lastProcessedAt = new Date();
          await this.stageRuleService.executeStep(step.id);
          this.totalProcessedJobs += 1;
        } catch (err) {
          this.totalFailedJobs += 1;
          this.logger.error(
            `Poller: erro ao executar passo ${step.id}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `Poller: erro ao buscar passos pendentes: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private createRedisOptions(): RedisOptions {
    return {
      host: this.redisHost,
      port: this.redisPort,
      db: this.redisDb,
      password: this.redisPassword ?? undefined,
      maxRetriesPerRequest: null,
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

  private async safeCloseQueueArtifacts(): Promise<void> {
    if (this.worker) {
      await this.worker.close().catch(() => undefined);
      this.worker = null;
    }

    if (this.queue) {
      await this.queue.close().catch(() => undefined);
      this.queue = null;
    }
  }
}
