import { zodToJsonSchema } from 'zod-to-json-schema';
import { StructuredReplySchema } from './structured-reply.schema';

describe('StructuredReplySchema', () => {
  const validPayload = {
    should_respond: true,
    reply: 'Oi! Como posso te ajudar?',
    mark_qualified: false,
    qualification_reason: null,
    suggested_next_stage_id: null,
    request_handoff: false,
    handoff_reason: null,
  };

  it('accepts a fully populated valid object', () => {
    const result = StructuredReplySchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it('rejects object missing qualification_reason (required even if null)', () => {
    const { qualification_reason: _, ...missing } = validPayload;
    const result = StructuredReplySchema.safeParse(missing);
    expect(result.success).toBe(false);
  });

  it('accepts null for each nullable field individually', () => {
    const fields = [
      'reply',
      'qualification_reason',
      'suggested_next_stage_id',
      'handoff_reason',
    ] as const;
    for (const field of fields) {
      const payload = { ...validPayload, [field]: null };
      const result = StructuredReplySchema.safeParse(payload);
      expect(result.success).toBe(true);
    }
  });

  it('rejects non-boolean values for should_respond / mark_qualified / request_handoff', () => {
    for (const field of [
      'should_respond',
      'mark_qualified',
      'request_handoff',
    ] as const) {
      const payload = { ...validPayload, [field]: 'true' };
      const result = StructuredReplySchema.safeParse(payload);
      expect(result.success).toBe(false);
    }
  });

  describe('zodToJsonSchema conversion with openApi3 + $refStrategy:none', () => {
    const jsonSchema = zodToJsonSchema(StructuredReplySchema, {
      target: 'openApi3',
      $refStrategy: 'none',
    }) as Record<string, unknown>;

    it('produces exactly 7 properties', () => {
      const properties = jsonSchema.properties as Record<string, unknown>;
      expect(Object.keys(properties).length).toBe(7);
    });

    it('lists all 7 properties in required[]', () => {
      const required = jsonSchema.required as string[];
      expect(required.length).toBe(7);
      expect(required.sort()).toEqual(
        [
          'handoff_reason',
          'mark_qualified',
          'qualification_reason',
          'reply',
          'request_handoff',
          'should_respond',
          'suggested_next_stage_id',
        ].sort(),
      );
    });

    it('sets additionalProperties to false', () => {
      expect(jsonSchema.additionalProperties).toBe(false);
    });

    it('contains no $ref in the serialized schema', () => {
      const serialized = JSON.stringify(jsonSchema);
      expect(serialized.includes('$ref')).toBe(false);
    });
  });
});
