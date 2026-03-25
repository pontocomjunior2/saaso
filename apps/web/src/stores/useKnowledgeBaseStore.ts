import { create } from 'zustand';
import api from '../lib/api';

export interface KnowledgeBaseDraft {
  name: string;
  summary?: string | null;
  content: string;
}

export interface KnowledgeBase {
  id: string;
  name: string;
  summary: string | null;
  content: string | null;
  agentCount: number;
  createdAt: string;
  updatedAt: string;
}

interface KnowledgeBaseState {
  knowledgeBases: KnowledgeBase[];
  isLoading: boolean;
  error: string | null;
  fetchKnowledgeBases: () => Promise<void>;
  createKnowledgeBase: (data: KnowledgeBaseDraft) => Promise<KnowledgeBase>;
  updateKnowledgeBase: (id: string, data: Partial<KnowledgeBaseDraft>) => Promise<KnowledgeBase>;
  deleteKnowledgeBase: (id: string) => Promise<void>;
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

export const useKnowledgeBaseStore = create<KnowledgeBaseState>((set, get) => ({
  knowledgeBases: [],
  isLoading: false,
  error: null,

  fetchKnowledgeBases: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<KnowledgeBase[]>('/knowledge-bases');
      set({ knowledgeBases: response.data, isLoading: false });
    } catch (error: unknown) {
      set({ error: extractErrorMessage(error, 'Erro ao carregar bases de conhecimento'), isLoading: false });
    }
  },

  createKnowledgeBase: async (data) => {
    try {
      const response = await api.post<KnowledgeBase>('/knowledge-bases', data);
      await get().fetchKnowledgeBases();
      return response.data;
    } catch (error: unknown) {
      throw new Error(extractErrorMessage(error, 'Erro ao criar base de conhecimento'));
    }
  },

  updateKnowledgeBase: async (id, data) => {
    try {
      const response = await api.patch<KnowledgeBase>(`/knowledge-bases/${id}`, data);
      await get().fetchKnowledgeBases();
      return response.data;
    } catch (error: unknown) {
      throw new Error(extractErrorMessage(error, 'Erro ao atualizar base de conhecimento'));
    }
  },

  deleteKnowledgeBase: async (id) => {
    try {
      await api.delete(`/knowledge-bases/${id}`);
      set((state) => ({
        knowledgeBases: state.knowledgeBases.filter((knowledgeBase) => knowledgeBase.id !== id),
      }));
    } catch (error: unknown) {
      throw new Error(extractErrorMessage(error, 'Erro ao remover base de conhecimento'));
    }
  },
}));
