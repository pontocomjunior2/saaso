import { create } from 'zustand';
import api from '../lib/api';

function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { data?: { message?: unknown } } }).response;
    const message = response?.data?.message;
    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }
  }

  return fallback;
}

export interface JourneyExecutionLog {
  id: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  nodeId: string | null;
  nodeLabel: string | null;
  message: string;
  details: unknown;
  createdAt: string;
}

export interface JourneyExecutionJob {
  id: string;
  nodeId: string;
  nodeLabel: string | null;
  nodeKind: string;
  actionType: string | null;
  delayInSeconds: number;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  scheduledFor: string;
  startedAt: string | null;
  completedAt: string | null;
  attempts: number;
  lastError: string | null;
  deadLetteredAt: string | null;
  deadLetterReason: string | null;
  manuallyRequeuedAt: string | null;
  manualRequeueCount: number;
  details: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface JourneyExecution {
  id: string;
  triggerSource: string;
  triggerPayload: unknown;
  contactId: string | null;
  cardId: string | null;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  pendingJobCount: number;
  runningJobCount: number;
  failedJobCount: number;
  nextScheduledAt: string | null;
  logs: JourneyExecutionLog[];
  jobs: JourneyExecutionJob[];
}

export interface JourneyRuntimeStatus {
  driver: 'bullmq' | 'poller';
  queueConfigured: boolean;
  queueOperational: boolean;
  queueName: string | null;
  redisHost: string | null;
  redisPort: number | null;
  workerConcurrency: number;
  lastQueueError: string | null;
  lastEnqueuedAt: string | null;
  lastProcessedAt: string | null;
  totalEnqueuedJobs: number;
  totalProcessedJobs: number;
  totalFailedJobs: number;
  totalRequeuedJobs: number;
  runtimePollMs: number;
  maxJobAttempts: number;
  retryDelayInSeconds: number;
  pendingJobs: number;
  runningJobs: number;
  failedJobs: number;
  deadLetterJobs: number;
  nextScheduledAt: string | null;
  recentDeadLetters: Array<{
    jobId: string;
    executionId: string;
    journeyId: string;
    journeyName: string;
    nodeId: string;
    nodeLabel: string | null;
    actionType: string | null;
    status: 'FAILED';
    failedAt: string | null;
    deadLetteredAt: string | null;
    deadLetterReason: string | null;
    manualRequeueCount: number;
  }>;
}

export interface Journey {
  id: string;
  name: string;
  isActive: boolean;
  nodes: unknown[];
  edges: unknown[];
  createdAt: string;
  updatedAt: string;
  executionCount: number;
  lastExecutionAt: string | null;
  lastExecutionStatus: JourneyExecution['status'] | null;
  recentExecutions?: JourneyExecution[];
}

interface JourneyState {
  journeys: Journey[];
  currentJourney: Journey | null;
  runtimeStatus: JourneyRuntimeStatus | null;
  isLoading: boolean;
  error: string | null;
  fetchJourneys: () => Promise<void>;
  fetchJourney: (id: string) => Promise<void>;
  fetchRuntimeStatus: () => Promise<void>;
  createJourney: (data: Partial<Journey>) => Promise<Journey>;
  updateJourney: (id: string, data: Partial<Journey>) => Promise<Journey>;
  deleteJourney: (id: string) => Promise<void>;
  triggerJourney: (id: string, payload: Record<string, unknown>) => Promise<JourneyExecution>;
  requeueFailedJob: (jobId: string) => Promise<{
    requeuedJobs: number;
    execution: JourneyExecution;
  }>;
  requeueFailedExecutionJobs: (executionId: string) => Promise<{
    requeuedJobs: number;
    execution: JourneyExecution;
  }>;
  processDueJobs: () => Promise<{
    processedAt: string;
    processedJobs: number;
    completedJobs: number;
    failedJobs: number;
    requeuedJobs: number;
    pendingJobs: number;
    nextScheduledAt: string | null;
  }>;
}

export const useJourneyStore = create<JourneyState>((set, get) => ({
  journeys: [],
  currentJourney: null,
  runtimeStatus: null,
  isLoading: false,
  error: null,

  fetchJourneys: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get('/journeys');
      set({ journeys: response.data, isLoading: false });
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, 'Erro ao carregar jornadas'), isLoading: false });
    }
  },

  fetchJourney: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get(`/journeys/${id}`);
      set({ currentJourney: response.data, isLoading: false });
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, 'Erro ao carregar a jornada'), isLoading: false });
    }
  },

  fetchRuntimeStatus: async () => {
    try {
      const response = await api.get('/journeys/runtime/status');
      set({ runtimeStatus: response.data });
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, 'Erro ao carregar o runtime das jornadas') });
    }
  },

  createJourney: async (data: Partial<Journey>) => {
    try {
      const response = await api.post('/journeys', data);
      await get().fetchJourneys();
      return response.data;
    } catch (error: unknown) {
      throw new Error(getErrorMessage(error, 'Erro ao criar jornada'));
    }
  },

  updateJourney: async (id: string, data: Partial<Journey>) => {
    try {
      const response = await api.patch(`/journeys/${id}`, data);
      const updatedJourney = response.data as Journey;
      set((state) => ({
        currentJourney: state.currentJourney?.id === id ? updatedJourney : state.currentJourney,
        journeys: state.journeys.map((journey) => (journey.id === id ? { ...journey, ...updatedJourney } : journey)),
      }));
      await get().fetchJourneys();
      return updatedJourney;
    } catch (error: unknown) {
      throw new Error(getErrorMessage(error, 'Erro ao atualizar jornada'));
    }
  },

  deleteJourney: async (id: string) => {
    try {
      await api.delete(`/journeys/${id}`);
      set((state) => ({
        journeys: state.journeys.filter((journey) => journey.id !== id),
        currentJourney: state.currentJourney?.id === id ? null : state.currentJourney,
      }));
    } catch (error: unknown) {
      throw new Error(getErrorMessage(error, 'Erro ao deletar jornada'));
    }
  },

  triggerJourney: async (id: string, payload: Record<string, unknown>) => {
    try {
      const response = await api.post(`/journeys/${id}/trigger`, payload);
      const execution = response.data as JourneyExecution;

      if (get().currentJourney?.id === id) {
        await get().fetchJourney(id);
      } else {
        await get().fetchJourneys();
      }
      await get().fetchRuntimeStatus();

      return execution;
    } catch (error: unknown) {
      throw new Error(getErrorMessage(error, 'Erro ao disparar jornada'));
    }
  },

  requeueFailedJob: async (jobId: string) => {
    try {
      const response = await api.post(`/journeys/runtime/jobs/${jobId}/requeue`);
      const currentJourneyId = get().currentJourney?.id;
      if (currentJourneyId) {
        await get().fetchJourney(currentJourneyId);
      }
      await get().fetchJourneys();
      await get().fetchRuntimeStatus();
      return response.data;
    } catch (error: unknown) {
      throw new Error(getErrorMessage(error, 'Erro ao reenfileirar job'));
    }
  },

  requeueFailedExecutionJobs: async (executionId: string) => {
    try {
      const response = await api.post(`/journeys/runtime/executions/${executionId}/requeue-failed`);
      const currentJourneyId = get().currentJourney?.id;
      if (currentJourneyId) {
        await get().fetchJourney(currentJourneyId);
      }
      await get().fetchJourneys();
      await get().fetchRuntimeStatus();
      return response.data;
    } catch (error: unknown) {
      throw new Error(getErrorMessage(error, 'Erro ao reenfileirar execução'));
    }
  },

  processDueJobs: async () => {
    try {
      const response = await api.post('/journeys/runtime/process-due');
      const currentJourneyId = get().currentJourney?.id;
      if (currentJourneyId) {
        await get().fetchJourney(currentJourneyId);
      }
      await get().fetchJourneys();
      await get().fetchRuntimeStatus();
      return response.data;
    } catch (error: unknown) {
      throw new Error(getErrorMessage(error, 'Erro ao processar agendamentos'));
    }
  },
}));
