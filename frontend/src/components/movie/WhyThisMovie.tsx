import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface WhyThisMovieProps {
  explanation: string;
  isOpen: boolean;
  onToggle: () => void;
}

export const WhyThisMovie: React.FC<WhyThisMovieProps> = ({ explanation, isOpen, onToggle }) => (
  <div>
    <button
      id="why-this-movie-toggle"
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        background: 'none',
        border: 'none',
        color: 'var(--color-accent-secondary)',
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: 600,
        padding: '6px 0',
        width: '100%',
        textAlign: 'left',
        transition: 'opacity 0.2s',
      }}
    >
      <span style={{
        display: 'inline-block',
        transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
        transition: 'transform 0.2s ease',
      }}>▶</span>
      Why this movie?
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
          <div style={{
            padding: '12px 14px',
            marginTop: '4px',
            background: 'rgba(124, 58, 237, 0.08)',
            border: '1px solid rgba(124, 58, 237, 0.2)',
            borderRadius: '10px',
            fontSize: '13px',
            lineHeight: 1.65,
            color: 'var(--color-text-secondary)',
            fontStyle: 'italic',
          }}>
            <span style={{ marginRight: '6px' }}>✨</span>
            {explanation || 'A great match for your current mood.'}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);
