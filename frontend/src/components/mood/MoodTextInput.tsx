import React, { useState, useEffect } from 'react';
import { useMoodStore } from '../../store/moodStore';

interface MoodTextInputProps {
  onSubmit?: () => void;
  placeholder?: string;
}

const CINEMA_PROMPTS = [
  "Rainy midnight comfort with bittersweet romance...",
  "Gritty cyberpunk detective in a sprawling neon metropolis...",
  "Slow-burn psychological mystery with a shocking twist...",
  "Heartfelt coming-of-age story that will make me laugh and cry...",
  "Intense claustrophobic thriller that doesn't let you breathe...",
];

export const MoodTextInput: React.FC<MoodTextInputProps> = ({ onSubmit }) => {
  const { moodText, setMoodText } = useMoodStore();
  const [promptIndex, setPromptIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPromptIndex((prev) => (prev + 1) % CINEMA_PROMPTS.length);
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit?.();
    }
  };

  const samplePrompts = [
    { label: '🌧️ Melancholy & Comfort', text: 'Melancholic rainy night comfort with deep poetic emotions' },
    { label: '🚀 Mind-Bending Sci-Fi', text: 'Mind-bending philosophical sci-fi with incredible concepts' },
    { label: '🕯️ Slow-Burn Mystery', text: 'Atmospheric slow-burn noir thriller with unexpected revelations' },
    { label: '😂 Unapologetic Joy', text: 'Lighthearted hilarious feel-good comedy to lift my spirits' },
  ];

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <textarea
          id="mood-text-input"
          value={moodText}
          onChange={(e) => setMoodText(e.target.value)}
          onKeyDown={handleKey}
          placeholder={`e.g. ${CINEMA_PROMPTS[promptIndex]}`}
          rows={3}
          style={{
            width: '100%',
            padding: '16px 48px 16px 18px',
            backgroundColor: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-sans)',
            fontSize: '15px',
            lineHeight: 1.6,
            outline: 'none',
            resize: 'none',
            transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
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
            onClick={() => setMoodText('')}
            style={{
              position: 'absolute',
              right: '14px',
              top: '14px',
              background: 'none',
              border: 'none',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '4px',
              lineHeight: 1,
            }}
            title="Clear prompt"
          >
            ✕
          </button>
        )}
      </div>

      {/* Quick inspiration chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', alignSelf: 'center', marginRight: '4px' }}>
          Try:
        </span>
        {samplePrompts.map((p) => (
          <button
            key={p.label}
            onClick={() => setMoodText(p.text)}
            style={{
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-pill)',
              color: 'var(--color-text-secondary)',
              fontSize: '11px',
              padding: '3px 10px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-accent-border)';
              e.currentTarget.style.color = 'var(--color-accent-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-border)';
              e.currentTarget.style.color = 'var(--color-text-secondary)';
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
};
