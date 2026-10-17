import React from 'react';
import type { RecommendationItem } from '../../types';
import { MovieCard } from './MovieCard';

interface MovieGridProps {
  items: RecommendationItem[];
  queryText?: string;
}

export const MovieGrid: React.FC<MovieGridProps> = ({ items, queryText }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
      gap: '24px',
    }}
  >
    {items.map((item, i) => (
      <MovieCard key={item.movie.id} item={item} index={i} queryText={queryText} />
    ))}
  </div>
);
