import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';

describe('AiService', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('returns fallback response when OPENAI_API_KEY is not configured', async () => {
    const service = new AiService(
      new ConfigService({
        OPENAI_API_BASE_URL: 'https://api.openai.com/v1',
      }),
    );

    const response = await service.generateResponse(
      'System prompt',
      'Mensagem do lead',
    );

    expect(response).toContain(
      'No momento nao consigo responder automaticamente',
    );
  });

  it('calls OpenAI Responses API and returns assistant text', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        output: [
          {
            type: 'message',
            role: 'assistant',
            content: [
              {
                type: 'output_text',
                text: 'Resposta real da OpenAI',
              },
            ],
          },
        ],
      }),
    }) as typeof fetch;

    const service = new AiService(
      new ConfigService({
        OPENAI_API_KEY: 'test-key',
        OPENAI_API_BASE_URL: 'https://api.openai.com/v1',
      }),
    );

    const response = await service.generateResponse(
      'System prompt',
      'Mensagem do lead',
      {
        model: 'gpt-4o-mini',
        temperature: 0.3,
        maxTokens: 280,
      },
    );

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/responses',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-key',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          instructions: 'System prompt',
          input: 'Mensagem do lead',
          max_output_tokens: 280,
          temperature: 0.3,
          text: {
            format: {
              type: 'text',
            },
          },
          store: false,
        }),
      },
    );
    expect(response).toBe('Resposta real da OpenAI');
  });

  it('returns fallback response when provider fails', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('network error')) as typeof fetch;

    const service = new AiService(
      new ConfigService({
        OPENAI_API_KEY: 'test-key',
      }),
    );

    const response = await service.generateResponse(
      'System prompt',
      'Mensagem do lead',
    );

    expect(response).toContain(
      'No momento nao consigo responder automaticamente',
    );
  });
});
