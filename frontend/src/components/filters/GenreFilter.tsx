import React from 'react';
import { motion } from 'framer-motion';
import { GENRES } from '../../types';
import { GenreChip } from '../movie/GenreChip';
import { useMoodStore } from '../../store/moodStore';

export const GenreFilter: React.FC = () => {
  const { filters, setFilters } = useMoodStore();
  const selectedIds = filters.genre_ids || [];

  const toggle = (id: number) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((g) => g !== id)
      : [...selectedIds, id];
    setFilters({ ...filters, genre_ids: next.length ? next : undefined });
  };

  return (
    <div>
      <p style={{
        fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '10px',
        textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600,
      }}>
        Genres
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {GENRES.map((g) => (
          <motion.div key={g.id} whileTap={{ scale: 0.95 }}>
            <GenreChip
              genre={g}
              selected={selectedIds.includes(g.id)}
              onClick={() => toggle(g.id)}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
};
