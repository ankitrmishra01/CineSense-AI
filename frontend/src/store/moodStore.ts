import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RecommendFilters, RecommendResponse } from '../types';

interface MoodState {
  moodText: string;
  selectedEmojis: string[];
  filters: RecommendFilters;
  lastResults: RecommendResponse | null;
  seed: number | null;
  currentPage: number;
  setMoodText: (text: string) => void;
  toggleEmoji: (emoji: string) => void;
  setFilters: (filters: RecommendFilters) => void;
  setResults: (results: RecommendResponse) => void;
  setSeed: (seed: number | null) => void;
  setCurrentPage: (page: number) => void;
  reset: () => void;
}

const defaultFilters: RecommendFilters = {};

export const useMoodStore = create<MoodState>()(
  persist(
    (set) => ({
      moodText: '',
      selectedEmojis: [],
      filters: defaultFilters,
      lastResults: null,
      seed: null,
      currentPage: 1,

      setMoodText: (text) => set({ moodText: text }),

      toggleEmoji: (emoji) =>
        set((state) => ({
          selectedEmojis: state.selectedEmojis.includes(emoji)
            ? state.selectedEmojis.filter((e) => e !== emoji)
            : [...state.selectedEmojis, emoji],
        })),

      setFilters: (filters) => set({ filters }),

      setResults: (results) => set({ lastResults: results }),

      setSeed: (seed) => set({ seed }),
      
      setCurrentPage: (page) => set({ currentPage: page }),

      reset: () =>
        set({ moodText: '', selectedEmojis: [], filters: defaultFilters, lastResults: null, seed: null, currentPage: 1 }),
    }),
    {
      name: 'cinesense-mood-storage', // unique name
    }
  )
);
