import { create } from 'zustand';
import api from '../lib/api';

export type LeadFormFieldType = 'text' | 'textarea' | 'email' | 'phone' | 'select';
export type LeadFormFieldMap =
  | 'name'
  | 'email'
  | 'phone'
  | 'position'
  | 'companyName'
  | 'cardTitle'
  | 'custom';

export interface LeadFormFieldOption {
  label: string;
  value: string;
}

export interface LeadFormField {
  id: string;
  key: string;
  label: string;
  type: LeadFormFieldType;
  placeholder?: string;
  helpText?: string;
  required?: boolean;
  mapTo?: LeadFormFieldMap;
  options?: LeadFormFieldOption[];
}

export interface LeadFormDraft {
  name: string;
  slug?: string;
  headline?: string;
  description?: string;
  submitButtonLabel?: string;
  successTitle?: string;
  successMessage?: string;
  isActive?: boolean;
  stageId: string;
  fields: LeadFormField[];
}

export interface LeadForm {
  id: string;
  name: string;
  slug: string;
  headline: string | null;
  description: string | null;
  submitButtonLabel: string | null;
  successTitle: string | null;
  successMessage: string | null;
  isActive: boolean;
  stageId: string;
  createdAt: string;
  updatedAt: string;
  fields: LeadFormField[];
  stage: {
    id: string;
    name: string;
    pipeline: {
      id: string;
      name: string;
    };
  };
  /** Total number of form submissions (included in list response if backend supports it) */
  submissionCount?: number;
  /** ISO datetime of the most recent submission */
  lastSubmissionAt?: string | null;
}

export interface LeadFormAnalytics {
  formId: string;
  totalSubmissions: number;
  submissionsLast7Days: number;
  submissionsLast30Days: number;
  latestSubmissionAt: string | null;
  recentSubmissions: Array<{
    id: string;
    createdAt: string;
    contact: {
      id: string;
      name: string;
      email: string | null;
      phone: string | null;
    } | null;
    card: {
      id: string;
      title: string;
    } | null;
  }>;
}

interface LeadFormState {
  forms: LeadForm[];
  analyticsByFormId: Record<string, LeadFormAnalytics>;
  isLoading: boolean;
  analyticsLoadingFormId: string | null;
  error: string | null;
  analyticsError: string | null;
  fetchForms: () => Promise<void>;
  fetchFormAnalytics: (formId: string) => Promise<LeadFormAnalytics>;
  createForm: (data: LeadFormDraft) => Promise<LeadForm>;
  updateForm: (id: string, data: Partial<LeadFormDraft>) => Promise<LeadForm>;
  deleteForm: (id: string) => Promise<void>;
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

export const useLeadFormStore = create<LeadFormState>((set, get) => ({
  forms: [],
  analyticsByFormId: {},
  isLoading: false,
  analyticsLoadingFormId: null,
  error: null,
  analyticsError: null,

  fetchForms: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<LeadForm[]>('/forms');
      set({ forms: response.data, isLoading: false });
    } catch (error: unknown) {
      set({ error: extractErrorMessage(error, 'Erro ao carregar formularios'), isLoading: false });
    }
  },

  fetchFormAnalytics: async (formId) => {
    set({ analyticsLoadingFormId: formId, analyticsError: null });
    try {
      const response = await api.get<LeadFormAnalytics>(`/forms/${formId}/analytics`);
      set((state) => ({
        analyticsByFormId: {
          ...state.analyticsByFormId,
          [formId]: response.data,
        },
        analyticsLoadingFormId: null,
      }));
      return response.data;
    } catch (error: unknown) {
      const message = extractErrorMessage(error, 'Erro ao carregar analytics do formulario');
      set({ analyticsError: message, analyticsLoadingFormId: null });
      throw new Error(message);
    }
  },

  createForm: async (data) => {
    try {
      const response = await api.post<LeadForm>('/forms', data);
      await get().fetchForms();
      return response.data;
    } catch (error: unknown) {
      throw new Error(extractErrorMessage(error, 'Erro ao criar formulario'));
    }
  },

  updateForm: async (id, data) => {
    try {
      const response = await api.patch<LeadForm>(`/forms/${id}`, data);
      await get().fetchForms();
      return response.data;
    } catch (error: unknown) {
      throw new Error(extractErrorMessage(error, 'Erro ao atualizar formulario'));
    }
  },

  deleteForm: async (id) => {
    try {
      await api.delete(`/forms/${id}`);
      set((state) => {
        const nextAnalytics = { ...state.analyticsByFormId };
        delete nextAnalytics[id];

        return {
          forms: state.forms.filter((form) => form.id !== id),
          analyticsByFormId: nextAnalytics,
        };
      });
    } catch (error: unknown) {
      throw new Error(extractErrorMessage(error, 'Erro ao deletar formulario'));
    }
  },
}));
