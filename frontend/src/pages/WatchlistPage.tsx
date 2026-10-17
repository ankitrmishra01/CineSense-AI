import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PageWrapper } from '../components/layout/PageWrapper';
import { GenreChip } from '../components/movie/GenreChip';
import { Skeleton } from '../components/ui/Skeleton';
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
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎟️</div>
          <h2
            style={{
              fontFamily: 'var(--font-serif)',
              fontWeight: 700,
              fontSize: '26px',
              marginBottom: '10px',
              color: 'var(--color-text-primary)',
            }}
          >
            Ticket Archive Locked
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: '24px', fontSize: '15px' }}>
            Please sign in to access your personal cinema ticket collection.
          </p>
          <button className="btn-cinema" onClick={() => navigate('/auth')}>
            Sign In to Archive
          </button>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'var(--color-accent-subtle)',
            border: '1px solid var(--color-accent-border)',
            borderRadius: 'var(--radius-pill)',
            padding: '3px 12px',
            fontSize: '11px',
            color: 'var(--color-accent-primary)',
            fontFamily: 'var(--font-sans)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: '12px',
          }}
        >
          <span>🎟️</span>
          <span>Personal Ticket Collection</span>
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontWeight: 700,
            fontSize: 'clamp(28px, 4vw, 42px)',
            marginBottom: '6px',
            color: 'var(--color-text-primary)',
          }}
        >
          Curated Watchlist
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '32px', fontSize: '14px' }}>
          {items.length} {items.length === 1 ? 'admission ticket' : 'admission tickets'} in your archival collection
        </p>
      </motion.div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} style={{ height: '130px', borderRadius: 'var(--radius-md)' }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ textAlign: 'center', padding: '80px 0' }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎟️</div>
          <h3
            style={{
              fontFamily: 'var(--font-serif)',
              fontWeight: 700,
              fontSize: '22px',
              marginBottom: '10px',
              color: 'var(--color-text-primary)',
            }}
          >
            Your ticket collection is empty
          </h3>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: '24px', fontSize: '14px' }}>
            Browse recommendations and collect admission tickets for films you want to see.
          </p>
          <button className="btn-cinema" onClick={() => navigate('/')}>
            Discover Films
          </button>
        </motion.div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <AnimatePresence>
            {items.map((item, index) => {
              const movie = item.movie;
              const poster = posterUrl(movie.poster_path, 'w185');
              const year = movie.release_date ? new Date(movie.release_date).getFullYear() : null;

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16, height: 0, marginBottom: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="ticket-stub"
                  style={{
                    display: 'flex',
                    gap: '20px',
                    padding: '16px 24px',
                    alignItems: 'center',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  {/* Poster Thumbnail */}
                  <Link to={`/movie/${movie.id}`} style={{ flexShrink: 0 }}>
                    <div
                      style={{
                        width: '74px',
                        height: '110px',
                        borderRadius: 'var(--radius-sm)',
                        overflow: 'hidden',
                        backgroundColor: 'var(--color-bg-secondary)',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      {poster ? (
                        <img
                          src={poster}
                          alt={movie.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '24px',
                          }}
                        >
                          🎬
                        </div>
                      )}
                    </div>
                  </Link>

                  {/* Movie Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                      <span
                        style={{
                          fontSize: '10px',
                          letterSpacing: '0.12em',
                          color: 'var(--color-accent-primary)',
                          fontFamily: 'var(--font-sans)',
                          textTransform: 'uppercase',
                          fontWeight: 700,
                        }}
                      >
                        ADMIT ONE
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        · Added {new Date(item.added_at).toLocaleDateString()}
                      </span>
                    </div>

                    <Link to={`/movie/${movie.id}`} style={{ textDecoration: 'none' }}>
                      <h3
                        style={{
                          fontFamily: 'var(--font-serif)',
                          fontWeight: 600,
                          fontSize: '17px',
                          color: 'var(--color-text-primary)',
                          marginBottom: '4px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {movie.title}
                      </h3>
                    </Link>

                    <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                      {[year, movie.runtime ? `${movie.runtime}m` : null].filter(Boolean).join(' · ')}
                    </p>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                      {movie.vote_average && (
                        <span
                          style={{
                            fontSize: '11px',
                            color: 'var(--color-accent-primary)',
                            backgroundColor: 'var(--color-accent-subtle)',
                            padding: '2px 7px',
                            borderRadius: 'var(--radius-pill)',
                            border: '1px solid var(--color-accent-border)',
                          }}
                        >
                          ★ {Number(movie.vote_average).toFixed(1)}
                        </span>
                      )}
                      {movie.genres?.slice(0, 2).map((g: any) => (
                        <GenreChip key={g.id} genre={g} small />
                      ))}
                    </div>
                  </div>

                  {/* Perforated Divider line */}
                  <div
                    style={{
                      height: '80px',
                      borderLeft: '1px dashed var(--color-border)',
                      margin: '0 8px',
                    }}
                  />

                  {/* Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
                    <Link
                      to={`/movie/${movie.id}`}
                      className="btn-cinema"
                      style={{ padding: '6px 14px', fontSize: '12px', textDecoration: 'none' }}
                    >
                      View Reel
                    </Link>
                    <button
                      onClick={() => removeFromWatchlist(item.id)}
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text-muted)',
                        padding: '5px 12px',
                        borderRadius: 'var(--radius-pill)',
                        cursor: 'pointer',
                        fontSize: '11px',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)';
                        e.currentTarget.style.color = '#ef4444';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--color-border)';
                        e.currentTarget.style.color = 'var(--color-text-muted)';
                      }}
                      title="Void ticket"
                    >
                      Void Ticket
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </PageWrapper>
  );
};
