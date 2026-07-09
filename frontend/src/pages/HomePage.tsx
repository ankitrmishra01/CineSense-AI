import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageWrapper } from '../components/layout/PageWrapper';
import { EmojiTagSelector } from '../components/mood/EmojiTagSelector';
import { MoodTextInput } from '../components/mood/MoodTextInput';
import { GenreFilter } from '../components/filters/GenreFilter';
import { RatingFilter, RuntimeFilter } from '../components/filters/RatingFilter';
import { useRecommendations } from '../hooks/useRecommendations';
import { Spinner } from '../components/ui/Spinner';
import { LiveMovieCarousel } from '../components/movies/LiveMovieCarousel';

export const HomePage: React.FC = () => {
  const { loading, error, fetchRecommendations, surpriseMe } = useRecommendations();
  const [showFilters, setShowFilters] = useState(false);

  return (
    <PageWrapper>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: '56px' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h1 style={{
            fontFamily: 'var(--font-primary)',
            fontWeight: 900,
            fontSize: 'clamp(36px, 6vw, 64px)',
            lineHeight: 1.1,
            marginBottom: '16px',
          }}>
            <span className="gradient-text">How are you feeling</span>
            <br />
            <span style={{ color: 'var(--color-text-primary)' }}>right now?</span>
          </h1>
          <p style={{
            fontSize: '18px',
            color: 'var(--color-text-secondary)',
            maxWidth: '520px',
            margin: '0 auto',
            lineHeight: 1.6,
          }}>
            Tell us your mood and we'll find movies that resonate — powered by AI that actually listens.
          </p>
        </motion.div>
      </div>

      {/* Main input card */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass"
        style={{ padding: '32px', marginBottom: '20px' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          <div>
            <p style={{
              fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '10px',
              textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600,
            }}>
              Describe your mood
            </p>
            <MoodTextInput onSubmit={fetchRecommendations} />
          </div>

          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '24px' }}>
            <EmojiTagSelector />
          </div>
        </div>
      </motion.div>

      {/* Filter toggle */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
        <button
          id="toggle-filters"
          onClick={() => setShowFilters(!showFilters)}
          className="btn-ghost"
          style={{ marginBottom: '16px', fontSize: '13px' }}
        >
          <span style={{ transform: showFilters ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▶</span>
          {showFilters ? 'Hide' : 'Show'} Filters
        </button>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              style={{ overflow: 'hidden' }}
            >
              <div className="glass" style={{ padding: '28px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <GenreFilter />
                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '20px' }}>
                  <RatingFilter />
                </div>
                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '20px' }}>
                  <RuntimeFilter />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Error */}
      {error && (
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{
            padding: '12px 16px', borderRadius: '10px', marginBottom: '16px',
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#ef4444', fontSize: '14px',
          }}
        >
          {error}
        </motion.p>
      )}

      {/* Action buttons */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '48px' }}
      >
        <button
          id="find-movies-btn"
          className="btn-primary"
          onClick={() => fetchRecommendations()}
          disabled={loading}
          style={{ flex: 1, minWidth: '200px', padding: '14px 28px', fontSize: '16px' }}
        >
          {loading ? <><Spinner size={20} color="#fff" /> Finding your movies...</> : '🎬 Find My Movies'}
        </button>
        <button
          id="surprise-me-btn"
          className="btn-ghost"
          onClick={surpriseMe}
          disabled={loading}
          style={{ padding: '14px 24px', fontSize: '15px' }}
        >
          🎲 Surprise Me
        </button>
      </motion.div>

      {/* Live Data Carousels */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        style={{ textAlign: 'left' }}
      >
        <LiveMovieCarousel 
          title="Trending Today" 
          emoji="🔥"
          fetchFn={() => import('../api/movies').then(m => m.moviesApi.getLiveTrending())} 
        />
        <LiveMovieCarousel 
          title="In Theaters Now" 
          emoji="🍿"
          fetchFn={() => import('../api/movies').then(m => m.moviesApi.getLiveNowPlaying())} 
        />
      </motion.div>

      {/* Decorative background orbs */}
      <div style={{ position: 'fixed', top: '-10%', right: '-5%', width: '500px', height: '500px',
        background: 'radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: -1 }} />
      <div style={{ position: 'fixed', bottom: '-10%', left: '-5%', width: '400px', height: '400px',
        background: 'radial-gradient(circle, rgba(236,72,153,0.06) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: -1 }} />
    </PageWrapper>
  );
};
