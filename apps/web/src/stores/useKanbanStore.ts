import { create } from 'zustand';
import api from '../lib/api';
import type { StageMessageTemplate, StageRule } from '../components/board/board-types';

export interface Card {
  id: string;
  title: string;
  stageId: string;
  position: number;
  automation?: {
    status:
      | 'TAKEOVER'
      | 'NO_AGENT'
      | 'AGENT_PAUSED'
      | 'RUNNING'
      | 'WAITING_DELAY'
      | 'COMPLETED'
      | 'FAILED'
      | 'AUTOPILOT'
      | 'IDLE';
    label: string;
    description: string;
    nextAction: string;
  };
  updatedAt?: string;
  contact?: {
    id: string;
    name: string;
    company?: {
      id: string;
      name: string;
    } | null;
  } | null;
  assignee?: {
    id: string;
    name: string;
  } | null;
  activities?: Array<{
    id: string;
    type: string;
    content: string;
    createdAt: string;
  }>;
  agentConversations?: Array<{
    id: string;
    status: 'OPEN' | 'HANDOFF_REQUIRED' | 'CLOSED';
    updatedAt: string;
    lastMessageAt: string | null;
    summary: string | null;
    agent: {
      id: string;
      name: string;
      isActive: boolean;
    };
  }>;
  sequenceRuns?: Array<{
    id: string;
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PAUSED' | 'CANCELED';
    currentStepIndex: number;
    nextRunAt: string | null;
    updatedAt: string;
    campaign: {
      id: string;
      name: string;
    };
    steps: Array<{
      id: string;
      order: number;
      status: 'PENDING' | 'QUEUED' | 'RUNNING' | 'SENT' | 'FAILED' | 'SKIPPED';
      scheduledFor: string;
      completedAt: string | null;
      channel: 'WHATSAPP' | 'EMAIL';
    }>;
  }>;
}

export interface Stage {
  id: string;
  name: string;
  order: number;
  classificationCriteria?: string | null;
  rule?: StageRule | null;
  messageTemplates?: StageMessageTemplate[];
  agents?: Array<{
    id: string;
    name: string;
    isActive: boolean;
  }>;
  cards: Card[];
}

export interface Pipeline {
  id: string;
  name: string;
  stages: Stage[];
}

export interface RuleStepInput {
  order: number;
  dayOffset: number;
  channel: 'WHATSAPP' | 'EMAIL';
  messageTemplateId: string;
}

export interface StageAgentOption {
  id: string;
  name: string;
  stage: {
    id: string;
    classificationCriteria: string | null;
  } | null;
}

interface KanbanState {
  pipeline: Pipeline | null;
  isLoading: boolean;
  error: string | null;
  fetchPipeline: (id: string) => Promise<void>;
  moveCardLocally: (cardId: string, sourceStageId: string, destStageId: string, sourceIndex: number, destIndex: number) => void;
  moveCardApi: (cardId: string, destStageId: string, destIndex: number) => Promise<void>;
  createCard: (stageId: string, title: string) => Promise<void>;
  createCardWithContact: (data: {
    stageId: string;
    contactName: string;
    cardTitle?: string;
    email?: string;
    phone?: string;
    companyName?: string;
  }) => Promise<void>;
  updateCard: (cardId: string, patch: any) => Promise<void>;
  deleteCard: (cardId: string) => Promise<void>;
  toggleAutopilot: (conversationId: string, currentStatus: string) => Promise<void>;
  createStage: (pipelineId: string, name: string) => Promise<void>;
  renameStage: (stageId: string, name: string) => Promise<void>;
  deleteStage: (stageId: string) => Promise<void>;
  loadTemplate: (pipelineId: string, templateId: string) => Promise<{ id: string; name: string }>;
  sendMessage: (cardId: string, templateId: string, channel: 'WHATSAPP' | 'EMAIL') => Promise<{ success: boolean; deliveryMode: string }>;
  fetchStageRule: (stageId: string) => Promise<StageRule | null>;
  createStageRule: (stageId: string) => Promise<StageRule>;
  upsertRuleSteps: (ruleId: string, steps: RuleStepInput[]) => Promise<StageRule>;
  deleteRule: (ruleId: string) => Promise<void>;
  pauseRun: (runId: string) => Promise<void>;
  resumeRun: (runId: string) => Promise<void>;
  startManualRun: (cardId: string, stageId: string) => Promise<void>;
  setStageAgent: (stageId: string, agentId: string | null, classificationCriteria: string | null) => Promise<void>;
  toggleTakeover: (conversationId: string) => Promise<void>;
  fetchAgents: () => Promise<StageAgentOption[]>;
}

