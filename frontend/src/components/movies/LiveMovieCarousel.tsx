import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import type { Movie } from '../../types';
import { Spinner } from '../ui/Spinner';

import { SUPPORTED_LANGUAGES } from '../../store/preferencesStore';

const LANG_MAP: Record<string, { name: string; native: string }> = SUPPORTED_LANGUAGES.reduce((acc, item) => {
  acc[item.code] = { name: item.name, native: item.native };
  return acc;
}, {} as Record<string, { name: string; native: string }>);

interface LiveMovieCarouselProps {
  title: string;
  fetchFn: () => Promise<{ data: Movie[] }>;
  emoji?: string;
  subtitle?: string;
}

export const LiveMovieCarousel: React.FC<LiveMovieCarouselProps> = ({ title, fetchFn, emoji, subtitle }) => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fetchRef = useRef(fetchFn);
  fetchRef.current = fetchFn;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    let mounted = true;
    setLoading(true);
    fetchRef
      .current()
      .then((res) => {
        if (mounted) {
          setMovies(res.data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch live movies', err);
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [isVisible, title]);

  return (
    <div
      ref={containerRef}
      style={{
        marginBottom: '44px',
        overflow: 'hidden',
        contentVisibility: 'auto',
        containIntrinsicSize: '1px 320px',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {emoji && <span style={{ fontSize: '18px' }}>{emoji}</span>}
          <h2
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '22px',
              fontWeight: 700,
              margin: 0,
              color: 'var(--color-text-primary)',
            }}
          >
            {title}
          </h2>
        </div>
        {subtitle && (
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-sans)' }}>
            {subtitle}
          </p>
        )}
      </div>

      {loading ? (
        <div style={{ padding: '24px 0', minHeight: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spinner size={26} color="var(--color-accent-primary)" />
        </div>
      ) : movies.length === 0 ? null : (

      <div
        style={{
          display: 'flex',
          gap: '16px',
          overflowX: 'auto',
          paddingBottom: '20px',
          paddingTop: '6px',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
        }}
      >
        {movies.map((movie, idx) => {
          const langInfo = movie.original_language ? LANG_MAP[movie.original_language] : null;

          return (
            <motion.div
              key={movie.id}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(idx * 0.04, 0.3) }}
              style={{
                scrollSnapAlign: 'start',
                flex: '0 0 auto',
                width: '175px',
              }}
            >
              <Link to={`/movie/${movie.id}`} style={{ textDecoration: 'none' }}>
                <div
                  className="cinema-card"
                  style={{
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    height: '260px',
                    position: 'relative',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  {movie.poster_path ? (
                    <img
                      src={movie.poster_path.replace('/w500/', '/w185/')}
                      alt={movie.title}
                      width={175}
                      height={260}
                      decoding="async"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      loading="lazy"
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        backgroundColor: 'var(--color-bg-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '16px',
                        textAlign: 'center',
                      }}
                    >
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '12px', fontFamily: 'var(--font-serif)' }}>
                        {movie.title}
                      </span>
                    </div>
                  )}

                  {/* Language Pill Top Left */}
                  {langInfo && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '8px',
                        left: '8px',
                        backgroundColor: 'rgba(12, 11, 10, 0.75)',
                        backdropFilter: 'blur(4px)',
                        padding: '2px 7px',
                        borderRadius: 'var(--radius-pill)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--color-accent-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        zIndex: 2,
                      }}
                    >
                      <span className="font-indic">{langInfo.native}</span>
                    </div>
                  )}

                  {/* Cinema Gradient Title Footprint */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: 'linear-gradient(to top, rgba(12,11,10,0.95) 0%, rgba(12,11,10,0.6) 60%, transparent 100%)',
                      padding: '36px 10px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '3px',
                      zIndex: 2,
                    }}
                  >
                    <span
                      style={{
                        color: 'var(--color-text-primary)',
                        fontFamily: 'var(--font-serif)',
                        fontWeight: 600,
                        fontSize: '13px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {movie.title}
                    </span>
                    {movie.vote_average && (
                      <span style={{ color: 'var(--color-accent-primary)', fontSize: '11px', fontWeight: 700 }}>
                        ★ {Number(movie.vote_average).toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
      )}
    </div>
  );
};

