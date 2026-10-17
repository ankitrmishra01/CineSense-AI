import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PageWrapper } from '../components/layout/PageWrapper';
import { TrailerEmbed } from '../components/movie/TrailerEmbed';
import { GenreChip } from '../components/movie/GenreChip';
import { Skeleton } from '../components/ui/Skeleton';
import { useMovieDetail } from '../hooks/useMovieDetail';
import { useWatchlist } from '../hooks/useWatchlist';
import { useAuthStore } from '../store/authStore';
import { posterUrl } from '../api/client';
import { moviesApi } from '../api/movies';
import type { Movie } from '../types';

export const MovieDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const movieId = id ? parseInt(id) : null;
  const { movie, loading, error } = useMovieDetail(movieId);
  const { isAuthenticated } = useAuthStore();
  const { isInWatchlist, addToWatchlist, removeFromWatchlist, getWatchlistItemId } = useWatchlist();
  const [similarMovies, setSimilarMovies] = useState<Movie[]>([]);

  useEffect(() => {
    if (movieId) {
      moviesApi
        .getSimilar(movieId)
        .then((res) => {
          if (Array.isArray(res.data)) {
            setSimilarMovies(res.data);
          }
        })
        .catch(() => {
          setSimilarMovies([]);
        });
    }
  }, [movieId]);

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
          <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            Movie print not found
          </h2>
          <button className="btn-cinema" onClick={() => navigate(-1)} style={{ marginTop: '20px' }}>
            ← Return to Archive
          </button>
        </div>
      </PageWrapper>
    );
  }

  const poster = posterUrl(movie.poster_path, 'w500');
  const backdrop = movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null;
  const year = movie.release_date ? new Date(movie.release_date).getFullYear() : null;
  const inWatchlist = isInWatchlist(movie.id);

  const handleWatchlist = async () => {
    if (!isAuthenticated) {
      navigate('/auth');
      return;
    }
    if (inWatchlist) {
      const itemId = getWatchlistItemId(movie.id);
      if (itemId) await removeFromWatchlist(itemId);
    } else {
      await addToWatchlist(movie.id);
    }
  };

  const cast = movie.cast_crew?.cast || [];
  const crew = movie.cast_crew?.crew || [];
  const directors = crew.filter((c) => c.job === 'Director');

  return (
    <>
      {/* Dynamic Ambient Backdrop */}
      {backdrop && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: '60vh',
            backgroundImage: `url(${backdrop})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
            zIndex: -1,
            opacity: 0.28,
            filter: 'contrast(1.1) saturate(1.2)',
            maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 100%)',
          }}
        />
      )}

      <PageWrapper>
        <button
          id="back-from-detail"
          onClick={() => navigate(-1)}
          className="btn-outline"
          style={{ marginBottom: '28px', fontSize: '12px', padding: '6px 14px' }}
        >
          ← Back
        </button>

        {/* Main Content Card */}
        <div
          style={{
            display: 'flex',
            gap: '40px',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            marginBottom: '48px',
          }}
        >
          {/* Poster Frame */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} style={{ flexShrink: 0 }}>
            <div
              style={{
                width: '280px',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-modal)',
                backgroundColor: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                position: 'relative',
              }}
            >
              {poster ? (
                <img src={poster} alt={movie.title} style={{ width: '100%', display: 'block' }} />
              ) : (
                <div
                  style={{
                    aspectRatio: '2/3',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '64px',
                  }}
                >
                  🎬
                </div>
              )}
            </div>
          </motion.div>

          {/* Info Details */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            style={{ flex: 1, minWidth: '300px' }}
          >
            {directors.length > 0 && (
              <p
                style={{
                  fontSize: '12px',
                  color: 'var(--color-accent-primary)',
                  fontFamily: 'var(--font-sans)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  fontWeight: 600,
                  marginBottom: '6px',
                }}
              >
                Directed by {directors.map((d) => d.name).join(', ')}
              </p>
            )}

            <h1
              style={{
                fontFamily: 'var(--font-serif)',
                fontWeight: 700,
                fontSize: 'clamp(28px, 4vw, 44px)',
                marginBottom: '8px',
                lineHeight: 1.15,
                color: 'var(--color-text-primary)',
              }}
            >
              {movie.title}
            </h1>

            {movie.tagline && (
              <p
                style={{
                  color: 'var(--color-text-muted)',
                  fontFamily: 'var(--font-serif)',
                  fontStyle: 'italic',
                  fontSize: '17px',
                  marginBottom: '16px',
                }}
              >
                "{movie.tagline}"
              </p>
            )}

            {/* Meta Row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '18px', alignItems: 'center' }}>
              {movie.vote_average && (
                <div
                  style={{
                    backgroundColor: 'var(--color-accent-subtle)',
                    border: '1px solid var(--color-accent-border)',
                    borderRadius: 'var(--radius-pill)',
                    padding: '3px 10px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: 'var(--color-accent-primary)',
                  }}
                >
                  ★ {Number(movie.vote_average).toFixed(1)} / 10
                </div>
              )}
              {year && <span style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>{year}</span>}
              {movie.runtime && (
                <span style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                  ⏳ {movie.runtime} min
                </span>
              )}
              {movie.vote_count && (
                <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>
                  ({movie.vote_count.toLocaleString()} ratings)
                </span>
              )}
            </div>

            {/* Genres */}
            {movie.genres && movie.genres.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '20px' }}>
                {movie.genres.map((g: any) => (
                  <GenreChip key={g.id} genre={g} />
                ))}
              </div>
            )}

            {/* Overview */}
            {movie.overview && (
              <p
                style={{
                  color: 'var(--color-text-secondary)',
                  lineHeight: 1.7,
                  fontSize: '15px',
                  marginBottom: '26px',
                }}
              >
                {movie.overview}
              </p>
            )}

            {/* Watchlist ticket action button */}
            <motion.button
              id="watchlist-toggle"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleWatchlist}
              className={inWatchlist ? 'btn-outline' : 'btn-cinema'}
              style={{ padding: '12px 28px', fontSize: '14px' }}
            >
              {inWatchlist ? '🎟️ Ticket in Collection (Remove)' : '🎟️ Admit One (Add to Watchlist)'}
            </motion.button>
            {!isAuthenticated && (
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '8px' }}>
                Sign in to save films to your permanent cinema journal
              </p>
            )}
          </motion.div>
        </div>

        {/* Cast & Crew Section */}
        {cast.length > 0 && (
          <div className="cinema-card" style={{ padding: '24px', marginBottom: '32px' }}>
            <h2
              style={{
                fontFamily: 'var(--font-serif)',
                fontWeight: 600,
                fontSize: '20px',
                marginBottom: '16px',
                color: 'var(--color-text-primary)',
              }}
            >
              🎭 Principal Cast
            </h2>
            <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '8px', scrollbarWidth: 'thin' }}>
              {cast.slice(0, 10).map((c) => (
                <div
                  key={c.id}
                  style={{
                    flexShrink: 0,
                    width: '130px',
                    padding: '10px',
                    backgroundColor: 'var(--color-bg-secondary)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    textAlign: 'center',
                  }}
                >
                  <p style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text-primary)', marginBottom: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.name}
                  </p>
                  {c.character && (
                    <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.character}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trailer */}
        {movie.trailer_key && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="cinema-card"
            style={{ padding: '24px', marginBottom: '32px' }}
          >
            <h2
              style={{
                fontFamily: 'var(--font-serif)',
                fontWeight: 600,
                fontSize: '20px',
                marginBottom: '16px',
                color: 'var(--color-text-primary)',
              }}
            >
              🎥 Official Theatrical Trailer
            </h2>
            <TrailerEmbed trailerKey={movie.trailer_key} title={`${movie.title} Trailer`} />
          </motion.div>
        )}

        {/* Watch Providers */}
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

          const getProviderLink = (providerName: string, title: string) => {
            const q = encodeURIComponent(title);
            const name = providerName.toLowerCase();

            if (name.includes('netflix')) return `https://www.netflix.com/search?q=${q}`;
            if (name.includes('amazon') || name.includes('prime')) return `https://www.primevideo.com/search/?phrase=${q}`;
            if (name.includes('apple') || name.includes('itunes')) return `https://tv.apple.com/search?q=${q}`;
            if (name.includes('google play') || name.includes('google')) return `https://play.google.com/store/search?q=${q}&c=movies`;
            if (name.includes('youtube')) return `https://www.youtube.com/results?search_query=${q}+movie`;
            if (name.includes('hotstar') || name.includes('disney')) return `https://www.hotstar.com/in/search?q=${q}`;
            if (name.includes('zee5')) return `https://www.zee5.com/search?q=${q}`;
            if (name.includes('jio')) return `https://www.jiocinema.com/search?q=${q}`;
            if (name.includes('sony')) return `https://www.sonyliv.com/search?q=${q}`;
            if (name.includes('hulu')) return `https://www.hulu.com/search?q=${q}`;
            if (name.includes('peacock')) return `https://www.peacocktv.com/watch/search?q=${q}`;
            if (name.includes('hbo') || name.includes('max')) return `https://play.max.com/search?q=${q}`;

            return regionData.link || `https://www.google.com/search?q=watch+${q}+on+${encodeURIComponent(providerName)}`;
          };

          return (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="cinema-card"
              style={{ padding: '24px', marginBottom: '32px' }}
            >
              <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '20px', marginBottom: '16px' }}>
                📺 Where to Watch ({regionCode})
              </h2>

              {regionData.flatrate && regionData.flatrate.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                    Stream
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                    {regionData.flatrate.map((p: any) => (
                      <a
                        key={p.provider_name}
                        href={getProviderLink(p.provider_name, movie.title)}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--color-text-secondary)', textDecoration: 'none' }}
                      >
                        {p.logo_path && (
                          <img
                            src={`https://image.tmdb.org/t/p/w45${p.logo_path}`}
                            alt={p.provider_name}
                            style={{ width: '32px', height: '32px', borderRadius: '6px' }}
                          />
                        )}
                        {p.provider_name}
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {regionData.rent && regionData.rent.length > 0 && (
                <div>
                  <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                    Rent / Purchase
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                    {regionData.rent.map((p: any) => (
                      <a
                        key={p.provider_name}
                        href={getProviderLink(p.provider_name, movie.title)}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--color-text-secondary)', textDecoration: 'none' }}
                      >
                        {p.logo_path && (
                          <img
                            src={`https://image.tmdb.org/t/p/w45${p.logo_path}`}
                            alt={p.provider_name}
                            style={{ width: '32px', height: '32px', borderRadius: '6px' }}
                          />
                        )}
                        {p.provider_name}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          );
        })()}

        {/* More Like This (Similar Films) */}
        {similarMovies.length > 0 && (
          <div style={{ marginTop: '48px' }}>
            <h2
              style={{
                fontFamily: 'var(--font-serif)',
                fontWeight: 700,
                fontSize: '22px',
                marginBottom: '18px',
                color: 'var(--color-text-primary)',
              }}
            >
              🎬 More Like This
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: '16px',
              }}
            >
              {similarMovies.slice(0, 6).map((m) => (
                <Link
                  key={m.id}
                  to={`/movie/${m.id}`}
                  style={{ textDecoration: 'none' }}
                >
                  <div className="cinema-card" style={{ overflow: 'hidden' }}>
                    <div style={{ aspectRatio: '2/3', backgroundColor: 'var(--color-bg-secondary)' }}>
                      {m.poster_path ? (
                        <img
                          src={posterUrl(m.poster_path, 'w342') || ''}
                          alt={m.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🎬</div>
                      )}
                    </div>
                    <div style={{ padding: '10px' }}>
                      <p
                        style={{
                          fontFamily: 'var(--font-serif)',
                          fontSize: '13px',
                          fontWeight: 600,
                          color: 'var(--color-text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {m.title}
                      </p>
                      {m.vote_average && (
                        <p style={{ fontSize: '11px', color: 'var(--color-accent-primary)', marginTop: '2px' }}>
                          ★ {Number(m.vote_average).toFixed(1)}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </PageWrapper>
    </>
  );
};
