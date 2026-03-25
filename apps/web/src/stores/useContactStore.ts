import { create } from 'zustand';
import api from '../lib/api';

export interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  tags: string[];
  companyId: string | null;
  company?: {
    id: string;
    name: string;
    industry?: string | null;
  } | null;
  cards?: Array<{
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
  }>;
  _count?: {
    cards: number;
    messages: number;
    agentConversations: number;
  };
}

export interface SegmentBucket {
  key: string;
  label: string;
  count: number;
}

export interface ContactSegments {
  tags: SegmentBucket[];
  industries: SegmentBucket[];
  positions: SegmentBucket[];
}

export interface ManualEntryInput {
  contactName: string;
  email?: string;
  phone?: string;
  position?: string;
  tags?: string[];
  companyId?: string;
  companyName?: string;
  industry?: string;
  website?: string;
  stageId: string;
  assigneeId?: string;
  cardTitle?: string;
  note?: string;
  manualTakeover?: boolean;
}

interface ContactState {
  contacts: Contact[];
  segments: ContactSegments;
  isLoading: boolean;
  isSegmentsLoading: boolean;
  error: string | null;
  fetchContacts: (search?: string) => Promise<void>;
  fetchSegments: () => Promise<void>;
  createContact: (data: Partial<Contact>) => Promise<void>;
  updateContact: (id: string, data: Partial<Contact>) => Promise<void>;
  createManualEntry: (data: ManualEntryInput) => Promise<void>;
  deleteContact: (id: string) => Promise<void>;
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

const emptySegments: ContactSegments = {
  tags: [],
  industries: [],
  positions: [],
};

export const useContactStore = create<ContactState>((set, get) => ({
  contacts: [],
  segments: emptySegments,
  isLoading: false,
  isSegmentsLoading: false,
  error: null,

  fetchContacts: async (search?: string) => {
    set({ isLoading: true, error: null });
    try {
      const url = search ? `/contacts?search=${encodeURIComponent(search)}` : '/contacts';
      const response = await api.get<Contact[]>(url);
      set({ contacts: response.data, isLoading: false });
    } catch (error: unknown) {
      set({ error: extractErrorMessage(error, 'Erro ao carregar contatos'), isLoading: false });
    }
  },

  fetchSegments: async () => {
    set({ isSegmentsLoading: true, error: null });
    try {
      const response = await api.get<ContactSegments>('/contacts/segments');
      set({ segments: response.data, isSegmentsLoading: false });
    } catch (error: unknown) {
      set({ error: extractErrorMessage(error, 'Erro ao carregar segmentos'), isSegmentsLoading: false });
    }
  },

  createContact: async (data) => {
    try {
      await api.post('/contacts', data);
      await Promise.all([get().fetchContacts(), get().fetchSegments()]);
    } catch (error: unknown) {
      throw new Error(extractErrorMessage(error, 'Erro ao criar contato'));
    }
  },

  updateContact: async (id, data) => {
    try {
      await api.patch(`/contacts/${id}`, data);
      await Promise.all([get().fetchContacts(), get().fetchSegments()]);
    } catch (error: unknown) {
      throw new Error(extractErrorMessage(error, 'Erro ao atualizar contato'));
    }
  },

  createManualEntry: async (data) => {
    try {
      await api.post('/contacts/manual-entry', data);
      await Promise.all([get().fetchContacts(), get().fetchSegments()]);
    } catch (error: unknown) {
      throw new Error(extractErrorMessage(error, 'Erro ao registrar entrada manual'));
    }
  },

  deleteContact: async (id) => {
    try {
      await api.delete(`/contacts/${id}`);
      set((state) => ({ contacts: state.contacts.filter((contact) => contact.id !== id) }));
      await get().fetchSegments();
    } catch (error: unknown) {
      throw new Error(extractErrorMessage(error, 'Erro ao deletar contato'));
    }
  },
}));
