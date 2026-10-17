import React from 'react';
import type { Genre } from '../../types';

interface GenreChipProps {
  genre: Genre;
  selected?: boolean;
  onClick?: () => void;
  small?: boolean;
}

const GENRE_COLORS: Record<number, string> = {
  28: '#e06c75',    // Action - muted vermilion
  12: '#d19a66',    // Adventure - ochre
  16: '#e5c07b',    // Animation - warm amber
  35: '#98c379',    // Comedy - olive green
  80: '#61afef',    // Crime - steel blue
  18: '#56b6c2',    // Drama - cyan gray
  27: '#c678dd',    // Horror - twilight
  10749: '#e06c75', // Romance - rose
  878: '#61afef',   // Sci-Fi - deep sky
  53: '#d19a66',    // Thriller - cognac
};

export const GenreChip: React.FC<GenreChipProps> = ({ genre, selected, onClick, small }) => {
  const baseColor = GENRE_COLORS[genre.id] || 'var(--color-accent-primary)';
  return (
    <button
      onClick={onClick}
      id={`genre-chip-${genre.id}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: small ? '2px 8px' : '4px 12px',
        borderRadius: 'var(--radius-pill)',
        border: `1px solid ${selected ? baseColor : 'var(--color-border)'}`,
        backgroundColor: selected ? 'var(--color-accent-subtle)' : 'var(--color-bg-secondary)',
        color: selected ? baseColor : 'var(--color-text-secondary)',
        fontSize: small ? '11px' : '12px',
        fontWeight: selected ? 600 : 400,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s ease',
        whiteSpace: 'nowrap',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {genre.name}
    </button>
  );
};
