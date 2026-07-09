import React from 'react';
import { useMoodStore } from '../../store/moodStore';

interface MoodTextInputProps {
  onSubmit?: () => void;
  placeholder?: string;
}

export const MoodTextInput: React.FC<MoodTextInputProps> = ({
  onSubmit,
  placeholder = "I'm feeling lonely and want something comforting...",
}) => {
  const { moodText, setMoodText } = useMoodStore();

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit?.();
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <textarea
        id="mood-text-input"
        value={moodText}
        onChange={(e) => setMoodText(e.target.value)}
        onKeyDown={handleKey}
        placeholder={placeholder}
        rows={3}
        className="input-base"
        style={{
          resize: 'none',
          lineHeight: 1.6,
          fontSize: '16px',
          paddingRight: '48px',
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
            fontSize: '18px',
            padding: '2px',
            lineHeight: 1,
          }}
          title="Clear"
        >
          ✕
        </button>
      )}
    </div>
  );
};
