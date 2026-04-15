import { create } from 'zustand';
import api from '../lib/api';

export interface WhatsAppAccountSummary {
  id: string;
  provider: string;
  phoneNumber: string | null;
  phoneNumberId: string | null;
  wabaId: string | null;
  instanceName: string | null;
  status: string;
  hasAccessToken: boolean;
  connectionMode: 'cloud_api' | 'local_demo' | 'configuration_incomplete';
  isOperational: boolean;
  supportsSimulator: boolean;
  canSendOfficialOutbound: boolean;
  canReceiveOfficialWebhook: boolean;
  verifyTokenConfigured: boolean;
  assignedPipelineId: string | null;
  assignedPipelineName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EvolutionInstanceInput {
  name: string;
  phoneNumber?: string;
}

export interface SimulateInboundInput {
  fromPhoneNumber: string;
  contactName?: string;
  companyName?: string;
  message: string;
  stageId?: string;
}

interface WhatsAppAccountState {
  accounts: WhatsAppAccountSummary[];
  currentAccount: WhatsAppAccountSummary | null;
  isLoading: boolean;
  error: string | null;
  qrCode: string | null;
  connectionState: string | null;
  fetchAccounts: () => Promise<void>;
  createAccount: (dto: {
    provider?: string;
    phoneNumber?: string;
    phoneNumberId?: string;
    wabaId?: string;
    accessToken?: string;
    instanceName?: string;
  }) => Promise<WhatsAppAccountSummary>;
  updateAccount: (id: string, dto: {
    provider?: string;
    phoneNumber?: string;
    phoneNumberId?: string;
    wabaId?: string;
    accessToken?: string;
    instanceName?: string;
  }) => Promise<WhatsAppAccountSummary>;
  deleteAccount: (id: string) => Promise<void>;
  disconnectAccount: (id: string) => Promise<void>;
  createEvolutionInstance: (dto: EvolutionInstanceInput) => Promise<{ instance: string }>;
  fetchQrCode: (instanceName: string) => Promise<string>;
  fetchConnectionState: (instanceName: string) => Promise<string>;
  simulateInbound: (dto: SimulateInboundInput) => Promise<void>;
  clearQrCode: () => void;
  switchProvider: (provider: 'meta_cloud' | 'evolution') => void;
  selectedProvider: 'meta_cloud' | 'evolution';
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

    if ('message' in error && typeof error.message === 'string') {
      return error.message;
    }
  }

  return fallback;
}

export const useWhatsAppAccountStore = create<WhatsAppAccountState>((set, get) => ({
  accounts: [],
  currentAccount: null,
  isLoading: false,
  error: null,
  qrCode: null,
  connectionState: null,
  selectedProvider: 'evolution',

  fetchAccounts: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<WhatsAppAccountSummary[]>('/whatsapp/accounts');
      set({ accounts: response.data, isLoading: false });
    } catch (error: unknown) {
      set({
        error: extractErrorMessage(error, 'Erro ao carregar contas WhatsApp'),
        isLoading: false,
      });
    }
  },

  createAccount: async (dto) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<WhatsAppAccountSummary>('/whatsapp/accounts', dto);
      set((state) => ({
        accounts: [...state.accounts, response.data],
        currentAccount: response.data,
        isLoading: false,
      }));
      return response.data;
    } catch (error: unknown) {
      set({
        error: extractErrorMessage(error, 'Erro ao criar conta WhatsApp'),
        isLoading: false,
      });
      throw error;
    }
  },

  updateAccount: async (id, dto) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.patch<WhatsAppAccountSummary>(`/whatsapp/accounts/${id}`, dto);
      set((state) => ({
        accounts: state.accounts.map((a) => (a.id === id ? response.data : a)),
        currentAccount: state.currentAccount?.id === id ? response.data : state.currentAccount,
        isLoading: false,
      }));
      return response.data;
    } catch (error: unknown) {
      set({
        error: extractErrorMessage(error, 'Erro ao atualizar conta WhatsApp'),
        isLoading: false,
      });
      throw error;
    }
  },

  deleteAccount: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/whatsapp/accounts/${id}`);
      set((state) => ({
        accounts: state.accounts.filter((a) => a.id !== id),
        currentAccount: state.currentAccount?.id === id ? null : state.currentAccount,
        isLoading: false,
      }));
    } catch (error: unknown) {
      set({
        error: extractErrorMessage(error, 'Erro ao excluir conta WhatsApp'),
        isLoading: false,
      });
      throw error;
    }
  },

  disconnectAccount: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await api.post(`/whatsapp/accounts/${id}/disconnect`);
      set((state) => ({
        accounts: state.accounts.map((a) =>
          a.id === id ? { ...a, status: 'DISCONNECTED' } : a,
        ),
        isLoading: false,
      }));
    } catch (error: unknown) {
      set({
        error: extractErrorMessage(error, 'Erro ao desconectar conta WhatsApp'),
        isLoading: false,
      });
      throw error;
    }
  },

  createEvolutionInstance: async (dto) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<{ instance: string }>('/whatsapp/evolution/instance', dto);
      set({ isLoading: false });
      return response.data;
    } catch (error: unknown) {
      set({
        error: extractErrorMessage(error, 'Erro ao criar instância Evolution'),
        isLoading: false,
      });
      throw error;
    }
  },

  fetchQrCode: async (instanceName) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<{ qr: string }>(`/whatsapp/evolution/instance/${instanceName}/qr`);
      set({ qrCode: response.data.qr, isLoading: false });
      return response.data.qr;
    } catch (error: unknown) {
      set({
        error: extractErrorMessage(error, 'Erro ao buscar QR Code'),
        isLoading: false,
      });
      throw error;
    }
  },

  fetchConnectionState: async (instanceName) => {
    try {
      const response = await api.get<{ state: string }>(`/whatsapp/evolution/instance/${instanceName}/connection-state`);
      set({ connectionState: response.data.state });
      return response.data.state;
    } catch (error: unknown) {
      set({
        error: extractErrorMessage(error, 'Erro ao buscar estado da conexão'),
      });
      throw error;
    }
  },

  simulateInbound: async (dto) => {
    set({ isLoading: true, error: null });
    try {
      await api.post('/whatsapp/simulate-inbound', dto);
      set({ isLoading: false });
    } catch (error: unknown) {
      set({
        error: extractErrorMessage(error, 'Erro ao simular mensagem inbound'),
        isLoading: false,
      });
      throw error;
    }
  },

  clearQrCode: () => {
    set({ qrCode: null });
  },

  switchProvider: (provider) => {
    set({ selectedProvider: provider });
  },
}));
