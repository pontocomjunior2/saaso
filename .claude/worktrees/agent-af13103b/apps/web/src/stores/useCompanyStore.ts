import { create } from 'zustand';
import api from '../lib/api';

export interface Company {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  contacts?: Array<{
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  }>;
}

interface CompanyState {
  companies: Company[];
  isLoading: boolean;
  error: string | null;
  fetchCompanies: (search?: string) => Promise<void>;
  createCompany: (data: Partial<Company>) => Promise<void>;
  updateCompany: (id: string, data: Partial<Company>) => Promise<void>;
  deleteCompany: (id: string) => Promise<void>;
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

export const useCompanyStore = create<CompanyState>((set, get) => ({
  companies: [],
  isLoading: false,
  error: null,

  fetchCompanies: async (search?: string) => {
    set({ isLoading: true, error: null });
    try {
      const url = search ? `/companies?search=${encodeURIComponent(search)}` : '/companies';
      const response = await api.get<Company[]>(url);
      set({ companies: response.data, isLoading: false });
    } catch (error: unknown) {
      set({ error: extractErrorMessage(error, 'Erro ao carregar empresas'), isLoading: false });
    }
  },

  createCompany: async (data) => {
    try {
      await api.post('/companies', data);
      await get().fetchCompanies();
    } catch (error: unknown) {
      throw new Error(extractErrorMessage(error, 'Erro ao criar empresa'));
    }
  },

  updateCompany: async (id, data) => {
    try {
      await api.patch(`/companies/${id}`, data);
      await get().fetchCompanies();
    } catch (error: unknown) {
      throw new Error(extractErrorMessage(error, 'Erro ao atualizar empresa'));
    }
  },

  deleteCompany: async (id) => {
    try {
      await api.delete(`/companies/${id}`);
      set((state) => ({ companies: state.companies.filter((company) => company.id !== id) }));
    } catch (error: unknown) {
      throw new Error(extractErrorMessage(error, 'Erro ao deletar empresa'));
    }
  },
}));
