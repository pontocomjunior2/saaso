import { create } from 'zustand';
import api from '@/lib/api';
import type { TimelineResponse, UnifiedTimelineEvent } from '@/components/board/board-types';
import type { TimelineFilterValue } from '@/components/board/TimelineFilters';

interface TimelineState {
  items: UnifiedTimelineEvent[];
  nextCursor: string | null;
  filter: TimelineFilterValue;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  currentCardId: string | null;
  fetchInitial: (cardId: string) => Promise<void>;
  fetchMore: (cardId: string) => Promise<void>;
  setFilter: (filter: TimelineFilterValue) => void;
}

function getErrorMessage(): string {
  return 'Não foi possível carregar a linha do tempo. Tente novamente.';
}

export const useTimelineStore = create<TimelineState>((set, get) => ({
  items: [],
  nextCursor: null,
  filter: 'all',
  isLoading: false,
  isLoadingMore: false,
  error: null,
  currentCardId: null,

  fetchInitial: async (cardId) => {
    set({
      isLoading: true,
      error: null,
      currentCardId: cardId,
      items: [],
      nextCursor: null,
      filter: 'all',
    });

    try {
      const response = await api.get<TimelineResponse>(`/cards/${cardId}/timeline?limit=100`);
      set({
        items: response.data.items,
        nextCursor: response.data.nextCursor,
        isLoading: false,
      });
    } catch {
      set({
        error: getErrorMessage(),
        isLoading: false,
      });
    }
  },

  fetchMore: async (cardId) => {
    const { nextCursor, isLoadingMore } = get();

    if (!nextCursor || isLoadingMore) {
      return;
    }

    set({ isLoadingMore: true, error: null });

    try {
      const response = await api.get<TimelineResponse>(
        `/cards/${cardId}/timeline?limit=100&before=${encodeURIComponent(nextCursor)}`,
      );
      set((state) => {
        if (state.currentCardId !== cardId) {
          // Response arrived for a card the user has already navigated away from.
          return { isLoadingMore: false };
        }
        return {
          items: [...state.items, ...response.data.items],
          nextCursor: response.data.nextCursor,
          isLoadingMore: false,
        };
      });
    } catch {
      set({
        error: getErrorMessage(),
        isLoadingMore: false,
      });
    }
  },

  setFilter: (filter) => set({ filter }),
}));
