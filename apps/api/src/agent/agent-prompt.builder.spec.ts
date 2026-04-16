import {
  buildAgentCompiledPrompt,
  normalizeAgentPromptProfile,
} from './agent-prompt.builder';

describe('agent-prompt.builder', () => {
  it('normalizes empty values and preserves rich prompt settings', () => {
    const profile = normalizeAgentPromptProfile({
      persona: '  SDR premium  ',
      objective: ' Qualificar leads ',
      qualificationChecklist: [' orçamento ', '', 'momento de compra'],
      blockedTerms: [' preço ', '', 'DESCONTO'],
      temperature: 0.5,
      maxTokens: 550,
    });

    expect(profile).toEqual({
      persona: 'SDR premium',
      objective: 'Qualificar leads',
      qualificationChecklist: ['orçamento', 'momento de compra'],
      blockedTerms: ['preço', 'DESCONTO'],
      temperature: 0.5,
      maxTokens: 550,
    });
  });

  it('builds a compiled prompt with admin instructions and funnel context', () => {
    const compiledPrompt = buildAgentCompiledPrompt({
      name: 'Qualificador Premium',
      systemPrompt: 'Pergunte sempre antes de oferecer agenda.',
      profile: {
        persona: 'Consultor comercial sênior',
        objective: 'Entender fit e urgência',
        tone: 'Consultivo',
        qualificationChecklist: ['Mapear time comercial', 'Validar urgência'],
        handoffTriggers: ['Pedido para falar com humano'],
      },
      context: {
        tenantName: 'Saaso Demo',
        pipelineName: 'Vendas Inbound',
        stageName: 'Qualificação',
      },
    });

    expect(compiledPrompt).toContain('Qualificador Premium');
    expect(compiledPrompt).toContain('Consultor comercial sênior');
    expect(compiledPrompt).toContain('Vendas Inbound');
    expect(compiledPrompt).toContain('Qualificação');
    expect(compiledPrompt).toContain(
      'Pergunte sempre antes de oferecer agenda.',
    );
    expect(compiledPrompt).toContain('Pedido para falar com humano');
  });

  it('builds prompt containing the Formato de saída section with all 7 field names', () => {
    const compiledPrompt = buildAgentCompiledPrompt({
      name: 'Qualificador',
      systemPrompt: null,
      profile: null,
    });

    expect(compiledPrompt).toContain('Formato de saída');
    expect(compiledPrompt).toContain('should_respond');
    expect(compiledPrompt).toContain('reply');
    expect(compiledPrompt).toContain('mark_qualified');
    expect(compiledPrompt).toContain('qualification_reason');
    expect(compiledPrompt).toContain('suggested_next_stage_id');
    expect(compiledPrompt).toContain('request_handoff');
    expect(compiledPrompt).toContain('handoff_reason');
  });

  describe('normalizeAgentPromptProfile — historyWindow / summaryThreshold clamping', () => {
    it('clamps historyWindow above 50 to 50', () => {
      const profile = normalizeAgentPromptProfile({
        persona: 'SDR',
        historyWindow: 999,
      });

      expect(profile?.historyWindow).toBe(50);
    });

    it('clamps historyWindow below 10 to 10', () => {
      const profile = normalizeAgentPromptProfile({
        persona: 'SDR',
        historyWindow: 2,
      });

      expect(profile?.historyWindow).toBe(10);
    });

    it('clamps summaryThreshold above 20 to 20', () => {
      const profile = normalizeAgentPromptProfile({
        persona: 'SDR',
        summaryThreshold: 100,
      });

      expect(profile?.summaryThreshold).toBe(20);
    });

    it('clamps summaryThreshold below 5 to 5', () => {
      const profile = normalizeAgentPromptProfile({
        persona: 'SDR',
        summaryThreshold: 1,
      });

      expect(profile?.summaryThreshold).toBe(5);
    });

    it('coerces numeric strings to integers', () => {
      const profile = normalizeAgentPromptProfile({
        persona: 'SDR',
        historyWindow: '30',
        summaryThreshold: '12',
      });

      expect(profile?.historyWindow).toBe(30);
      expect(profile?.summaryThreshold).toBe(12);
    });

    it('ignores non-numeric summaryThreshold', () => {
      const profile = normalizeAgentPromptProfile({
        persona: 'SDR',
        summaryThreshold: 'abc',
      });

      expect(profile?.summaryThreshold).toBeUndefined();
    });

    it('rounds fractional historyWindow before clamping', () => {
      const profile = normalizeAgentPromptProfile({
        persona: 'SDR',
        historyWindow: 22.6,
      });

      expect(profile?.historyWindow).toBe(23);
    });
  });
});
