import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface GenerateAgentResponseOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

interface OpenAiResponseOutputItem {
  type?: string;
  role?: string;
  content?: Array<{
    type?: string;
    text?: string;
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
