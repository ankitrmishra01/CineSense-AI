import { apiClient } from './client';
import type { AuthResponse, TokenRefreshResponse } from '../types';

export const authApi = {
  signup: (email: string, username: string, password: string) =>
    apiClient.post<AuthResponse>('/auth/signup', { email, username, password }),

  login: (email: string, password: string) =>
    apiClient.post<AuthResponse>('/auth/login', { email, password }),

  refresh: (refreshToken: string) =>
    apiClient.post<TokenRefreshResponse>('/auth/refresh', { refresh_token: refreshToken }),

  logout: (refreshToken: string) =>
    apiClient.post('/auth/logout', { refresh_token: refreshToken }),
};
