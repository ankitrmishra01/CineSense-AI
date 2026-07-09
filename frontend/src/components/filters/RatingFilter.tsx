import React from 'react';
import { useMoodStore } from '../../store/moodStore';

export const RatingFilter: React.FC = () => {
  const { filters, setFilters } = useMoodStore();

  return (
    <div>
      <p style={{
        fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '10px',
        textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600,
      }}>
        Minimum Rating: <span style={{ color: 'var(--color-accent-secondary)' }}>
          {filters.min_rating ? `${filters.min_rating}/10` : 'Any'}
        </span>
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Any</span>
        <input
          id="rating-filter"
          type="range"
          min={0}
          max={9}
          step={0.5}
          value={filters.min_rating || 0}
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            setFilters({ ...filters, min_rating: val > 0 ? val : undefined });
          }}
          style={{ flex: 1, accentColor: 'var(--color-accent-primary)', cursor: 'pointer' }}
        />
        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>9</span>
      </div>
    </div>
  );
};

export const RuntimeFilter: React.FC = () => {
  const { filters, setFilters } = useMoodStore();
  const options = [
    { label: 'Any', value: undefined },
    { label: '< 90m', value: 90 },
    { label: '< 120m', value: 120 },
    { label: '< 150m', value: 150 },
    { label: '< 180m', value: 180 },
  ];

  return (
    <div>
      <p style={{
        fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '10px',
        textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600,
      }}>
        Max Runtime
      </p>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {options.map((opt) => {
          const selected = filters.max_runtime === opt.value;
          return (
            <button
              key={opt.label}
              id={`runtime-filter-${opt.label}`}
              onClick={() => setFilters({ ...filters, max_runtime: opt.value })}
              style={{
                padding: '5px 12px',
                borderRadius: '999px',
                border: `1px solid ${selected ? 'rgba(124,58,237,0.6)' : 'var(--color-border)'}`,
                background: selected ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.04)',
                color: selected ? 'var(--color-accent-secondary)' : 'var(--color-text-secondary)',
                fontSize: '12px',
                fontWeight: selected ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
