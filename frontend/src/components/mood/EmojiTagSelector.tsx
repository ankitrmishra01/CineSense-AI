import React from 'react';
import { motion } from 'framer-motion';
import { EMOTION_TAGS } from '../../types';
import { useMoodStore } from '../../store/moodStore';

export const EmojiTagSelector: React.FC = () => {
  const { selectedEmojis, toggleEmoji } = useMoodStore();

  return (
    <div>
      <p style={{
        fontSize: '13px',
        color: 'var(--color-text-muted)',
        marginBottom: '12px',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        fontWeight: 600,
      }}>
        Quick mood tags
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {EMOTION_TAGS.map((tag) => {
          const selected = selectedEmojis.includes(tag.emoji);
          return (
            <motion.button
              key={tag.emoji}
              id={`emoji-tag-${tag.label.toLowerCase()}`}
              onClick={() => toggleEmoji(tag.emoji)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '999px',
                border: `1px solid ${selected ? 'rgba(124,58,237,0.6)' : 'var(--color-border)'}`,
                background: selected
                  ? 'rgba(124, 58, 237, 0.2)'
                  : 'rgba(255, 255, 255, 0.04)',
                color: selected ? 'var(--color-accent-secondary)' : 'var(--color-text-secondary)',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: selected ? 600 : 400,
                transition: 'all 0.15s ease',
                boxShadow: selected ? '0 0 12px rgba(124,58,237,0.25)' : 'none',
              }}
            >
              <span style={{ fontSize: '18px' }}>{tag.emoji}</span>
              {tag.label}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