export const useKanbanStore = create<KanbanState>((set, get) => ({
  pipeline: null,
  isLoading: false,
  error: null,

  fetchPipeline: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get(`/pipelines/${id}`);
      set({ pipeline: response.data, isLoading: false });
    } catch (error: any) {
      set({ error: error?.response?.data?.message || 'Erro ao carregar o pipeline', isLoading: false });
    }
  },

  createCard: async (stageId, title) => {
    try {
      await api.post('/cards', { stageId, title });
      const pipelineId = get().pipeline?.id;
      if (pipelineId) await get().fetchPipeline(pipelineId);
    } catch (error: any) {
      set({ error: error?.response?.data?.message || 'Erro ao criar card' });
      throw error;
    }
  },

  createCardWithContact: async (data) => {
    try {
      await api.post('/contacts/manual-entry', data);
      const pipelineId = get().pipeline?.id;
      if (pipelineId) await get().fetchPipeline(pipelineId);
    } catch (error: any) {
      set({ error: error?.response?.data?.message || 'Erro ao criar card com contato' });
      throw error;
    }
  },

  updateCard: async (cardId, patch) => {
    try {
      await api.patch(`/cards/${cardId}`, patch);
      const pipelineId = get().pipeline?.id;
      if (pipelineId) await get().fetchPipeline(pipelineId);
    } catch (error: any) {
      set({ error: error?.response?.data?.message || 'Erro ao atualizar card' });
      throw error;
    }
  },

  deleteCard: async (cardId) => {
    try {
      await api.delete(`/cards/${cardId}`);
      const pipelineId = get().pipeline?.id;
      if (pipelineId) await get().fetchPipeline(pipelineId);
    } catch (error: any) {
      set({ error: error?.response?.data?.message || 'Erro ao deletar card' });
      throw error;
    }
  },

  toggleAutopilot: async (conversationId, currentStatus) => {
    try {
      const nextStatus = currentStatus === 'OPEN' ? 'HANDOFF_REQUIRED' : 'OPEN';
      await api.patch(`/agents/conversations/${conversationId}/status`, { status: nextStatus });
      const pipelineId = get().pipeline?.id;
      if (pipelineId) await get().fetchPipeline(pipelineId);
    } catch (error: any) {
      set({ error: error?.response?.data?.message || 'Erro ao alterar piloto automático' });
      throw error;
    }
  },

  moveCardLocally: (cardId, sourceStageId, destStageId, sourceIndex, destIndex) => {
    const pipeline = get().pipeline;
    if (!pipeline) return;

    const sourceStage = pipeline.stages.find((s) => s.id === sourceStageId);
    const destStage = pipeline.stages.find((s) => s.id === destStageId);

    if (!sourceStage || !destStage) return;

    const sourceCards = [...(sourceStage.cards ?? [])];
    const destCards = sourceStageId === destStageId ? sourceCards : [...(destStage.cards ?? [])];

    const [movedCard] = sourceCards.splice(sourceIndex, 1);
    destCards.splice(destIndex, 0, movedCard);

    set((state) => {
      if (!state.pipeline) return state;
      const newStages = state.pipeline.stages.map((stage) => {
        if (stage.id === sourceStageId) return { ...stage, cards: sourceCards };
        if (stage.id === destStageId) return { ...stage, cards: destCards };
        return stage;
      });

      return { pipeline: { ...state.pipeline, stages: newStages } };
    });
  },

  moveCardApi: async (cardId, destStageId, destIndex) => {
    try {
      await api.patch(`/cards/${cardId}/move`, {
        destinationStageId: destStageId,
        destinationIndex: destIndex,
      });
      const pipelineId = get().pipeline?.id;
      if (pipelineId) await get().fetchPipeline(pipelineId);
    } catch (error: any) {
      console.error('Failed to move card in API', error);
      // Aqui poderíamos reverter o state (optimistic rollback)
      set({ error: 'Erro ao salvar a nova posição do card.' });
    }
  },

  createStage: async (pipelineId: string, name: string) => {
    try {
      await api.post('/stages', { pipelineId, name });
      await get().fetchPipeline(pipelineId);
    } catch (error: any) {
      set({ error: error?.response?.data?.message || 'Erro ao criar etapa' });
      throw error;
    }
  },

  renameStage: async (stageId: string, name: string) => {
    try {
      await api.patch(`/stages/${stageId}`, { name });
      const pipelineId = get().pipeline?.id;
      if (pipelineId) await get().fetchPipeline(pipelineId);
    } catch (error: any) {
      set({ error: error?.response?.data?.message || 'Erro ao renomear etapa' });
      throw error;
    }
  },

  deleteStage: async (stageId: string) => {
    try {
      await api.delete(`/stages/${stageId}`);
      const pipelineId = get().pipeline?.id;
      if (pipelineId) await get().fetchPipeline(pipelineId);
    } catch (error: unknown) {
      const message = typeof error === 'object' && error !== null && 'response' in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      set({ error: message || 'Erro ao excluir etapa' });
      throw error;
    }
  },
  loadTemplate: async (_pipelineId: string, templateId: string) => {
    try {
      const response = await api.post('/pipelines/from-template', { templateId });
      return response.data;
    } catch (error: any) {
      set({ error: error?.response?.data?.message || 'Erro ao carregar template' });
      throw error;
    }
  },

  sendMessage: async (cardId: string, templateId: string, channel: 'WHATSAPP' | 'EMAIL') => {
    const response = await api.post(`/cards/${cardId}/send-message`, { templateId, channel });
    return response.data;
  },

  fetchStageRule: async (stageId: string) => {
    try {
      const response = await api.get<StageRule | null>(`/stages/${stageId}/rule`);
      return response.data;
    } catch (error: unknown) {
      const message = typeof error === 'object' && error !== null && 'response' in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      set({ error: message || 'Erro ao carregar régua da etapa' });
      throw error;
    }
  },

  createStageRule: async (stageId: string) => {
    try {
      const response = await api.post<StageRule>(`/stages/${stageId}/rule`, {});
      const pipelineId = get().pipeline?.id;
      if (pipelineId) await get().fetchPipeline(pipelineId);
      return response.data;
    } catch (error: unknown) {
      const message = typeof error === 'object' && error !== null && 'response' in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      set({ error: message || 'Erro ao criar régua da etapa' });
      throw error;
    }
  },

  upsertRuleSteps: async (ruleId: string, steps: RuleStepInput[]) => {
    try {
      const response = await api.put<StageRule>(`/stage-rules/${ruleId}/steps`, { steps });
      const pipelineId = get().pipeline?.id;
      if (pipelineId) await get().fetchPipeline(pipelineId);
      return response.data;
    } catch (error: unknown) {
      const message = typeof error === 'object' && error !== null && 'response' in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      set({ error: message || 'Erro ao salvar etapas da régua' });
      throw error;
    }
  },

  deleteRule: async (ruleId: string) => {
    try {
      await api.delete(`/stage-rules/${ruleId}`);
      const pipelineId = get().pipeline?.id;
      if (pipelineId) await get().fetchPipeline(pipelineId);
    } catch (error: unknown) {
      const message = typeof error === 'object' && error !== null && 'response' in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      set({ error: message || 'Erro ao excluir régua' });
      throw error;
    }
  },

  pauseRun: async (runId: string) => {
    try {
      await api.post(`/stage-rule-runs/${runId}/pause`);
      const pipelineId = get().pipeline?.id;
      if (pipelineId) await get().fetchPipeline(pipelineId);
    } catch (error: unknown) {
      const message = typeof error === 'object' && error !== null && 'response' in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      set({ error: message || 'Erro ao pausar régua' });
      throw error;
    }
  },

  resumeRun: async (runId: string) => {
    try {
      await api.post(`/stage-rule-runs/${runId}/resume`);
      const pipelineId = get().pipeline?.id;
      if (pipelineId) await get().fetchPipeline(pipelineId);
    } catch (error: unknown) {
      const message = typeof error === 'object' && error !== null && 'response' in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      set({ error: message || 'Erro ao retomar régua' });
      throw error;
    }
  },

  startManualRun: async (cardId: string, stageId: string) => {
    try {
      await api.post(`/cards/${cardId}/stage-rule/start`, { stageId });
      const pipelineId = get().pipeline?.id;
      if (pipelineId) await get().fetchPipeline(pipelineId);
    } catch (error: unknown) {
      const message = typeof error === 'object' && error !== null && 'response' in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      set({ error: message || 'Erro ao iniciar régua manualmente' });
      throw error;
    }
  },

  setStageAgent: async (stageId: string, agentId: string | null, classificationCriteria: string | null) => {
    try {
      await api.patch(`/stages/${stageId}/agent`, { agentId, classificationCriteria });
      const pipelineId = get().pipeline?.id;
      if (pipelineId) await get().fetchPipeline(pipelineId);
    } catch (error: unknown) {
      const message = typeof error === 'object' && error !== null && 'response' in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      set({ error: message || 'Erro ao salvar agente da etapa' });
      throw error;
    }
  },

  toggleTakeover: async (conversationId: string) => {
    try {
      await api.post(`/agent-conversations/${conversationId}/toggle-takeover`);
      const pipelineId = get().pipeline?.id;
      if (pipelineId) await get().fetchPipeline(pipelineId);
    } catch (error: unknown) {
      const message = typeof error === 'object' && error !== null && 'response' in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      set({ error: message || 'Erro ao alterar takeover' });
      throw error;
    }
  },

  fetchAgents: async () => {
    try {
      const response = await api.get<StageAgentOption[]>('/agents');
      return response.data;
    } catch (error: unknown) {
      const message = typeof error === 'object' && error !== null && 'response' in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      set({ error: message || 'Erro ao carregar agentes' });
      throw error;
    }
  },
}));

