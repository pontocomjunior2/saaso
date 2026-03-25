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
      temperature: 0.5,
      maxTokens: 550,
    });

    expect(profile).toEqual({
      persona: 'SDR premium',
      objective: 'Qualificar leads',
      qualificationChecklist: ['orçamento', 'momento de compra'],
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
});
