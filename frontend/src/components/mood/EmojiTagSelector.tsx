import React from 'react';
import { motion } from 'framer-motion';
import { EMOTION_TAGS } from '../../types';
import { useMoodStore } from '../../store/moodStore';

export const EmojiTagSelector: React.FC = () => {
  const { selectedEmojis, toggleEmoji } = useMoodStore();

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <p
          style={{
            fontSize: '11px',
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontWeight: 600,
            fontFamily: 'var(--font-sans)',
          }}
        >
          Cinematic Atmosphere & Mood
        </p>
        {selectedEmojis.length > 0 && (
          <span style={{ fontSize: '11px', color: 'var(--color-accent-primary)', fontWeight: 600 }}>
            {selectedEmojis.length} selected
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {EMOTION_TAGS.map((tag) => {
          const selected = selectedEmojis.includes(tag.emoji);
          return (
            <motion.button
              key={tag.emoji}
              id={`mood-tag-${tag.label.toLowerCase()}`}
              onClick={() => toggleEmoji(tag.emoji)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`mood-chip ${selected ? 'active' : ''}`}
            >
              <span>{tag.label}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
