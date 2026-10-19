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
  const { movie, loading, error, refetch } = useMovieDetail(movieId);
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
        <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap', marginBottom: '32px' }}>
          <Skeleton style={{ width: '280px', aspectRatio: '2/3', flexShrink: 0, borderRadius: 'var(--radius-md)' }} />
          <div style={{ flex: 1, minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Skeleton style={{ height: '40px', width: '70%' }} />
            <Skeleton style={{ height: '20px', width: '40%' }} />
            <Skeleton style={{ height: '14px', width: '90%' }} />
            <Skeleton style={{ height: '14px', width: '85%' }} />
            <Skeleton style={{ height: '14px', width: '80%' }} />
            <Skeleton style={{ height: '44px', width: '180px', marginTop: '16px' }} />
          </div>
        </div>
        <Skeleton style={{ height: '220px', width: '100%', borderRadius: 'var(--radius-md)', marginBottom: '32px' }} />
        <Skeleton style={{ height: '180px', width: '100%', borderRadius: 'var(--radius-md)' }} />
      </PageWrapper>
    );
  }

  if (error || !movie) {
    return (
      <PageWrapper>
        <div
          className="cinema-card"
          style={{
            textAlign: 'center',
            padding: '60px 24px',
            maxWidth: '560px',
            margin: '40px auto',
          }}
        >
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-accent-primary)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ margin: '0 auto 16px' }}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h2
            style={{
              fontFamily: 'var(--font-serif)',
              fontWeight: 700,
              fontSize: '22px',
              color: 'var(--color-text-primary)',
              marginBottom: '10px',
            }}
          >
            Movie details unavailable
          </h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginBottom: '24px' }}>
            We couldn't load the complete details for this title right now.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button className="btn-cinema" onClick={() => refetch?.()}>
              Retry
            </button>
            <button className="btn-outline" onClick={() => navigate('/')}>
              Return Home
            </button>
          </div>
        </div>
      </PageWrapper>
    );
  }

  const poster = posterUrl(movie.poster_path, 'w342');
  const backdrop = movie.backdrop_path
    ? (movie.backdrop_path.startsWith('http')
        ? movie.backdrop_path
        : `https://image.tmdb.org/t/p/w780${movie.backdrop_path}`)
    : null;
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

  // Watch Providers Parsing (Supports both new structured shape and legacy region dictionary)
  const providers = movie.watch_providers || {};
  let regionCode = providers.region_code || 'IN';
  let regionLabel = providers.region_label || (regionCode === 'IN' ? 'India' : regionCode);

  let stream = providers.stream || [];
  let rent = providers.rent || [];
  let buy = providers.buy || [];
  const watchLink = providers.link || (providers[regionCode] ? providers[regionCode].link : null);
  const attribution = providers.attribution || 'Streaming data by JustWatch';

  // Fallback to region dict lookup if structured lists were not at root
  if (!stream.length && !rent.length && !buy.length) {
    let regionData = providers[regionCode];
    if (!regionData) {
      if (providers['US']) {
        regionCode = 'US';
        regionLabel = 'United States';
        regionData = providers['US'];
      } else {
        const firstKey = Object.keys(providers).find((k) => k.length === 2);
        if (firstKey) {
          regionCode = firstKey;
          regionLabel = firstKey;
          regionData = providers[firstKey];
        }
      }
    }
    if (regionData) {
      stream = regionData.flatrate || [];
      rent = regionData.rent || [];
      buy = regionData.buy || [];
    }
  }

  const hasAnyProviders = Boolean(stream.length || rent.length || buy.length);

  const getProviderLink = (providerName: string, title: string) => {
    const q = encodeURIComponent(title);
    const name = providerName.toLowerCase();

    if (name.includes('netflix')) return `https://www.netflix.com/search?q=${q}`;
    if (name.includes('amazon') || name.includes('prime')) return `https://www.primevideo.com/search/?phrase=${q}`;
    if (name.includes('apple') || name.includes('itunes')) return `https://tv.apple.com/search?q=${q}`;
    if (name.includes('google play') || name.includes('google')) return `https://play.google.com/store/search?q=${q}&c=movies`;
    if (name.includes('youtube')) return `https://www.youtube.com/results?search_query=${q}+full+movie`;
    if (name.includes('goldmines')) return `https://www.youtube.com/@goldminesbollywood/search?query=${q}`;
    if (name.includes('shemaroo')) return `https://www.youtube.com/@shemaroobollywood/search?query=${q}`;
    if (name.includes('ultra')) return `https://www.youtube.com/@UltraBollywood/search?query=${q}`;
    if (name.includes('rajshri')) return `https://www.youtube.com/@rajshri/search?query=${q}`;
    if (name.includes('aditya')) return `https://www.youtube.com/@adityamovies/search?query=${q}`;
    if (name.includes('hotstar') || name.includes('disney')) return `https://www.hotstar.com/in/search?q=${q}`;
    if (name.includes('zee5')) return `https://www.zee5.com/search?q=${q}`;
    if (name.includes('jio')) return `https://www.jiocinema.com/search?q=${q}`;
    if (name.includes('sony')) return `https://www.sonyliv.com/search?q=${q}`;
    if (name.includes('lionsgate')) return `https://www.lionsgateplay.com/search/${q}`;
    if (name.includes('hulu')) return `https://www.hulu.com/search?q=${q}`;
    if (name.includes('peacock')) return `https://www.peacocktv.com/watch/search?q=${q}`;
    if (name.includes('hbo') || name.includes('max')) return `https://play.max.com/search?q=${q}`;

    return watchLink || `https://www.google.com/search?q=watch+${q}+on+${encodeURIComponent(providerName)}`;
  };

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
            height: '280px',
            backgroundImage: `url(${backdrop})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
            zIndex: -1,
            opacity: 0.22,
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
          style={{ marginBottom: '28px', fontSize: '13px', padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back
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
          <div style={{ flexShrink: 0 }}>
            <div
              style={{
                width: '280px',
                aspectRatio: '2/3',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-modal)',
                backgroundColor: 'var(--color-surface-card)',
                border: '1px solid var(--color-border)',
                position: 'relative',
              }}
            >
              {poster ? (
                <img
                  src={poster}
                  alt={movie.title}
                  loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
                    <line x1="7" y1="2" x2="7" y2="22" />
                    <line x1="17" y1="2" x2="17" y2="22" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                  </svg>
                </div>
              )}
            </div>
          </div>

          {/* Info Details */}
          <div style={{ flex: 1, minWidth: '300px' }}>
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

            {movie.original_title && movie.original_title !== movie.title && (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginBottom: '8px' }}>
                Original title: <span style={{ color: 'var(--color-text-subtle)' }}>{movie.original_title}</span>
              </p>
            )}

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
                  {movie.runtime} min
                </span>
              )}
              {movie.original_language && (
                <span
                  style={{
                    textTransform: 'uppercase',
                    fontSize: '11px',
                    padding: '2px 8px',
                    backgroundColor: 'var(--color-surface-elevated)',
                    borderRadius: 'var(--radius-xs)',
                    color: 'var(--color-text-muted)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  {movie.original_language}
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

            {/* Watchlist action button */}
            <motion.button
              id="watchlist-toggle"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleWatchlist}
              className={inWatchlist ? 'btn-outline' : 'btn-cinema'}
              style={{ padding: '12px 28px', fontSize: '14px' }}
            >
              {inWatchlist ? '✓ In Watchlist (Remove)' : '+ Add to Watchlist'}
            </motion.button>
            {!isAuthenticated && (
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '8px' }}>
                Sign in to save movies to your watchlist
              </p>
            )}
          </div>
        </div>

        {/* Official Trailer Section */}
        <section style={{ marginBottom: '36px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-accent-primary)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
              <line x1="7" y1="2" x2="7" y2="22" />
              <line x1="17" y1="2" x2="17" y2="22" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <line x1="2" y1="7" x2="7" y2="7" />
              <line x1="2" y1="17" x2="7" y2="17" />
              <line x1="17" y1="17" x2="22" y2="17" />
              <line x1="17" y1="7" x2="22" y2="7" />
            </svg>
            <h2
              style={{
                fontFamily: 'var(--font-serif)',
                fontWeight: 600,
                fontSize: '20px',
                margin: 0,
                color: 'var(--color-text-primary)',
              }}
            >
              Official Trailer
            </h2>
          </div>
          <TrailerEmbed
            trailerKey={movie.trailer_key}
            title={movie.trailer_name || `${movie.title} Official Trailer`}
            movieTitle={movie.title}
            originalLanguage={movie.original_language || undefined}
            backdropUrl={backdrop}
          />
        </section>

        {/* Where to Watch Section */}
        <section
          className="cinema-card"
          id="where-to-watch-section"
          style={{ padding: '24px', marginBottom: '36px' }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--color-accent-primary)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
                <polyline points="17 2 12 7 7 2" />
              </svg>
              <h2
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontWeight: 600,
                  fontSize: '20px',
                  margin: 0,
                  color: 'var(--color-text-primary)',
                }}
              >
                Where to Watch
              </h2>
            </div>
            <span
              style={{
                fontSize: '12px',
                padding: '4px 12px',
                backgroundColor: 'var(--color-surface-elevated)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-pill)',
                color: 'var(--color-text-subtle)',
                fontWeight: 500,
              }}
            >
              Showing availability for {regionLabel}
            </span>
          </div>

          {hasAnyProviders ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Stream / Subscription */}
              {stream.length > 0 && (
                <div>
                  <p
                    style={{
                      fontSize: '11px',
                      color: 'var(--color-text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      fontWeight: 700,
                      marginBottom: '10px',
                    }}
                  >
                    Stream
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                    {stream.map((p: any) => (
                      <a
                        key={p.provider_name}
                        href={getProviderLink(p.provider_name, movie.title)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="provider-pill"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '6px 14px 6px 8px',
                          backgroundColor: 'var(--color-surface-elevated)',
                          borderRadius: 'var(--radius-pill)',
                          border: '1px solid var(--color-border)',
                          textDecoration: 'none',
                          color: 'var(--color-text-primary)',
                          fontSize: '13px',
                          transition: 'border-color 160ms ease, transform 160ms ease',
                        }}
                      >
                        {p.logo_path && (
                          <img
                            src={`https://image.tmdb.org/t/p/w92${p.logo_path}`}
                            alt={p.provider_name}
                            style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
                          />
                        )}
                        <span>{p.provider_name}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Rent */}
              {rent.length > 0 && (
                <div>
                  <p
                    style={{
                      fontSize: '11px',
                      color: 'var(--color-text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      fontWeight: 700,
                      marginBottom: '10px',
                    }}
                  >
                    Rent
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                    {rent.map((p: any) => (
                      <a
                        key={p.provider_name}
                        href={getProviderLink(p.provider_name, movie.title)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="provider-pill"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '6px 14px 6px 8px',
                          backgroundColor: 'var(--color-surface-elevated)',
                          borderRadius: 'var(--radius-pill)',
                          border: '1px solid var(--color-border)',
                          textDecoration: 'none',
                          color: 'var(--color-text-primary)',
                          fontSize: '13px',
                          transition: 'border-color 160ms ease, transform 160ms ease',
                        }}
                      >
                        {p.logo_path && (
                          <img
                            src={`https://image.tmdb.org/t/p/w92${p.logo_path}`}
                            alt={p.provider_name}
                            style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
                          />
                        )}
                        <span>{p.provider_name}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Buy */}
              {buy.length > 0 && (
                <div>
                  <p
                    style={{
                      fontSize: '11px',
                      color: 'var(--color-text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      fontWeight: 700,
                      marginBottom: '10px',
                    }}
                  >
                    Buy / Purchase
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                    {buy.map((p: any) => (
                      <a
                        key={p.provider_name}
                        href={getProviderLink(p.provider_name, movie.title)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="provider-pill"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '6px 14px 6px 8px',
                          backgroundColor: 'var(--color-surface-elevated)',
                          borderRadius: 'var(--radius-pill)',
                          border: '1px solid var(--color-border)',
                          textDecoration: 'none',
                          color: 'var(--color-text-primary)',
                          fontSize: '13px',
                          transition: 'border-color 160ms ease, transform 160ms ease',
                        }}
                      >
                        {p.logo_path && (
                          <img
                            src={`https://image.tmdb.org/t/p/w92${p.logo_path}`}
                            alt={p.provider_name}
                            style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
                          />
                        )}
                        <span>{p.provider_name}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                padding: '24px',
                textAlign: 'center',
                backgroundColor: 'var(--color-surface-elevated)',
                borderRadius: 'var(--radius-sm)',
                border: '1px dashed var(--color-border)',
              }}
            >
              <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '14px' }}>
                Not available to stream in {regionLabel} right now. Check again later.
              </p>
              <div style={{ marginTop: '14px' }}>
                <a
                  href={`https://www.youtube.com/results?search_query=${encodeURIComponent(movie.title)}+full+movie`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-outline"
                  style={{ textDecoration: 'none', fontSize: '12px', padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#FF0000">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                  <span>Check Movie on YouTube ↗</span>
                </a>
              </div>
            </div>
          )}

          {/* JustWatch Required Attribution */}
          <div
            style={{
              marginTop: '20px',
              paddingTop: '12px',
              borderTop: '1px solid var(--color-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px',
              fontSize: '11px',
              color: 'var(--color-text-muted)',
            }}
          >
            <span>{attribution}</span>
            {watchLink && (
              <a
                href={watchLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: 'var(--color-accent-primary)',
                  textDecoration: 'none',
                  fontWeight: 500,
                }}
              >
                View on TMDB ↗
              </a>
            )}
          </div>
        </section>

        {/* Principal Cast Section */}
        {cast.length > 0 && (
          <section className="cinema-card" style={{ padding: '24px', marginBottom: '36px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--color-accent-primary)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <h2
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontWeight: 600,
                  fontSize: '20px',
                  margin: 0,
                  color: 'var(--color-text-primary)',
                }}
              >
                Principal Cast
              </h2>
            </div>
            <div
              style={{
                display: 'flex',
                gap: '16px',
                overflowX: 'auto',
                paddingBottom: '12px',
                scrollbarWidth: 'thin',
              }}
            >
              {cast.slice(0, 10).map((c) => (
                <div
                  key={c.id}
                  style={{
                    flexShrink: 0,
                    width: '120px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      width: '72px',
                      height: '72px',
                      borderRadius: '50%',
                      overflow: 'hidden',
                      backgroundColor: 'var(--color-surface-elevated)',
                      border: '1px solid var(--color-border)',
                      marginBottom: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {c.profile_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w185${c.profile_path}`}
                        alt={c.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <svg
                        width="32"
                        height="32"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="var(--color-text-muted)"
                        strokeWidth="1.5"
                      >
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    )}
                  </div>
                  <p
                    style={{
                      fontWeight: 600,
                      fontSize: '13px',
                      color: 'var(--color-text-primary)',
                      margin: '0 0 2px 0',
                      width: '100%',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {c.name}
                  </p>
                  {c.character && (
                    <p
                      style={{
                        fontSize: '11px',
                        color: 'var(--color-text-muted)',
                        margin: 0,
                        width: '100%',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {c.character}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* More Like This (Similar Films) */}
        {similarMovies.length > 0 && (
          <section style={{ marginTop: '48px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--color-accent-primary)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <h2
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontWeight: 700,
                  fontSize: '22px',
                  margin: 0,
                  color: 'var(--color-text-primary)',
                }}
              >
                More Like This
              </h2>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: '16px',
              }}
            >
              {similarMovies.slice(0, 6).map((m) => (
                <Link key={m.id} to={`/movie/${m.id}`} style={{ textDecoration: 'none' }}>
                  <div className="cinema-card" style={{ overflow: 'hidden' }}>
                    <div style={{ aspectRatio: '2/3', backgroundColor: 'var(--color-surface-elevated)' }}>
                      {m.poster_path ? (
                        <img
                          src={posterUrl(m.poster_path, 'w342') || ''}
                          alt={m.title}
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
                            color: 'var(--color-text-muted)',
                          }}
                        >
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
                            <line x1="7" y1="2" x2="7" y2="22" />
                            <line x1="17" y1="2" x2="17" y2="22" />
                            <line x1="2" y1="12" x2="22" y2="12" />
                          </svg>
                        </div>
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
                          margin: 0,
                        }}
                      >
                        {m.title}
                      </p>
                      {m.vote_average && (
                        <p style={{ fontSize: '11px', color: 'var(--color-accent-primary)', marginTop: '3px', marginBottom: 0 }}>
                          ★ {Number(m.vote_average).toFixed(1)}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </PageWrapper>
    </>
  );
};
