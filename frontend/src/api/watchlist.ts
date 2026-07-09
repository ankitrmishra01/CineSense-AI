import { apiClient } from './client';
import type { WatchlistResponse, WatchlistAddResponse } from '../types';

export const watchlistApi = {
  add: (movieId: number) =>
    apiClient.post<WatchlistAddResponse>('/watchlist', { movie_id: movieId }),

  getAll: () =>
    apiClient.get<WatchlistResponse>('/watchlist'),

  remove: (itemId: string) =>
    apiClient.delete(`/watchlist/${itemId}`),
};
