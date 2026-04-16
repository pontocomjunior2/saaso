import { create } from 'zustand';
import api from '../lib/api';

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
  historyWindow?: number;
  summaryThreshold?: number;
}

export interface AgentDraft {
  name: string;
  systemPrompt?: string;
  profile?: AgentPromptProfile | null;
  isActive?: boolean;
  stageId?: string | null;
  knowledgeBaseId?: string | null;
}

export interface Agent {
  id: string;
  name: string;
  systemPrompt: string;
  compiledPrompt: string;
  isActive: boolean;
  stageId: string | null;
  knowledgeBaseId: string | null;
  knowledgeBase: {
    id: string;
    name: string;
    summary: string | null;
    content: string | null;
  } | null;
  profile: AgentPromptProfile | null;
  createdAt: string;
  updatedAt: string;
  stage: {
    id: string;
    name: string;
    pipeline: {
      id: string;
      name: string;
    };
  } | null;
}

export interface AgentConversationMessage {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  whatsAppMessageId: string | null;
}

export interface AgentConversation {
  id: string;
  status: string;
  summary: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
  contact: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
  };
  card: {
    id: string;
    title: string;
    stageId: string;
  } | null;
  messages: AgentConversationMessage[];
}

interface AgentPromptPreview {
  compiledPrompt: string;
  profile: AgentPromptProfile | null;
}

interface AgentState {
  agents: Agent[];
  conversationsByAgent: Record<string, AgentConversation[]>;
  isLoading: boolean;
  isPreviewLoading: boolean;
  conversationLoadingAgentId: string | null;
  error: string | null;
  conversationError: string | null;
  previewPrompt: string;
  fetchAgents: () => Promise<void>;
  fetchAgentConversations: (agentId: string) => Promise<AgentConversation[]>;
  createAgent: (data: AgentDraft) => Promise<Agent>;
  updateAgent: (id: string, data: Partial<AgentDraft>) => Promise<Agent>;
  deleteAgent: (id: string) => Promise<void>;
  getPromptPreview: (data: Partial<AgentDraft>) => Promise<string>;
  clearPromptPreview: () => void;
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const responseMessage = (error as { response?: { data?: { message?: string | string[] } } }).response?.data
      ?.message;

    if (Array.isArray(responseMessage)) {
      return responseMessage.join(' ');
    }

    if (typeof responseMessage === 'string') {
      return responseMessage;
    }
  }

  return fallback;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: [],
  conversationsByAgent: {},
  isLoading: false,
  isPreviewLoading: false,
  conversationLoadingAgentId: null,
  error: null,
  conversationError: null,
  previewPrompt: '',

  fetchAgents: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<Agent[]>('/agents');
      set({ agents: response.data, isLoading: false });
    } catch (error: unknown) {
      set({ error: extractErrorMessage(error, 'Erro ao carregar agentes'), isLoading: false });
    }
  },

  fetchAgentConversations: async (agentId) => {
    set({ conversationLoadingAgentId: agentId, conversationError: null });
    try {
      const response = await api.get<AgentConversation[]>(`/agents/${agentId}/conversations`);
      set((state) => ({
        conversationsByAgent: {
          ...state.conversationsByAgent,
          [agentId]: response.data,
        },
        conversationLoadingAgentId: null,
      }));
      return response.data;
    } catch (error: unknown) {
      const message = extractErrorMessage(error, 'Erro ao carregar conversas do agente');
      set({ conversationError: message, conversationLoadingAgentId: null });
      throw new Error(message);
    }
  },

  createAgent: async (data) => {
    try {
      const response = await api.post<Agent>('/agents', data);
      await get().fetchAgents();
      return response.data;
    } catch (error: unknown) {
      throw new Error(extractErrorMessage(error, 'Erro ao criar agente'));
    }
  },

  updateAgent: async (id, data) => {
    try {
      const response = await api.patch<Agent>(`/agents/${id}`, data);
      await get().fetchAgents();
      return response.data;
    } catch (error: unknown) {
      throw new Error(extractErrorMessage(error, 'Erro ao atualizar agente'));
    }
  },

  deleteAgent: async (id) => {
    try {
      await api.delete(`/agents/${id}`);
      set((state) => {
        const nextConversationsByAgent = { ...state.conversationsByAgent };
        delete nextConversationsByAgent[id];

        return {
          agents: state.agents.filter((agent) => agent.id !== id),
          conversationsByAgent: nextConversationsByAgent,
        };
      });
    } catch (error: unknown) {
      throw new Error(extractErrorMessage(error, 'Erro ao deletar agente'));
    }
  },

  getPromptPreview: async (data) => {
    set({ isPreviewLoading: true, error: null });
    try {
      const response = await api.post<AgentPromptPreview>('/agents/preview-prompt', data);
      set({ previewPrompt: response.data.compiledPrompt, isPreviewLoading: false });
      return response.data.compiledPrompt;
    } catch (error: unknown) {
      const message = extractErrorMessage(error, 'Erro ao montar preview do prompt');
      set({ error: message, isPreviewLoading: false });
      throw new Error(message);
    }
  },

  clearPromptPreview: () => {
    set({ previewPrompt: '' });
  },
}));
