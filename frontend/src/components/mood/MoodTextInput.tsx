import React, { useRef, useEffect } from 'react';
import { useMoodStore } from '../../store/moodStore';

interface MoodTextInputProps {
  onSubmit?: () => void;
  placeholder?: string;
}

const SAMPLE_PROMPTS = [
  { label: 'Rainy Comfort', text: 'Melancholic rainy night comfort with bittersweet emotions' },
  { label: 'Mind-Bending Sci-Fi', text: 'Mind-bending sci-fi with philosophical concepts and mystery' },
  { label: 'Slow-Burn Noir', text: 'Atmospheric slow-burn detective thriller with unexpected turns' },
  { label: 'Lighthearted Joy', text: 'Warm, funny, uplifting comedy to lift my spirits' },
];

export const MoodTextInput: React.FC<MoodTextInputProps> = ({ onSubmit }) => {
  const { moodText, setMoodText, selectedEmojis } = useMoodStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea between 2 rows (~52px) and 6 rows (~150px)
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      const nextH = Math.min(Math.max(el.scrollHeight, 52), 150);
      el.style.height = `${nextH}px`;
    }
  }, [moodText]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit?.();
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <textarea
          ref={textareaRef}
          id="mood-text-input"
          value={moodText}
          onChange={(e) => setMoodText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. A slow-burn mystery in the rain, or like Blade Runner 2049..."
          rows={2}
          style={{
            width: '100%',
            minHeight: '52px',
            maxHeight: '150px',
            padding: '12px 42px 12px 14px',
            backgroundColor: 'var(--color-bg-input)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-sans)',
            fontSize: '14px',
            lineHeight: 1.5,
            outline: 'none',
            resize: 'none',
            transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
            boxSizing: 'border-box',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-accent-border)';
            e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-accent-subtle)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-border)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
        {moodText && (
          <button
            type="button"
            onClick={() => setMoodText('')}
            style={{
              position: 'absolute',
              right: '10px',
              top: '12px',
              background: 'none',
              border: 'none',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              fontSize: '14px',
              padding: '4px',
              lineHeight: 1,
              borderRadius: '50%',
            }}
            title="Clear prompt"
            aria-label="Clear text"
          >
            ✕
          </button>
        )}
      </div>

      {/* Combined query indicator */}
      {moodText.trim() && selectedEmojis.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
          <span style={{ color: 'var(--color-accent-primary)', fontSize: '11px' }}>●</span>
          <span>Using your text description + {selectedEmojis.length} selected {selectedEmojis.length === 1 ? 'mood' : 'moods'}</span>
        </div>
      )}

      {/* Suggestion Chips ("Try:") */}
      <div className="try-chips-scroll" style={{ marginTop: '10px' }}>
        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, flexShrink: 0 }}>
          Try:
        </span>
        {SAMPLE_PROMPTS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setMoodText(p.text)}
            className="try-chip"
            title={`Fill: "${p.text}"`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
};
