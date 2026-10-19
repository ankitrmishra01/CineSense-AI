import React, { useState } from 'react';
import { authApi } from '../../api/auth';
import { useAuth } from '../../hooks/useAuth';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const COMMON_WEAK_PASSWORDS = new Set([
  '12345678', 'password', 'password123', '123456789', '1234567890',
  'qwerty123', 'admin123', 'welcome1', 'iloveyou', 'secret123',
  'cinesense', 'letmein1', 'cinema123', 'changeme', 'abc12345'
]);

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose }) => {
  const { handleLogout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!currentPassword) {
      setError('Please enter your current password.');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword.length > 128) {
      setError('New password must not exceed 128 characters.');
      return;
    }

    if (COMMON_WEAK_PASSWORDS.has(newPassword.toLowerCase())) {
      setError('This password is too common and easily guessed. Please choose a stronger password.');
      return;
    }

    if (newPassword === currentPassword) {
      setError('New password cannot be the same as your current password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { data } = await authApi.changePassword(currentPassword, newPassword);
      setSuccess(data.message || 'Password changed successfully! Signing out...');
      setTimeout(() => {
        handleLogout();
        onClose();
      }, 2000);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to change password. Please verify current password.';
      setError(typeof msg === 'string' ? msg : 'An error occurred while changing your password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-password-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div
        className="cinema-card"
        style={{
          width: '100%',
          maxWidth: '440px',
          padding: '28px',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2
            id="change-password-title"
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              margin: 0,
            }}
          >
            Change Password
          </h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-muted)',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            ✕
          </button>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '20px', lineHeight: 1.5 }}>
          Enter your current password and choose a secure new password (at least 8 characters).
        </p>

        {error && (
          <div
            role="alert"
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              fontSize: '13px',
              marginBottom: '16px',
            }}
          >
            {error}
          </div>
        )}

        {success && (
          <div
            role="status"
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              color: '#22c55e',
              fontSize: '13px',
              marginBottom: '16px',
            }}
          >
            ✓ {success}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label
              htmlFor="current-password-input"
              style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}
            >
              Current Password
            </label>
            <input
              id="current-password-input"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg-secondary)',
                color: 'var(--color-text-primary)',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label
              htmlFor="new-password-input"
              style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}
            >
              New Password (min 8 characters)
            </label>
            <input
              id="new-password-input"
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg-secondary)',
                color: 'var(--color-text-primary)',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label
              htmlFor="confirm-password-input"
              style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}
            >
              Confirm New Password
            </label>
            <input
              id="confirm-password-input"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg-secondary)',
                color: 'var(--color-text-primary)',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn-outline"
              style={{ padding: '8px 16px', fontSize: '13px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-cinema"
              style={{ padding: '8px 20px', fontSize: '13px' }}
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
