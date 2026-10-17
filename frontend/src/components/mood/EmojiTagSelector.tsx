import React from 'react';
import { motion } from 'framer-motion';
import { EMOTION_TAGS } from '../../types';
import { useMoodStore } from '../../store/moodStore';

export const EmojiTagSelector: React.FC = () => {
  const { selectedEmojis, toggleEmoji } = useMoodStore();

  return (
    <div>
      <p
        style={{
          fontSize: '11px',
          color: 'var(--color-text-muted)',
          marginBottom: '12px',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          fontWeight: 600,
          fontFamily: 'var(--font-sans)',
        }}
      >
        Emotional Atmosphere
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {EMOTION_TAGS.map((tag) => {
          const selected = selectedEmojis.includes(tag.emoji);
          return (
            <motion.button
              key={tag.emoji}
              id={`emoji-tag-${tag.label.toLowerCase()}`}
              onClick={() => toggleEmoji(tag.emoji)}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: 'var(--radius-pill)',
                border: `1px solid ${selected ? 'var(--color-accent-border)' : 'var(--color-border)'}`,
                backgroundColor: selected
                  ? 'var(--color-accent-subtle)'
                  : 'var(--color-bg-card)',
                color: selected ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: selected ? 600 : 400,
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ fontSize: '16px' }}>{tag.emoji}</span>
              <span>{tag.label}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
