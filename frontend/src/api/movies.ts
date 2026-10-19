import { apiClient } from './client';
import type { Movie, MovieSearchResult } from '../types';

export const moviesApi = {
  getById: (id: number, preferredLanguage?: string) =>
    apiClient.get<Movie>(`/movies/${id}`, {
      params: preferredLanguage ? { preferred_language: preferredLanguage } : undefined,
    }),

  search: (q: string, limit = 10, signal?: AbortSignal) =>
    apiClient.get<MovieSearchResult>('/movies/search', { params: { q, limit }, signal }),

  getLiveTrending: () =>
    apiClient.get<Movie[]>('/movies/live/trending'),

  getTrendingIndia: () =>
    apiClient.get<Movie[]>('/movies/live/trending-india'),

  getTrendingByLanguage: (lang: string) =>
    apiClient.get<Movie[]>('/movies/live/trending-by-language', { params: { language: lang } }),

  getTopRatedByLanguage: (lang: string) =>
    apiClient.get<Movie[]>('/movies/live/top-rated-by-language', { params: { language: lang } }),

  getLiveNowPlaying: () =>
    apiClient.get<Movie[]>('/movies/live/now-playing'),

  getSimilar: (id: number) =>
    apiClient.get<Movie[]>(`/movies/${id}/similar`),
};

