import { apiClient } from './client';
import type { RecommendRequest, RecommendResponse } from '../types';

export const recommendApi = {
  recommend: (payload: RecommendRequest) =>
    apiClient.post<RecommendResponse>('/recommend', payload),
};
