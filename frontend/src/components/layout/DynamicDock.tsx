import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useWatchlistStore } from '../../store/watchlistStore';
import { useRecommendations } from '../../hooks/useRecommendations';
import { useCommandPaletteStore } from '../../store/commandPaletteStore';

interface DockItem {
  id: string;
  label: string;
  shortcut?: string;
  path?: string;
  action?: () => void;
  badge?: number | null;
  icon: (active: boolean) => React.ReactNode;
}

export const DynamicDock: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const watchlistItems = useWatchlistStore((s) => s.items);
  const { surpriseMe } = useRecommendations();
  const openPalette = useCommandPaletteStore((s) => s.open);

  // Hide dock completely on auth page for focused login experience
  if (location.pathname === '/auth') {
    return null;
  }

  const handleSurprise = () => {
    surpriseMe();
    if (location.pathname !== '/') {
      navigate('/');
    }
  };

  const handleOpenPalette = () => {
    openPalette();
  };

  const items: DockItem[] = [
    {
      id: 'discover',
      label: 'Discover',
      shortcut: 'Alt+D',
      path: '/',
      icon: (active) => (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke={active ? 'var(--color-accent-primary)' : 'currentColor'}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill={active ? 'var(--color-accent-primary)' : 'none'} />
        </svg>
      ),
    },
    {
      id: 'search',
      label: 'Search',
      shortcut: 'Alt+S',
      path: '/search',
      icon: (active) => (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke={active ? 'var(--color-accent-primary)' : 'currentColor'}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      ),
    },
    {
      id: 'watchlist',
      label: 'Watchlist',
      shortcut: 'Alt+W',
      path: '/watchlist',
      badge: watchlistItems.length > 0 ? watchlistItems.length : null,
      icon: (active) => (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill={active ? 'var(--color-accent-primary)' : 'none'}
          stroke={active ? 'var(--color-accent-primary)' : 'currentColor'}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      id: 'quick-jump',
      label: 'Quick Jump',
      shortcut: 'Ctrl+K',
      action: handleOpenPalette,
      icon: () => (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      ),
    },
    {
      id: 'surprise',
      label: 'Surprise Me',
      shortcut: 'Dice',
      action: handleSurprise,
      icon: () => (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
          <circle cx="8" cy="8" r="1.5" fill="currentColor" />
          <circle cx="16" cy="16" r="1.5" fill="currentColor" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
          <circle cx="16" cy="8" r="1.5" fill="currentColor" />
          <circle cx="8" cy="16" r="1.5" fill="currentColor" />
        </svg>
      ),
    },
  ];

  return (
    <nav
      aria-label="Floating Dynamic Navigation"
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 90,
        pointerEvents: 'none',
      }}
    >
      <motion.div
        initial={{ y: 40, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        style={{
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 10px',
          borderRadius: '9999px',
          backgroundColor: 'var(--color-bg-card)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 16px 38px -6px rgba(0, 0, 0, 0.45), 0 4px 12px rgba(0, 0, 0, 0.25)',
        }}
      >
        {items.map((item) => {
          const isActive = item.path ? location.pathname === item.path : false;
          const isHovered = hoveredId === item.id;

          const handleClick = () => {
            if (item.action) {
              item.action();
            } else if (item.path) {
              navigate(item.path);
            }
          };

          return (
            <div
              key={item.id}
              style={{ position: 'relative' }}
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {/* Tooltip Badge on Hover */}
              <AnimatePresence>
                {isHovered && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.92 }}
                    animate={{ opacity: 1, y: -4, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.92 }}
                    transition={{ duration: 0.16 }}
                    style={{
                      position: 'absolute',
                      bottom: 'calc(100% + 10px)',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      whiteSpace: 'nowrap',
                      backgroundColor: 'var(--color-bg-popover)',
                      color: 'var(--color-text-primary)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-pill)',
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: 600,
                      boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      pointerEvents: 'none',
                      zIndex: 100,
                    }}
                  >
                    <span>{item.label}</span>
                    {item.shortcut && (
                      <span
                        style={{
                          fontSize: '9px',
                          color: 'var(--color-text-muted)',
                          padding: '1px 4px',
                          borderRadius: '3px',
                          backgroundColor: 'rgba(255,255,255,0.08)',
                          border: '1px solid var(--color-border)',
                        }}
                      >
                        {item.shortcut}
                      </span>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Dock Button */}
              <motion.button
                type="button"
                onClick={handleClick}
                onTap={handleClick}
                whileHover={{ scale: 1.15, y: -3 }}
                whileTap={{ scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                style={{
                  position: 'relative',
                  width: '44px',
                  height: '44px',
                  borderRadius: '9999px',
                  border: 'none',
                  outline: 'none',
                  cursor: 'pointer',
                  backgroundColor: 'transparent',
                  color: isActive ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'color 0.2s ease',
                  padding: 0,
                }}
              >
                {/* Dynamic Sliding Active Pill Background */}
                {isActive && (
                  <motion.div
                    layoutId="dynamicDockActivePill"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    style={{
                      position: 'absolute',
                      inset: '2px',
                      borderRadius: '9999px',
                      backgroundColor: 'var(--color-accent-subtle)',
                      border: '1px solid var(--color-accent-border)',
                      zIndex: 0,
                    }}
                  />
                )}

                {/* Icon Container */}
                <span
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {item.icon(isActive)}
                </span>

                {/* Live Badge (e.g. Watchlist Count) */}
                {typeof item.badge === 'number' && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    style={{
                      position: 'absolute',
                      top: '2px',
                      right: '2px',
                      backgroundColor: 'var(--color-accent-primary)',
                      color: 'var(--color-btn-primary-text)',
                      borderRadius: '9999px',
                      minWidth: '16px',
                      height: '16px',
                      padding: '0 4px',
                      fontSize: '10px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 2,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                    }}
                  >
                    {item.badge}
                  </motion.span>
                )}
              </motion.button>
            </div>
          );
        })}
      </motion.div>
    </nav>
  );
};
