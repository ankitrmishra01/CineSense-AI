import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { Spinner } from '../components/ui/Spinner';

export const AuthPage: React.FC = () => {
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { handleLogin, handleSignup } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (tab === 'login') {
        await handleLogin(email, password);
      } else {
        await handleSignup(email, username, password);
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === 'string') {
        setError(detail);
      } else if (Array.isArray(detail) && detail.length > 0) {
        setError(detail[0].msg || JSON.stringify(detail[0]));
      } else if (detail) {
        setError(JSON.stringify(detail));
      } else {
        setError(err?.message || 'Something went wrong. Try again.');
      }
    } finally {
      setLoading(false);
    }
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
      }}
    >
      {/* Warm Ambient Projector Illumination */}
      <div
        style={{
          position: 'fixed',
          top: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '600px',
          height: '350px',
          background: 'radial-gradient(ellipse, rgba(212, 175, 55, 0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="cinema-card"
        style={{ width: '100%', maxWidth: '420px', padding: '36px' }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '36px', marginBottom: '10px' }}>🎟️</div>
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
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', marginTop: '4px' }}>
            Archival access for your personal cinema journey
          </p>
        </div>

        {/* Tab switcher */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'var(--color-bg-secondary)',
            borderRadius: 'var(--radius-pill)',
            padding: '4px',
            marginBottom: '24px',
            border: '1px solid var(--color-border)',
          }}
        >
          {(['login', 'signup'] as const).map((t) => (
            <button
              key={t}
              id={`auth-tab-${t}`}
              onClick={() => {
                setTab(t);
                setError('');
              }}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: 'var(--radius-pill)',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: tab === t ? 'var(--color-accent-primary)' : 'transparent',
                color: tab === t ? '#0c0b0a' : 'var(--color-text-secondary)',
                fontWeight: 600,
                fontSize: '13px',
                transition: 'all 0.2s',
              }}
            >
              {t === 'login' ? 'Sign In' : 'Join Archive'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '6px', display: 'block', fontWeight: 500 }}>
              Email Address
            </label>
            <input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              }}
            />
          </div>

          <AnimatePresence>
            {tab === 'signup' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                style={{ overflow: 'hidden' }}
              >
                <label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '6px', display: 'block', fontWeight: 500 }}>
                  Curator Username
                </label>
                <input
                  id="auth-username"
                  type="text"
                  required={tab === 'signup'}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
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
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '6px', display: 'block', fontWeight: 500 }}>
              Passcode
            </label>
            <input
              id="auth-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
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
              }}
            />
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#ef4444',
                fontSize: '13px',
              }}
            >
              {error}
            </motion.p>
          )}

          <button
            id="auth-submit"
            type="submit"
            disabled={loading}
            className="btn-cinema"
            style={{ marginTop: '8px', width: '100%', padding: '12px', fontSize: '14px' }}
          >
            {loading ? <Spinner size={16} color="#0c0b0a" /> : null}
            <span>
              {tab === 'login'
                ? loading
                  ? 'Verifying Credentials...'
                  : 'Enter Projection Booth'
                : loading
                ? 'Minting Pass...'
                : 'Create Curator Pass'}
            </span>
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
          {tab === 'login' ? "Don't have an archive pass? " : 'Already a registered curator? '}
          <button
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
              fontSize: '12px',
            }}
          >
            {tab === 'login' ? 'Join here' : 'Sign in'}
          </button>
        </p>
      </motion.div>
    </div>
  );
};
