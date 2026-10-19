import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthPage } from '../pages/AuthPage';

// Mock useAuth
const mockHandleLogin = vi.fn();
const mockHandleSignup = vi.fn();
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    handleLogin: mockHandleLogin,
    handleSignup: mockHandleSignup,
    handleLogout: vi.fn(),
  }),
}));

describe('AuthPage Component Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders Sign In tab by default with accessible tablist', () => {
    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>
    );

    const loginTab = screen.getByRole('tab', { name: /sign in/i });
    const signupTab = screen.getByRole('tab', { name: /join archive/i });

    expect(loginTab).toBeInTheDocument();
    expect(signupTab).toBeInTheDocument();
    expect(loginTab).toHaveAttribute('aria-selected', 'true');
    expect(signupTab).toHaveAttribute('aria-selected', 'false');
  });

  it('switches tabs with keyboard arrows (ArrowRight / ArrowLeft)', () => {
    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>
    );

    const loginTab = screen.getByRole('tab', { name: /sign in/i });
    fireEvent.keyDown(loginTab, { key: 'ArrowRight' });

    const signupTab = screen.getByRole('tab', { name: /join archive/i });
    expect(signupTab).toHaveAttribute('aria-selected', 'true');
    expect(loginTab).toHaveAttribute('aria-selected', 'false');
  });

  it('retains email and clears password on 401 error, displaying role="alert"', async () => {
    mockHandleLogin.mockRejectedValueOnce({
      response: {
        status: 401,
        data: { detail: 'Incorrect email or password' },
      },
    });

    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>
    );

    const emailInput = screen.getByLabelText(/email address/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(/^password$|^passcode$/i) as HTMLInputElement;
    const submitBtn = screen.getByRole('button', { name: /enter projection booth|sign in/i });

    // Enter credentials
    fireEvent.change(emailInput, { target: { value: 'testuser@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });

    expect(emailInput.value).toBe('testuser@example.com');
    expect(passwordInput.value).toBe('wrongpassword');

    // Submit form
    fireEvent.click(submitBtn);

    // Wait for error alert to appear
    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert.textContent).toMatch(/incorrect email or (passcode|password)/i);
    });

    // Verify email is RETAINED and password is CLEARED
    expect(emailInput.value).toBe('testuser@example.com');
    expect(passwordInput.value).toBe('');
  });

  it('toggles password visibility when eye button is clicked', () => {
    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>
    );

    const passwordInput = screen.getByLabelText(/^password$|^passcode$/i) as HTMLInputElement;
    expect(passwordInput.type).toBe('password');

    const toggleBtn = screen.getByLabelText(/show (passcode|password)/i);
    fireEvent.click(toggleBtn);
    expect(passwordInput.type).toBe('text');

    const hideBtn = screen.getByLabelText(/hide (passcode|password)/i);
    fireEvent.click(hideBtn);
    expect(passwordInput.type).toBe('password');
  });

  it('stores email in localStorage when "Remember email" is checked and login succeeds', async () => {
    mockHandleLogin.mockResolvedValueOnce({ user: { id: 1, email: 'remember@example.com' } });

    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>
    );

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/^password$|^passcode$/i);
    const rememberCheckbox = screen.getByLabelText(/remember my email on this device/i);
    const submitBtn = screen.getByRole('button', { name: /enter projection booth|sign in/i });

    fireEvent.change(emailInput, { target: { value: 'remember@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'correctpassword' } });
    fireEvent.click(rememberCheckbox);

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(localStorage.getItem('cinesense_remembered_email')).toBe('remember@example.com');
    });
  });
});
