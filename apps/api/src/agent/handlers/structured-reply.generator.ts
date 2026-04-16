// [CITED: 05-CONTEXT.md D-18 parse fallback; 05-AI-SPEC.md §4 lines 320-432;
// 05-RESEARCH.md Pitfalls #4 (refusal), #6 (max_output_tokens=800)]
// Thin wrapper over AiService.generateStructuredResponse<StructuredReply>. Maps
// every failure reason to either a typed fallback (parse | refusal) or a thrown
// AgentProviderError (provider | empty). Keeps the runner cascade free of shape
// branching on Result<T>.
import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../../common/services/ai.service';
import {
  StructuredReplySchema,
  StructuredReply,
} from '../schemas/structured-reply.schema';
import type { AgentPromptProfile } from '../agent-prompt.builder';
import type { HistoryTurn } from './conversation-history.loader';

export class AgentProviderError extends Error {
  constructor(
    public readonly reason: 'provider' | 'empty',
    public readonly raw: string | null,
  ) {
    super(`agent_provider_error:${reason}`);
    this.name = 'AgentProviderError';
  }
}

export interface GenerateInput {
  compiledPrompt: string;
  userMessage: string;
  history: HistoryTurn[];
  summary: string | null;
  profile: AgentPromptProfile | null;
}

export interface GenerateResult {
  reply: StructuredReply;
  rawOutput: string;
  fallback: boolean;
  fallbackReason?: 'parse' | 'refusal';
}

const PARSE_FALLBACK_REPLY =
  'Desculpe, tive um problema ao interpretar a resposta. Pode repetir?';

@Injectable()
export class StructuredReplyGenerator {
  private readonly logger = new Logger(StructuredReplyGenerator.name);

  constructor(private readonly ai: AiService) {}

  async generate(input: GenerateInput): Promise<GenerateResult> {
    const result = await this.ai.generateStructuredResponse(
      input.compiledPrompt,
      input.userMessage,
      StructuredReplySchema,
      {
        history: input.history,
        summary: input.summary,
        model: input.profile?.model,
        temperature: input.profile?.temperature ?? 0.3,
        maxTokens: input.profile?.maxTokens ?? 800,
        schemaName: 'structured_reply',
      },
    );

    if (result.ok) {
      return { reply: result.data, rawOutput: result.raw, fallback: false };
    }

    if (result.reason === 'parse') {
      this.logger.warn(
        `Structured reply parse failure. raw=${String(result.raw).slice(0, 200)}`,
      );
      const rawTrimmed = result.raw?.trim() ?? '';
      return {
        reply: {
          should_respond: true,
          reply: rawTrimmed.length > 0 ? rawTrimmed : PARSE_FALLBACK_REPLY,
          mark_qualified: false,
          qualification_reason: null,
          suggested_next_stage_id: null,
          request_handoff: false,
          handoff_reason: null,
        },
        rawOutput: result.raw ?? '',
        fallback: true,
        fallbackReason: 'parse',
      };
    }

    if (result.reason === 'refusal') {
      this.logger.warn(
        `Structured reply refusal. refusal=${String(result.raw).slice(0, 200)}`,
      );
      return {
        reply: {
          should_respond: false,
          reply: null,
          mark_qualified: false,
          qualification_reason: null,
          suggested_next_stage_id: null,
          request_handoff: false,
          handoff_reason: null,
        },
        rawOutput: result.raw ?? '',
        fallback: true,
        fallbackReason: 'refusal',
      };
    }

    // 'provider' | 'empty' — typed bubble-up for the runner's AGENT_ERROR branch.
    throw new AgentProviderError(result.reason, result.raw);
  }
}
