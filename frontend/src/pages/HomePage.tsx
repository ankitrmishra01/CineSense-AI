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
import { useMoodStore } from '../store/moodStore';
import { usePreferencesStore } from '../store/preferencesStore';

interface IndustryChip {
  label: string;
  native?: string;
  code: string;
  samplePrompt: string;
}

const INDUSTRY_CHIPS: IndustryChip[] = [
  { label: 'All Cinemas', code: 'all', samplePrompt: '' },
  { label: 'Bollywood', native: 'हिन्दी', code: 'hi', samplePrompt: 'Warm feel-good Bollywood family drama with soul-stirring music' },
  { label: 'Tollywood', native: 'తెలుగు', code: 'te', samplePrompt: 'High-octane mass action thriller with heroic elevation' },
  { label: 'Kollywood', native: 'தமிழ்', code: 'ta', samplePrompt: 'Grounded intense Tamil gangster thriller with brilliant cinematography' },
  { label: 'Mollywood', native: 'മലയാളം', code: 'ml', samplePrompt: 'Realistic subtle mystery thriller set in lush Kerala countryside' },
  { label: 'Sandalwood', native: 'ಕನ್ನಡ', code: 'kn', samplePrompt: 'Epic Kannada period drama with mythic lore and grandeur' },
  { label: 'K-Cinema', native: '한국어', code: 'ko', samplePrompt: 'Mind-bending Korean psychological thriller with unexpected twists' },
  { label: 'Hollywood', native: 'English', code: 'en', samplePrompt: 'Visually stunning sci-fi space odyssey exploring time and memory' },
];

const LANGUAGE_ROW_CONFIG: Record<string, { title: string; subtitle: string; emoji: string }> = {
  hi: { title: 'Bollywood Trending', subtitle: 'Popular Hindi cinema & releases', emoji: '🎭' },
  ta: { title: 'Kollywood Trending', subtitle: 'Acclaimed Tamil cinema & craft', emoji: '🔥' },
  te: { title: 'Tollywood Trending', subtitle: 'High-energy Telugu cinema & blockbusters', emoji: '⚡' },
  ml: { title: 'Mollywood Trending', subtitle: 'Realistic Malayalam cinema & gripping narratives', emoji: '🌿' },
  kn: { title: 'Sandalwood Trending', subtitle: 'Top Kannada films & stories', emoji: '⭐' },
  ko: { title: 'K-Cinema Trending', subtitle: 'Leading Korean cinema & suspense', emoji: '🌸' },
  ja: { title: 'Japanese Cinema & Anime', subtitle: 'Aesthetic Japanese cinema & animations', emoji: '⛩️' },
  bn: { title: 'Bengali Cinema', subtitle: 'Thoughtful Bengali cinema & literature adaptations', emoji: '📖' },
  mr: { title: 'Marathi Cinema', subtitle: 'Award-winning Marathi cinema', emoji: '🪔' },
  pa: { title: 'Punjabi Cinema', subtitle: 'Vibrant Punjabi cinema & comedies', emoji: '🥁' },
};

