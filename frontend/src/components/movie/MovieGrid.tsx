import React from 'react';
import type { RecommendationItem } from '../../types';
import { MovieCard } from './MovieCard';

interface MovieGridProps {
  items: RecommendationItem[];
}

export const MovieGrid: React.FC<MovieGridProps> = ({ items }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: '20px',
  }}>
    {items.map((item, i) => (
      <MovieCard key={item.movie.id} item={item} index={i} />
    ))}
  </div>
);
