import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { recommendApi } from '../../api/recommend';

interface WhyThisMovieProps {
  explanation: string;
  isOpen: boolean;
  onToggle: () => void;
  movieId?: number;
  queryText?: string;
}

export const WhyThisMovie: React.FC<WhyThisMovieProps> = ({
  explanation,
  isOpen,
  onToggle,
  movieId,
  queryText,
}) => {
  const [richExplanation, setRichExplanation] = useState<string | null>(null);
  const [loadingRich, setLoadingRich] = useState(false);

  const handleToggle = async () => {
    onToggle();
    if (!isOpen && movieId && queryText && !richExplanation) {
      // Lazily request grounded LLM reasoning if needed
      setLoadingRich(true);
      try {
        const { data } = await recommendApi.explain(movieId, queryText);
        if (data.explanation) {
          setRichExplanation(data.explanation);
        }
      } catch {
        // Fall back gracefully to existing grounded explanation
      } finally {
        setLoadingRich(false);
      }
    }
  };

  const displayText = richExplanation || explanation || 'Matches themes and tone from your query.';

  return (
    <div>
      <button
        id="why-this-movie-toggle"
        onClick={handleToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'none',
          border: 'none',
          color: 'var(--color-accent-primary)',
          cursor: 'pointer',
          fontSize: '12px',
          fontFamily: 'var(--font-sans)',
          fontWeight: 600,
          padding: '4px 0',
          width: '100%',
          textAlign: 'left',
          transition: 'opacity 0.2s',
          letterSpacing: '0.02em',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            fontSize: '9px',
            transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        >
          ▶
        </span>
        <span>Why this fits</span>
        {loadingRich && (
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
            (loading...)
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div
              style={{
                padding: '10px 12px',
                marginTop: '6px',
                backgroundColor: 'var(--color-accent-subtle)',
                border: '1px solid var(--color-accent-border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '12px',
                lineHeight: 1.6,
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-serif)',
                fontStyle: 'italic',
              }}
            >
              <span style={{ color: 'var(--color-accent-primary)', marginRight: '6px', fontStyle: 'normal' }}>
                ✦
              </span>
              {displayText}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
