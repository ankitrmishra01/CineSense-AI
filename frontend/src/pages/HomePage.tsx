import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageWrapper } from '../components/layout/PageWrapper';
import { EmojiTagSelector } from '../components/mood/EmojiTagSelector';
import { MoodTextInput } from '../components/mood/MoodTextInput';
import { GenreFilter } from '../components/filters/GenreFilter';
import { RatingFilter, RuntimeFilter } from '../components/filters/RatingFilter';
import { useRecommendations } from '../hooks/useRecommendations';
import { Spinner } from '../components/ui/Spinner';
import { LiveMovieCarousel } from '../components/movies/LiveMovieCarousel';
import { FilmStripJournal } from '../components/movie/FilmStripJournal';
import { moviesApi } from '../api/movies';

export const HomePage: React.FC = () => {
  const { loading, error, fetchRecommendations, surpriseMe } = useRecommendations();
  const [showFilters, setShowFilters] = useState(false);
  const [slowLoading, setSlowLoading] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (loading) {
      timer = setTimeout(() => {
        setSlowLoading(true);
      }, 2500);
    } else {
      setSlowLoading(false);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  return (
    <PageWrapper>
      {/* Vintage Cinema Marquee Ribbon */}
      <div className="marquee-ribbon" style={{ marginBottom: '40px', borderRadius: 'var(--radius-sm)' }}>
        <div className="marquee-content">
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: '13px', color: 'var(--color-accent-primary)', letterSpacing: '0.08em' }}>
            ✦ NOW SCREENING: EMOTION-AWARE CINEMA DISCOVERY ✦ 35MM ARCHIVAL VIBES ✦ HYBRID VECTOR RE-RANKING ✦ GENUINE GROUNDED RECOMMENDATIONS ✦
          </span>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: '13px', color: 'var(--color-accent-primary)', letterSpacing: '0.08em' }}>
            ✦ NOW SCREENING: EMOTION-AWARE CINEMA DISCOVERY ✦ 35MM ARCHIVAL VIBES ✦ HYBRID VECTOR RE-RANKING ✦ GENUINE GROUNDED RECOMMENDATIONS ✦
          </span>
        </div>
      </div>

      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--color-accent-subtle)',
              border: '1px solid var(--color-accent-border)',
              borderRadius: 'var(--radius-pill)',
              padding: '4px 14px',
              marginBottom: '16px',
              fontSize: '12px',
              color: 'var(--color-accent-primary)',
              fontFamily: 'var(--font-serif)',
              letterSpacing: '0.04em',
            }}
          >
            <span>📽️</span>
            <span>The Cinema of Your Mind</span>
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-serif)',
              fontWeight: 700,
              fontSize: 'clamp(38px, 6vw, 68px)',
              lineHeight: 1.08,
              marginBottom: '16px',
              letterSpacing: '-0.02em',
              color: 'var(--color-text-primary)',
            }}
          >
            How are you feeling{' '}
            <span style={{ fontStyle: 'italic', color: 'var(--color-accent-primary)' }}>
              tonight?
            </span>
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '17px',
              color: 'var(--color-text-secondary)',
              maxWidth: '560px',
              margin: '0 auto',
              lineHeight: 1.6,
            }}
          >
            Describe the mood, atmosphere, or feeling you're craving. We curate films that match your inner world.
          </p>
        </motion.div>
      </div>

      {/* Main input card */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="cinema-card"
        style={{ padding: '32px', marginBottom: '20px' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
          <div>
            <p
              style={{
                fontSize: '11px',
                color: 'var(--color-text-muted)',
                marginBottom: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                fontWeight: 600,
                fontFamily: 'var(--font-sans)',
              }}
            >
              Describe Your Mood or Story
            </p>
            <MoodTextInput onSubmit={fetchRecommendations} />
          </div>

          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '22px' }}>
            <EmojiTagSelector />
          </div>
        </div>
      </motion.div>

      {/* Filter toggle */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
        <button
          id="toggle-filters"
          onClick={() => setShowFilters(!showFilters)}
          className="btn-outline"
          style={{ marginBottom: '16px', fontSize: '12px', padding: '6px 14px' }}
        >
          <span style={{ transform: showFilters ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▶</span>
          {showFilters ? 'Hide' : 'Refine with'} Filters
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
              <div className="cinema-card" style={{ padding: '24px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <GenreFilter />
                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '18px' }}>
                  <RatingFilter />
                </div>
                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '18px' }}>
                  <RuntimeFilter />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Cold Start Indicator */}
      {slowLoading && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            padding: '12px 18px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '16px',
            backgroundColor: 'var(--color-accent-subtle)',
            border: '1px solid var(--color-accent-border)',
            color: 'var(--color-accent-primary)',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <span style={{ fontSize: '18px' }}>🎞️</span>
          <span>Waking up the projection booth (Render cold start)... Calibrating film reels.</span>
        </motion.div>
      )}

      {/* Error */}
      {error && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '16px',
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            color: '#ef4444',
            fontSize: '14px',
          }}
        >
          {error}
        </motion.p>
      )}

      {/* Action buttons */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}
      >
        <button
          id="find-movies-btn"
          className="btn-cinema"
          onClick={() => fetchRecommendations()}
          disabled={loading}
          style={{ flex: 1, minWidth: '220px', padding: '14px 28px', fontSize: '15px' }}
        >
          {loading ? (
            <>
              <Spinner size={18} color="#0c0b0a" />
              <span>Projecting Recommendations...</span>
            </>
          ) : (
            '🎬 Find My Movies'
          )}
        </button>
        <button
          id="surprise-me-btn"
          className="btn-outline"
          onClick={surpriseMe}
          disabled={loading}
          style={{ padding: '14px 24px', fontSize: '14px' }}
        >
          🎲 Surprise Me
        </button>
      </motion.div>

      {/* 35mm Film-Strip Search Journal */}
      <FilmStripJournal />

      {/* Live Data Carousels */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        style={{ textAlign: 'left', marginTop: '40px' }}
      >
        <LiveMovieCarousel
          title="Trending Today"
          emoji="🔥"
          fetchFn={moviesApi.getLiveTrending}
        />
        <LiveMovieCarousel
          title="In Theaters Now"
          emoji="🍿"
          fetchFn={moviesApi.getLiveNowPlaying}
        />
      </motion.div>

      {/* Ambient cinema projector glow */}
      <div
        style={{
          position: 'fixed',
          top: '-15%',
          right: '-10%',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(212, 175, 55, 0.04) 0%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: -1,
        }}
      />
      <div
        style={{
          position: 'fixed',
          bottom: '-15%',
          left: '-10%',
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(180, 140, 70, 0.03) 0%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: -1,
        }}
      />
    </PageWrapper>
  );
};
