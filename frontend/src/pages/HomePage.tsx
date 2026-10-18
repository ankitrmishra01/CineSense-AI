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
      {/* Clean Archival Status Indicator */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '10px',
          margin: '0 auto 36px',
          padding: '5px 16px',
          borderRadius: 'var(--radius-pill)',
          backgroundColor: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          maxWidth: 'fit-content',
        }}
      >
        <span style={{ fontSize: '11px', color: 'var(--color-accent-primary)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Archival Index
        </span>
        <span style={{ width: '3px', height: '3px', borderRadius: '50%', backgroundColor: 'var(--color-text-muted)' }} />
        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
          Curated from 5,000+ films across 20 distinct cinematic atmospheres
        </span>
      </div>

      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        >
          <h1
            style={{
              fontFamily: 'var(--font-serif)',
              fontWeight: 700,
              fontSize: 'clamp(32px, 5vw, 56px)',
              color: 'var(--color-text-primary)',
              lineHeight: 1.15,
              marginBottom: '16px',
            }}
          >
            How are you feeling <em style={{ fontStyle: 'italic', color: 'var(--color-accent-primary)' }}>tonight?</em>
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '16px',
              color: 'var(--color-text-secondary)',
              maxWidth: '540px',
              margin: '0 auto',
              lineHeight: 1.6,
            }}
          >
            Describe your mood, atmosphere, or cinematic craving. We curate films that match your inner world.
          </p>
        </motion.div>
      </div>

      {/* Main input card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.35 }}
        className="cinema-card"
        style={{ padding: '32px', marginBottom: '20px' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
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

          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '20px' }}>
            <EmojiTagSelector />
          </div>
        </div>
      </motion.div>

      {/* Filter toggle */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
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
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="calm-message"
          style={{ marginBottom: '16px' }}
        >
          <Spinner size={16} color="var(--color-calm-banner-text)" />
          <span>Waking up the projection booth... Calibrating archival film reels.</span>
        </motion.div>
      )}

      {/* Calm Status & Error Box */}
      {error && (
        <motion.div
          role="alert"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            padding: '14px 18px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px',
            backgroundColor: 'var(--color-calm-banner-bg)',
            border: '1px solid var(--color-calm-banner-border)',
            color: 'var(--color-calm-banner-text)',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchRecommendations()}
            style={{
              background: 'none',
              border: '1px solid var(--color-calm-banner-border)',
              borderRadius: 'var(--radius-pill)',
              padding: '4px 12px',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--color-calm-banner-text)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Retry
          </button>
        </motion.div>
      )}

      {/* Action buttons (Normal width, no emoji) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '32px' }}
      >
        <button
          id="find-movies-btn"
          className="btn-cinema"
          onClick={() => fetchRecommendations()}
          disabled={loading}
          style={{ minWidth: '180px', padding: '12px 28px', fontSize: '14px' }}
        >
          {loading ? (
            <>
              <Spinner size={16} color="var(--color-btn-primary-text)" />
              <span>Projecting...</span>
            </>
          ) : (
            'Find My Movies'
          )}
        </button>
        <button
          id="surprise-me-btn"
          className="btn-outline"
          onClick={surpriseMe}
          disabled={loading}
          style={{ padding: '12px 22px', fontSize: '13px' }}
        >
          Surprise Me
        </button>
      </motion.div>

      {/* 35mm Film-Strip Search Journal */}
      <FilmStripJournal />

      {/* Live Data Carousels */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        style={{ textAlign: 'left', marginTop: '40px' }}
      >
        <LiveMovieCarousel
          title="Trending Today"
          fetchFn={moviesApi.getLiveTrending}
        />
        <LiveMovieCarousel
          title="Now Playing in Theatres"
          fetchFn={moviesApi.getLiveNowPlaying}
        />
      </motion.div>
    </PageWrapper>
  );
};
