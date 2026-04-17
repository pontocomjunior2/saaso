import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common';
import { Queue, Worker, type Job } from 'bullmq';
import IORedis, { type RedisOptions } from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../../notification/notification.service';
import { AgentRunnerService } from '../agent-runner.service';
import type { AgentRetryJobPayload } from './agent-retry.types';

export interface AgentRetryRuntimeSnapshot {
  driver: 'bullmq' | 'disabled';
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

/**
 * AgentRetryQueue — BullMQ queue+worker that re-runs the agent runner when
 * the OpenAI provider fails transiently (D-19). Mirrors the pattern of
 * `apps/api/src/stage-rule/stage-rule-queue.service.ts` for lifecycle,
 * Redis options, driver-preference env var.
 *
 * Key configuration (from 05-AI-SPEC.md §4b Retry table):
 * - attempts: 3 hard ceiling (D-19, also limits T-05-03-01 poison-pill DoS)
 * - backoff: exponential, 2s base — yields 2s, 8s, 32s step delays
 * - On final failure (`attemptsMade >= attempts`) writes AGENT_ERROR activity
 *   AND emits AGENT_PERSISTENT_FAILURE notification exactly once.
 *
 * Circular-dep handling: imports AgentRunnerService via `forwardRef`. The
 * runner imports AgentRetryJobPayload from `./agent-retry.types` (type-only),
 * never from this file — per PATTERNS §S4.
 */
@Injectable()
export class AgentRetryQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AgentRetryQueue.name);
  private readonly queueName = 'agent_retry';
  private readonly queueDriverPreference =
    (process.env.AGENT_RETRY_RUNTIME_DRIVER?.trim().toLowerCase() ??
      'bullmq') as 'bullmq' | 'poller';
  private readonly redisHost = process.env.REDIS_HOST?.trim() || '127.0.0.1';
  private readonly redisPort = this.parsePositiveInteger(
    process.env.REDIS_PORT,
    6379,
  );
  private readonly redisDb = this.parsePositiveInteger(process.env.REDIS_DB, 0);
  private readonly redisPassword = process.env.REDIS_PASSWORD?.trim() || null;
  private readonly workerConcurrency = Math.max(
    1,
    this.parsePositiveInteger(process.env.AGENT_RETRY_CONCURRENCY, 1),
  );
  private readonly maxAttempts = 3;
  private queue: Queue<AgentRetryJobPayload> | null = null;
  private worker: Worker<AgentRetryJobPayload> | null = null;
  private queueOperational = false;
  private lastQueueError: string | null = null;
  private lastEnqueuedAt: Date | null = null;
  private lastProcessedAt: Date | null = null;
  private totalEnqueuedJobs = 0;
  private totalProcessedJobs = 0;
  private totalFailedJobs = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    @Inject(forwardRef(() => AgentRunnerService))
    private readonly runner: AgentRunnerService,
  ) {}

  public async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    if (this.queueDriverPreference === 'poller') {
      this.logger.log(
        'AgentRetry runtime desabilitado via AGENT_RETRY_RUNTIME_DRIVER=poller.',
      );
      return;
    }

    const redisOptions = this.createRedisOptions();
    const healthConnection = new IORedis(redisOptions);

    try {
      await healthConnection.ping();

      this.queue = new Queue<AgentRetryJobPayload>(this.queueName, {
        connection: redisOptions,
        defaultJobOptions: {
          removeOnComplete: 100,
          // Bound dead-letter volume per threat T-05-03-01.
          removeOnFail: 500,
        },
      });

      this.worker = new Worker<AgentRetryJobPayload>(
        this.queueName,
        async (job) => {
          this.lastProcessedAt = new Date();
          try {
            await this.processJob(job);
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
        this.logger.error('Worker do AgentRetry falhou.', error.stack);
      });

      // Final-attempt handler — fires AGENT_PERSISTENT_FAILURE exactly once
      // per threat T-05-03-05 (no double-fire).
      this.worker.on('failed', (job, err) => {
        void this.onJobFailed(job, err);
      });

      await this.queue.waitUntilReady();
      await this.worker.waitUntilReady();

      this.queueOperational = true;
      this.lastQueueError = null;
      this.logger.log(
        `BullMQ operacional para AgentRetry em redis://${this.redisHost}:${this.redisPort}/${this.redisDb} (concurrency=${this.workerConcurrency}, attempts=${this.maxAttempts}).`,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Erro desconhecido ao iniciar BullMQ.';
      this.lastQueueError = message;
      this.queueOperational = false;
      this.logger.warn(
        `BullMQ indisponivel para AgentRetry (${message}). Retries ficarao em no-op ate Redis voltar.`,
      );
      await this.safeCloseQueueArtifacts();
    } finally {
      await healthConnection.quit().catch(() => undefined);
    }
  }

  public async onModuleDestroy(): Promise<void> {
    await this.safeCloseQueueArtifacts();
  }

  /**
   * Enqueues a retry job. BullMQ handles the 3-attempt / 2s exponential
   * backoff internally — caller does NOT loop. Returns false if the queue
   * is not operational (caller should record AGENT_ERROR activity inline).
   */
  public async enqueue(payload: AgentRetryJobPayload): Promise<boolean> {
    if (!this.queueOperational || !this.queue) {
      return false;
    }

    try {
      await this.queue.add('agent_retry.execute', payload, {
        attempts: this.maxAttempts,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      });
      this.lastEnqueuedAt = new Date();
      this.lastQueueError = null;
      this.totalEnqueuedJobs += 1;
      return true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Erro desconhecido ao enfileirar retry.';
      this.lastQueueError = message;
      this.logger.error(
        `Falha ao enfileirar AgentRetry para conversa ${payload.conversationId}: ${message}`,
      );
      return false;
    }
  }

  public getRuntimeSnapshot(): AgentRetryRuntimeSnapshot {
    return {
      driver: this.queueOperational ? 'bullmq' : 'disabled',
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

  /**
   * Worker body. Extracted so unit tests can invoke it directly without
   * booting BullMQ. Delegates to the runner; errors propagate so BullMQ
   * retries per attempts/backoff.
   */
  public async processJob(job: Job<AgentRetryJobPayload>): Promise<void> {
    await this.runner.processInboundMessage(job.data);
  }

  /**
   * Final-attempt listener. BullMQ invokes `worker.on('failed', ...)` on
   * EVERY failed attempt — we gate the side-effects on
   * `attemptsMade >= attempts` so AGENT_PERSISTENT_FAILURE fires exactly
   * once (per threat T-05-03-05). Extracted as a named method so unit
   * tests can invoke it directly with a stub job.
   */
  public async onJobFailed(
    job: Job<AgentRetryJobPayload> | undefined,
    err: Error,
  ): Promise<void> {
    if (!job) {
      return;
    }

    const maxAttempts = job.opts?.attempts ?? this.maxAttempts;
    const attemptsMade = job.attemptsMade ?? 0;

    if (attemptsMade < maxAttempts) {
      // Not the final attempt — BullMQ will retry. No side-effects yet.
      return;
    }

    const payload = job.data;
    const errorMessage = err?.message ?? 'unknown error';

    try {
      await this.prisma.cardActivity.create({
        data: {
          cardId: payload.cardId,
          type: 'AGENT_ERROR',
          content: `Agente falhou apos ${maxAttempts} tentativas. Ultimo erro: ${errorMessage}`,
          metadata: {
            reason: 'persistent_failure',
            attempts: maxAttempts,
            last_error: errorMessage,
            conversationId: payload.conversationId,
          },
        },
      });
    } catch (activityError) {
      this.logger.error(
        `Falha ao escrever AGENT_ERROR activity para card ${payload.cardId}: ${activityError instanceof Error ? activityError.message : String(activityError)}`,
      );
    }

    try {
      this.notificationService.emit(payload.tenantId, {
        type: 'AGENT_PERSISTENT_FAILURE',
        cardId: payload.cardId,
        cardTitle: '',
        at: new Date().toISOString(),
        conversationId: payload.conversationId,
        attempts: maxAttempts,
        lastError: errorMessage,
      });
    } catch (notifyError) {
      this.logger.error(
        `Falha ao emitir AGENT_PERSISTENT_FAILURE para tenant ${payload.tenantId}: ${notifyError instanceof Error ? notifyError.message : String(notifyError)}`,
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
