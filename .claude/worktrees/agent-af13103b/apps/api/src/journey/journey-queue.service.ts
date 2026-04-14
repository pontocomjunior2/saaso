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
import { JourneyService } from './journey.service';

interface JourneyQueuePayload {
  journeyJobId: string;
}

export interface JourneyQueueRuntimeSnapshot {
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
  totalRequeuedJobs: number;
}

@Injectable()
export class JourneyQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JourneyQueueService.name);
  private readonly queueName = 'journey_execute';
  private readonly queueDriverPreference =
    (process.env.JOURNEY_RUNTIME_DRIVER?.trim().toLowerCase() ?? 'bullmq') as
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
      process.env.JOURNEY_RUNTIME_WORKER_CONCURRENCY,
      4,
    ),
  );
  private queue: Queue<JourneyQueuePayload> | null = null;
  private worker: Worker<JourneyQueuePayload> | null = null;
  private queueOperational = false;
  private lastQueueError: string | null = null;
  private lastEnqueuedAt: Date | null = null;
  private lastProcessedAt: Date | null = null;
  private totalEnqueuedJobs = 0;
  private totalProcessedJobs = 0;
  private totalFailedJobs = 0;
  private totalRequeuedJobs = 0;

  constructor(
    @Inject(forwardRef(() => JourneyService))
    private readonly journeyService: JourneyService,
  ) {}

  public async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    if (this.queueDriverPreference === 'poller') {
      this.logger.log(
        'Journey runtime configurado para usar apenas o poller interno.',
      );
      return;
    }

    const redisOptions = this.createRedisOptions();
    const healthConnection = new IORedis(redisOptions);

    try {
      await healthConnection.ping();

      this.queue = new Queue<JourneyQueuePayload>(this.queueName, {
        connection: redisOptions,
        defaultJobOptions: {
          removeOnComplete: 500,
          removeOnFail: 500,
        },
      });

      this.worker = new Worker<JourneyQueuePayload>(
        this.queueName,
        async (job) => {
          this.lastProcessedAt = new Date();
          const result = await this.journeyService.processQueuedJobById(
            job.data.journeyJobId,
          );

          if (!result) {
            return;
          }

          this.totalProcessedJobs += 1;
          if (result === 'FAILED') {
            this.totalFailedJobs += 1;
          }
          if (result === 'REQUEUED') {
            this.totalRequeuedJobs += 1;
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
          'Worker do runtime de Journeys falhou. O poller interno permanece como fallback.',
          error.stack,
        );
      });

      await this.queue.waitUntilReady();
      await this.worker.waitUntilReady();

      this.queueOperational = true;
      this.lastQueueError = null;
      this.logger.log(
        `BullMQ operacional para Journeys em redis://${this.redisHost}:${this.redisPort}/${this.redisDb}.`,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Erro desconhecido ao iniciar BullMQ.';
      this.lastQueueError = message;
      this.queueOperational = false;
      this.logger.warn(
        `BullMQ indisponivel para Journeys (${message}). O runtime segue com o poller interno.`,
      );
      await this.safeCloseQueueArtifacts();
    } finally {
      await healthConnection.quit().catch(() => undefined);
    }
  }

  public async onModuleDestroy(): Promise<void> {
    await this.safeCloseQueueArtifacts();
  }

  public getRuntimeSnapshot(): JourneyQueueRuntimeSnapshot {
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
      totalRequeuedJobs: this.totalRequeuedJobs,
    };
  }

  public async enqueueJourneyJob(
    journeyJobId: string,
    scheduledFor: Date,
  ): Promise<boolean> {
    if (!this.queueOperational || !this.queue) {
      return false;
    }

    const delayInMs = Math.max(0, scheduledFor.getTime() - Date.now());

    try {
      await this.queue.add(
        'journey.execute',
        {
          journeyJobId,
        },
        {
          jobId: journeyJobId,
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
        `Falha ao enfileirar JourneyExecutionJob ${journeyJobId} no BullMQ. O poller interno segue como fallback.`,
      );
      return false;
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
