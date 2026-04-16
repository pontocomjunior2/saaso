import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StructuredReplySchema } from '../../agent/schemas/structured-reply.schema';
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

  describe('generateStructuredResponse', () => {
    const validReply = {
      should_respond: true,
      reply: 'oi',
      mark_qualified: false,
      qualification_reason: null,
      suggested_next_stage_id: null,
      request_handoff: false,
      handoff_reason: null,
    };

    const makeService = (...args: [apiKey?: string | undefined]) => {
      const config: Record<string, string> = {
        OPENAI_API_BASE_URL: 'https://api.openai.com/v1',
      };
      // Use arguments.length so we can distinguish "no arg" (default to test-key)
      // from "explicit undefined" (no key -> exercises missing-apiKey path).
      if (args.length === 0) {
        config.OPENAI_API_KEY = 'test-key';
      } else if (args[0] !== undefined) {
        config.OPENAI_API_KEY = args[0];
      }
      return new AiService(new ConfigService(config));
    };

    it('happy path — returns {ok:true,data,raw} for valid structured JSON', async () => {
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
                  text: JSON.stringify(validReply),
                },
              ],
            },
          ],
        }),
      }) as typeof fetch;

      const service = makeService();
      const result = await service.generateStructuredResponse(
        'system',
        'mensagem',
        StructuredReplySchema,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.should_respond).toBe(true);
        expect(result.data.reply).toBe('oi');
        expect(result.raw).toBe(JSON.stringify(validReply));
      }
    });

    it('refusal path — returns {ok:false, reason:refusal} when output[].content[].type===refusal', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          output: [
            {
              type: 'message',
              role: 'assistant',
              content: [
                {
                  type: 'refusal',
                  refusal: 'Não posso ajudar com isso.',
                },
              ],
            },
          ],
        }),
      }) as typeof fetch;

      const service = makeService();
      const result = await service.generateStructuredResponse(
        'system',
        'mensagem',
        StructuredReplySchema,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('refusal');
        expect(result.raw).toBe('Não posso ajudar com isso.');
      }
    });

    it('parse path — returns {ok:false, reason:parse} when output_text is not valid JSON', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          output_text: 'not json',
        }),
      }) as typeof fetch;

      const service = makeService();
      const result = await service.generateStructuredResponse(
        'system',
        'mensagem',
        StructuredReplySchema,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('parse');
      }
    });

    it('provider path — returns {ok:false, reason:provider} on HTTP 500', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValue({ error: 'server exploded' }),
      }) as typeof fetch;

      const service = makeService();
      const result = await service.generateStructuredResponse(
        'system',
        'mensagem',
        StructuredReplySchema,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('provider');
      }
    });

    it('missing apiKey — returns {ok:false, reason:provider} without calling fetch', async () => {
      global.fetch = jest.fn() as typeof fetch;

      const service = makeService(undefined);
      const result = await service.generateStructuredResponse(
        'system',
        'mensagem',
        StructuredReplySchema,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('provider');
      }
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('empty path — returns {ok:false, reason:empty} when no output text present', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ output: [] }),
      }) as typeof fetch;

      const service = makeService();
      const result = await service.generateStructuredResponse(
        'system',
        'mensagem',
        StructuredReplySchema,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('empty');
      }
    });

    it('request body uses text.format (not legacy response_format) and strict json_schema', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          output: [
            {
              type: 'message',
              role: 'assistant',
              content: [
                { type: 'output_text', text: JSON.stringify(validReply) },
              ],
            },
          ],
        }),
      });
      global.fetch = fetchMock as typeof fetch;

      const service = makeService();
      await service.generateStructuredResponse(
        'system',
        'mensagem',
        StructuredReplySchema,
      );

      const [, init] = fetchMock.mock.calls[0];
      const body = JSON.parse(init.body as string);
      expect(body).not.toHaveProperty('response_format');
      expect(body.text.format.type).toBe('json_schema');
      expect(body.text.format.strict).toBe(true);
      expect(body.text.format.name).toBe('structured_reply');
      expect(body.temperature).toBe(0.3);
      expect(body.max_output_tokens).toBe(800);
      expect(body.store).toBe(false);
      // Must NOT contain $ref — strict mode rejects it (Pitfall #5)
      expect(JSON.stringify(body.text.format.schema).includes('$ref')).toBe(
        false,
      );
    });
  });
});
