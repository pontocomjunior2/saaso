import { create } from 'zustand';
import api from '../lib/api';

export interface WhatsAppAccount {
  id: string;
  phoneNumber: string | null;
  phoneNumberId: string | null;
  wabaId: string | null;
  status: 'CONNECTED' | 'DISCONNECTED' | 'QR_READY' | 'ERROR';
  hasAccessToken: boolean;
  connectionMode: 'cloud_api' | 'local_demo' | 'configuration_incomplete';
  isOperational: boolean;
  supportsSimulator: boolean;
  canSendOfficialOutbound: boolean;
  canReceiveOfficialWebhook: boolean;
  verifyTokenConfigured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SimulateInboundInput {
  fromPhoneNumber: string;
  contactName?: string;
  companyName?: string;
  message: string;
  stageId?: string;
}

interface WhatsAppState {
  account: WhatsAppAccount | null;
  isLoading: boolean;
  isSimulatingInbound: boolean;
  error: string | null;
  fetchAccount: () => Promise<void>;
  connect: (data: {
    phoneNumber: string;
    accessToken?: string;
    phoneNumberId?: string;
    wabaId?: string;
  }) => Promise<void>;
  simulateInbound: (data: SimulateInboundInput) => Promise<void>;
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

export const useWhatsAppStore = create<WhatsAppState>((set) => ({
  account: null,
  isLoading: false,
  isSimulatingInbound: false,
  error: null,

  fetchAccount: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get('/whatsapp/account');
      set({ account: response.data, isLoading: false });
    } catch (error: unknown) {
      set({
        error: extractErrorMessage(error, 'Erro ao carregar conta'),
        isLoading: false,
      });
    }
  },

  connect: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<WhatsAppAccount>('/whatsapp/connect', data);
      set({ account: response.data, isLoading: false });
    } catch (error: unknown) {
      set({
        error: extractErrorMessage(error, 'Erro ao conectar WhatsApp'),
        isLoading: false,
      });
      throw error;
    }
  },

  simulateInbound: async (data) => {
    set({ isSimulatingInbound: true, error: null });
    try {
      await api.post('/whatsapp/simulate-inbound', data);
      set({ isSimulatingInbound: false });
    } catch (error: unknown) {
      set({
        error: extractErrorMessage(error, 'Erro ao simular mensagem inbound'),
        isSimulatingInbound: false,
      });
      throw error;
    }
  },
}));
