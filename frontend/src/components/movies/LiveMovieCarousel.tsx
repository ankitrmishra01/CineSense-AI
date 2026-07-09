import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import type { Movie } from '../../types';
import { Spinner } from '../ui/Spinner';

interface LiveMovieCarouselProps {
  title: string;
  fetchFn: () => Promise<{ data: Movie[] }>;
  emoji?: string;
}

export const LiveMovieCarousel: React.FC<LiveMovieCarouselProps> = ({ title, fetchFn, emoji }) => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetchFn()
      .then(res => {
        if (mounted) {
          setMovies(res.data);
          setLoading(false);
        }
      })
      .catch(err => {
        console.error("Failed to fetch live movies", err);
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [fetchFn]);

  if (loading) {
    return (
      <div style={{ padding: '24px 0', minHeight: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner size={30} />
      </div>
    );
  }

  if (movies.length === 0) return null;

  return (
    <div style={{ marginBottom: '48px', overflow: 'hidden' }}>
      <h2 style={{
        fontSize: '24px', 
        fontWeight: 700, 
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        {emoji && <span>{emoji}</span>}
        {title}
      </h2>

      <div style={{ 
        display: 'flex', 
        gap: '16px', 
        overflowX: 'auto', 
        paddingBottom: '24px',
        paddingTop: '8px',
        scrollSnapType: 'x mandatory',
        WebkitOverflowScrolling: 'touch',
        marginLeft: '-16px',
        paddingLeft: '16px',
        marginRight: '-16px',
        paddingRight: '16px'
      }} className="hide-scrollbar">
        {movies.map((movie, idx) => (
          <motion.div
            key={movie.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            style={{ 
              scrollSnapAlign: 'start', 
              flex: '0 0 auto',
              width: '180px',
            }}
          >
            <Link to={`/movies/${movie.id}`} style={{ textDecoration: 'none' }}>
              <div 
                className="glass"
                style={{
                  borderRadius: '16px',
                  overflow: 'hidden',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  cursor: 'pointer',
                  height: '270px',
                  position: 'relative'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'scale(1.05) translateY(-5px)';
                  e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {movie.poster_path ? (
                  <img 
                    src={movie.poster_path} 
                    alt={movie.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ 
                    width: '100%', height: '100%', 
                    background: 'var(--color-bg-secondary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '16px', textAlign: 'center'
                  }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>{movie.title}</span>
                  </div>
                )}
                
                {/* Netflix style gradient overlay for text */}
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.5) 60%, transparent 100%)',
                  padding: '40px 12px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <span style={{ 
                    color: '#fff', 
                    fontWeight: 600, 
                    fontSize: '14px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {movie.title}
                  </span>
                  {movie.vote_average && (
                    <span style={{ color: 'var(--color-primary)', fontSize: '12px', fontWeight: 700 }}>
                      ★ {movie.vote_average.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
