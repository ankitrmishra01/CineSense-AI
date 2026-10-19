import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { CommandPalette } from './CommandPalette';
import { LanguagePickerModal } from '../preferences/LanguagePickerModal';
import { ChangePasswordModal } from '../auth/ChangePasswordModal';
import { usePreferencesStore } from '../../store/preferencesStore';
import { useCommandPaletteStore } from '../../store/commandPaletteStore';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, handleLogout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const { preferredLanguages } = usePreferencesStore();
  const [theme, setTheme] = useState(
    () => localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    const handleThemeChange = () => {
      setTheme(document.documentElement.getAttribute('data-theme') || 'dark');
    };
    window.addEventListener('themechange', handleThemeChange);
    return () => window.removeEventListener('themechange', handleThemeChange);
  }, [theme]);

  const togglePalette = useCommandPaletteStore((s) => s.toggle);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        togglePalette();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [togglePalette]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    window.dispatchEvent(new Event('themechange'));
  };

  return (
    <>
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="app-navbar"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          backgroundColor: 'var(--color-header-bg)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--color-header-border)',
          boxSizing: 'border-box',
          width: '100%',
          maxWidth: '100vw',
        }}
      >
        <div
          style={{
            maxWidth: '1240px',
            margin: '0 auto',
            height: '68px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            flexWrap: 'nowrap',
          }}
        >
          {/* Logo with Aperture Pulse Icon & Balanced Wordmark */}
          <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                backgroundColor: 'var(--color-accent-subtle)',
                border: '1px solid var(--color-accent-border)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-accent-primary)',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 3C8.82 3 3 8.82 3 16s5.82 13 13 13c3.6 0 6.88-1.46 9.25-3.83-5.2 0-9.42-4.22-9.42-9.42 0-4.08 2.6-7.55 6.27-8.86C20.17 4.24 18.17 3 16 3z" fill="var(--color-accent-primary)" />
                <path d="M24 10l1.2 2.8L28 14l-2.8 1.2L24 18l-1.2-2.8L20 14l2.8-1.2L24 10z" fill="var(--color-accent-secondary)" />
              </svg>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                className="nav-wordmark"
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontWeight: 700,
                  fontSize: '22px',
                  letterSpacing: '-0.01em',
                  color: 'var(--color-text-primary)',
                }}
              >
                CineSense
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 700,
                  fontSize: '10px',
                  letterSpacing: '0.08em',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-pill)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-secondary)',
                  textTransform: 'uppercase',
                  lineHeight: 1,
                }}
              >
                AI
              </span>
            </div>
          </Link>

          {/* Top Navbar Center is kept minimal and clean, matching Cresta style */}

          {/* Auth Section, Language & Theme */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {/* Language Selector Button */}
            <button
              id="language-picker-btn"
              onClick={() => setPickerOpen(true)}
              aria-label="Change language preferences"
              className="btn-outline"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 8px',
                fontSize: '12px',
                borderRadius: 'var(--radius-pill)',
                fontWeight: 500,
              }}
              title="Change language preferences"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <span className="nav-lang-label font-indic" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {preferredLanguages.length > 0 ? preferredLanguages.slice(0, 3).join(' · ') : 'LANG'}
              </span>
            </button>

            {/* Theme Toggle Button with Crisp SVG Icons */}
            <button
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
              style={{
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-pill)',
                cursor: 'pointer',
                padding: '7px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-text-secondary)',
                transition: 'all 0.2s ease',
              }}
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            >
              {theme === 'light' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              )}
            </button>

            {isAuthenticated ? (
              <>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '4px', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <span className="nav-username-text" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.username}</span>
                </span>
                <button
                  id="nav-change-password-btn"
                  className="btn-outline"
                  onClick={() => setPasswordModalOpen(true)}
                  style={{ padding: '6px 10px', fontSize: '12px', flexShrink: 0, position: 'relative', zIndex: 2 }}
                  title="Change Password"
                >
                  Password
                </button>
                <button
                  className="btn-outline"
                  onClick={handleLogout}
                  style={{ padding: '6px 10px', fontSize: '12px', flexShrink: 0, position: 'relative', zIndex: 2 }}
                >
                  Sign out
                </button>
              </>
            ) : location.pathname !== '/auth' ? (
              <button
                id="nav-signin-btn"
                className="btn-outline nav-btn-signin"
                onClick={() => navigate('/auth')}
                style={{ padding: '6px 14px', fontSize: '13px', fontWeight: 500 }}
              >
                Sign in
              </button>
            ) : null}
          </div>
        </div>
      </motion.nav>

      {/* Command Palette Modal */}
      <CommandPalette />

      {/* Language Preferences Picker Modal */}
      <LanguagePickerModal isOpen={pickerOpen} onClose={() => setPickerOpen(false)} />

      {/* Change Password Modal */}
      <ChangePasswordModal isOpen={passwordModalOpen} onClose={() => setPasswordModalOpen(false)} />
    </>
  );
};
