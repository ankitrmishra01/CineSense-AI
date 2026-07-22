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
      } else if (Array.isArray(detail) && detail.length > 0 && detail[0].msg) {
        setError(detail[0].msg);
      } else {
        setError('Something went wrong. Try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)',
        width: '600px', height: '300px',
        background: 'radial-gradient(ellipse, rgba(124,58,237,0.2) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass"
        style={{ width: '100%', maxWidth: '420px', padding: '40px' }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎬</div>
          <h1 style={{
            fontFamily: 'var(--font-primary)', fontWeight: 800, fontSize: '24px',
            background: 'var(--gradient-primary)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            CineSense AI
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            Discover movies that match your mood
          </p>
        </div>

        {/* Tab switcher */}
        <div style={{
          display: 'flex', background: 'rgba(255,255,255,0.04)',
          borderRadius: '10px', padding: '4px', marginBottom: '28px',
        }}>
          {(['login', 'signup'] as const).map((t) => (
            <button
              key={t}
              id={`auth-tab-${t}`}
              onClick={() => { setTab(t); setError(''); }}
              style={{
                flex: 1, padding: '8px', borderRadius: '8px',
                border: 'none', cursor: 'pointer',
                background: tab === t ? 'var(--color-accent-primary)' : 'transparent',
                color: tab === t ? '#fff' : 'var(--color-text-secondary)',
                fontWeight: 600, fontSize: '14px', transition: 'all 0.2s',
              }}
            >
              {t === 'login' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '6px', display: 'block' }}>
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-base"
              placeholder="you@example.com"
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
                <label style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '6px', display: 'block' }}>
                  Username
                </label>
                <input
                  id="auth-username"
                  type="text"
                  required={tab === 'signup'}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input-base"
                  placeholder="cinefan99"
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <label style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '6px', display: 'block' }}>
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-base"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                padding: '10px 14px', borderRadius: '8px',
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                color: '#ef4444', fontSize: '13px',
              }}
            >
              {error}
            </motion.p>
          )}

          <button
            id="auth-submit"
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ marginTop: '8px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            {loading && <Spinner size={18} color="#fff" />}
            <span>{tab === 'login' ? (loading ? 'Signing In...' : 'Sign In') : (loading ? 'Creating Account...' : 'Create Account')}</span>
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
          Or{' '}
          <button
            onClick={() => { setTab(tab === 'login' ? 'signup' : 'login'); setError(''); }}
            style={{ background: 'none', border: 'none', color: 'var(--color-accent-secondary)', cursor: 'pointer', fontWeight: 600 }}
          >
            {tab === 'login' ? 'create an account' : 'sign in instead'}
          </button>
        </p>
      </motion.div>
    </div>
  );
};
