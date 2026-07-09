import { useState, useEffect } from 'react';
import { moviesApi } from '../api/movies';
import type { Movie } from '../types';

export const useMovieDetail = (movieId: number | null) => {
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!movieId) return;
    setLoading(true);
    setError(null);
    moviesApi.getById(movieId)
      .then(({ data }) => setMovie(data))
      .catch(() => setError('Movie not found.'))
      .finally(() => setLoading(false));
  }, [movieId]);

  return { movie, loading, error };
};
