import React from 'react';

interface TrailerEmbedProps {
  trailerKey: string;
  title?: string;
}

export const TrailerEmbed: React.FC<TrailerEmbedProps> = ({ trailerKey, title = 'Movie Trailer' }) => (
  <div style={{
    position: 'relative',
    width: '100%',
    paddingTop: '56.25%', // 16:9 ratio
    borderRadius: 'var(--border-radius)',
    overflow: 'hidden',
    background: '#000',
  }}>
    <iframe
      style={{
        position: 'absolute',
        top: 0, left: 0,
        width: '100%', height: '100%',
        border: 'none',
      }}
      src={`https://www.youtube.com/embed/${trailerKey}?rel=0&modestbranding=1`}
      title={title}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
    />
  </div>
);
