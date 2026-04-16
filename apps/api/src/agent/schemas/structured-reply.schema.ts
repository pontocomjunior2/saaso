// [CITED: 05-CONTEXT.md D-17, 05-AI-SPEC.md §3 + §4b verbatim, 05-RESEARCH.md Pitfall #4]
// OpenAI Responses API strict mode requires every property to appear in required[] and
// additionalProperties: false. `.optional()` would drop the field from required and trigger a 400.
// Every field below uses `.nullable()` — never `.optional()`.
import { z } from 'zod';

export const StructuredReplySchema = z
  .object({
    should_respond: z
      .boolean()
      .describe(
        'true se o agente deve enviar a reply ao lead agora; false para segurar (fragmentação).',
      ),
    reply: z
      .string()
      .nullable()
      .describe('Texto pronto para envio ao lead. null quando should_respond=false.'),
    mark_qualified: z
      .boolean()
      .describe(
        'true se o lead atende aos critérios de qualificação desta etapa.',
      ),
    qualification_reason: z
      .string()
      .nullable()
      .describe(
        'Justificativa curta (1-2 frases) quando mark_qualified=true; null caso contrário.',
      ),
    suggested_next_stage_id: z
      .string()
      .nullable()
      .describe('ID exato de uma etapa válida deste pipeline, ou null.'),
    request_handoff: z
      .boolean()
      .describe('true se o lead precisa de atendimento humano imediato.'),
    handoff_reason: z
      .string()
      .nullable()
      .describe('Justificativa do handoff; null quando request_handoff=false.'),
  })
  .strict();

export type StructuredReply = z.infer<typeof StructuredReplySchema>;
