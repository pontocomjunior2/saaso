'use client';

import api from '@/lib/api';
import {
  Bot,
  BrainCircuit,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Database,
  LoaderCircle,
  MessageSquare,
  Power,
  Plus,
  RefreshCw,
  Settings,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Agent,
  AgentConversation,
  AgentDraft,
  AgentPromptProfile,
  useAgentStore,
} from '../../stores/useAgentStore';
import {
  KnowledgeBase,
  KnowledgeBaseDraft,
  useKnowledgeBaseStore,
} from '../../stores/useKnowledgeBaseStore';

interface PipelineOption {
  id: string;
  name: string;
  stages: Array<{
    id: string;
    name: string;
  }>;
}

interface AgentPreset {
  id: string;
  name: string;
  summary: string;
  draft: AgentDraft;
}

const DEFAULT_PROFILE: AgentPromptProfile = {
  persona: '',
  objective: '',
  tone: 'Consultivo e seguro',
  language: 'Português do Brasil',
  businessContext: '',
  targetAudience: '',
  valueProposition: '',
  responseLength: 'Curta a média',
  qualificationChecklist: [],
  handoffTriggers: [],
  guardrails: [],
  callToAction: '',
  customInstructions: '',
  model: 'gpt-4o-mini',
  temperature: 0.4,
  maxTokens: 450,
  historyWindow: 20,
  summaryThreshold: 10,
};

const DEFAULT_DRAFT: AgentDraft = {
  name: '',
  systemPrompt: '',
  isActive: true,
  stageId: null,
  knowledgeBaseId: null,
  profile: DEFAULT_PROFILE,
};

const DEFAULT_KNOWLEDGE_BASE_DRAFT: KnowledgeBaseDraft = {
  name: '',
  summary: '',
  content: '',
};

const PRESETS: AgentPreset[] = [
  {
    id: 'qualificador',
    name: 'Qualificador Inbound',
    summary: 'Qualifica lead, urgência e fit antes do handoff.',
    draft: {
      ...DEFAULT_DRAFT,
      name: 'Qualificador Inbound',
      profile: {
        ...DEFAULT_PROFILE,
        persona: 'SDR consultivo com postura executiva',
        objective: 'Entender fit, dor principal e urgência antes da reunião.',
        businessContext: 'CRM com agentes de IA para acelerar follow-up e operação comercial.',
        targetAudience: 'Gestores comerciais e founders B2B.',
        valueProposition: 'Mais velocidade comercial e menos operação manual.',
        qualificationChecklist: ['Tamanho do time', 'Canal de entrada', 'Urgência de implantação'],
        handoffTriggers: ['Pedido de humano', 'Negociação avançada', 'Objeção sensível'],
        guardrails: ['Não inventar integração', 'Não prometer preço sem contexto'],
        callToAction: 'Conduzir para diagnóstico comercial com especialista.',
      },
      systemPrompt: 'Se a urgência for alta, puxe agenda rapidamente. Se estiver frio, faça poucas perguntas.',
    },
  },
  {
    id: 'reativador',
    name: 'Reativador de Carteira',
    summary: 'Retoma oportunidades mornas sem parecer cobrança.',
    draft: {
      ...DEFAULT_DRAFT,
      name: 'Reativador de Carteira',
      profile: {
        ...DEFAULT_PROFILE,
        persona: 'Executivo de contas atento ao timing do cliente',
        objective: 'Retomar deals mornos e encontrar novo gatilho de avanço.',
        tone: 'Natural, respeitoso e prático',
        responseLength: 'Curta',
        qualificationChecklist: ['Motivo do esfriamento', 'Mudança de prioridade', 'Timing atual'],
        handoffTriggers: ['Interesse em retomar', 'Pedido por proposta atualizada'],
        guardrails: ['Não pressionar', 'Não repetir texto genérico'],
        callToAction: 'Abrir nova conversa comercial ou reunião curta.',
      },
      systemPrompt: 'Reconheça o histórico anterior antes de tentar avançar.',
    },
  },
];

function cloneProfile(profile?: AgentPromptProfile | null): AgentPromptProfile {
  return {
    ...DEFAULT_PROFILE,
    ...(profile ?? {}),
    qualificationChecklist: [...(profile?.qualificationChecklist ?? [])],
    handoffTriggers: [...(profile?.handoffTriggers ?? [])],
    guardrails: [...(profile?.guardrails ?? [])],
  };
}

function cloneDraft(draft?: Partial<AgentDraft>): AgentDraft {
  return {
    ...DEFAULT_DRAFT,
    ...draft,
    stageId: draft?.stageId ?? null,
    knowledgeBaseId: draft?.knowledgeBaseId ?? null,
    profile: cloneProfile(draft?.profile),
  };
}

function draftFromAgent(agent: Agent): AgentDraft {
  return cloneDraft({
    name: agent.name,
    systemPrompt: agent.systemPrompt,
    isActive: agent.isActive,
    stageId: agent.stageId,
    knowledgeBaseId: agent.knowledgeBaseId,
    profile: agent.profile,
  });
}

function listToText(items?: string[]): string {
  return (items ?? []).join('\n');
}

function textToList(value: string): string[] {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}

