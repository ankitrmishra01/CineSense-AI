import { create } from 'zustand';
import type { RecommendFilters, RecommendResponse } from '../types';

interface MoodState {
  moodText: string;
  selectedEmojis: string[];
  filters: RecommendFilters;
  lastResults: RecommendResponse | null;
  setMoodText: (text: string) => void;
  toggleEmoji: (emoji: string) => void;
  setFilters: (filters: RecommendFilters) => void;
  setResults: (results: RecommendResponse) => void;
  reset: () => void;
}

const defaultFilters: RecommendFilters = {};

export const useMoodStore = create<MoodState>((set) => ({
  moodText: '',
  selectedEmojis: [],
  filters: defaultFilters,
  lastResults: null,

  setMoodText: (text) => set({ moodText: text }),

  toggleEmoji: (emoji) =>
    set((state) => ({
      selectedEmojis: state.selectedEmojis.includes(emoji)
        ? state.selectedEmojis.filter((e) => e !== emoji)
        : [...state.selectedEmojis, emoji],
    })),

  setFilters: (filters) => set({ filters }),

  setResults: (results) => set({ lastResults: results }),

  reset: () =>
    set({ moodText: '', selectedEmojis: [], filters: defaultFilters, lastResults: null }),
}));
