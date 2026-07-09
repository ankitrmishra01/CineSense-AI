import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PageWrapper } from '../components/layout/PageWrapper';
import { MovieGrid } from '../components/movie/MovieGrid';
import { GridSkeleton } from '../components/ui/Skeleton';
import { useMoodStore } from '../store/moodStore';
import { useRecommendations } from '../hooks/useRecommendations';

export const RecommendationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { lastResults } = useMoodStore();
  const { loading, fetchRecommendations } = useRecommendations();

  if (!lastResults && !loading) {
    return (
      <PageWrapper>
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>🎭</div>
          <h2 style={{ fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: '24px', marginBottom: '12px' }}>
            No recommendations yet
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: '28px' }}>
            Go back and tell us how you're feeling.
          </p>
          <button className="btn-primary" onClick={() => navigate('/')}>
            ← Back to Discover
          </button>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      {/* Header */}
      <div style={{ marginBottom: '36px' }}>
        <button
          id="back-to-home"
          onClick={() => navigate('/')}
          className="btn-ghost"
          style={{ marginBottom: '20px', fontSize: '13px' }}
        >
          ← Back
        </button>
        {lastResults && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h1 style={{
              fontFamily: 'var(--font-primary)', fontWeight: 800,
              fontSize: 'clamp(24px, 4vw, 36px)', marginBottom: '8px',
            }}>
              Movies for{' '}
              <span className="gradient-text">"{lastResults.query_summary}"</span>
            </h1>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '15px' }}>
              {lastResults.recommendations.length} movies matched your mood
            </p>
          </motion.div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <GridSkeleton count={8} />
      ) : lastResults ? (
        <>
          <MovieGrid items={lastResults.recommendations} />
          {/* Re-search button */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            style={{ textAlign: 'center', marginTop: '48px' }}
          >
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '16px', fontSize: '14px' }}>
              Not quite right?
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn-ghost" onClick={() => navigate('/')}>
                ✏️ Change mood
              </button>
              <button className="btn-primary" onClick={() => fetchRecommendations()}>
                🔄 Try again
              </button>
            </div>
          </motion.div>
        </>
      ) : null}
    </PageWrapper>
  );
};
