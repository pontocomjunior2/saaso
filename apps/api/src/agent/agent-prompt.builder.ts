import { Prisma } from '@prisma/client';

export interface AgentPromptProfile {
  persona?: string;
  objective?: string;
  tone?: string;
  language?: string;
  businessContext?: string;
  targetAudience?: string;
  valueProposition?: string;
  responseLength?: string;
  qualificationChecklist?: string[];
  handoffTriggers?: string[];
  guardrails?: string[];
  callToAction?: string;
  customInstructions?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AgentPromptContext {
  pipelineName?: string | null;
  stageName?: string | null;
  tenantName?: string | null;
  knowledgeBaseName?: string | null;
  knowledgeBaseSummary?: string | null;
  knowledgeBaseContent?: string | null;
}

function normalizeString(value: string | undefined | null): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return normalized.length > 0 ? normalized : undefined;
}

function normalizeNumber(value: number | undefined | null): number | undefined {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return undefined;
  }

  return value;
}

export function normalizeAgentPromptProfile(
  value: Prisma.JsonValue | AgentPromptProfile | null | undefined,
): AgentPromptProfile | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  const profile: AgentPromptProfile = {
    persona: normalizeString(record.persona as string | undefined),
    objective: normalizeString(record.objective as string | undefined),
    tone: normalizeString(record.tone as string | undefined),
    language: normalizeString(record.language as string | undefined),
    businessContext: normalizeString(
      record.businessContext as string | undefined,
    ),
    targetAudience: normalizeString(
      record.targetAudience as string | undefined,
    ),
    valueProposition: normalizeString(
      record.valueProposition as string | undefined,
    ),
    responseLength: normalizeString(
      record.responseLength as string | undefined,
    ),
    qualificationChecklist: normalizeStringArray(record.qualificationChecklist),
    handoffTriggers: normalizeStringArray(record.handoffTriggers),
    guardrails: normalizeStringArray(record.guardrails),
    callToAction: normalizeString(record.callToAction as string | undefined),
    customInstructions: normalizeString(
      record.customInstructions as string | undefined,
    ),
    model: normalizeString(record.model as string | undefined),
    temperature: normalizeNumber(record.temperature as number | undefined),
    maxTokens: normalizeNumber(record.maxTokens as number | undefined),
  };

  const hasAnyValue = Object.values(profile).some((item) => {
    if (Array.isArray(item)) {
      return item.length > 0;
    }

    return item !== undefined;
  });

  return hasAnyValue ? profile : null;
}

export function serializeAgentPromptProfile(
  profile: AgentPromptProfile | null,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (!profile) {
    return Prisma.JsonNull;
  }

  return profile as Prisma.InputJsonValue;
}

function addSection(sections: string[], title: string, content?: string): void {
  if (!content) {
    return;
  }

  sections.push(`${title}\n${content}`);
}

function addListSection(
  sections: string[],
  title: string,
  items?: string[],
): void {
  if (!items || items.length === 0) {
    return;
  }

  const lines = items.map((item) => `- ${item}`);
  sections.push(`${title}\n${lines.join('\n')}`);
}

function truncateText(
  value: string | null | undefined,
  maxLength: number,
): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.length <= maxLength
    ? trimmed
    : `${trimmed.slice(0, maxLength - 1)}…`;
}

export function buildAgentCompiledPrompt(input: {
  name?: string | null;
  systemPrompt?: string | null;
  profile?: AgentPromptProfile | null;
  context?: AgentPromptContext;
}): string {
  const name =
    normalizeString(input.name ?? undefined) ?? 'Agente Comercial de IA';
  const systemPrompt = normalizeString(input.systemPrompt ?? undefined);
  const profile = input.profile ?? null;
  const context = input.context;
  const sections: string[] = [];

  const identityParts = [
    `Você é ${name}, um agente de IA responsável por operar relacionamentos comerciais.`,
    profile?.persona ? `Assuma a persona: ${profile.persona}.` : undefined,
    context?.tenantName
      ? `Você representa a empresa/tenant ${context.tenantName}.`
      : undefined,
  ].filter((item): item is string => typeof item === 'string');

  sections.push(identityParts.join(' '));

  addSection(sections, 'Objetivo principal', profile?.objective);

  const funnelContext = [
    context?.pipelineName ? `Pipeline: ${context.pipelineName}.` : undefined,
    context?.stageName ? `Etapa atual: ${context.stageName}.` : undefined,
  ]
    .filter((item): item is string => typeof item === 'string')
    .join(' ');
  addSection(sections, 'Contexto do funil', funnelContext || undefined);

  addSection(sections, 'Contexto do negócio', profile?.businessContext);
  addSection(sections, 'Público-alvo', profile?.targetAudience);
  addSection(sections, 'Proposta de valor', profile?.valueProposition);
  addSection(
    sections,
    'Base de conhecimento vinculada',
    context?.knowledgeBaseName
      ? `${context.knowledgeBaseName}${context.knowledgeBaseSummary ? `\n${context.knowledgeBaseSummary}` : ''}`
      : undefined,
  );
  addSection(
    sections,
    'Contexto extra da base de conhecimento',
    truncateText(context?.knowledgeBaseContent, 2200),
  );

  const communicationDirectives = [
    profile?.tone ? `Tom de voz: ${profile.tone}.` : undefined,
    profile?.language ? `Idioma preferencial: ${profile.language}.` : undefined,
    profile?.responseLength
      ? `Tamanho esperado das respostas: ${profile.responseLength}.`
      : undefined,
  ]
    .filter((item): item is string => typeof item === 'string')
    .join(' ');
  addSection(
    sections,
    'Diretrizes de comunicação',
    communicationDirectives || undefined,
  );

  addListSection(
    sections,
    'Checklist de qualificação',
    profile?.qualificationChecklist,
  );
  addListSection(
    sections,
    'Situações para handoff humano',
    profile?.handoffTriggers,
  );
  addListSection(sections, 'Guardrails e limites', profile?.guardrails);

  addSection(sections, 'Call to action esperado', profile?.callToAction);
  addSection(
    sections,
    'Ajustes personalizados do admin',
    profile?.customInstructions,
  );
  addSection(sections, 'Fine-tuning manual do prompt', systemPrompt);

  sections.push(
    'Regras finais\nSeja claro, objetivo e útil. Não invente informações. Quando faltar contexto relevante, faça perguntas curtas para avançar a conversa com segurança.',
  );

  return sections.join('\n\n');
}
