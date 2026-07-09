import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PageWrapper } from '../components/layout/PageWrapper';
import { GenreChip } from '../components/movie/GenreChip';
import { Skeleton } from '../components/ui/Skeleton';
import { Badge } from '../components/ui/Badge';
import { useWatchlist } from '../hooks/useWatchlist';
import { useAuthStore } from '../store/authStore';
import { posterUrl } from '../api/client';

export const WatchlistPage: React.FC = () => {
  const { items, loading, removeFromWatchlist } = useWatchlist();
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  if (!isAuthenticated) {
    return (
      <PageWrapper>
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>📌</div>
          <h2 style={{ fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: '24px', marginBottom: '12px' }}>
            Sign in to view your watchlist
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: '28px' }}>
            Save movies while browsing recommendations.
          </p>
          <button className="btn-primary" onClick={() => navigate('/auth')}>
            Sign In
          </button>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 style={{
          fontFamily: 'var(--font-primary)', fontWeight: 800,
          fontSize: 'clamp(24px, 4vw, 36px)', marginBottom: '8px',
        }}>
          📌 My Watchlist
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '36px' }}>
          {items.length} {items.length === 1 ? 'movie' : 'movies'} saved
        </p>
      </motion.div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} style={{ height: '140px', borderRadius: 'var(--border-radius)' }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ textAlign: 'center', padding: '80px 0' }}
        >
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>🎬</div>
          <h3 style={{ fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: '20px', marginBottom: '12px' }}>
            Your watchlist is empty
          </h3>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: '28px' }}>
            Discover movies and save them here.
          </p>
          <button className="btn-primary" onClick={() => navigate('/')}>
            Start Discovering
          </button>
        </motion.div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <AnimatePresence>
            {items.map((item, index) => {
              const movie = item.movie;
              const poster = posterUrl(movie.poster_path, 'w185');
              const year = movie.release_date ? new Date(movie.release_date).getFullYear() : null;

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20, height: 0, marginBottom: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="glass glass-hover"
                  style={{ display: 'flex', gap: '20px', padding: '16px', alignItems: 'center' }}
                >
                  {/* Poster */}
                  <Link to={`/movie/${movie.id}`} style={{ flexShrink: 0 }}>
                    <div style={{
                      width: '80px', height: '120px', borderRadius: '8px',
                      overflow: 'hidden', background: '#1a1a2e',
                    }}>
                      {poster ? (
                        <img src={poster} alt={movie.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }}>🎬</div>
                      )}
                    </div>
                  </Link>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link to={`/movie/${movie.id}`} style={{ textDecoration: 'none' }}>
                      <h3 style={{
                        fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: '16px',
                        color: 'var(--color-text-primary)', marginBottom: '4px',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {movie.title}
                      </h3>
                    </Link>
                    <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                      {[year, movie.runtime ? `${movie.runtime}m` : null].filter(Boolean).join(' · ')}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                      {movie.vote_average && <Badge color="gold">⭐ {Number(movie.vote_average).toFixed(1)}</Badge>}
                      {movie.genres?.slice(0, 2).map((g: any) => (
                        <GenreChip key={g.id} genre={g} small />
                      ))}
                    </div>
                  </div>

                  {/* Remove button */}
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => removeFromWatchlist(item.id)}
                    style={{
                      flexShrink: 0,
                      background: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.2)',
                      color: '#ef4444',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 500,
                      transition: 'all 0.2s',
                    }}
                  >
                    Remove
                  </motion.button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </PageWrapper>
  );
};
