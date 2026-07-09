import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { RecommendationItem } from '../../types';
import { posterUrl } from '../../api/client';
import { GenreChip } from './GenreChip';
import { WhyThisMovie } from './WhyThisMovie';
import { useWatchlist } from '../../hooks/useWatchlist';
import { useAuthStore } from '../../store/authStore';

interface MovieCardProps {
  item: RecommendationItem;
  index?: number;
}

export const MovieCard: React.FC<MovieCardProps> = ({ item, index = 0 }) => {
  const { movie, explanation } = item;
  const [whyOpen, setWhyOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const { isAuthenticated } = useAuthStore();
  const { isInWatchlist, addToWatchlist, getWatchlistItemId, removeFromWatchlist } = useWatchlist();

  const poster = posterUrl(movie.poster_path, 'w342');
  const year = movie.release_date ? new Date(movie.release_date).getFullYear() : null;
  const inWatchlist = isInWatchlist(movie.id);

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.4, ease: 'easeOut' }}
      className="glass glass-hover"
      style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
    >
      {/* Poster */}
      <Link to={`/movie/${movie.id}`} style={{ textDecoration: 'none', display: 'block', position: 'relative' }}>
        <div style={{ position: 'relative', aspectRatio: '2/3', overflow: 'hidden', background: '#1a1a2e' }}>
          {poster && !imgError ? (
            <img
              src={poster}
              alt={movie.title}
              onError={() => setImgError(true)}
              style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s ease' }}
              loading="lazy"
            />
          ) : (
            <div style={{
              width: '100%', height: '100%', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '48px',
            }}>🎬</div>
          )}
          {/* Rating badge */}
          {movie.vote_average && (
            <div style={{
              position: 'absolute', top: '10px', left: '10px',
              background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
              borderRadius: '8px', padding: '4px 8px',
              display: 'flex', alignItems: 'center', gap: '4px',
              fontSize: '13px', fontWeight: 700, color: '#f59e0b',
            }}>
              ⭐ {Number(movie.vote_average).toFixed(1)}
            </div>
          )}
          {/* Watchlist button */}
          {isAuthenticated && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleWatchlistClick}
              style={{
                position: 'absolute', top: '10px', right: '10px',
                background: inWatchlist ? 'rgba(124,58,237,0.85)' : 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(8px)',
                border: 'none', borderRadius: '8px',
                padding: '6px 8px', cursor: 'pointer', fontSize: '16px',
                transition: 'background 0.2s',
              }}
              title={inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
            >
              {inWatchlist ? '📌' : '🔖'}
            </motion.button>
          )}
        </div>
      </Link>

      {/* Card body */}
      <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div>
          <Link to={`/movie/${movie.id}`} style={{ textDecoration: 'none' }}>
            <h3 style={{
              fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: '16px',
              color: 'var(--color-text-primary)', marginBottom: '4px',
              lineHeight: 1.3,
              transition: 'color 0.2s',
            }}>
              {movie.title}
            </h3>
          </Link>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
            {[year, movie.runtime ? `${movie.runtime}m` : null].filter(Boolean).join(' · ')}
          </p>
        </div>

        {/* Genres */}
        {movie.genres && movie.genres.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {(movie.genres as Array<{ id: number; name: string }>).slice(0, 3).map((g) => (
              <GenreChip key={g.id} genre={g} small />
            ))}
          </div>
        )}

        {/* Overview */}
        {movie.overview && (
          <p style={{
            fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.6,
            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {movie.overview}
          </p>
        )}

        {/* Why this movie */}
        <div style={{ marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid var(--color-border)' }}>
          <WhyThisMovie
            explanation={explanation}
            isOpen={whyOpen}
            onToggle={() => setWhyOpen(!whyOpen)}
          />
        </div>
      </div>
    </motion.div>
  );
};
