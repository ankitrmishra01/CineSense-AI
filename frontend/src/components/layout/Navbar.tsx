import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, handleLogout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [theme, setTheme] = React.useState(
    () => localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  );

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    const handleThemeChange = () => {
      setTheme(document.documentElement.getAttribute('data-theme') || 'dark');
    };
    window.addEventListener('themechange', handleThemeChange);
    return () => window.removeEventListener('themechange', handleThemeChange);
  }, [theme]);

  const isActive = (path: string) => location.pathname === path;

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'var(--color-bg-card)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--color-border)',
        padding: '0 24px',
      }}
    >
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* Logo */}
        <Link to="/" style={{ textDecoration: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              background: 'var(--gradient-primary)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
            }}>🎬</div>
            <span style={{
              fontFamily: 'var(--font-primary)',
              fontWeight: 800,
              fontSize: '18px',
              background: 'var(--gradient-primary)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>CineSense AI</span>
          </div>
        </Link>

        {/* Nav links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {[
            { to: '/', label: '🎭 Discover' },
            { to: '/search', label: '🔍 Search' },
            ...(isAuthenticated ? [{ to: '/watchlist', label: '📌 Watchlist' }] : []),
          ].map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              style={{
                textDecoration: 'none',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 500,
                color: isActive(to) ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                background: isActive(to) ? 'rgba(124, 58, 237, 0.15)' : 'transparent',
                transition: 'all 0.2s',
              }}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Auth section & Theme Toggle */}
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
              fontSize: '20px',
              padding: '4px',
              opacity: 0.8,
              transition: 'opacity 0.2s',
            }}
            title="Toggle Dark/Light Mode"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>

          {isAuthenticated ? (
            <>
              <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                👤 {user?.username}
              </span>
              <button className="btn-ghost" onClick={handleLogout} style={{ padding: '7px 14px', fontSize: '13px' }}>
                Sign out
              </button>
            </>
          ) : (
            <button className="btn-primary" onClick={() => navigate('/auth')} style={{ padding: '8px 20px', fontSize: '14px' }}>
              Sign in
            </button>
          )}
        </div>
      </div>
    </motion.nav>
  );
};
