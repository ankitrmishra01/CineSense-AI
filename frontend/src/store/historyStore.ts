import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { JournalEntry } from '../types';

interface HistoryState {
  journal: JournalEntry[];
  addEntry: (entry: Omit<JournalEntry, 'id' | 'timestamp'>) => void;
  removeEntry: (id: string) => void;
  clearHistory: () => void;
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set) => ({
      journal: [],

      addEntry: (entry) =>
        set((state) => {
          const newEntry: JournalEntry = {
            id: `strip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            timestamp: new Date().toISOString(),
            ...entry,
          };
          // Keep the latest 25 searches
          return {
            journal: [newEntry, ...state.journal.filter((j) => j.querySummary !== entry.querySummary)].slice(0, 25),
          };
        }),

      removeEntry: (id) =>
        set((state) => ({
          journal: state.journal.filter((item) => item.id !== id),
        })),

      clearHistory: () => set({ journal: [] }),
    }),
    {
      name: 'cinesense-history-journal',
    }
  )
);
