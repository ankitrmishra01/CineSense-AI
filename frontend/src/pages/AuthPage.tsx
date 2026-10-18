import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { Spinner } from '../components/ui/Spinner';

export const AuthPage: React.FC = () => {
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState(() => localStorage.getItem('cinesense_remembered_email') || '');
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem('cinesense_remembered_email'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isWakingUp, setIsWakingUp] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const tabLoginRef = useRef<HTMLButtonElement>(null);
  const tabSignupRef = useRef<HTMLButtonElement>(null);

  const { handleLogin, handleSignup } = useAuth();

  // Email format helper
  const isEmailValid = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

  // Keyboard navigation for tablist
  const handleTabKeyDown = (e: React.KeyboardEvent, currentTab: 'login' | 'signup') => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const nextTab = currentTab === 'login' ? 'signup' : 'login';
      setTab(nextTab);
      setError('');
      if (nextTab === 'login') {
        tabLoginRef.current?.focus();
      } else {
        tabSignupRef.current?.focus();
      }
    }
  };

  const executeAuth = async (isRetry = false) => {
    setError('');
    setLoading(true);

    if (!isEmailValid(email)) {
      setError('Please enter a valid email address.');
      setLoading(false);
      emailRef.current?.focus();
      return;
    }

    if (tab === 'signup') {
      if (!username.trim()) {
        setError('Please choose a curator username.');
        setLoading(false);
        usernameRef.current?.focus();
        return;
      }
      if (password.length < 8) {
        setError('Passcode must be at least 8 characters long.');
        setLoading(false);
        passwordRef.current?.focus();
        return;
      }
    }

    try {
      if (tab === 'login') {
        await handleLogin(email, password);
      } else {
        await handleSignup(email, username, password);
      }

      // Persist remember me preference
      if (rememberMe) {
        localStorage.setItem('cinesense_remembered_email', email);
      } else {
        localStorage.removeItem('cinesense_remembered_email');
      }
    } catch (err: any) {
      // Clear password on failed attempt; KEEP EMAIL FILLED IN
      setPassword('');

      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;

      if (status === 401) {
        setError('Incorrect email or passcode. Please check your credentials and try again.');
        passwordRef.current?.focus();
      } else if (status === 400 || status === 409) {
        setError('An account with this email already exists. Please sign in instead.');
        emailRef.current?.focus();
      } else if (status === 422) {
        if (typeof detail === 'string') {
          setError(detail);
        } else if (Array.isArray(detail) && detail.length > 0) {
          setError(detail[0].msg || 'Please check the required fields.');
        } else {
          setError('Validation error. Please verify your details.');
        }
        passwordRef.current?.focus();
      } else if (status === 429) {
        setError('Too many attempts. Please wait a moment before trying again.');
      } else if (!isRetry && (!status || status >= 500)) {
        // Cold start or server spin-up: show message and retry once automatically after 3s
        setIsWakingUp(true);
        setError('Waking up the projection booth, this may take a few seconds...');
        setTimeout(() => {
          setIsWakingUp(false);
          executeAuth(true);
        }, 3000);
        return;
      } else {
        setError(
          typeof detail === 'string'
            ? detail
            : err?.message || 'Unable to connect to projection service. Please try again.'
        );
      }
    } finally {
      if (!isWakingUp) {
        setLoading(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    await executeAuth(false);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Warm Ambient Projector Illumination (bounded to container) */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(600px, 90vw)',
          height: '350px',
          background: 'radial-gradient(ellipse, rgba(212, 175, 55, 0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="cinema-card"
        style={{
          width: '100%',
          maxWidth: '440px',
          padding: '36px 32px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Cinema Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              margin: '0 auto 12px',
              borderRadius: '12px',
              backgroundColor: 'var(--color-accent-subtle)',
              border: '1px solid var(--color-accent-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-accent-primary)',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
              <line x1="7" y1="2" x2="7" y2="22" />
              <line x1="17" y1="2" x2="17" y2="22" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <line x1="2" y1="7" x2="7" y2="7" />
              <line x1="2" y1="17" x2="7" y2="17" />
              <line x1="17" y1="17" x2="22" y2="17" />
              <line x1="17" y1="7" x2="22" y2="7" />
            </svg>
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-serif)',
              fontWeight: 700,
              fontSize: '26px',
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.01em',
            }}
          >
            CineSense <span style={{ color: 'var(--color-accent-primary)' }}>AI</span>
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', marginTop: '6px' }}>
            Archival access for your personal cinema journey
          </p>
        </div>

        {/* Tab Switcher with Accessible Roles & High Contrast */}
        <div
          role="tablist"
          aria-label="Authentication Options"
          style={{
            display: 'flex',
            backgroundColor: 'var(--color-bg-secondary)',
            borderRadius: 'var(--radius-pill)',
            padding: '4px',
            marginBottom: '24px',
            border: '1px solid var(--color-border)',
          }}
        >
          <button
            ref={tabLoginRef}
            id="auth-tab-login"
            role="tab"
            aria-selected={tab === 'login'}
            aria-controls="auth-panel-login"
            tabIndex={tab === 'login' ? 0 : -1}
            onClick={() => {
              setTab('login');
              setError('');
            }}
            onKeyDown={(e) => handleTabKeyDown(e, 'login')}
            style={{
              flex: 1,
              padding: '9px 12px',
              borderRadius: 'var(--radius-pill)',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: tab === 'login' ? 'var(--color-accent-primary)' : 'transparent',
              color: tab === 'login' ? 'var(--color-btn-primary-text)' : 'var(--color-text-secondary)',
              fontWeight: 700,
              fontSize: '13px',
              letterSpacing: '0.02em',
              transition: 'all 0.2s ease',
              outline: 'none',
            }}
          >
            Sign In
          </button>
          <button
            ref={tabSignupRef}
            id="auth-tab-signup"
            role="tab"
            aria-selected={tab === 'signup'}
            aria-controls="auth-panel-signup"
            tabIndex={tab === 'signup' ? 0 : -1}
            onClick={() => {
              setTab('signup');
              setError('');
            }}
            onKeyDown={(e) => handleTabKeyDown(e, 'signup')}
            style={{
              flex: 1,
              padding: '9px 12px',
              borderRadius: 'var(--radius-pill)',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: tab === 'signup' ? 'var(--color-accent-primary)' : 'transparent',
              color: tab === 'signup' ? 'var(--color-btn-primary-text)' : 'var(--color-text-secondary)',
              fontWeight: 700,
              fontSize: '13px',
              letterSpacing: '0.02em',
              transition: 'all 0.2s ease',
              outline: 'none',
            }}
          >
            Join Archive
          </button>
        </div>

        {/* Authentication Form */}
        <form
          onSubmit={handleSubmit}
          noValidate
          id={`auth-panel-${tab}`}
          role="tabpanel"
          style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}
        >
          {/* Email input */}
          <div>
            <label
              htmlFor="auth-email"
              style={{
                fontSize: '12px',
                color: 'var(--color-text-secondary)',
                marginBottom: '6px',
                display: 'block',
                fontWeight: 600,
                letterSpacing: '0.02em',
              }}
            >
              Email Address
            </label>
            <input
              ref={emailRef}
              id="auth-email"
              type="email"
              name="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError('');
              }}
              placeholder="cinephile@archive.com"
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg-secondary)',
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
            />
          </div>

          {/* Username input (Sign up only) */}
          <AnimatePresence>
            {tab === 'signup' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: 'hidden' }}
              >
                <label
                  htmlFor="auth-username"
                  style={{
                    fontSize: '12px',
                    color: 'var(--color-text-secondary)',
                    marginBottom: '6px',
                    display: 'block',
                    fontWeight: 600,
                    letterSpacing: '0.02em',
                  }}
                >
                  Curator Username
                </label>
                <input
                  ref={usernameRef}
                  id="auth-username"
                  type="text"
                  name="username"
                  required={tab === 'signup'}
                  autoComplete="username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="truffaut99"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-bg-secondary)',
                    color: 'var(--color-text-primary)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Passcode input with Show/Hide toggle */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label
                htmlFor="auth-password"
                style={{
                  fontSize: '12px',
                  color: 'var(--color-text-secondary)',
                  display: 'block',
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                }}
              >
                Passcode
              </label>
              {tab === 'signup' && (
                <span style={{ fontSize: '11px', color: password.length >= 8 ? 'var(--color-emerald)' : 'var(--color-text-muted)' }}>
                  {password.length >= 8 ? '✓ Minimum length met' : 'Min 8 characters'}
                </span>
              )}
            </div>
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                ref={passwordRef}
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                required
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                placeholder="••••••••"
                style={{
                  width: '100%',
                  padding: '12px 44px 12px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-bg-secondary)',
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide passcode' : 'Show passcode'}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Remember Me Checkbox */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              id="auth-remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{
                accentColor: 'var(--color-accent-primary)',
                width: '15px',
                height: '15px',
                cursor: 'pointer',
              }}
            />
            <label
              htmlFor="auth-remember-me"
              style={{
                fontSize: '12px',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              Remember my email on this device
            </label>
          </div>

          {/* Inline Error Message with Gentle Shake & Accessibility */}
          {error && (
            <motion.div
              role="alert"
              aria-live="polite"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: [0, -6, 6, -4, 4, 0] }}
              transition={{ duration: 0.35 }}
              style={{
                padding: '11px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </motion.div>
          )}

          {/* Submit Button */}
          <button
            id="auth-submit"
            type="submit"
            disabled={loading}
            className="btn-cinema"
            style={{
              marginTop: '4px',
              width: '100%',
              padding: '13px',
              fontSize: '14px',
              fontWeight: 700,
            }}
          >
            {loading ? <Spinner size={16} color="#0c0b0a" /> : null}
            <span>
              {tab === 'login'
                ? loading
                  ? isWakingUp
                    ? 'Connecting to Projection...'
                    : 'Verifying Credentials...'
                  : 'Enter Projection Booth'
                : loading
                ? 'Minting Pass...'
                : 'Create Curator Pass'}
            </span>
          </button>
        </form>

        {/* Footer switch */}
        <p style={{ textAlign: 'center', marginTop: '22px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
          {tab === 'login' ? "Don't have an archive pass? " : 'Already a registered curator? '}
          <button
            type="button"
            onClick={() => {
              setTab(tab === 'login' ? 'signup' : 'login');
              setError('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-accent-primary)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
              textDecoration: 'underline',
              padding: 0,
            }}
          >
            {tab === 'login' ? 'Join here' : 'Sign in'}
          </button>
        </p>
      </motion.div>
    </div>
  );
};