function formatDateTime(value?: string | Date | null): string {
  if (!value) {
    return 'Sem atividade';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function isHistoryWindowValid(value?: number) {
  return typeof value === 'number' && value >= 10 && value <= 50;
}

function isSummaryThresholdValid(value?: number) {
  return typeof value === 'number' && value >= 5 && value <= 20;
}

function getConversationStatusMeta(status: string): { label: string; className: string } {
  switch (status) {
    case 'OPEN':
      return {
        label: 'Aberta',
        className: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100',
      };
    case 'HANDOFF_REQUIRED':
      return {
        label: 'Handoff',
        className: 'border-amber-300/20 bg-amber-300/10 text-amber-100',
      };
    case 'CLOSED':
      return {
        label: 'Fechada',
        className: 'border-slate-300/20 bg-slate-300/10 text-slate-200',
      };
    default:
      return {
        label: status,
        className: 'border-white/10 bg-white/[0.08] text-slate-200',
      };
  }
}

function getConversationPreviewMessages(conversation: AgentConversation) {
  return conversation.messages.slice(-4);
}

function WizardListArea({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value?: string[];
  onChange: (items: string[]) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-300">{label}</span>
      <p className="mb-2 text-xs text-slate-500">{hint}</p>
      <textarea
        rows={4}
        value={listToText(value)}
        onChange={(event) => onChange(textToList(event.target.value))}
        className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:bg-white/[0.08]"
      />
    </label>
  );
}

export default function AgentsPage() {
  const {
    agents,
    conversationsByAgent,
    isLoading,
    isPreviewLoading,
    conversationLoadingAgentId,
    conversationError,
    previewPrompt,
    fetchAgents,
    fetchAgentConversations,
    deleteAgent,
    createAgent,
    updateAgent,
    getPromptPreview,
    clearPromptPreview,
  } = useAgentStore();
  const {
    knowledgeBases,
    isLoading: isKnowledgeBaseLoading,
    fetchKnowledgeBases,
    createKnowledgeBase,
    updateKnowledgeBase,
    deleteKnowledgeBase,
  } = useKnowledgeBaseStore();

  const [pipelines, setPipelines] = useState<PipelineOption[]>([]);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [draft, setDraft] = useState<AgentDraft>(cloneDraft());
  const [isKnowledgeBaseModalOpen, setIsKnowledgeBaseModalOpen] = useState(false);
  const [editingKnowledgeBase, setEditingKnowledgeBase] = useState<KnowledgeBase | null>(null);
  const [knowledgeBaseDraft, setKnowledgeBaseDraft] = useState<KnowledgeBaseDraft>(DEFAULT_KNOWLEDGE_BASE_DRAFT);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [selectedHistoryAgentId, setSelectedHistoryAgentId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isKnowledgeBaseSubmitting, setIsKnowledgeBaseSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [knowledgeBaseError, setKnowledgeBaseError] = useState<string | null>(null);
  const [busyAgentId, setBusyAgentId] = useState<string | null>(null);
  const [operationFeedback, setOperationFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    void fetchKnowledgeBases();
  }, [fetchKnowledgeBases]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const response = await api.get<PipelineOption[]>('/pipelines');
        if (isMounted) {
          setPipelines(response.data);
        }
      } catch {
        if (isMounted) {
          setPipelines([]);
        }
      }
    };

    void load();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedHistoryAgentId) {
      return;
    }

    const selectedAgentStillExists = agents.some((agent) => agent.id === selectedHistoryAgentId);
    if (!selectedAgentStillExists) {
      setSelectedHistoryAgentId(null);
    }
  }, [agents, selectedHistoryAgentId]);

  useEffect(() => {
    if (!isWizardOpen) {
      return;
    }

    const timer = window.setTimeout(() => {
      void getPromptPreview({
        name: draft.name,
        systemPrompt: draft.systemPrompt,
        stageId: draft.stageId,
        knowledgeBaseId: draft.knowledgeBaseId,
        profile: draft.profile,
      }).catch(() => undefined);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [draft, getPromptPreview, isWizardOpen]);

  const selectedPipeline = useMemo(
    () => pipelines.find((pipeline) => pipeline.id === selectedPipelineId) ?? null,
    [pipelines, selectedPipelineId],
  );

  const selectedKnowledgeBase = useMemo(
    () => knowledgeBases.find((knowledgeBase) => knowledgeBase.id === draft.knowledgeBaseId) ?? null,
    [draft.knowledgeBaseId, knowledgeBases],
  );

  const selectedStageLabel = useMemo(() => {
    for (const pipeline of pipelines) {
      const stage = pipeline.stages.find((item) => item.id === draft.stageId);
      if (stage) {
        return `${pipeline.name} / ${stage.name}`;
      }
    }

    return 'Sem etapa fixa';
  }, [draft.stageId, pipelines]);

  const selectedHistoryAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedHistoryAgentId) ?? null,
    [agents, selectedHistoryAgentId],
  );

  const selectedHistoryConversations = useMemo(
    () => (selectedHistoryAgentId ? conversationsByAgent[selectedHistoryAgentId] ?? [] : []),
    [conversationsByAgent, selectedHistoryAgentId],
  );

  const agentMetrics = useMemo(() => {
    return {
      active: agents.filter((agent) => agent.isActive).length,
      staged: agents.filter((agent) => agent.stageId).length,
      withKnowledgeBase: agents.filter((agent) => agent.knowledgeBaseId).length,
      bases: knowledgeBases.length,
    };
  }, [agents, knowledgeBases]);

  const steps = [
    { title: 'Identidade', detail: 'Persona, objetivo e preset' },
    { title: 'Contexto', detail: 'Pipeline, etapa e contexto comercial' },
    { title: 'Regras', detail: 'Checklist, handoff e limites' },
    { title: 'Fine-tuning', detail: 'Prompt final, modelo e ativação' },
  ];

  const updateDraft = (patch: Partial<AgentDraft>) => {
    setDraft((current) => cloneDraft({ ...current, ...patch, profile: patch.profile ?? current.profile }));
  };

  const updateProfile = (patch: Partial<AgentPromptProfile>) => {
    setDraft((current) =>
      cloneDraft({
        ...current,
        profile: {
          ...cloneProfile(current.profile),
          ...patch,
        },
      }),
    );
  };

  const openWizard = (agent?: Agent) => {
    const baseDraft = agent ? draftFromAgent(agent) : cloneDraft();
    const pipelineId =
      agent?.stage?.pipeline.id ??
      pipelines.find((pipeline) => pipeline.stages.some((stage) => stage.id === baseDraft.stageId))?.id ??
      pipelines[0]?.id ??
      null;

    setEditingAgent(agent ?? null);
    setSelectedPipelineId(pipelineId);
    setDraft(
      pipelineId && !baseDraft.stageId
        ? cloneDraft({
            ...baseDraft,
            stageId: pipelines.find((pipeline) => pipeline.id === pipelineId)?.stages[0]?.id ?? null,
          })
        : baseDraft,
    );
    setStep(0);
    setFormError(null);
    setIsWizardOpen(true);
  };

  const closeWizard = () => {
    setIsWizardOpen(false);
    setEditingAgent(null);
    setDraft(cloneDraft());
    setSelectedPipelineId(null);
    setStep(0);
    setFormError(null);
    clearPromptPreview();
  };

  const openKnowledgeBaseModal = (knowledgeBase?: KnowledgeBase) => {
    setEditingKnowledgeBase(knowledgeBase ?? null);
    setKnowledgeBaseDraft(
      knowledgeBase
        ? {
            name: knowledgeBase.name,
            summary: knowledgeBase.summary ?? '',
            content: knowledgeBase.content ?? '',
          }
        : DEFAULT_KNOWLEDGE_BASE_DRAFT,
    );
    setKnowledgeBaseError(null);
    setIsKnowledgeBaseModalOpen(true);
  };

  const closeKnowledgeBaseModal = () => {
    setIsKnowledgeBaseModalOpen(false);
    setEditingKnowledgeBase(null);
    setKnowledgeBaseDraft(DEFAULT_KNOWLEDGE_BASE_DRAFT);
    setKnowledgeBaseError(null);
  };

  const applyPreset = (preset: AgentPreset) => {
    setDraft((current) =>
      cloneDraft({
        ...preset.draft,
        stageId: current.stageId,
        knowledgeBaseId: current.knowledgeBaseId,
      }),
    );
  };

  const changePipeline = (pipelineId: string) => {
    const pipeline = pipelines.find((item) => item.id === pipelineId) ?? null;
    setSelectedPipelineId(pipelineId);
    updateDraft({ stageId: pipeline?.stages[0]?.id ?? null });
  };

  const submitKnowledgeBase = async () => {
    if (!knowledgeBaseDraft.name.trim()) {
      setKnowledgeBaseError('Defina um nome para a base de conhecimento.');
      return;
    }

    if (!knowledgeBaseDraft.content.trim()) {
      setKnowledgeBaseError('Preencha o conteúdo operacional da base de conhecimento.');
      return;
    }

    setIsKnowledgeBaseSubmitting(true);
    setKnowledgeBaseError(null);

    try {
      const savedKnowledgeBase = editingKnowledgeBase
        ? await updateKnowledgeBase(editingKnowledgeBase.id, knowledgeBaseDraft)
        : await createKnowledgeBase(knowledgeBaseDraft);

      if (!draft.knowledgeBaseId) {
        updateDraft({ knowledgeBaseId: savedKnowledgeBase.id });
      }

      setOperationFeedback({
        tone: 'success',
        message: editingKnowledgeBase
          ? `Base ${savedKnowledgeBase.name} atualizada e pronta para uso nos agentes.`
          : `Base ${savedKnowledgeBase.name} criada e disponível no wizard.`,
      });
      closeKnowledgeBaseModal();
    } catch (error: unknown) {
      setKnowledgeBaseError(errorMessage(error, 'Não foi possível salvar a base de conhecimento.'));
    } finally {
      setIsKnowledgeBaseSubmitting(false);
    }
  };

  const submitWizard = async () => {
    if (!draft.name.trim()) {
      setFormError('Defina um nome para o agente.');
      setStep(0);
      return;
    }

    if (!draft.profile?.objective?.trim()) {
      setFormError('Defina o objetivo principal do agente.');
      setStep(0);
      return;
    }

    if (!isHistoryWindowValid(draft.profile?.historyWindow)) {
      setFormError('Janela de histórico deve ficar entre 10 e 50 mensagens.');
      setStep(3);
      return;
    }

    if (!isSummaryThresholdValid(draft.profile?.summaryThreshold)) {
      setFormError('Limiar de sumarização deve ficar entre 5 e 20 mensagens.');
      setStep(3);
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      if (editingAgent) {
        await updateAgent(editingAgent.id, draft);
      } else {
        await createAgent(draft);
      }

      await fetchKnowledgeBases();

      closeWizard();
    } catch (error: unknown) {
      setFormError(errorMessage(error, 'Não foi possível salvar o agente.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAgent = async (agent: Agent) => {
    setBusyAgentId(agent.id);
    setOperationFeedback(null);

    try {
      await deleteAgent(agent.id);
      await fetchKnowledgeBases();

      if (selectedHistoryAgentId === agent.id) {
        setSelectedHistoryAgentId(null);
      }

      setOperationFeedback({
        tone: 'success',
        message: `Agente ${agent.name} removido do workspace.`,
      });
    } catch (error: unknown) {
      setOperationFeedback({
        tone: 'error',
        message: errorMessage(error, 'Nao foi possivel remover o agente.'),
      });
    } finally {
      setBusyAgentId(null);
    }
  };

  const toggleAgentHistory = (agent: Agent) => {
    const nextAgentId = selectedHistoryAgentId === agent.id ? null : agent.id;
    setSelectedHistoryAgentId(nextAgentId);

    if (nextAgentId) {
      void fetchAgentConversations(nextAgentId).catch(() => undefined);
    }
  };

  const refreshSelectedHistory = () => {
    if (!selectedHistoryAgent) {
      return;
    }

    void fetchAgentConversations(selectedHistoryAgent.id).catch(() => undefined);
  };

  const handleToggleAgent = async (agent: Agent) => {
    setBusyAgentId(agent.id);
    setOperationFeedback(null);

    try {
      await updateAgent(agent.id, { isActive: !agent.isActive });

      if (selectedHistoryAgentId === agent.id) {
        await fetchAgentConversations(agent.id);
      }

      setOperationFeedback({
        tone: 'success',
        message: agent.isActive
          ? `Agente ${agent.name} desligado. Conversas abertas foram movidas para takeover manual.`
          : `Agente ${agent.name} reativado para novos atendimentos automáticos.`,
      });
    } catch (error: unknown) {
      setOperationFeedback({
        tone: 'error',
        message: errorMessage(error, 'Nao foi possivel atualizar o estado operacional do agente.'),
      });
    } finally {
      setBusyAgentId(null);
    }
  };

  const handleDeleteKnowledgeBase = async (knowledgeBase: KnowledgeBase) => {
    try {
      await deleteKnowledgeBase(knowledgeBase.id);

      if (draft.knowledgeBaseId === knowledgeBase.id) {
        updateDraft({ knowledgeBaseId: null });
      }

      setOperationFeedback({
        tone: 'success',
        message: `Base ${knowledgeBase.name} removida do workspace.`,
      });
    } catch (error: unknown) {
      setOperationFeedback({
        tone: 'error',
        message: errorMessage(error, 'Nao foi possivel remover a base de conhecimento.'),
      });
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6 lg:p-8">
      <section className="rounded-[30px] border border-white/10 bg-[rgba(7,16,29,0.88)] p-5 shadow-[0_20px_72px_rgba(0,0,0,0.22)] lg:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Agentes</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Operação de agentes, bases e takeover.</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-400">
              Aqui o admin decide quem atende, em qual etapa, com qual base de conhecimento e qual grau de autonomia
              cada agente mantém no runtime.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 xl:max-w-[44rem] xl:justify-end">
            <div className="grid min-w-[14rem] flex-1 gap-2 rounded-[24px] border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Agentes</span>
                <span className="text-lg font-semibold text-white">{agents.length}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
                <span>Ativos {agentMetrics.active}</span>
                <span>Com base {agentMetrics.withKnowledgeBase}</span>
                <span>Em etapa {agentMetrics.staged}</span>
              </div>
            </div>
            <div className="grid min-w-[11rem] gap-1 rounded-[24px] border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300">
              <span className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Knowledge base</span>
              <span className="text-lg font-semibold text-white">{agentMetrics.bases}</span>
              <span className="text-xs text-slate-400">bases prontas para acoplar no prompt</span>
            </div>
            <button
              onClick={() => openWizard()}
              className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-4 py-3 font-medium text-slate-950 transition hover:translate-y-[-1px]"
            >
              <Plus className="h-4 w-4" />
              Novo agente
            </button>
          </div>
        </div>
      </section>

      {operationFeedback ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            operationFeedback.tone === 'success'
              ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'
              : 'border-rose-400/20 bg-rose-500/10 text-rose-100'
          }`}
        >
          {operationFeedback.message}
        </div>
      ) : null}

      {isWizardOpen ? (
        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[32px] border border-white/10 bg-[rgba(7,16,29,0.82)] p-6 shadow-[0_20px_72px_rgba(0,0,0,0.24)]">
            <div className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
                  {editingAgent ? 'Editando agente' : 'Criando agente'}
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  {editingAgent ? editingAgent.name : 'Novo agente operacional'}
                </h2>
              </div>

              <div className="flex flex-wrap gap-2">
                {steps.map((item, index) => (
                  <button
                    key={item.title}
                    onClick={() => setStep(index)}
                    className={`rounded-full px-3 py-2 text-xs font-medium transition ${
                      step === index
                        ? 'bg-cyan-300 text-slate-950'
                        : 'border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
                    }`}
                  >
                    {index + 1}. {item.title}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <p className="text-sm font-medium text-white">{steps[step].title}</p>
              <p className="mt-1 text-sm text-slate-500">{steps[step].detail}</p>
            </div>

            <div className="mt-6 space-y-5">
              <aside className="rounded-md border-l-4 border-[#f5bd4f] bg-amber-50 p-4">
                <p className="text-sm text-slate-800">
                  <strong>⚠️ IMPORTANTE:</strong> O agente NÃO move cards automaticamente. Ele sugere estágios e sinaliza quando acredita que o lead está qualificado. O SDR é sempre quem confirma e avança o card no funil.
                </p>
              </aside>

              {step === 0 ? (
                <>
                  <div className="grid gap-3 md:grid-cols-2">
                    {PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => applyPreset(preset)}
                        className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 text-left transition hover:border-cyan-300/20 hover:bg-cyan-400/10"
                      >
                        <p className="text-sm font-semibold text-white">{preset.name}</p>
                        <p className="mt-2 text-xs leading-6 text-slate-400">{preset.summary}</p>
                      </button>
                    ))}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-300">Nome do agente</span>
                      <input
                        type="text"
                        value={draft.name}
                        onChange={(event) => updateDraft({ name: event.target.value })}
                        className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:bg-white/[0.08]"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-300">Persona operacional</span>
                      <input
                        type="text"
                        value={draft.profile?.persona ?? ''}
                        onChange={(event) => updateProfile({ persona: event.target.value })}
                        className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:bg-white/[0.08]"
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-300">Objetivo principal</span>
                    <textarea
                      rows={3}
                      value={draft.profile?.objective ?? ''}
                      onChange={(event) => updateProfile({ objective: event.target.value })}
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:bg-white/[0.08]"
                    />
                  </label>

                  <div className="grid gap-4 md:grid-cols-3">
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-300">Tom</span>
                      <input
                        type="text"
                        value={draft.profile?.tone ?? ''}
                        onChange={(event) => updateProfile({ tone: event.target.value })}
                        className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:bg-white/[0.08]"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-300">Idioma</span>
                      <input
                        type="text"
                        value={draft.profile?.language ?? ''}
                        onChange={(event) => updateProfile({ language: event.target.value })}
                        className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:bg-white/[0.08]"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-300">Tamanho da resposta</span>
                      <select
                        value={draft.profile?.responseLength ?? DEFAULT_PROFILE.responseLength}
                        onChange={(event) => updateProfile({ responseLength: event.target.value })}
                        className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:bg-white/[0.08]"
                      >
                        <option value="Curta">Curta</option>
                        <option value="Curta a média">Curta a média</option>
                        <option value="Média">Média</option>
                        <option value="Detalhada quando necessário">Detalhada quando necessário</option>
                      </select>
                    </label>
                  </div>
                </>
              ) : null}

              {step === 1 ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-300">Pipeline</span>
                      <select
                        value={selectedPipelineId ?? ''}
                        onChange={(event) => changePipeline(event.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:bg-white/[0.08]"
                      >
                        <option value="" disabled>
                          Selecione um pipeline
                        </option>
                        {pipelines.map((pipeline) => (
                          <option key={pipeline.id} value={pipeline.id}>
                            {pipeline.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-300">Etapa</span>
                      <select
                        value={draft.stageId ?? ''}
                        onChange={(event) => updateDraft({ stageId: event.target.value || null })}
                        className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:bg-white/[0.08]"
                      >
                        <option value="">Sem etapa fixa</option>
                        {(selectedPipeline?.stages ?? []).map((stage) => (
                          <option key={stage.id} value={stage.id}>
                            {stage.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-300">Base de conhecimento</span>
                      <select
                        value={draft.knowledgeBaseId ?? ''}
                        onChange={(event) => updateDraft({ knowledgeBaseId: event.target.value || null })}
                        className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:bg-white/[0.08]"
                      >
                        <option value="">Sem base vinculada</option>
                        {knowledgeBases.map((knowledgeBase) => (
                          <option key={knowledgeBase.id} value={knowledgeBase.id}>
                            {knowledgeBase.name}
                          </option>
                        ))}
                      </select>
                      <p className="mt-2 text-xs leading-6 text-slate-500">
                        A base entra no prompt compilado e orienta o runtime do agente.
                      </p>
                    </label>

                    <button
                      type="button"
                      onClick={() => openKnowledgeBaseModal(selectedKnowledgeBase ?? undefined)}
                      className="self-start rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08]"
                    >
                      {selectedKnowledgeBase ? 'Editar base' : 'Criar base'}
                    </button>
                  </div>

                  {selectedKnowledgeBase ? (
                    <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{selectedKnowledgeBase.name}</p>
                          <p className="mt-2 text-xs uppercase tracking-[0.24em] text-slate-500">
                            {selectedKnowledgeBase.agentCount} agente(s) vinculado(s)
                          </p>
                        </div>
                        <Database className="h-5 w-5 text-cyan-200" />
                      </div>
                      <p className="mt-3 text-sm leading-7 text-slate-300">
                        {selectedKnowledgeBase.summary || 'Sem resumo. O agente usará diretamente o conteúdo salvo.'}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-slate-500">
                      Nenhuma base vinculada. O agente pode operar só com o prompt, mas perderá contexto persistente.
                    </div>
                  )}

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-300">Contexto do negócio</span>
                    <textarea
                      rows={4}
                      value={draft.profile?.businessContext ?? ''}
                      onChange={(event) => updateProfile({ businessContext: event.target.value })}
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:bg-white/[0.08]"
                    />
                  </label>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-300">Público-alvo</span>
                      <textarea
                        rows={3}
                        value={draft.profile?.targetAudience ?? ''}
                        onChange={(event) => updateProfile({ targetAudience: event.target.value })}
                        className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:bg-white/[0.08]"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-300">Proposta de valor</span>
                      <textarea
                        rows={3}
                        value={draft.profile?.valueProposition ?? ''}
                        onChange={(event) => updateProfile({ valueProposition: event.target.value })}
                        className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:bg-white/[0.08]"
                      />
                    </label>
                  </div>
                </>
              ) : null}

              {step === 2 ? (
                <>
                  <WizardListArea
                    label="Checklist de qualificação"
                    hint="Uma linha por item."
                    value={draft.profile?.qualificationChecklist}
                    onChange={(items) => updateProfile({ qualificationChecklist: items })}
                  />

                  <WizardListArea
                    label="Triggers de handoff"
                    hint="Quando o agente deve passar a conversa para o humano."
                    value={draft.profile?.handoffTriggers}
                    onChange={(items) => updateProfile({ handoffTriggers: items })}
                  />

                  <WizardListArea
                    label="Guardrails"
                    hint="Regras de segurança e limites operacionais."
                    value={draft.profile?.guardrails}
                    onChange={(items) => updateProfile({ guardrails: items })}
                  />

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-300">Call to action</span>
                    <input
                      type="text"
                      value={draft.profile?.callToAction ?? ''}
                      onChange={(event) => updateProfile({ callToAction: event.target.value })}
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:bg-white/[0.08]"
                    />
                  </label>
                </>
              ) : null}
              {step === 3 ? (
                <>
                  <div className="grid gap-4 md:grid-cols-3">
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-300">Modelo</span>
                      <input
                        type="text"
                        value={draft.profile?.model ?? DEFAULT_PROFILE.model}
                        onChange={(event) => updateProfile({ model: event.target.value })}
                        className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:bg-white/[0.08]"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-300">Temperature</span>
                      <input
                        type="number"
                        min={0}
                        max={2}
                        step={0.1}
                        value={draft.profile?.temperature ?? DEFAULT_PROFILE.temperature}
                        onChange={(event) => updateProfile({ temperature: Number(event.target.value) })}
                        className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:bg-white/[0.08]"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-300">Max tokens</span>
                      <input
                        type="number"
                        min={100}
                        max={4000}
                        step={50}
                        value={draft.profile?.maxTokens ?? DEFAULT_PROFILE.maxTokens}
                        onChange={(event) => updateProfile({ maxTokens: Number(event.target.value) })}
                        className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:bg-white/[0.08]"
                      />
                    </label>
                  </div>

                  <details className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                    <summary className="cursor-pointer list-none text-sm font-medium text-slate-200">
                      Avançado
                    </summary>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <label className="block">
                        <span className="mb-1 block text-sm font-medium text-slate-300">
                          Janela de histórico (mensagens)
                        </span>
                        <input
                          type="number"
                          min={10}
                          max={50}
                          value={draft.profile?.historyWindow ?? DEFAULT_PROFILE.historyWindow}
                          onChange={(event) => updateProfile({ historyWindow: Number(event.target.value) })}
                          className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:bg-white/[0.08]"
                        />
                        <p className="mt-2 text-xs text-slate-500">
                          Quantas mensagens recentes o agente lê a cada turno (10 a 50).
                        </p>
                      </label>

                      <label className="block">
                        <span className="mb-1 block text-sm font-medium text-slate-300">
                          Limiar de sumarização (mensagens)
                        </span>
                        <input
                          type="number"
                          min={5}
                          max={20}
                          value={draft.profile?.summaryThreshold ?? DEFAULT_PROFILE.summaryThreshold}
                          onChange={(event) => updateProfile({ summaryThreshold: Number(event.target.value) })}
                          className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:bg-white/[0.08]"
                        />
                        <p className="mt-2 text-xs text-slate-500">
                          Frequência com que a memória de longo prazo é resumida (5 a 20).
                        </p>
                      </label>
                    </div>
                  </details>

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-300">Instruções customizadas do admin</span>
                    <textarea
                      rows={4}
                      value={draft.profile?.customInstructions ?? ''}
                      onChange={(event) => updateProfile({ customInstructions: event.target.value })}
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:bg-white/[0.08]"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-300">Fine-tuning manual do prompt</span>
                    <textarea
                      rows={5}
                      value={draft.systemPrompt ?? ''}
                      onChange={(event) => updateDraft({ systemPrompt: event.target.value })}
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:bg-white/[0.08]"
                    />
                  </label>

                  <label className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      checked={draft.isActive ?? true}
                      onChange={(event) => updateDraft({ isActive: event.target.checked })}
                      className="h-4 w-4 rounded border-white/20 bg-transparent text-cyan-300"
                    />
                    Ativar agente ao salvar
                  </label>
                </>
              ) : null}
            </div>

            {formError ? (
              <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                {formError}
              </div>
            ) : null}

            <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <button
                onClick={closeWizard}
                className="rounded-2xl px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/[0.08]"
              >
                Cancelar
              </button>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => setStep((current) => Math.max(current - 1, 0))}
                  disabled={step === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Voltar
                </button>

                {step < steps.length - 1 ? (
                  <button
                    onClick={() => setStep((current) => Math.min(current + 1, steps.length - 1))}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-medium text-slate-950 transition hover:translate-y-[-1px]"
                  >
                    Avançar
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    onClick={submitWizard}
                    disabled={isSubmitting}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-medium text-slate-950 transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {isSubmitting ? 'Salvando...' : editingAgent ? 'Salvar agente' : 'Criar agente'}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-white/10 bg-[rgba(7,16,29,0.82)] p-6 shadow-[0_20px_72px_rgba(0,0,0,0.24)]">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Preview operacional</p>
                <h3 className="mt-2 text-xl font-semibold text-white">Prompt compilado</h3>
              </div>
              <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-emerald-100">
                {isPreviewLoading ? 'Atualizando...' : 'Ao vivo'}
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Etapa</p>
                <p className="mt-3 text-sm font-medium text-white">{selectedStageLabel}</p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Modelo</p>
                <p className="mt-3 text-sm font-medium text-white">
                  {draft.profile?.model ?? DEFAULT_PROFILE.model} · temp {draft.profile?.temperature ?? DEFAULT_PROFILE.temperature}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Objetivo</p>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                {draft.profile?.objective?.trim() || 'Defina um objetivo operacional claro para o agente.'}
              </p>
            </div>

            <div className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Base de conhecimento</p>
              <p className="mt-3 text-sm font-medium text-white">
                {selectedKnowledgeBase?.name || 'Sem base vinculada'}
              </p>
              <p className="mt-2 text-sm leading-7 text-slate-300">
                {selectedKnowledgeBase?.summary ||
                  'Selecione uma base para trazer contexto persistente ao prompt e ao runtime do agente.'}
              </p>
            </div>

            <div className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Checklist</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(draft.profile?.qualificationChecklist?.length
                  ? draft.profile.qualificationChecklist
                  : ['Nenhum checkpoint definido']).map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-xs text-slate-200"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-[28px] border border-cyan-300/10 bg-[linear-gradient(180deg,rgba(8,18,34,0.92),rgba(5,12,24,0.96))] p-5">
              <div className="flex items-center gap-2 text-cyan-100">
                <BrainCircuit className="h-4 w-4" />
                <p className="text-sm font-medium">Prompt final</p>
              </div>
              <pre className="mt-4 max-h-[30rem] overflow-auto whitespace-pre-wrap text-xs leading-6 text-slate-300">
                {previewPrompt || 'O prompt compilado aparecerá aqui conforme você preencher a configuração.'}
              </pre>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {isLoading && agents.length === 0 ? (
          <p className="text-slate-400">Buscando agentes...</p>
        ) : agents.length === 0 ? (
          <div className="col-span-full rounded-[30px] border border-dashed border-white/10 bg-[rgba(7,16,29,0.72)] py-20 text-center">
            <Bot className="mx-auto mb-4 h-16 w-16 text-slate-700" />
            <p className="font-medium text-slate-300">Nenhum agente configurado.</p>
            <p className="text-sm text-slate-500">Use o wizard para ativar o primeiro agente operacional.</p>
          </div>
        ) : (
          agents.map((agent) => (
            <article
              key={agent.id}
              className="group relative rounded-[28px] border border-white/10 bg-[rgba(7,16,29,0.82)] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.2)] transition hover:border-cyan-300/20 hover:bg-[rgba(9,19,35,0.9)]"
            >
              <div className="mb-4 flex items-start justify-between">
                <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-2">
                  <Bot className="h-6 w-6 text-cyan-100" />
                </div>

                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => openWizard(agent)}
                    className="rounded-xl border border-white/10 bg-white/[0.05] p-1.5 text-slate-400 transition-colors hover:border-cyan-300/20 hover:bg-cyan-300/10 hover:text-cyan-100"
                  >
                    <Settings className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => void handleDeleteAgent(agent)}
                    className="rounded-xl border border-white/10 bg-white/[0.05] p-1.5 text-slate-400 transition-colors hover:border-rose-400/20 hover:bg-rose-500/10 hover:text-rose-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <h3 className="text-lg font-bold text-white">{agent.name}</h3>
              <div className="mt-2 flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${agent.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  {agent.isActive ? 'Em operação' : 'Pausado'}
                </span>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-300">
                <p className="line-clamp-3">
                  {agent.profile?.objective || 'Sem objetivo estruturado. Use o wizard para enriquecer este agente.'}
                </p>
              </div>

              <div className="mt-4 grid gap-3 text-xs text-slate-500 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <p className="uppercase tracking-[0.2em] text-slate-400">Etapa</p>
                  <p className="mt-2 font-medium text-slate-200">
                    {agent.stage ? `${agent.stage.pipeline.name} / ${agent.stage.name}` : 'Sem bind de etapa'}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <p className="uppercase tracking-[0.2em] text-slate-400">Tom / modelo</p>
                  <p className="mt-2 font-medium text-slate-200">
                    {agent.profile?.tone || 'Tom padrão'} · {agent.profile?.model || 'gpt-4o-mini'}
                  </p>
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs text-slate-500">
                <p className="uppercase tracking-[0.2em] text-slate-400">Base</p>
                <p className="mt-2 font-medium text-slate-200">
                  {agent.knowledgeBase?.name || 'Sem base vinculada'}
                </p>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-xs leading-6 text-slate-200">
                <div className="mb-2 flex items-center gap-2 text-cyan-200">
                  <Sparkles className="h-3.5 w-3.5" />
                  Prompt compilado
                </div>
                <p className="line-clamp-5 whitespace-pre-wrap">{agent.compiledPrompt}</p>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-xs text-slate-400">
                <div className="flex items-center gap-1">
                  <BrainCircuit className="h-3 w-3" />
                  <span>{agent.profile?.qualificationChecklist?.length ?? 0} checkpoints</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    <span>{agent.profile?.handoffTriggers?.length ?? 0} handoffs</span>
                  </div>
                  <button
                    onClick={() => void handleToggleAgent(agent)}
                    disabled={busyAgentId === agent.id}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      agent.isActive
                        ? 'border border-amber-300/20 bg-amber-300/10 text-amber-100 hover:bg-amber-300/15'
                        : 'border border-emerald-400/20 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/15'
                    }`}
                  >
                    <Power className="h-3 w-3" />
                    {busyAgentId === agent.id
                      ? 'Atualizando...'
                      : agent.isActive
                        ? 'Desligar agente'
                        : 'Reativar agente'}
                  </button>
                  <button
                    onClick={() => toggleAgentHistory(agent)}
                    className={`rounded-full px-3 py-1.5 font-medium transition ${
                      selectedHistoryAgentId === agent.id
                        ? 'bg-cyan-300 text-slate-950'
                        : 'border border-white/10 bg-white/[0.04] text-slate-300 hover:border-cyan-300/20 hover:text-cyan-100'
                    }`}
                  >
                    {selectedHistoryAgentId === agent.id ? 'Ocultar conversas' : 'Ver conversas'}
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </section>

      <section className="rounded-[32px] border border-white/10 bg-[rgba(7,16,29,0.82)] p-6 shadow-[0_20px_72px_rgba(0,0,0,0.24)]">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Knowledge base</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Bases de conhecimento</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-400">
              Contexto persistente, objeções, posicionamento e blocos de resposta que alimentam o prompt do agente.
            </p>
          </div>

          <button
            onClick={() => openKnowledgeBaseModal()}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08]"
          >
            <Plus className="h-4 w-4" />
            Nova base
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {isKnowledgeBaseLoading && knowledgeBases.length === 0 ? (
            <p className="text-sm text-slate-400">Carregando bases de conhecimento...</p>
          ) : knowledgeBases.length === 0 ? (
            <div className="col-span-full rounded-[28px] border border-dashed border-white/10 bg-white/[0.03] px-6 py-12 text-center">
              <Database className="mx-auto mb-4 h-12 w-12 text-slate-700" />
              <p className="font-medium text-slate-200">Nenhuma base criada ainda.</p>
              <p className="mt-2 text-sm text-slate-500">
                Crie a primeira base para organizar contexto persistente e vinculá-lo aos agentes.
              </p>
            </div>
          ) : (
            knowledgeBases.map((knowledgeBase) => (
              <article
                key={knowledgeBase.id}
                className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-white">{knowledgeBase.name}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.24em] text-slate-500">
                      {knowledgeBase.agentCount} agente(s) vinculado(s)
                    </p>
                  </div>
                  <Database className="h-5 w-5 text-cyan-200" />
                </div>

                <p className="mt-4 text-sm leading-7 text-slate-300">
                  {knowledgeBase.summary || 'Sem resumo. A base usará diretamente o conteúdo salvo abaixo.'}
                </p>

                <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 p-4 text-sm leading-7 text-slate-300">
                  <p className="line-clamp-5 whitespace-pre-wrap">{knowledgeBase.content || 'Sem conteúdo salvo.'}</p>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                  <span>Atualizada em {formatDateTime(knowledgeBase.updatedAt)}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openKnowledgeBaseModal(knowledgeBase)}
                      className="rounded-full border border-white/10 px-3 py-1.5 font-medium text-slate-200 transition hover:bg-white/[0.08]"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => void handleDeleteKnowledgeBase(knowledgeBase)}
                      className="rounded-full border border-rose-400/20 px-3 py-1.5 font-medium text-rose-100 transition hover:bg-rose-500/10"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      {selectedHistoryAgent ? (
        <section className="rounded-[32px] border border-white/10 bg-[rgba(7,16,29,0.82)] p-6 shadow-[0_20px_72px_rgba(0,0,0,0.24)]">
          <div className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Monitoramento do agente</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">{selectedHistoryAgent.name}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-400">
                Conversas reais capturadas pelo runner via WhatsApp. Use este painel para revisar tom, handoff e
                qualidade da execução do prompt.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={refreshSelectedHistory}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08]"
              >
                <RefreshCw className="h-4 w-4" />
                Atualizar
              </button>
              <button
                onClick={() => setSelectedHistoryAgentId(null)}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08]"
              >
                <X className="h-4 w-4" />
                Fechar
              </button>
            </div>
          </div>

          {conversationLoadingAgentId === selectedHistoryAgent.id ? (
            <div className="flex items-center gap-3 py-10 text-sm text-slate-300">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Buscando conversas mais recentes...
            </div>
          ) : conversationError ? (
            <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {conversationError}
            </div>
          ) : selectedHistoryConversations.length === 0 ? (
            <div className="mt-6 rounded-[28px] border border-dashed border-white/10 bg-white/[0.03] px-6 py-14 text-center">
              <Clock3 className="mx-auto mb-4 h-10 w-10 text-slate-600" />
              <p className="font-medium text-slate-200">Nenhuma conversa registrada ainda.</p>
              <p className="mt-2 text-sm text-slate-500">
                Assim que um lead falar com este agente, o histórico operacional aparecerá aqui.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-5 xl:grid-cols-2">
              {selectedHistoryConversations.map((conversation) => {
                const statusMeta = getConversationStatusMeta(conversation.status);

                return (
                  <article
                    key={conversation.id}
                    className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.04))] p-5"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-lg font-semibold text-white">{conversation.contact.name}</p>
                        <p className="mt-1 text-sm text-slate-400">
                          {conversation.contact.phone || conversation.contact.email || 'Contato sem telefone ou e-mail'}
                        </p>
                      </div>
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] ${statusMeta.className}`}
                      >
                        {statusMeta.label}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                        <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Ultima atividade</p>
                        <p className="mt-2 text-sm font-medium text-slate-200">
                          {formatDateTime(conversation.lastMessageAt || conversation.updatedAt)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                        <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Card vinculado</p>
                        <p className="mt-2 text-sm font-medium text-slate-200">
                          {conversation.card?.title || 'Sem card vinculado'}
                        </p>
                      </div>
                    </div>

                    {conversation.summary ? (
                      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Resumo</p>
                        <p className="mt-2 text-sm leading-7 text-slate-300">{conversation.summary}</p>
                      </div>
                    ) : null}

                    <div className="mt-4 space-y-3">
                      {getConversationPreviewMessages(conversation).map((message) => (
                        <div
                          key={message.id}
                          className={`rounded-2xl border px-4 py-3 text-sm leading-7 ${
                            message.role === 'AGENT'
                              ? 'border-cyan-300/20 bg-cyan-300/10 text-cyan-50'
                              : 'border-white/10 bg-white/[0.04] text-slate-200'
                          }`}
                        >
                          <p className="text-[11px] uppercase tracking-[0.24em] opacity-70">
                            {message.role === 'AGENT' ? 'Agente' : 'Lead'} · {formatDateTime(message.createdAt)}
                          </p>
                          <p className="mt-2 whitespace-pre-wrap">{message.content}</p>
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {isKnowledgeBaseModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/72 px-4 py-10 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-[32px] border border-white/10 bg-[rgba(7,16,29,0.96)] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.4)]">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
                  {editingKnowledgeBase ? 'Editando base' : 'Criando base'}
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-white">
                  {editingKnowledgeBase?.name || 'Nova base de conhecimento'}
                </h3>
                <p className="mt-2 text-sm leading-7 text-slate-400">
                  Estruture aqui o contexto persistente que o agente deve carregar no prompt final e nas respostas.
                </p>
              </div>

              <button
                onClick={closeKnowledgeBaseModal}
                className="rounded-2xl p-2 text-slate-300 transition hover:bg-white/[0.08]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 space-y-5">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-300">Nome da base</span>
                <input
                  type="text"
                  value={knowledgeBaseDraft.name}
                  onChange={(event) =>
                    setKnowledgeBaseDraft((current) => ({ ...current, name: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:bg-white/[0.08]"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-300">Resumo</span>
                <textarea
                  rows={3}
                  value={knowledgeBaseDraft.summary ?? ''}
                  onChange={(event) =>
                    setKnowledgeBaseDraft((current) => ({ ...current, summary: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:bg-white/[0.08]"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-300">Conteúdo operacional</span>
                <textarea
                  rows={10}
                  value={knowledgeBaseDraft.content}
                  onChange={(event) =>
                    setKnowledgeBaseDraft((current) => ({ ...current, content: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:bg-white/[0.08]"
                />
                <p className="mt-2 text-xs leading-6 text-slate-500">
                  Use este campo para FAQs, argumentos de venda, posicionamento, objeções, diferenciais e limites do agente.
                </p>
              </label>
            </div>

            {knowledgeBaseError ? (
              <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                {knowledgeBaseError}
              </div>
            ) : null}

            <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-5">
              <button
                onClick={closeKnowledgeBaseModal}
                className="rounded-2xl px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/[0.08]"
              >
                Cancelar
              </button>

              <button
                onClick={submitKnowledgeBase}
                disabled={isKnowledgeBaseSubmitting}
                className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-medium text-slate-950 transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" />
                {isKnowledgeBaseSubmitting
                  ? 'Salvando...'
                  : editingKnowledgeBase
                    ? 'Salvar base'
                    : 'Criar base'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
