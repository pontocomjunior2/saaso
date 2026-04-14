import { create } from 'zustand';
import api from '@/lib/api';

export interface MetaMapping {
  id: string;
  metaFormId: string;
  pipelineId: string;
  pipeline?: { name: string };
  pipelineName?: string;
  stageId: string;
  stage?: { name: string };
  stageName?: string;
  verifyToken: string;
  createdAt: string;
}

export interface CreateMetaMappingInput {
  metaFormId: string;
  pipelineId: string;
  stageId: string;
  verifyToken: string;
  pageAccessToken?: string;
}

interface MetaMappingsState {
  mappings: MetaMapping[];
  loading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  create: (input: CreateMetaMappingInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useMetaMappingsStore = create<MetaMappingsState>((set, get) => ({
  mappings: [],
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const response = await api.get<MetaMapping[]>('/meta-mappings');
      set({ mappings: response.data, loading: false });
    } catch (error: any) {
      set({ error: error?.message ?? 'Erro ao carregar mapeamentos', loading: false });
    }
  },

  create: async (input) => {
    const response = await api.post<MetaMapping>('/meta-mappings', input);
    set({ mappings: [...get().mappings, response.data] });
  },

  remove: async (id) => {
    await api.delete(`/meta-mappings/${id}`);
    set({ mappings: get().mappings.filter((mapping) => mapping.id !== id) });
  },
}));
