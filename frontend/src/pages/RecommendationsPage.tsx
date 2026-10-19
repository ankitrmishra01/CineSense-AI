import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PageWrapper } from '../components/layout/PageWrapper';
import { MovieGrid } from '../components/movie/MovieGrid';
import { GridSkeleton } from '../components/ui/Skeleton';
import { useMoodStore } from '../store/moodStore';
import { useRecommendations } from '../hooks/useRecommendations';
import { SUPPORTED_LANGUAGES } from '../store/preferencesStore';

const LANG_MAP: Record<string, { name: string; native: string }> = SUPPORTED_LANGUAGES.reduce((acc, item) => {
  acc[item.code] = { name: item.name, native: item.native };
  return acc;
}, {} as Record<string, { name: string; native: string }>);

export const RecommendationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { lastResults, reset } = useMoodStore();
  const { loading, fetchRecommendations } = useRecommendations();
  const [copied, setCopied] = useState(false);
  const [selectedLangFilter, setSelectedLangFilter] = useState<string>('all');

  const availableLanguages = useMemo(() => {
    if (!lastResults?.recommendations) return [];
    const counts: Record<string, number> = {};
    for (const item of lastResults.recommendations) {
      const lang = item.movie.original_language || 'en';
      counts[lang] = (counts[lang] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [lastResults]);

  const displayedItems = useMemo(() => {
    if (!lastResults?.recommendations) return [];
    if (selectedLangFilter === 'all') return lastResults.recommendations;
    return lastResults.recommendations.filter(
      (item) => (item.movie.original_language || 'en') === selectedLangFilter
    );
  }, [lastResults, selectedLangFilter]);

  const handleShare = () => {
    if (!lastResults) return;
    const shareText = `Check out these cinema recommendations for "${lastResults.query_summary}" on CineSense AI!`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(`${shareText}\n${window.location.origin}/`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  if (!lastResults && !loading) {
    return (
      <PageWrapper>
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              margin: '0 auto 20px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-accent-subtle)',
              border: '1px solid var(--color-accent-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-accent-primary)',
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
              <line x1="7" y1="2" x2="7" y2="22" />
              <line x1="17" y1="2" x2="17" y2="22" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <line x1="2" y1="7" x2="7" y2="7" />
              <line x1="2" y1="17" x2="7" y2="17" />
              <line x1="17" y1="17" x2="22" y2="17" />
              <line x1="17" y1="7" x2="22" y2="7" />
            </svg>
          </div>
          <h2
            style={{
              fontFamily: 'var(--font-serif)',
              fontWeight: 700,
              fontSize: '26px',
              marginBottom: '10px',
              color: 'var(--color-text-primary)',
            }}
          >
            No screening underway
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: '24px', fontSize: '15px' }}>
            Tell our projectionist how you're feeling to begin your screening.
          </p>
          <button className="btn-cinema" onClick={() => navigate('/')}>
            ← Back to Discover
          </button>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <button
            id="back-to-home"
            onClick={() => navigate('/')}
            className="btn-outline"
            style={{ fontSize: '12px', padding: '6px 14px' }}
          >
            ← Modify Mood
          </button>

          {lastResults && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleShare}
                className="btn-outline"
                style={{ fontSize: '12px', padding: '6px 14px' }}
                title="Share this mood list"
              >
                {copied ? '✓ Link Copied' : 'Share Results'}
              </button>
              <button
                onClick={() => {
                  reset();
                  navigate('/');
                }}
                className="btn-outline"
                style={{ fontSize: '12px', padding: '6px 14px' }}
                title="Reset search"
              >
                ↺ Clear
              </button>
            </div>
          )}
        </div>

        {lastResults && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <span
              style={{
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: 'var(--color-accent-primary)',
                fontFamily: 'var(--font-sans)',
                fontWeight: 600,
              }}
            >
              Recommendations
            </span>
            <h1
              style={{
                fontFamily: 'var(--font-serif)',
                fontWeight: 700,
                fontSize: 'clamp(26px, 4vw, 40px)',
                marginTop: '4px',
                marginBottom: '8px',
                lineHeight: 1.2,
                color: 'var(--color-text-primary)',
              }}
            >
              Films for{' '}
              <span style={{ fontStyle: 'italic', color: 'var(--color-accent-primary)' }}>
                "{lastResults.query_summary}"
              </span>
            </h1>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
              {lastResults.total_results} movies matching your mood and preferences
            </p>

            {/* Quick Language Filter Chips */}
            {availableLanguages.length > 1 && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginTop: '12px' }}>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                  Filter Language:
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedLangFilter('all')}
                  className={selectedLangFilter === 'all' ? 'btn-cinema' : 'btn-outline'}
                  style={{ padding: '4px 12px', fontSize: '12px', borderRadius: 'var(--radius-pill)', cursor: 'pointer' }}
                >
                  All ({lastResults.recommendations.length})
                </button>
                {availableLanguages.map(([code, count]) => {
                  const langInfo = LANG_MAP[code] || { name: code.toUpperCase(), native: code };
                  const isSelected = selectedLangFilter === code;
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setSelectedLangFilter(code)}
                      className={isSelected ? 'btn-cinema' : 'btn-outline'}
                      style={{
                        padding: '4px 12px',
                        fontSize: '12px',
                        borderRadius: 'var(--radius-pill)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span className="font-indic">{langInfo.native}</span>
                      <span style={{ opacity: 0.8, fontSize: '11px' }}>({count})</span>
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <GridSkeleton count={8} />
      ) : lastResults ? (
        <>
          <MovieGrid items={displayedItems} queryText={lastResults.query_summary} />

          {/* Pagination controls */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '16px',
              marginTop: '44px',
              marginBottom: '24px',
            }}
          >
            <button
              className="btn-outline"
              disabled={lastResults.current_page <= 1}
              onClick={() => fetchRecommendations({ page: lastResults.current_page - 1 })}
              style={{ padding: '8px 18px', fontSize: '13px' }}
            >
              ← Previous
            </button>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '13px', fontFamily: 'var(--font-sans)' }}>
              Page {lastResults.current_page} of {lastResults.total_pages}
            </span>
            <button
              className="btn-outline"
              disabled={lastResults.current_page >= lastResults.total_pages}
              onClick={() => fetchRecommendations({ page: lastResults.current_page + 1 })}
              style={{ padding: '8px 18px', fontSize: '13px' }}
            >
              Next →
            </button>
          </div>

          {/* Re-shuffle section */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            style={{
              textAlign: 'center',
              marginTop: '36px',
              padding: '24px',
              backgroundColor: 'var(--color-bg-secondary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
            }}
          >
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '14px', fontSize: '14px', fontFamily: 'var(--font-serif)' }}>
              Looking for a different shade of this emotion?
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn-outline" onClick={() => navigate('/')}>
                ✏️ Refine Mood
              </button>
              <button className="btn-cinema" onClick={() => fetchRecommendations(undefined, true)}>
                🔄 Try Again (Shuffle Reel)
              </button>
            </div>
          </motion.div>
        </>
      ) : null}
    </PageWrapper>
  );
};
