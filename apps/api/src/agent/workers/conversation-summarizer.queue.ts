import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Queue, Worker, type Job } from 'bullmq';
import IORedis, { type RedisOptions } from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService } from '../../common/services/ai.service';

interface ConversationSummarizerQueuePayload {
  conversationId: string;
}

export interface ConversationSummarizerRuntimeSnapshot {
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
 * ConversationSummarizerQueue — async worker that condenses AgentConversation
 * history into `AgentConversation.summary`. Mirrors the pattern of
 * `apps/api/src/stage-rule/stage-rule-queue.service.ts` line-for-line (same
 * lifecycle, same Redis options, same driver-preference env var).
 *
 * Key differences from the stage-rule template:
 * - Queue name: `agent_summarize`
 * - Concurrency: clamped to MAX 1 (RESEARCH Pitfall #7 — concurrent summarizer
 *   jobs on the same conversation would race on `AgentConversation.summary`).
 * - Dedupe: `jobId: conversationId` so rapid re-enqueues collapse into a single
 *   run per conversation.
 * - Driver preference: optional `AGENT_SUMMARIZE_RUNTIME_DRIVER=poller` disables
 *   BullMQ entirely (no-op); no internal poller fallback because summarization
 *   is not timing-critical (runs off the hot path, D-02, D-21).
 * - On failure: previous `summary` is preserved (D-21); the error propagates
 *   so BullMQ marks the job failed and retries per queue defaults.
 */
@Injectable()
export class ConversationSummarizerQueue
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ConversationSummarizerQueue.name);
  private readonly queueName = 'agent_summarize';
  private readonly queueDriverPreference =
    (process.env.AGENT_SUMMARIZE_RUNTIME_DRIVER?.trim().toLowerCase() ??
      'bullmq') as 'bullmq' | 'poller';
  private readonly redisHost = process.env.REDIS_HOST?.trim() || '127.0.0.1';
  private readonly redisPort = this.parsePositiveInteger(
    process.env.REDIS_PORT,
    6379,
  );
  private readonly redisDb = this.parsePositiveInteger(process.env.REDIS_DB, 0);
  private readonly redisPassword = process.env.REDIS_PASSWORD?.trim() || null;
  // MAX 1 per RESEARCH Pitfall #7 — a second concurrent job would race on
  // AgentConversation.summary. Env var is accepted but clamped to 1.
  private readonly workerConcurrency = Math.min(
    1,
    Math.max(
      1,
      this.parsePositiveInteger(process.env.AGENT_SUMMARIZE_CONCURRENCY, 1),
    ),
  );
  private queue: Queue<ConversationSummarizerQueuePayload> | null = null;
  private worker: Worker<ConversationSummarizerQueuePayload> | null = null;
  private queueOperational = false;
  private lastQueueError: string | null = null;
  private lastEnqueuedAt: Date | null = null;
  private lastProcessedAt: Date | null = null;
  private totalEnqueuedJobs = 0;
  private totalProcessedJobs = 0;
  private totalFailedJobs = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  public async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    if (this.queueDriverPreference === 'poller') {
      this.logger.log(
        'ConversationSummarizer runtime desabilitado via AGENT_SUMMARIZE_RUNTIME_DRIVER=poller.',
      );
      return;
    }

    const redisOptions = this.createRedisOptions();
    const healthConnection = new IORedis(redisOptions);

    try {
      await healthConnection.ping();

      this.queue = new Queue<ConversationSummarizerQueuePayload>(
        this.queueName,
        {
          connection: redisOptions,
          defaultJobOptions: {
            removeOnComplete: 100,
            removeOnFail: 500,
          },
        },
      );

      this.worker = new Worker<ConversationSummarizerQueuePayload>(
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
        this.logger.error(
          'Worker do ConversationSummarizer falhou.',
          error.stack,
        );
      });

      await this.queue.waitUntilReady();
      await this.worker.waitUntilReady();

      this.queueOperational = true;
      this.lastQueueError = null;
      this.logger.log(
        `BullMQ operacional para ConversationSummarizer em redis://${this.redisHost}:${this.redisPort}/${this.redisDb} (concurrency=${this.workerConcurrency}).`,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Erro desconhecido ao iniciar BullMQ.';
      this.lastQueueError = message;
      this.queueOperational = false;
      this.logger.warn(
        `BullMQ indisponivel para ConversationSummarizer (${message}). Sumarizacao ficara em no-op ate Redis voltar.`,
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
   * Enqueues a summarizer job for the given conversation. Uses
   * `jobId: conversationId` so rapid duplicate enqueues dedupe into a single
   * run — BullMQ rejects a second add() with the same jobId while the first
   * is queued / active.
   */
  public async enqueue(
    conversationId: string,
    opts: { delayMs?: number } = {},
  ): Promise<boolean> {
    if (!this.queueOperational || !this.queue) {
      return false;
    }

    const delay = Math.max(0, opts.delayMs ?? 0);

    try {
      await this.queue.add(
        'agent_summarize.execute',
        { conversationId },
        {
          jobId: conversationId,
          delay,
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
          : 'Erro desconhecido ao enfileirar summarizer.';
      this.lastQueueError = message;
      this.logger.error(
        `Falha ao enfileirar ConversationSummarizer para ${conversationId}: ${message}`,
      );
      return false;
    }
  }

  public getRuntimeSnapshot(): ConversationSummarizerRuntimeSnapshot {
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
   * Summarizer worker body. Extracted as a named method so unit tests can
   * invoke it directly without booting BullMQ.
   *
   * Contract (05-CONTEXT.md D-02, D-21; 05-AI-SPEC.md §4 State Management):
   * 1. Load last 50 AgentMessage rows for the conversation (oldest-first).
   * 2. If fewer than 4 messages — return early (nothing to summarize).
   * 3. Call AiService.generateResponse with a condense-to-500-tokens prompt.
   * 4. On success AND returned text non-empty → overwrite
   *    AgentConversation.summary with the new text.
   * 5. On empty/error → rethrow. BullMQ marks the job failed; the previous
   *    summary is preserved untouched (D-21).
   */
  public async processJob(
    job: Job<ConversationSummarizerQueuePayload>,
  ): Promise<void> {
    const { conversationId } = job.data;

    const rows = await this.prisma.agentMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 50,
      select: { role: true, content: true, createdAt: true },
    });

    if (rows.length < 4) {
      return;
    }

    const transcript = rows
      .map((m) => `${m.role === 'AGENT' ? 'Agente' : 'Lead'}: ${m.content}`)
      .join('\n');

    const systemPrompt =
      'Condense a conversa abaixo em um resumo de no máximo 500 tokens em português brasileiro. ' +
      'Mantenha fatos específicos (orçamento, papel, dor, prazo), use tom neutro, ' +
      'não invente nada que não esteja na conversa.';

    const summary = await this.aiService.generateResponse(
      systemPrompt,
      transcript,
      {
        temperature: 0.2,
        maxTokens: 600,
      },
    );

    const text = summary?.trim();
    if (!text) {
      // Preserve previous summary; mark job failed by throwing (D-21).
      throw new Error(
        `Summarizer returned empty output for conversation ${conversationId}`,
      );
    }

    await this.prisma.agentConversation.update({
      where: { id: conversationId },
      data: { summary: text },
    });
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
