import { apiClient } from './client';
import type { Movie, MovieSearchResult } from '../types';

export const moviesApi = {
  getById: (id: number) =>
    apiClient.get<Movie>(`/movies/${id}`),

  search: (q: string, limit = 10) =>
    apiClient.get<MovieSearchResult>('/movies/search', { params: { q, limit } }),

  getLiveTrending: () =>
    apiClient.get<Movie[]>('/movies/live/trending'),

  getLiveNowPlaying: () =>
    apiClient.get<Movie[]>('/movies/live/now-playing'),
};
