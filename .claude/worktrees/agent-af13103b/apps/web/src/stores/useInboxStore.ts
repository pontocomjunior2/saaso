import { create } from 'zustand';
import api from '../lib/api';

export type ConversationStatus = 'OPEN' | 'HANDOFF_REQUIRED' | 'CLOSED';

export interface InboxThreadMessage {
  id: string;
  content: string;
  direction: 'INBOUND' | 'OUTBOUND';
  status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  createdAt: string;
}

export interface InboxThreadConversation {
  id: string;
  status: ConversationStatus;
  summary: string | null;
  lastMessageAt: string | null;
  updatedAt: string;
  agent: {
    id: string;
    name: string;
    isActive: boolean;
  };
  card: {
    id: string;
    title: string;
    stage: {
      id: string;
      name: string;
      pipeline: {
        id: string;
        name: string;
      };
    };
  } | null;
}

export interface InboxThreadCard {
  id: string;
  title: string;
  updatedAt: string;
  stage: {
    id: string;
    name: string;
    pipeline: {
      id: string;
      name: string;
    };
  };
}

export interface InboxThreadAgent {
  id: string;
  name: string;
  isActive: boolean;
}

export interface InboxThreadSummary {
  contact: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    company: {
      id: string;
      name: string;
    } | null;
  };
  latestMessage: InboxThreadMessage | null;
  latestConversation: InboxThreadConversation | null;
  latestCard: InboxThreadCard | null;
  assignedAgent: InboxThreadAgent | null;
  messageCount: number;
}

export interface InboxThreadDetail extends InboxThreadSummary {
  account: {
    id: string;
    phoneNumber: string | null;
    status: 'CONNECTED' | 'DISCONNECTED' | 'QR_READY' | 'ERROR';
    connectionMode: 'cloud_api' | 'local_demo' | 'configuration_incomplete';
    isOperational: boolean;
  } | null;
  messages: InboxThreadMessage[];
}

interface InboxState {
  threads: InboxThreadSummary[];
  selectedContactId: string | null;
  selectedThread: InboxThreadDetail | null;
  isLoading: boolean;
  isThreadLoading: boolean;
  isSending: boolean;
  isUpdatingStatus: boolean;
  error: string | null;
  fetchInbox: () => Promise<void>;
  fetchThread: (contactId: string) => Promise<void>;
  sendMessage: (input: { contactId: string; content: string; cardId?: string }) => Promise<void>;
  updateConversationStatus: (conversationId: string, status: ConversationStatus) => Promise<void>;
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

export const useInboxStore = create<InboxState>((set, get) => ({
  threads: [],
  selectedContactId: null,
  selectedThread: null,
  isLoading: false,
  isThreadLoading: false,
  isSending: false,
  isUpdatingStatus: false,
  error: null,

  fetchInbox: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await api.get<InboxThreadSummary[]>('/whatsapp/inbox');
      const threads = response.data;
      const selectedContactId =
        get().selectedContactId && threads.some((thread) => thread.contact.id === get().selectedContactId)
          ? get().selectedContactId
          : threads[0]?.contact.id ?? null;

      set({
        threads,
        selectedContactId,
        isLoading: false,
      });

      if (selectedContactId) {
        await get().fetchThread(selectedContactId);
      } else {
        set({ selectedThread: null });
      }
    } catch (error: unknown) {
      set({ error: extractErrorMessage(error, 'Erro ao carregar a inbox.'), isLoading: false });
    }
  },

  fetchThread: async (contactId) => {
    set({ selectedContactId: contactId, isThreadLoading: true, error: null });

    try {
      const response = await api.get<InboxThreadDetail>(`/whatsapp/inbox/${contactId}`);
      set({ selectedThread: response.data, isThreadLoading: false });
    } catch (error: unknown) {
      set({
        error: extractErrorMessage(error, 'Erro ao carregar a thread selecionada.'),
        isThreadLoading: false,
      });
    }
  },

  sendMessage: async ({ contactId, content, cardId }) => {
    set({ isSending: true, error: null });

    try {
      await api.post('/whatsapp/send', {
        contactId,
        content,
        cardId,
        direction: 'OUTBOUND',
      });

      await Promise.all([get().fetchInbox(), get().fetchThread(contactId)]);
      set({ isSending: false });
    } catch (error: unknown) {
      set({ error: extractErrorMessage(error, 'Erro ao enviar mensagem.'), isSending: false });
      throw error;
    }
  },

  updateConversationStatus: async (conversationId, status) => {
    const selectedContactId = get().selectedContactId;
    if (!selectedContactId) {
      return;
    }

    set({ isUpdatingStatus: true, error: null });

    try {
      await api.patch(`/agents/conversations/${conversationId}/status`, { status });
      await Promise.all([get().fetchInbox(), get().fetchThread(selectedContactId)]);
      set({ isUpdatingStatus: false });
    } catch (error: unknown) {
      set({
        error: extractErrorMessage(error, 'Erro ao atualizar o modo da conversa.'),
        isUpdatingStatus: false,
      });
      throw error;
    }
  },
}));
