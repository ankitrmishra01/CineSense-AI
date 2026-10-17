import { apiClient } from './client';
import type { RecommendRequest, RecommendResponse } from '../types';

export const recommendApi = {
  recommend: (payload: RecommendRequest) =>
    apiClient.post<RecommendResponse>('/recommend', payload),

  explain: (movieId: number, queryText: string) =>
    apiClient.post<{ movie_id: number; explanation: string }>('/recommend/explain', {
      movie_id: movieId,
      query_text: queryText,
    }),
};

