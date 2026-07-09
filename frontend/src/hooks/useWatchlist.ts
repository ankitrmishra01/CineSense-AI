import { useState, useEffect, useCallback } from 'react';
import { watchlistApi } from '../api/watchlist';
import type { WatchlistItem } from '../types';
import { useAuthStore } from '../store/authStore';

export const useWatchlist = () => {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated } = useAuthStore();

  const fetchWatchlist = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const { data } = await watchlistApi.getAll();
      setItems(data.items);
    } catch {
      setError('Failed to load watchlist.');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const addToWatchlist = useCallback(async (movieId: number) => {
    try {
      await watchlistApi.add(movieId);
      await fetchWatchlist();
      return true;
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      if (axiosErr?.response?.data?.detail === 'Movie already in watchlist') return true;
      throw err;
    }
  }, [fetchWatchlist]);

  const removeFromWatchlist = useCallback(async (itemId: string) => {
    try {
      await watchlistApi.remove(itemId);
      setItems((prev) => prev.filter((i) => i.id !== itemId));
    } catch {
      setError('Failed to remove from watchlist.');
    }
  }, []);

  const isInWatchlist = useCallback(
    (movieId: number) => items.some((i) => i.movie.id === movieId),
    [items]
  );

  const getWatchlistItemId = useCallback(
    (movieId: number) => items.find((i) => i.movie.id === movieId)?.id,
    [items]
  );

  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  return { items, loading, error, fetchWatchlist, addToWatchlist, removeFromWatchlist, isInWatchlist, getWatchlistItemId };
};
