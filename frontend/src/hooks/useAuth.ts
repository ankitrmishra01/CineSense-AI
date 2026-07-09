import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../api/auth';

export const useAuth = () => {
  const { user, isAuthenticated, login, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogin = useCallback(async (email: string, password: string) => {
    const { data } = await authApi.login(email, password);
    login(data.user, data.access_token, data.refresh_token);
    navigate('/');
    return data;
  }, [login, navigate]);

  const handleSignup = useCallback(async (email: string, username: string, password: string) => {
    const { data } = await authApi.signup(email, username, password);
    login(data.user, data.access_token, data.refresh_token);
    navigate('/');
    return data;
  }, [login, navigate]);

  const handleLogout = useCallback(async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      try {
        await authApi.logout(refreshToken);
      } catch { /* ignore */ }
    }
    logout();
    navigate('/auth');
  }, [logout, navigate]);

  return { user, isAuthenticated, handleLogin, handleSignup, handleLogout };
};
