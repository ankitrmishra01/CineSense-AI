import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { RecommendationItem } from '../../types';
import { posterUrl } from '../../api/client';
import { GenreChip } from './GenreChip';
import { WhyThisMovie } from './WhyThisMovie';
import { useWatchlist } from '../../hooks/useWatchlist';
import { useAuthStore } from '../../store/authStore';
import { useFeedbackStore } from '../../store/feedbackStore';

const LANGUAGE_MAP: Record<string, { name: string; native: string }> = {
  hi: { name: 'Hindi', native: 'हिन्दी' },
  ta: { name: 'Tamil', native: 'தமிழ்' },
  te: { name: 'Telugu', native: 'తెలుగు' },
  ml: { name: 'Malayalam', native: 'മലയാളം' },
  kn: { name: 'Kannada', native: 'ಕನ್ನಡ' },
  bn: { name: 'Bengali', native: 'বাংলা' },
  mr: { name: 'Marathi', native: 'मराठी' },
  pa: { name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  gu: { name: 'Gujarati', native: 'ગુજરાતી' },
  ko: { name: 'Korean', native: '한국어' },
  ja: { name: 'Japanese', native: '日本語' },
  es: { name: 'Spanish', native: 'Español' },
  fr: { name: 'French', native: 'Français' },
  en: { name: 'English', native: 'EN' },
};

interface MovieCardProps {
  item: RecommendationItem;
  index?: number;
  queryText?: string;
}

export const MovieCard: React.FC<MovieCardProps> = ({ item, index = 0, queryText }) => {
  const { movie, explanation, match_percentage } = item;
  const [whyOpen, setWhyOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const { isAuthenticated } = useAuthStore();
  const { isInWatchlist, addToWatchlist, getWatchlistItemId, removeFromWatchlist } = useWatchlist();
  const { toggleLike, toggleDislike, hideMovie, isLiked, isDisliked, isHidden } = useFeedbackStore();

  if (isHidden(movie.id)) {
    return null;
  }

  const poster = posterUrl(movie.poster_path, 'w342');
  const year = movie.release_date ? new Date(movie.release_date).getFullYear() : null;
  const inWatchlist = isInWatchlist(movie.id);
  const liked = isLiked(movie.id);
  const disliked = isDisliked(movie.id);

  const handleWatchlistClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) return;
    if (inWatchlist) {
      const itemId = getWatchlistItemId(movie.id);
      if (itemId) await removeFromWatchlist(itemId);
    } else {
      await addToWatchlist(movie.id);
    }
  };

  const handleLikeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleLike(movie.id);
  };

  const handleDislikeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleDislike(movie.id);
  };

  const handleHideClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    hideMovie(movie.id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.4), duration: 0.35, ease: 'easeOut' }}
      className="cinema-card"
      style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}
    >
      {/* Poster with Cinema Grain Frame */}
      <Link to={`/movie/${movie.id}`} style={{ textDecoration: 'none', display: 'block', position: 'relative' }}>
        <div
          style={{
            position: 'relative',
            aspectRatio: '2/3',
            overflow: 'hidden',
            backgroundColor: 'var(--color-bg-secondary)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          {poster && !imgError ? (
            <img
              src={poster}
              alt={movie.title}
              onError={() => setImgError(true)}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              loading="lazy"
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                color: 'var(--color-text-muted)',
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="2" ry="2" />
                <line x1="7" y1="2" x2="7" y2="22" />
                <line x1="17" y1="2" x2="17" y2="22" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <line x1="2" y1="7" x2="7" y2="7" />
                <line x1="2" y1="17" x2="7" y2="17" />
                <line x1="17" y1="17" x2="22" y2="17" />
                <line x1="17" y1="7" x2="22" y2="7" />
              </svg>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-sans)', letterSpacing: '0.02em' }}>
                No poster available
              </span>
            </div>
          )}

          {/* Top Left: Match % & Rating Pills */}
          <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {match_percentage ? (
              <div
                style={{
                  backgroundColor: 'rgba(12, 11, 10, 0.88)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid var(--color-accent-border)',
                  borderRadius: 'var(--radius-pill)',
                  padding: '3px 8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--color-accent-primary)',
                  letterSpacing: '0.03em',
                }}
              >
                <span>✦</span>
                <span>{match_percentage}% Match</span>
              </div>
            ) : null}

            {movie.vote_average ? (
              <div
                style={{
                  backgroundColor: 'rgba(12, 11, 10, 0.82)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-pill)',
                  padding: '2px 7px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--color-text-secondary)',
                }}
              >
                <span>★</span>
                <span>{Number(movie.vote_average).toFixed(1)}</span>
              </div>
            ) : null}

            {movie.original_language && (
              <div
                style={{
                  backgroundColor: 'rgba(12, 11, 10, 0.82)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-pill)',
                  padding: '2px 7px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--color-accent-primary)',
                  letterSpacing: '0.02em',
                }}
              >
                <span>{LANGUAGE_MAP[movie.original_language]?.native || movie.original_language.toUpperCase()}</span>
              </div>
            )}
          </div>

          {/* Top Right: Watchlist & Hide Buttons */}
          <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '6px' }}>
            {isAuthenticated && (
              <button
                onClick={handleWatchlistClick}
                style={{
                  backgroundColor: inWatchlist ? 'var(--color-accent-primary)' : 'rgba(12, 11, 10, 0.82)',
                  color: inWatchlist ? 'var(--color-btn-primary-text)' : 'var(--color-text-primary)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-pill)',
                  padding: '5px 7px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  transition: 'all 0.2s ease',
                }}
                title={inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
              >
                {inWatchlist ? '✓ Saved' : '+ Save'}
              </button>
            )}

            <button
              onClick={handleHideClick}
              style={{
                backgroundColor: 'rgba(12, 11, 10, 0.82)',
                color: 'var(--color-text-muted)',
                backdropFilter: 'blur(8px)',
                border: '1px solid var(--color-border)',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '11px',
                transition: 'all 0.2s',
              }}
              title="Not interested (hide this movie)"
            >
              ✕
            </button>
          </div>
        </div>
      </Link>

      {/* Card Details */}
      <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div>
          <Link to={`/movie/${movie.id}`} style={{ textDecoration: 'none' }}>
            <h3
              style={{
                fontFamily: 'var(--font-serif)',
                fontWeight: 600,
                fontSize: '16px',
                color: 'var(--color-text-primary)',
                marginBottom: '4px',
                lineHeight: 1.3,
                transition: 'color 0.2s',
              }}
            >
              {movie.title}
              {movie.original_title && movie.original_title !== movie.title && (
                <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: '6px' }}>
                  ({movie.original_title})
                </span>
              )}
            </h3>
          </Link>
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
            {[
              year,
              movie.runtime ? `${movie.runtime}m` : null,
              movie.original_language ? (LANGUAGE_MAP[movie.original_language]?.name || movie.original_language.toUpperCase()) : null,
              movie.original_language && movie.original_language !== 'en' ? (movie.original_language === 'hi' ? 'Original Hindi' : 'Hindi dub: not verified') : null
            ].filter(Boolean).join(' · ')}
          </p>
        </div>

        {/* Genres */}
        {movie.genres && movie.genres.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {(movie.genres as Array<{ id: number; name: string }>).slice(0, 3).map((g) => (
              <GenreChip key={g.id} genre={g} small />
            ))}
          </div>
        )}

        {/* Overview */}
        {movie.overview && (
          <p
            style={{
              fontSize: '12px',
              color: 'var(--color-text-secondary)',
              lineHeight: 1.55,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {movie.overview}
          </p>
        )}

        {/* Bottom Bar: Curator's Note & Feedback */}
        <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--color-border)' }}>
          <WhyThisMovie
            explanation={explanation}
            isOpen={whyOpen}
            onToggle={() => setWhyOpen(!whyOpen)}
            movieId={movie.id}
            queryText={queryText}
          />

          {/* Feedback thumbs row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '6px',
              marginTop: '8px',
            }}
          >
            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginRight: 'auto' }}>
              Feedback
            </span>
            <button
              onClick={handleLikeClick}
              style={{
                background: liked ? 'var(--color-accent-subtle)' : 'transparent',
                border: liked ? '1px solid var(--color-accent-border)' : '1px solid transparent',
                borderRadius: '4px',
                padding: '2px 6px',
                cursor: 'pointer',
                fontSize: '12px',
                color: liked ? 'var(--color-accent-primary)' : 'var(--color-text-muted)',
              }}
              title="More like this"
            >
              👍
            </button>
            <button
              onClick={handleDislikeClick}
              style={{
                background: disliked ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                border: disliked ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid transparent',
                borderRadius: '4px',
                padding: '2px 6px',
                cursor: 'pointer',
                fontSize: '12px',
                color: disliked ? '#ef4444' : 'var(--color-text-muted)',
              }}
              title="Less like this"
            >
              👎
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
