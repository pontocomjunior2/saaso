import { create } from 'zustand';
import api from '../lib/api';

export interface CampaignSegmentBucket {
  key: string;
  label: string;
  count: number;
}

export interface CampaignSegments {
  tags: CampaignSegmentBucket[];
  industries: CampaignSegmentBucket[];
  positions: CampaignSegmentBucket[];
}

export interface CampaignCompanyOption {
  id: string;
  name: string;
  industry?: string | null;
}

export interface AudienceFilters {
  search?: string | null;
  tags?: string[];
  industries?: string[];
  positions?: string[];
  companyIds?: string[];
  onlyWithPhone?: boolean;
  onlyWithEmail?: boolean;
}

export interface AudienceDraft {
  name: string;
  description?: string | null;
  kind: 'DYNAMIC' | 'MANUAL';
  filters: AudienceFilters;
  contactIds: string[];
}

export interface Audience {
  id: string;
  name: string;
  description: string | null;
  kind: 'DYNAMIC' | 'MANUAL';
  filters: {
    search: string | null;
    tags: string[];
    industries: string[];
    positions: string[];
    companyIds: string[];
    onlyWithPhone: boolean;
    onlyWithEmail: boolean;
  };
  contactIds: string[];
  contactCount: number;
  campaignCount: number;
  sampleContacts: Array<{
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    company: {
      id: string;
      name: string;
    } | null;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignContactOption {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  tags: string[];
  company?: {
    id: string;
    name: string;
    industry?: string | null;
  } | null;
}

export interface CampaignStepDraft {
  id?: string;
  order?: number;
  channel: 'WHATSAPP' | 'EMAIL';
  delayAmount: number;
  delayUnit: 'MINUTES' | 'HOURS' | 'DAYS';
  messageTemplate: string;
}

export interface CampaignDraft {
  name: string;
  description?: string | null;
  channel: 'WHATSAPP' | 'EMAIL';
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED';
  messageTemplate?: string | null;
  audienceId?: string | null;
  launchAt?: string | null;
  steps: CampaignStepDraft[];
}

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  channel: 'WHATSAPP' | 'EMAIL';
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED';
  messageTemplate: string | null;
  launchAt: string | null;
  steps: Array<{
    id: string;
    order: number;
    channel: 'WHATSAPP' | 'EMAIL';
    delayAmount: number;
    delayUnit: 'MINUTES' | 'HOURS' | 'DAYS';
    messageTemplate: string;
  }>;
  audience: {
    id: string;
    name: string;
    contactCount: number;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface CampaignState {
  campaigns: Campaign[];
  audiences: Audience[];
  segments: CampaignSegments;
  companies: CampaignCompanyOption[];
  contacts: CampaignContactOption[];
  isLoading: boolean;
  error: string | null;
  fetchCampaignHub: () => Promise<void>;
  createAudience: (data: AudienceDraft) => Promise<Audience>;
  updateAudience: (
    id: string,
    data: Partial<AudienceDraft>,
  ) => Promise<Audience>;
  deleteAudience: (id: string) => Promise<void>;
  createCampaign: (data: CampaignDraft) => Promise<Campaign>;
  updateCampaign: (
    id: string,
    data: Partial<CampaignDraft>,
  ) => Promise<Campaign>;
  deleteCampaign: (id: string) => Promise<void>;
}

const emptySegments: CampaignSegments = {
  tags: [],
  industries: [],
  positions: [],
};

function extractErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const responseMessage = (error as {
      response?: { data?: { message?: string | string[] } };
    }).response?.data?.message;

    if (Array.isArray(responseMessage)) {
      return responseMessage.join(' ');
    }

    if (typeof responseMessage === 'string') {
      return responseMessage;
    }
  }

  return fallback;
}

export const useCampaignStore = create<CampaignState>((set, get) => ({
  campaigns: [],
  audiences: [],
  segments: emptySegments,
  companies: [],
  contacts: [],
  isLoading: false,
  error: null,

  fetchCampaignHub: async () => {
    set({ isLoading: true, error: null });
    try {
      const [
        campaignsResponse,
        audiencesResponse,
        segmentsResponse,
        companiesResponse,
        contactsResponse,
      ] = await Promise.all([
        api.get<Campaign[]>('/campaigns'),
        api.get<Audience[]>('/audiences'),
        api.get<CampaignSegments>('/contacts/segments'),
        api.get<CampaignCompanyOption[]>('/companies'),
        api.get<CampaignContactOption[]>('/contacts'),
      ]);

      set({
        campaigns: campaignsResponse.data,
        audiences: audiencesResponse.data,
        segments: segmentsResponse.data,
        companies: companiesResponse.data,
        contacts: contactsResponse.data,
        isLoading: false,
      });
    } catch (error: unknown) {
      set({
        error: extractErrorMessage(
          error,
          'Erro ao carregar campanhas e audiencias',
        ),
        isLoading: false,
      });
    }
  },

  createAudience: async (data) => {
    try {
      const response = await api.post<Audience>('/audiences', data);
      await get().fetchCampaignHub();
      return response.data;
    } catch (error: unknown) {
      throw new Error(extractErrorMessage(error, 'Erro ao criar audiencia'));
    }
  },

  updateAudience: async (id, data) => {
    try {
      const response = await api.patch<Audience>(`/audiences/${id}`, data);
      await get().fetchCampaignHub();
      return response.data;
    } catch (error: unknown) {
      throw new Error(
        extractErrorMessage(error, 'Erro ao atualizar audiencia'),
      );
    }
  },

  deleteAudience: async (id) => {
    try {
      await api.delete(`/audiences/${id}`);
      set((state) => ({
        audiences: state.audiences.filter((audience) => audience.id !== id),
        campaigns: state.campaigns.map((campaign) =>
          campaign.audience?.id === id ? { ...campaign, audience: null } : campaign,
        ),
      }));
    } catch (error: unknown) {
      throw new Error(extractErrorMessage(error, 'Erro ao remover audiencia'));
    }
  },

  createCampaign: async (data) => {
    try {
      const response = await api.post<Campaign>('/campaigns', data);
      await get().fetchCampaignHub();
      return response.data;
    } catch (error: unknown) {
      throw new Error(extractErrorMessage(error, 'Erro ao criar campanha'));
    }
  },

  updateCampaign: async (id, data) => {
    try {
      const response = await api.patch<Campaign>(`/campaigns/${id}`, data);
      await get().fetchCampaignHub();
      return response.data;
    } catch (error: unknown) {
      throw new Error(
        extractErrorMessage(error, 'Erro ao atualizar campanha'),
      );
    }
  },

  deleteCampaign: async (id) => {
    try {
      await api.delete(`/campaigns/${id}`);
      set((state) => ({
        campaigns: state.campaigns.filter((campaign) => campaign.id !== id),
      }));
    } catch (error: unknown) {
      throw new Error(extractErrorMessage(error, 'Erro ao remover campanha'));
    }
  },
}));
