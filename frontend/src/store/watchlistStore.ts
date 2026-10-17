import { create } from 'zustand';
import { watchlistApi } from '../api/watchlist';
import type { WatchlistItem, Movie } from '../types';

interface WatchlistState {
  items: WatchlistItem[];
  loading: boolean;
  error: string | null;
  fetchWatchlist: () => Promise<void>;
  addToWatchlistOptimistic: (movie: Movie) => Promise<boolean>;
  removeFromWatchlistOptimistic: (itemId: string, movieId?: number) => Promise<boolean>;
  isInWatchlist: (movieId: number) => boolean;
  getWatchlistItemId: (movieId: number) => string | undefined;
  clearWatchlist: () => void;
}

export const useWatchlistStore = create<WatchlistState>()((set, get) => ({
  items: [],
  loading: false,
  error: null,

  fetchWatchlist: async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      set({ items: [] });
      return;
    }
    set({ loading: true, error: null });
    try {
      const { data } = await watchlistApi.getAll();
      set({ items: data.items, loading: false });
    } catch {
      set({ error: 'Failed to load watchlist.', loading: false });
    }
  },

  addToWatchlistOptimistic: async (movie: Movie) => {
    const previousItems = get().items;
    // Check if already in list
    if (previousItems.some((i) => i.movie.id === movie.id)) {
      return true;
    }

    const tempId = `temp-${Date.now()}`;
    const optimisticItem: WatchlistItem = {
      id: tempId,
      movie,
      added_at: new Date().toISOString(),
    };

    // Optimistically update
    set({ items: [optimisticItem, ...previousItems] });

    try {
      const { data } = await watchlistApi.add(movie.id);
      // Replace temporary id with real id
      set((state) => ({
        items: state.items.map((i) =>
          i.id === tempId ? { ...i, id: data.id, added_at: data.added_at } : i
        ),
      }));
      return true;
    } catch (err: unknown) {
      // Rollback on failure
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      if (axiosErr?.response?.data?.detail === 'Movie already in watchlist') {
        return true;
      }
      set({ items: previousItems, error: 'Failed to add movie to watchlist.' });
      return false;
    }
  },

  removeFromWatchlistOptimistic: async (itemId: string, movieId?: number) => {
    const previousItems = get().items;
    const targetItem = previousItems.find(
      (i) => i.id === itemId || (movieId && i.movie.id === movieId)
    );
    if (!targetItem) return true;

    const realItemId = targetItem.id;
    // Optimistically remove
    set({ items: previousItems.filter((i) => i.id !== realItemId) });

    try {
      // If it was a tempId not yet persisted, don't call server
      if (!realItemId.startsWith('temp-')) {
        await watchlistApi.remove(realItemId);
      }
      return true;
    } catch {
      // Rollback
      set({ items: previousItems, error: 'Failed to remove movie from watchlist.' });
      return false;
    }
  },

  isInWatchlist: (movieId: number) => {
    return get().items.some((i) => i.movie.id === movieId);
  },

  getWatchlistItemId: (movieId: number) => {
    return get().items.find((i) => i.movie.id === movieId)?.id;
  },

  clearWatchlist: () => {
    set({ items: [], loading: false, error: null });
  },
}));
