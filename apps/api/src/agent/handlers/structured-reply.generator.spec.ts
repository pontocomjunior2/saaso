import { Test, TestingModule } from '@nestjs/testing';
import {
  StructuredReplyGenerator,
  AgentProviderError,
} from './structured-reply.generator';
import { AiService } from '../../common/services/ai.service';

describe('StructuredReplyGenerator', () => {
  let generator: StructuredReplyGenerator;
  let ai: { generateStructuredResponse: jest.Mock };

  const baseInput = {
    compiledPrompt: 'prompt',
    userMessage: 'oi',
    history: [],
    summary: null,
    profile: null,
  };

  beforeEach(async () => {
    ai = { generateStructuredResponse: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StructuredReplyGenerator,
        { provide: AiService, useValue: ai },
      ],
    }).compile();
    generator = module.get(StructuredReplyGenerator);
  });

  it('returns ok result unchanged when AiService returns ok', async () => {
    const data = {
      should_respond: true,
      reply: 'Oi!',
      mark_qualified: false,
      qualification_reason: null,
      suggested_next_stage_id: null,
      request_handoff: false,
      handoff_reason: null,
    };
    ai.generateStructuredResponse.mockResolvedValue({
      ok: true,
      data,
      raw: JSON.stringify(data),
    });

    const result = await generator.generate(baseInput);
    expect(result.fallback).toBe(false);
    expect(result.reply).toEqual(data);
    expect(result.rawOutput).toBe(JSON.stringify(data));
  });

  it('on parse failure returns fallback reply with raw-as-reply', async () => {
    ai.generateStructuredResponse.mockResolvedValue({
      ok: false,
      reason: 'parse',
      raw: 'Oi! (texto solto, não-JSON)',
    });

    const result = await generator.generate(baseInput);
    expect(result.fallback).toBe(true);
    expect(result.fallbackReason).toBe('parse');
    expect(result.reply.should_respond).toBe(true);
    expect(result.reply.reply).toBe('Oi! (texto solto, não-JSON)');
    expect(result.reply.mark_qualified).toBe(false);
    expect(result.reply.request_handoff).toBe(false);
  });

  it('on parse failure with null/empty raw uses generic fallback copy', async () => {
    ai.generateStructuredResponse.mockResolvedValue({
      ok: false,
      reason: 'parse',
      raw: null,
    });

    const result = await generator.generate(baseInput);
    expect(result.fallback).toBe(true);
    expect(result.fallbackReason).toBe('parse');
    expect(result.reply.reply).toBe(
      'Desculpe, tive um problema ao interpretar a resposta. Pode repetir?',
    );
    expect(result.rawOutput).toBe('');
  });

  it('on refusal coerces should_respond=false with null reply', async () => {
    ai.generateStructuredResponse.mockResolvedValue({
      ok: false,
      reason: 'refusal',
      raw: 'I cannot comply with that request.',
    });

    const result = await generator.generate(baseInput);
    expect(result.fallback).toBe(true);
    expect(result.fallbackReason).toBe('refusal');
    expect(result.reply.should_respond).toBe(false);
    expect(result.reply.reply).toBeNull();
    expect(result.reply.mark_qualified).toBe(false);
    expect(result.reply.request_handoff).toBe(false);
  });

  it('on provider failure throws AgentProviderError with reason preserved', async () => {
    ai.generateStructuredResponse.mockResolvedValue({
      ok: false,
      reason: 'provider',
      raw: null,
    });

    await expect(generator.generate(baseInput)).rejects.toBeInstanceOf(
      AgentProviderError,
    );
    try {
      await generator.generate(baseInput);
    } catch (err) {
      const e = err as AgentProviderError;
      expect(e.reason).toBe('provider');
      expect(e.raw).toBeNull();
    }
  });

  it('passes history, summary, and profile knobs to AiService', async () => {
    ai.generateStructuredResponse.mockResolvedValue({
      ok: true,
      data: {
        should_respond: true,
        reply: 'ok',
        mark_qualified: false,
        qualification_reason: null,
        suggested_next_stage_id: null,
        request_handoff: false,
        handoff_reason: null,
      },
      raw: '{}',
    });

    await generator.generate({
      compiledPrompt: 'system',
      userMessage: 'hi',
      history: [{ role: 'user', content: 'prev' }],
      summary: 'resumo',
      profile: { model: 'gpt-4o', temperature: 0.5, maxTokens: 1000 },
    });

    expect(ai.generateStructuredResponse).toHaveBeenCalledWith(
      'system',
      'hi',
      expect.anything(),
      expect.objectContaining({
        history: [{ role: 'user', content: 'prev' }],
        summary: 'resumo',
        model: 'gpt-4o',
        temperature: 0.5,
        maxTokens: 1000,
        schemaName: 'structured_reply',
      }),
    );
  });
});