export const HomePage: React.FC = () => {
  const { loading, error, retryStatus, fetchRecommendations, surpriseMe } = useRecommendations();
  const { setMoodText } = useMoodStore();
  const { preferredLanguages } = usePreferencesStore();
  const [showFilters, setShowFilters] = useState(false);
  const [slowLoading, setSlowLoading] = useState(false);
  const [activeIndustry, setActiveIndustry] = useState<string>('all');

  const handleIndustrySelect = (chip: IndustryChip) => {
    setActiveIndustry(chip.code);
    if (chip.samplePrompt) {
      setMoodText(chip.samplePrompt);
    }
  };

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
      {/* Hero Section — Clean, Responsive, Zero Hardcoded Statistics */}
      <div
        style={{
          textAlign: 'center',
          marginTop: '4px',
          marginBottom: '20px',
        }}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <h1
            id="home-headline"
            style={{
              fontFamily: 'var(--font-serif)',
              fontWeight: 700,
              fontSize: 'clamp(28px, 4.5vw, 48px)',
              color: 'var(--color-text-primary)',
              lineHeight: 1.18,
              maxWidth: '720px',
              margin: '0 auto 8px',
              padding: '0 12px',
              textWrap: 'balance',
              wordBreak: 'break-word',
            }}
          >
            How are you feeling <em style={{ fontStyle: 'italic', color: 'var(--color-accent-primary)' }}>tonight?</em>
          </h1>
          <p
            id="home-subtitle"
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '15px',
              color: 'var(--color-text-secondary)',
              maxWidth: '520px',
              margin: '0 auto',
              lineHeight: 1.5,
              padding: '0 12px',
            }}
          >
            Describe a mood or a movie you loved. We'll find what fits.
          </p>
        </motion.div>
      </div>

      {/* Main Mood Search Card — Compact to fit on first screen at 1366x768 and 390x844 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="cinema-card"
        style={{ padding: '20px 18px', marginBottom: '16px' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Mood Textarea Input */}
          <div>
            <span
              style={{
                display: 'block',
                fontSize: '11px',
                color: 'var(--color-text-muted)',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontWeight: 600,
              }}
            >
              Describe Your Mood
            </span>
            <MoodTextInput onSubmit={fetchRecommendations} />
          </div>

          {/* Atmosphere Tags Selector */}
          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '12px' }}>
            <EmojiTagSelector />
          </div>

          {/* Slim Language Preferences Row (Placeholder for preferences without clutter) */}
          <div
            style={{
              borderTop: '1px solid var(--color-border)',
              paddingTop: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '12px',
              color: 'var(--color-text-secondary)',
            }}
          >
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
              Preferred Languages
            </span>
            <span className="font-indic" style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              {preferredLanguages.length > 0 ? preferredLanguages.map(l => l.toUpperCase()).join(' · ') : 'ALL'}
            </span>
          </div>

          {/* Integrated Action Buttons */}
          <div
            style={{
              borderTop: '1px solid var(--color-border)',
              paddingTop: '12px',
              display: 'flex',
              gap: '10px',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <button
              id="find-movies-btn"
              className="btn-primary"
              onClick={() => fetchRecommendations()}
              disabled={loading}
              style={{ minWidth: '140px', minHeight: '44px' }}
            >
              {loading ? (
                <>
                  <Spinner size={16} color="var(--color-btn-primary-text)" />
                  <span>Searching...</span>
                </>
              ) : (
                'Find Movies'
              )}
            </button>
            <button
              id="surprise-me-btn"
              className="btn-outline"
              onClick={surpriseMe}
              disabled={loading}
              style={{ minHeight: '44px' }}
            >
              Surprise Me
            </button>
          </div>
        </div>
      </motion.div>

      {/* Cinema Quick Exploration Chips */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
            Explore by Cinema
          </span>
        </div>
        <div className="try-chips-scroll" style={{ gap: '8px' }}>
          {INDUSTRY_CHIPS.map((chip) => {
            const isSelected = activeIndustry === chip.code;
            return (
              <button
                key={chip.code}
                type="button"
                onClick={() => handleIndustrySelect(chip)}
                className={isSelected ? 'btn-primary' : 'btn-outline'}
                style={{
                  padding: '5px 12px',
                  fontSize: '12px',
                  borderRadius: 'var(--radius-pill)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  cursor: 'pointer',
                  minHeight: '34px',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                <span>{chip.label}</span>
                {chip.native && (
                  <span className="font-indic" style={{ fontSize: '11px', opacity: 0.85 }}>
                    {chip.native}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter toggle */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
        <button
          id="toggle-filters"
          onClick={() => setShowFilters(!showFilters)}
          className="btn-outline"
          style={{ marginBottom: '16px', fontSize: '12px', padding: '5px 12px', minHeight: '32px' }}
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
              <div className="cinema-card" style={{ padding: '20px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <GenreFilter />
                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
                  <RatingFilter />
                </div>
                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
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
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="calm-message"
          style={{ marginBottom: '16px' }}
        >
          <Spinner size={16} color="var(--color-calm-banner-text)" />
          <span>Connecting to movie catalog...</span>
        </motion.div>
      )}

      {/* Status & Error Box */}
      {error && (
        <motion.div
          role="alert"
          className="calm-message"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ marginBottom: '16px', justifyContent: 'space-between' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
              padding: '3px 10px',
              fontSize: '12px',
              color: 'var(--color-calm-banner-text)',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </motion.div>
      )}

      {/* Busy Retrying Banner */}
      {retryStatus && (
        <motion.div
          role="status"
          className="calm-message"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ marginBottom: '16px' }}
        >
          <Spinner size={16} color="var(--color-accent-primary)" />
          <span>{retryStatus}</span>
        </motion.div>
      )}

      {/* 35mm Search Journal */}
      <FilmStripJournal />

      {/* Multilingual Carousels */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        style={{ textAlign: 'left', marginTop: '28px' }}
      >
        {/* Trending in India */}
        <LiveMovieCarousel
          title="Trending in India"
          subtitle="Box office and streaming popularity across India"
          emoji="🇮🇳"
          fetchFn={moviesApi.getTrendingIndia}
        />

        {/* Dynamic carousels based on user's preferred languages */}
        {preferredLanguages.map((langCode) => {
          const config = LANGUAGE_ROW_CONFIG[langCode];
          if (!config) return null;
          return (
            <LiveMovieCarousel
              key={langCode}
              title={config.title}
              subtitle={config.subtitle}
              emoji={config.emoji}
              fetchFn={() => moviesApi.getTrendingByLanguage(langCode)}
            />
          );
        })}

        {/* Theatrical Now Playing */}
        <LiveMovieCarousel
          title="Now Playing in Theatres"
          subtitle="Current theatrical releases in India"
          emoji="🎟️"
          fetchFn={moviesApi.getLiveNowPlaying}
        />

        {/* Worldwide Trending */}
        <LiveMovieCarousel
          title="Trending Worldwide"
          subtitle="International popular films and festival highlights"
          emoji="🌍"
          fetchFn={moviesApi.getLiveTrending}
        />
      </motion.div>
    </PageWrapper>
  );
};
