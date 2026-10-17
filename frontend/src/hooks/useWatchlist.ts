import { useEffect, useCallback } from 'react';
import { useWatchlistStore } from '../store/watchlistStore';
import { useAuthStore } from '../store/authStore';
import type { Movie } from '../types';

export const useWatchlist = () => {
  const {
    items,
    loading,
    error,
    fetchWatchlist,
    addToWatchlistOptimistic,
    removeFromWatchlistOptimistic,
    isInWatchlist,
    getWatchlistItemId,
  } = useWatchlistStore();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      fetchWatchlist();
    }
  }, [isAuthenticated, fetchWatchlist]);

  const addToWatchlist = useCallback(
    async (movieOrId: number | Movie) => {
      if (typeof movieOrId === 'number') {
        const dummyMovie: Movie = {
          id: movieOrId,
          title: 'Movie',
          overview: null,
          tagline: null,
          genres: null,
          keywords: null,
          poster_path: null,
          backdrop_path: null,
          runtime: null,
          vote_average: null,
          vote_count: null,
          release_date: null,
          trailer_key: null,
          watch_providers: null,
        };
        return await addToWatchlistOptimistic(dummyMovie);
      }
      return await addToWatchlistOptimistic(movieOrId);
    },
    [addToWatchlistOptimistic]
  );

  const removeFromWatchlist = useCallback(
    async (itemId: string, movieId?: number) => {
      return await removeFromWatchlistOptimistic(itemId, movieId);
    },
    [removeFromWatchlistOptimistic]
  );

  return {
    items,
    loading,
    error,
    fetchWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    isInWatchlist,
    getWatchlistItemId,
  };
};

