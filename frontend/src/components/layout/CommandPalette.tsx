import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GENRES } from '../../types';
import { useMoodStore } from '../../store/moodStore';
import { useRecommendations } from '../../hooks/useRecommendations';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { setMoodText, setFilters } = useMoodStore();
  const { fetchRecommendations } = useRecommendations();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Quick command definitions
  const commands = [
    { id: 'home', label: 'Go to Discover', icon: '🎭', action: () => { navigate('/'); onClose(); } },
    { id: 'search', label: 'Go to Search', icon: '🔍', action: () => { navigate('/search'); onClose(); } },
    { id: 'watchlist', label: 'Go to Watchlist', icon: '📌', action: () => { navigate('/watchlist'); onClose(); } },
    ...GENRES.map((g) => ({
      id: `genre_${g.id}`,
      label: `Filter by Genre: ${g.name}`,
      icon: '🎬',
      action: () => {
        setFilters({ genre_ids: [g.id] });
        navigate('/');
        onClose();
      },
    })),
    {
      id: 'mood_cyberpunk',
      label: 'Mood: Neon Noir & Cyberpunk Thriller',
      icon: '🌆',
      action: () => {
        setMoodText('Neon noir aesthetic and gritty cyberpunk mysteries');
        fetchRecommendations({ mood_text: 'Neon noir aesthetic and gritty cyberpunk mysteries' });
        onClose();
      },
    },
    {
      id: 'mood_cozy',
      label: 'Mood: Warm Cozy Comfort Movie',
      icon: '☕',
      action: () => {
        setMoodText('Warm heartwarming cozy comfort movie for a rainy evening');
        fetchRecommendations({ mood_text: 'Warm heartwarming cozy comfort movie for a rainy evening' });
        onClose();
      },
    },
    {
      id: 'mood_mindbend',
      label: 'Mood: Mind-Bending Psychological Puzzle',
      icon: '🌀',
      action: () => {
        setMoodText('Complex mind-bending psychological plot twists that keep you guessing');
        fetchRecommendations({ mood_text: 'Complex mind-bending psychological plot twists that keep you guessing' });
        onClose();
      },
    },
  ];

  const filtered = query.trim()
    ? commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))
    : commands.slice(0, 8);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
      } else if (query.trim()) {
        setMoodText(query);
        fetchRecommendations({ mood_text: query });
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '15vh',
            paddingLeft: '16px',
            paddingRight: '16px',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '560px',
              backgroundColor: 'var(--color-bg-card)',
              border: '1px solid var(--color-border-hover)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-modal)',
              overflow: 'hidden',
            }}
          >
            {/* Input bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '16px 20px',
                borderBottom: '1px solid var(--color-border)',
                gap: '12px',
              }}
            >
              <span style={{ fontSize: '18px', color: 'var(--color-accent-primary)' }}>⌘</span>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Search movies, mood, or jump to page..."
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '16px',
                  outline: 'none',
                }}
              />
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--color-text-muted)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '4px',
                  padding: '2px 6px',
                }}
              >
                ESC
              </span>
            </div>

            {/* List */}
            <div style={{ maxHeight: '320px', overflowY: 'auto', padding: '8px' }}>
              {filtered.length > 0 ? (
                filtered.map((item, idx) => (
                  <div
                    key={item.id}
                    onClick={item.action}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      backgroundColor:
                        selectedIndex === idx ? 'var(--color-bg-card-hover)' : 'transparent',
                      color:
                        selectedIndex === idx
                          ? 'var(--color-accent-primary)'
                          : 'var(--color-text-primary)',
                      transition: 'background-color 0.1s ease',
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>{item.icon}</span>
                    <span style={{ fontSize: '14px', fontWeight: 500, flex: 1 }}>{item.label}</span>
                    {selectedIndex === idx && (
                      <span style={{ fontSize: '12px', opacity: 0.7 }}>↵ Jump</span>
                    )}
                  </div>
                ))
              ) : (
                <div
                  onClick={() => {
                    setMoodText(query);
                    fetchRecommendations({ mood_text: query });
                    onClose();
                  }}
                  style={{
                    padding: '16px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    color: 'var(--color-accent-primary)',
                    fontSize: '14px',
                  }}
                >
                  Press Enter to discover movies for <strong>"{query}"</strong> →
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 16px',
                borderTop: '1px solid var(--color-border)',
                fontSize: '11px',
                color: 'var(--color-text-muted)',
                backgroundColor: 'var(--color-bg-secondary)',
              }}
            >
              <span>↑↓ Navigate</span>
              <span>↵ Select</span>
              <span>ESC Close</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
