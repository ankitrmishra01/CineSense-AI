import React, { useState, useEffect, useRef } from 'react';

interface TrailerEmbedProps {
  trailerKey?: string | null;
  title?: string;
  movieTitle?: string;
  originalLanguage?: string;
  backdropUrl?: string | null;
}

export const TrailerEmbed: React.FC<TrailerEmbedProps> = ({
  trailerKey,
  title = 'Official Trailer',
  movieTitle,
  originalLanguage,
  backdropUrl,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const triggerBtnRef = useRef<HTMLButtonElement>(null);

  // Close on Escape & trap focus
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        triggerBtnRef.current?.focus();
      } else if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length > 0) {
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    // Focus close button on open
    setTimeout(() => closeBtnRef.current?.focus(), 50);

    // Prevent body scrolling
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = origOverflow;
    };
  }, [isOpen]);

  const cleanTitle = (movieTitle || title || '').replace(/Official Trailer/i, '').trim();
  const encodedQuery = encodeURIComponent(cleanTitle);
  const trailerSearchUrl = `https://www.youtube.com/results?search_query=${encodedQuery}+official+trailer`;
  const fullMovieSearchUrl = `https://www.youtube.com/results?search_query=${encodedQuery}+full+movie`;

  if (!trailerKey) {
    return (
      <div
        className="cinema-card"
        style={{
          padding: '28px 24px',
          textAlign: 'center',
          color: 'var(--color-text-secondary)',
          border: '1px dashed var(--color-border)',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--color-surface-elevated)',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 0, 0, 0.12)',
            color: '#FF0000',
            marginBottom: '12px',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
        </div>
        <p style={{ margin: '0 0 6px 0', fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '15px' }}>
          No official trailer available for this title.
        </p>
        <p style={{ margin: '0 0 18px 0', fontSize: '13px', color: 'var(--color-text-muted)', maxWidth: '480px', marginLeft: 'auto', marginRight: 'auto' }}>
          TMDB has no verified official trailer (only movie songs or clips). Check YouTube for the trailer or watch the full film on official channels.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
          <a
            href={trailerSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline"
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px', padding: '9px 18px' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
            <span>Search Trailer on YouTube ↗</span>
          </a>
          <a
            href={fullMovieSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-cinema"
            style={{
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              padding: '9px 18px',
              backgroundColor: '#cc0000',
              borderColor: '#cc0000',
              color: '#ffffff',
            }}
          >
            <span>Watch Full Movie on YouTube Channels ↗</span>
          </a>
        </div>
        {originalLanguage && ['hi', 'ta', 'te', 'ml', 'bn', 'kn', 'mr'].includes(originalLanguage) && (
          <p style={{ marginTop: '14px', marginBottom: 0, fontSize: '11px', color: 'var(--color-text-subtle)' }}>
            Tip: Many classic and regional titles are officially streamed on channels like Goldmines, Shemaroo, Ultra, and Rajshri.
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Poster-Style Trailer Thumbnail / Play Trigger */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16/9',
          maxHeight: '440px',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          backgroundColor: '#0a0908',
          border: '1px solid var(--color-border)',
        }}
      >
        {backdropUrl && (
          <img
            src={backdropUrl}
            alt={title}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: 0.45,
              filter: 'blur(1px)',
            }}
          />
        )}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(to top, rgba(14, 12, 10, 0.85) 0%, rgba(14, 12, 10, 0.3) 50%, rgba(14, 12, 10, 0.6) 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            textAlign: 'center',
          }}
        >
          <button
            ref={triggerBtnRef}
            id="play-trailer-btn"
            onClick={() => setIsOpen(true)}
            aria-label={`Play ${title}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '12px',
              padding: '14px 28px',
              backgroundColor: 'var(--color-accent-primary)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 'var(--radius-pill)',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
              transition: 'transform 180ms ease, background-color 180ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.04)';
              e.currentTarget.style.backgroundColor = 'var(--color-accent-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.backgroundColor = 'var(--color-accent-primary)';
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Play Official Trailer
          </button>
          <p
            style={{
              marginTop: '12px',
              fontSize: '13px',
              color: 'var(--color-text-subtle)',
              maxWidth: '80%',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title}
          </p>
        </div>
      </div>

      {/* Accessible Trailer Modal */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          ref={modalRef}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsOpen(false);
              triggerBtnRef.current?.focus();
            }
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(5, 5, 5, 0.88)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            animation: 'fadeIn 200ms ease',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '960px',
              backgroundColor: '#000000',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.8)',
              border: '1px solid var(--color-border)',
            }}
          >
            {/* Modal Header Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 20px',
                backgroundColor: 'var(--color-surface-card)',
                borderBottom: '1px solid var(--color-border)',
              }}
            >
              <h3
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '16px',
                  fontWeight: 600,
                  margin: 0,
                  color: 'var(--color-text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {title}
              </h3>
              <button
                ref={closeBtnRef}
                id="close-trailer-btn"
                onClick={() => {
                  setIsOpen(false);
                  triggerBtnRef.current?.focus();
                }}
                aria-label="Close trailer dialog"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  fontSize: '20px',
                  cursor: 'pointer',
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-text-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-muted)')}
              >
                ✕
              </button>
            </div>

            {/* Privacy-Friendly YouTube Embed */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                paddingTop: '56.25%', // 16:9 ratio
                backgroundColor: '#000',
              }}
            >
              <iframe
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  border: 'none',
                }}
                src={`https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1&rel=0&modestbranding=1`}
                title={title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
