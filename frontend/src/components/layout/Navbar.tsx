import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { CommandPalette } from './CommandPalette';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, handleLogout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);
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

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          backgroundColor: 'rgba(12, 11, 10, 0.88)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--color-border)',
          padding: '0 20px',
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
            gap: '16px',
          }}
        >
          {/* Logo */}
          <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                backgroundColor: 'var(--color-accent-subtle)',
                border: '1px solid var(--color-accent-border)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
              }}
            >
              🎬
            </div>
            <div>
              <span
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontWeight: 700,
                  fontSize: '20px',
                  letterSpacing: '0.01em',
                  color: 'var(--color-text-primary)',
                }}
              >
                CineSense
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 600,
                  fontSize: '11px',
                  letterSpacing: '0.12em',
                  color: 'var(--color-accent-primary)',
                  marginLeft: '4px',
                  textTransform: 'uppercase',
                }}
              >
                AI
              </span>
            </div>
          </Link>

          {/* Center: Nav links & Command Search Trigger */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {[
              { to: '/', label: '🎭 Discover' },
              { to: '/search', label: '🔍 Search' },
              ...(isAuthenticated ? [{ to: '/watchlist', label: '🎟️ Watchlist' }] : []),
            ].map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                style={{
                  textDecoration: 'none',
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: isActive(to) ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                  backgroundColor: isActive(to) ? 'var(--color-bg-card-hover)' : 'transparent',
                  border: isActive(to) ? '1px solid var(--color-border-hover)' : '1px solid transparent',
                  transition: 'all 0.2s',
                }}
              >
                {label}
              </Link>
            ))}

            {/* Quick Command Palette Button */}
            <button
              onClick={() => setPaletteOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                backgroundColor: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-pill)',
                color: 'var(--color-text-muted)',
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              title="Quick Search (Ctrl+K)"
            >
              <span>Quick jump...</span>
              <kbd
                style={{
                  fontSize: '10px',
                  backgroundColor: 'var(--color-bg-card)',
                  padding: '1px 5px',
                  borderRadius: '3px',
                  border: '1px solid var(--color-border)',
                }}
              >
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Auth Section & Theme */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => {
                const newTheme = theme === 'light' ? 'dark' : 'light';
                document.documentElement.setAttribute('data-theme', newTheme);
                localStorage.setItem('theme', newTheme);
                window.dispatchEvent(new Event('themechange'));
              }}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '18px',
                padding: '6px',
                opacity: 0.8,
                transition: 'opacity 0.2s',
              }}
              title="Toggle Dark/Light Mode"
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>

            {isAuthenticated ? (
              <>
                <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                  👤 {user?.username}
                </span>
                <button
                  className="btn-outline"
                  onClick={handleLogout}
                  style={{ padding: '6px 14px', fontSize: '12px' }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <button
                className="btn-cinema"
                onClick={() => navigate('/auth')}
                style={{ padding: '7px 18px', fontSize: '13px' }}
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </motion.nav>

      {/* Command Palette Modal */}
      <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
};
