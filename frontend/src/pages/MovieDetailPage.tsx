import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PageWrapper } from '../components/layout/PageWrapper';
import { TrailerEmbed } from '../components/movie/TrailerEmbed';
import { GenreChip } from '../components/movie/GenreChip';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { useMovieDetail } from '../hooks/useMovieDetail';
import { useWatchlist } from '../hooks/useWatchlist';
import { useAuthStore } from '../store/authStore';
import { posterUrl } from '../api/client';

export const MovieDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const movieId = id ? parseInt(id) : null;
  const { movie, loading, error } = useMovieDetail(movieId);
  const { isAuthenticated } = useAuthStore();
  const { isInWatchlist, addToWatchlist, removeFromWatchlist, getWatchlistItemId } = useWatchlist();

  if (loading) {
    return (
      <PageWrapper>
        <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
          <Skeleton style={{ width: '280px', aspectRatio: '2/3', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Skeleton style={{ height: '36px', width: '70%' }} />
            <Skeleton style={{ height: '20px', width: '40%' }} />
            <Skeleton style={{ height: '14px', width: '90%' }} />
            <Skeleton style={{ height: '14px', width: '85%' }} />
            <Skeleton style={{ height: '14px', width: '80%' }} />
          </div>
        </div>
      </PageWrapper>
    );
  }

  if (error || !movie) {
    return (
      <PageWrapper>
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎬</div>
          <h2 style={{ fontFamily: 'var(--font-primary)', fontWeight: 700 }}>Movie not found</h2>
          <button className="btn-primary" onClick={() => navigate(-1)} style={{ marginTop: '20px' }}>← Go Back</button>
        </div>
      </PageWrapper>
    );
  }

  const poster = posterUrl(movie.poster_path, 'w500');
  const backdrop = movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null;
  const year = movie.release_date ? new Date(movie.release_date).getFullYear() : null;
  const inWatchlist = isInWatchlist(movie.id);

  const handleWatchlist = async () => {
    if (!isAuthenticated) { navigate('/auth'); return; }
    if (inWatchlist) {
      const itemId = getWatchlistItemId(movie.id);
      if (itemId) await removeFromWatchlist(itemId);
    } else {
      await addToWatchlist(movie.id);
    }
  };



  return (
    <>
      {/* Backdrop */}
      {backdrop && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: '50vh',
          backgroundImage: `url(${backdrop})`,
          backgroundSize: 'cover', backgroundPosition: 'center top',
          zIndex: -1,
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 100%)',
        }} />
      )}

      <PageWrapper>
        <button id="back-from-detail" onClick={() => navigate(-1)} className="btn-ghost" style={{ marginBottom: '32px', fontSize: '13px' }}>
          ← Back
        </button>

        {/* Main content */}
        <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: '48px' }}>
          {/* Poster */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            style={{ flexShrink: 0 }}
          >
            <div style={{
              width: '260px', borderRadius: 'var(--border-radius)',
              overflow: 'hidden', boxShadow: 'var(--shadow-card)',
              background: '#1a1a2e',
            }}>
              {poster ? (
                <img src={poster} alt={movie.title} style={{ width: '100%', display: 'block' }} />
              ) : (
                <div style={{ aspectRatio: '2/3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '64px' }}>🎬</div>
              )}
            </div>
          </motion.div>

          {/* Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            style={{ flex: 1, minWidth: '280px' }}
          >
            <h1 style={{ fontFamily: 'var(--font-primary)', fontWeight: 800, fontSize: 'clamp(24px, 4vw, 40px)', marginBottom: '8px', lineHeight: 1.2 }}>
              {movie.title}
            </h1>
            {movie.tagline && (
              <p style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '16px', marginBottom: '16px' }}>
                "{movie.tagline}"
              </p>
            )}

            {/* Meta row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '20px', alignItems: 'center' }}>
              {movie.vote_average && (
                <Badge color="gold">⭐ {Number(movie.vote_average).toFixed(1)} / 10</Badge>
              )}
              {year && <span style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>{year}</span>}
              {movie.runtime && (
                <span style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>🕐 {movie.runtime} min</span>
              )}
              {movie.vote_count && (
                <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>
                  {movie.vote_count.toLocaleString()} votes
                </span>
              )}
            </div>

            {/* Genres */}
            {movie.genres && movie.genres.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '20px' }}>
                {movie.genres.map((g: any) => <GenreChip key={g.id} genre={g} />)}
              </div>
            )}

            {/* Overview */}
            {movie.overview && (
              <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.7, fontSize: '15px', marginBottom: '28px' }}>
                {movie.overview}
              </p>
            )}

            {/* Watchlist button */}
            <motion.button
              id="watchlist-toggle"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleWatchlist}
              className={inWatchlist ? 'btn-ghost' : 'btn-primary'}
              style={{ padding: '12px 28px', fontSize: '15px' }}
            >
              {inWatchlist ? '📌 Remove from Watchlist' : '🔖 Add to Watchlist'}
            </motion.button>
            {!isAuthenticated && (
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '8px' }}>
                Sign in to save movies to your watchlist
              </p>
            )}
          </motion.div>
        </div>

        {/* Trailer */}
        {movie.trailer_key && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass"
            style={{ padding: '24px', marginBottom: '32px' }}
          >
            <h2 style={{ fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: '20px', marginBottom: '16px' }}>
              🎥 Trailer
            </h2>
            <TrailerEmbed trailerKey={movie.trailer_key} title={`${movie.title} Trailer`} />
          </motion.div>
        )}

        {/* Watch providers */}
        {(() => {
          const providers = movie.watch_providers || {};
          let regionCode = 'IN';
          let regionData = providers[regionCode];

          if (!regionData) {
            if (providers['US']) {
              regionCode = 'US';
              regionData = providers['US'];
            } else {
              const firstAvailable = Object.keys(providers)[0];
              if (firstAvailable) {
                regionCode = firstAvailable;
                regionData = providers[firstAvailable];
              }
            }
          }

          if (!regionData || (!regionData.flatrate?.length && !regionData.rent?.length)) {
            return null;
          }

          return (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass"
              style={{ padding: '24px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h2 style={{ fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: '20px', margin: 0 }}>
                  📺 Where to Watch ({regionCode})
                </h2>
                {regionData.link && (
                  <a href={regionData.link} target="_blank" rel="noreferrer" className="badge" style={{ textDecoration: 'none' }}>
                    View all options →
                  </a>
                )}
              </div>
              
              {regionData.flatrate && regionData.flatrate.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                    Stream
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                    {regionData.flatrate.map((p: any) => (
                      <div key={p.provider_name} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                        {p.logo_path && (
                          <img
                            src={`https://image.tmdb.org/t/p/w45${p.logo_path}`}
                            alt={p.provider_name}
                            style={{ width: '32px', height: '32px', borderRadius: '8px' }}
                          />
                        )}
                        {p.provider_name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {regionData.rent && regionData.rent.length > 0 && (
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                    Rent / Buy
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                    {regionData.rent.map((p: any) => (
                      <div key={p.provider_name} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                        {p.logo_path && (
                          <img
                            src={`https://image.tmdb.org/t/p/w45${p.logo_path}`}
                            alt={p.provider_name}
                            style={{ width: '32px', height: '32px', borderRadius: '8px' }}
                          />
                        )}
                        {p.provider_name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          );
        })()}
      </PageWrapper>
    </>
  );
};
