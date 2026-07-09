import React from 'react';
import { motion } from 'framer-motion';

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', style }) => (
  <div className={`skeleton ${className}`} style={style} />
);

export const MovieCardSkeleton: React.FC = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="glass"
    style={{ overflow: 'hidden', borderRadius: 'var(--border-radius)' }}
  >
    <Skeleton style={{ height: '320px', borderRadius: 0 }} />
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <Skeleton style={{ height: '20px', width: '70%' }} />
      <Skeleton style={{ height: '14px', width: '40%' }} />
      <Skeleton style={{ height: '12px', width: '90%' }} />
      <Skeleton style={{ height: '12px', width: '80%' }} />
      <div style={{ display: 'flex', gap: '8px' }}>
        <Skeleton style={{ height: '24px', width: '60px', borderRadius: '999px' }} />
        <Skeleton style={{ height: '24px', width: '60px', borderRadius: '999px' }} />
      </div>
    </div>
  </motion.div>
);

export const GridSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: '20px',
  }}>
    {Array.from({ length: count }).map((_, i) => (
      <MovieCardSkeleton key={i} />
    ))}
  </div>
);
