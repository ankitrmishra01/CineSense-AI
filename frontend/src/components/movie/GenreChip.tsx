import React from 'react';
import type { Genre } from '../../types';

interface GenreChipProps {
  genre: Genre;
  selected?: boolean;
  onClick?: () => void;
  small?: boolean;
}

const GENRE_COLORS: Record<number, string> = {
  28: '#ef4444',   // Action - red
  12: '#f97316',   // Adventure - orange
  16: '#eab308',   // Animation - yellow
  35: '#22c55e',   // Comedy - green
  80: '#6366f1',   // Crime - indigo
  18: '#3b82f6',   // Drama - blue
  27: '#7c3aed',   // Horror - purple
  10749: '#ec4899', // Romance - pink
  878: '#06b6d4',  // Sci-Fi - cyan
  53: '#f59e0b',   // Thriller - amber
};

export const GenreChip: React.FC<GenreChipProps> = ({ genre, selected, onClick, small }) => {
  const baseColor = GENRE_COLORS[genre.id] || '#a855f7';
  return (
    <button
      onClick={onClick}
      id={`genre-chip-${genre.id}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: small ? '3px 10px' : '5px 12px',
        borderRadius: '999px',
        border: `1px solid ${selected ? baseColor : 'var(--color-border)'}`,
        background: selected ? `${baseColor}22` : 'rgba(255,255,255,0.04)',
        color: selected ? baseColor : 'var(--color-text-secondary)',
        fontSize: small ? '11px' : '12px',
        fontWeight: selected ? 600 : 400,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s ease',
        whiteSpace: 'nowrap',
      }}
    >
      {genre.name}
    </button>
  );
};
