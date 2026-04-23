import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { z, ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export interface GenerateAgentResponseOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

// [CITED: 05-AI-SPEC.md §4 lines 320-432, 05-RESEARCH.md Pitfalls #4, #5, #6, #9]
export interface StructuredCallOptions extends GenerateAgentResponseOptions {
  /** Prior turns, OLDEST first. Excludes the current user message. */
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** Optional summary block injected as a system-level reminder. */
  summary?: string | null;
  /** Name for the JSON Schema (must match /^[a-zA-Z0-9_-]+$/). Defaults to 'structured_reply'. */
  schemaName?: string;
}

export type StructuredResult<T> =
  | { ok: true; data: T; raw: string }
  | {
      ok: false;
      reason: 'refusal' | 'parse' | 'provider' | 'empty';
      raw: string | null;
      error?: unknown;
    };

interface OpenAiResponseOutputItem {
  type?: string;
  role?: string;
  content?: Array<{
    type?: string;
    text?: string;
    refusal?: string;
  }>;
}

interface OpenAiResponsesApiPayload {
  output?: OpenAiResponseOutputItem[];
  output_text?: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly apiKey: string | undefined;
  private readonly apiBaseUrl: string;
  private readonly fallbackResponse =
    'Recebi sua mensagem. No momento nao consigo responder automaticamente com seguranca. Um humano pode seguir este atendimento na sequencia.';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.apiBaseUrl =
      this.configService
        .get<string>('OPENAI_API_BASE_URL')
        ?.replace(/\/+$/, '') ?? 'https://api.openai.com/v1';
  }

  public async generateResponse(
    systemPrompt: string,
    userMessage: string,
    options: GenerateAgentResponseOptions = {},
  ): Promise<string> {
    if (!this.apiKey) {
      this.logger.warn(
        'OPENAI_API_KEY nao configurada. Resposta de contingencia sera usada.',
      );
      return this.fallbackResponse;
    }

    const normalizedUserMessage = userMessage.trim();
    if (!normalizedUserMessage) {
      return this.fallbackResponse;
    }

    const requestBody = {
      model: this.normalizeModel(options.model),
      instructions: systemPrompt.trim(),
      input: normalizedUserMessage,
      max_output_tokens: this.normalizeMaxTokens(options.maxTokens),
      temperature: this.normalizeTemperature(options.temperature),
      text: {
        format: {
          type: 'text',
        },
      },
      store: false,
    };

    try {
      const response = await fetch(`${this.apiBaseUrl}/responses`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorPayload = await this.safeParseJson(response);
        this.logger.error(
          `OpenAI Responses API retornou ${response.status}. Payload: ${this.stringifyPayload(errorPayload)}`,
        );
        return this.fallbackResponse;
      }

      const data = (await response.json()) as OpenAiResponsesApiPayload;
      const outputText = this.extractOutputText(data);
      if (!outputText) {
        this.logger.warn(
          'OpenAI Responses API retornou sem texto utilizavel. Resposta de contingencia sera usada.',
        );
        return this.fallbackResponse;
      }

      return outputText;
    } catch (error: unknown) {
      this.logger.error(
        'Falha ao consultar OpenAI Responses API. Resposta de contingencia sera usada.',
        error instanceof Error ? error.stack : undefined,
      );
      return this.fallbackResponse;
    }
  }

  /**
   * Structured-output sibling to generateResponse. Returns a discriminated-union
   * result — OK data on success; typed reason (refusal|parse|provider|empty) on
   * failure, NEVER throws. Callers (e.g. StructuredReplyGenerator) map these to
   * CardActivity AGENT_HELD / AGENT_PARSE_FALLBACK / AGENT_ERROR per D-11, D-18, D-19.
   *
   * [CITED: 05-AI-SPEC.md §4 verbatim; 05-RESEARCH.md Pitfalls #4 (refusal),
   * #5 ($refStrategy:'none'), #6 (max_output_tokens=800), #9 (conversion cost)]
   *
   * NOTE: existing generateResponse is preserved — proactive D0 (D-09) and the
   * summarizer worker both still need plain-text generation. This method is
   * additive.
   */
  public async generateStructuredResponse<T>(
    systemPrompt: string,
    userMessage: string,
    schema: z.ZodType<T>,
    options: StructuredCallOptions = {},
  ): Promise<StructuredResult<T>> {
    if (!this.apiKey) {
      this.logger.warn(
        'OPENAI_API_KEY nao configurada. generateStructuredResponse retorna provider-fail.',
      );
      return { ok: false, reason: 'provider', raw: null };
    }

    // 1) Build the multi-turn input array. OLDEST first (Pitfall #8).
    const input: Array<{
      role: 'user' | 'assistant' | 'system';
      content: string;
    }> = [];
    if (options.summary) {
      input.push({
        role: 'system',
        content: `Resumo das interações anteriores (use como contexto, não repita literalmente):\n${options.summary}`,
      });
    }
    for (const turn of options.history ?? []) {
      input.push({ role: turn.role, content: turn.content });
    }
    input.push({ role: 'user', content: userMessage.trim() });

    // 2) Zod -> JSON Schema inline; $refStrategy:'none' required by strict mode (Pitfall #5).
    const jsonSchema = zodToJsonSchema(schema as ZodTypeAny, {
      target: 'openApi3',
      $refStrategy: 'none',
    }) as Record<string, unknown>;

    const requestBody = {
      model: this.normalizeModel(options.model),
      instructions: systemPrompt.trim(),
      input,
      max_output_tokens: this.normalizeMaxTokens(options.maxTokens ?? 800),
      temperature: this.normalizeTemperature(options.temperature ?? 0.3),
      text: {
        format: {
          type: 'json_schema',
          name: options.schemaName ?? 'structured_reply',
          strict: true,
          schema: jsonSchema,
        },
      },
      store: false,
    };

    let response: Response;
    try {
      response = await fetch(`${this.apiBaseUrl}/responses`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
    } catch (error) {
      this.logger.error(
        'Falha ao consultar OpenAI Responses API (network).',
        error instanceof Error ? error.stack : undefined,
      );
      return { ok: false, reason: 'provider', raw: null, error };
    }

    if (!response.ok) {
      const errorPayload = await this.safeParseJson(response);
      this.logger.error(
        `OpenAI Responses API retornou ${response.status}. Payload: ${this.stringifyPayload(errorPayload)}`,
      );
      return { ok: false, reason: 'provider', raw: null, error: errorPayload };
    }

    const data = (await response.json()) as OpenAiResponsesApiPayload;

    // 3) Refusal detection — strict output[].content[].type==='refusal' (Pitfall #4).
    //    Must run BEFORE any JSON.parse attempt on rawText.
    const refusal = data.output
      ?.flatMap((item) => item.content ?? [])
      .find((c) => c?.type === 'refusal');
    if (refusal?.refusal) {
      this.logger.warn(
        `OpenAI Responses API refusal: ${refusal.refusal.slice(0, 160)}`,
      );
      return { ok: false, reason: 'refusal', raw: refusal.refusal };
    }

    const rawText = this.extractOutputText(data);
    if (!rawText) {
      return { ok: false, reason: 'empty', raw: null };
    }

    // 4) Parse + Zod validation. strict:true is not 100% — Zod .safeParse is the
    //    second line of defense (Pitfall #3).
    try {
      const jsonValue = JSON.parse(rawText);
      const parsed = schema.safeParse(jsonValue);
      if (!parsed.success) {
        return {
          ok: false,
          reason: 'parse',
          raw: rawText,
          error: parsed.error,
        };
      }
      return { ok: true, data: parsed.data, raw: rawText };
    } catch (error) {
      return { ok: false, reason: 'parse', raw: rawText, error };
    }
  }

  private normalizeModel(model?: string): string {
    const normalizedModel = model?.trim();
    return normalizedModel && normalizedModel.length > 0
      ? normalizedModel
      : 'gpt-4o-mini';
  }

  private normalizeTemperature(temperature?: number): number | undefined {
    if (typeof temperature !== 'number' || Number.isNaN(temperature)) {
      return undefined;
    }

    return Math.min(Math.max(temperature, 0), 2);
  }

  private normalizeMaxTokens(maxTokens?: number): number | undefined {
    if (typeof maxTokens !== 'number' || Number.isNaN(maxTokens)) {
      return undefined;
    }

    return Math.min(Math.max(Math.round(maxTokens), 1), 4000);
  }

  private extractOutputText(payload: OpenAiResponsesApiPayload): string | null {
    if (
      typeof payload.output_text === 'string' &&
      payload.output_text.trim().length > 0
    ) {
      return payload.output_text.trim();
    }

    const content = payload.output
      ?.filter((item) => item.type === 'message' && item.role === 'assistant')
      .flatMap((item) => item.content ?? [])
      .filter(
        (item) => item.type === 'output_text' && typeof item.text === 'string',
      )
      .map((item) => item.text?.trim() ?? '')
      .filter((item) => item.length > 0);

    if (!content || content.length === 0) {
      return null;
    }

    return content.join('\n\n');
  }

  private async safeParseJson(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  private stringifyPayload(payload: unknown): string {
    if (!payload) {
      return 'null';
    }

    try {
      return JSON.stringify(payload);
    } catch {
      return '[unserializable payload]';
    }
  }
}
