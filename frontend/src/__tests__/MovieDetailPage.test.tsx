import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TrailerEmbed } from '../components/movie/TrailerEmbed';

describe('Movie Details Components (Trailer & Watch Providers)', () => {
  it('renders Play Official Trailer button and opens modal with privacy-friendly YouTube iframe on click', () => {
    render(
      <TrailerEmbed
        trailerKey="HNARuSROxbM"
        title="Arcadian Official Trailer"
        backdropUrl="/backdrop.jpg"
      />
    );

    // Initial state: Play button is visible, iframe is NOT in DOM
    const playBtn = screen.getByRole('button', { name: /Play Arcadian Official Trailer/i });
    expect(playBtn).toBeInTheDocument();
    expect(screen.queryByTitle('Arcadian Official Trailer')).not.toBeInTheDocument();

    // Click play button
    fireEvent.click(playBtn);

    // Modal is now open with youtube-nocookie iframe
    const iframe = screen.getByTitle('Arcadian Official Trailer');
    expect(iframe).toBeInTheDocument();
    expect(iframe.getAttribute('src')).toContain('https://www.youtube-nocookie.com/embed/HNARuSROxbM');

    // Close on Close button click
    const closeBtn = screen.getByRole('button', { name: /Close trailer dialog/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByTitle('Arcadian Official Trailer')).not.toBeInTheDocument();
  });

  it('closes trailer modal when Escape key is pressed', () => {
    render(
      <TrailerEmbed
        trailerKey="HNARuSROxbM"
        title="Arcadian Official Trailer"
      />
    );

    const playBtn = screen.getByRole('button', { name: /Play Arcadian Official Trailer/i });
    fireEvent.click(playBtn);
    expect(screen.getByTitle('Arcadian Official Trailer')).toBeInTheDocument();

    // Fire Escape keydown on window
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTitle('Arcadian Official Trailer')).not.toBeInTheDocument();
  });

  it('renders clean fallback line when trailerKey is null or empty', () => {
    render(<TrailerEmbed trailerKey={null} title="No Trailer Film" />);
    expect(screen.getByText(/No official trailer available for this title/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Play/i })).not.toBeInTheDocument();
  });
});
