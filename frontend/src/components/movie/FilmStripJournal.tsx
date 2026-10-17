import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useHistoryStore } from '../../store/historyStore';
import { useMoodStore } from '../../store/moodStore';
import { useRecommendations } from '../../hooks/useRecommendations';
import { posterUrl } from '../../api/client';

export const FilmStripJournal: React.FC = () => {
  const { journal, removeEntry, clearHistory } = useHistoryStore();
  const { setMoodText } = useMoodStore();
  const { fetchRecommendations } = useRecommendations();
  const [isOpen, setIsOpen] = React.useState(false);

  if (journal.length === 0) return null;

  const handleReplay = (entry: typeof journal[0]) => {
    setMoodText(entry.moodText);
    fetchRecommendations({
      mood_text: entry.moodText || undefined,
      emotion_tags: entry.emojis.length > 0 ? entry.emojis : undefined,
    });
  };

  return (
    <div style={{ marginTop: '36px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            background: 'none',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--color-accent-primary)',
            fontFamily: 'var(--font-serif)',
            fontSize: '18px',
            fontWeight: 600,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <span>🎞️</span>
          <span>35mm Film Journal ({journal.length})</span>
          <span style={{
            fontSize: '12px',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}>▼</span>
        </button>

        {isOpen && journal.length > 0 && (
          <button
            onClick={clearHistory}
            className="btn-outline"
            style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '4px' }}
          >
            Clear Roll
          </button>
        )}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            style={{ overflow: 'hidden' }}
          >
            <div
              style={{
                display: 'flex',
                gap: '16px',
                overflowX: 'auto',
                padding: '16px 8px 24px',
                scrollbarWidth: 'thin',
              }}
            >
              {journal.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    flexShrink: 0,
                    width: '280px',
                    backgroundColor: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    boxShadow: 'var(--shadow-subtle)',
                    position: 'relative',
                  }}
                >
                  {/* Sprocket holes track top */}
                  <div
                    style={{
                      height: '14px',
                      backgroundColor: '#050505',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-around',
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    {[...Array(9)].map((_, i) => (
                      <div
                        key={i}
                        style={{
                          width: '6px',
                          height: '8px',
                          borderRadius: '1px',
                          backgroundColor: '#1a1917',
                          border: '1px solid rgba(255,255,255,0.08)',
                        }}
                      />
                    ))}
                  </div>

                  {/* Frame Body */}
                  <div style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        {new Date(entry.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <button
                        onClick={() => removeEntry(entry.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '12px' }}
                        title="Remove frame"
                      >
                        ✕
                      </button>
                    </div>

                    <p
                      style={{
                        fontFamily: 'var(--font-serif)',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: 'var(--color-text-primary)',
                        marginBottom: '8px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={entry.querySummary}
                    >
                      "{entry.querySummary}"
                    </p>

                    {/* Movie thumbnails film negative preview */}
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                      {entry.movies.slice(0, 4).map((m) => (
                        <div
                          key={m.id}
                          style={{
                            width: '44px',
                            height: '66px',
                            borderRadius: '3px',
                            overflow: 'hidden',
                            backgroundColor: '#1a1917',
                            border: '1px solid rgba(255,255,255,0.1)',
                            flexShrink: 0,
                          }}
                        >
                          {m.poster_path ? (
                            <img
                              src={posterUrl(m.poster_path, 'w92') || ''}
                              alt={m.title}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>🎬</div>
                          )}
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => handleReplay(entry)}
                      className="btn-cinema"
                      style={{ width: '100%', padding: '6px 12px', fontSize: '12px' }}
                    >
                      ▶ Re-experience Mood
                    </button>
                  </div>

                  {/* Sprocket holes track bottom */}
                  <div
                    style={{
                      height: '14px',
                      backgroundColor: '#050505',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-around',
                      borderTop: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    {[...Array(9)].map((_, i) => (
                      <div
                        key={i}
                        style={{
                          width: '6px',
                          height: '8px',
                          borderRadius: '1px',
                          backgroundColor: '#1a1917',
                          border: '1px solid rgba(255,255,255,0.08)',
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
