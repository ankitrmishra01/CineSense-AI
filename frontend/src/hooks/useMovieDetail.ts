import { useState, useEffect } from 'react';
import { moviesApi } from '../api/movies';
import { usePreferencesStore } from '../store/preferencesStore';
import type { Movie } from '../types';

export const useMovieDetail = (movieId: number | null) => {
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preferredLanguages = usePreferencesStore((s) => s.preferredLanguages);
  const topLang = preferredLanguages && preferredLanguages.length > 0 ? preferredLanguages[0] : undefined;

  const fetchDetail = () => {
    if (!movieId) return;
    setLoading(true);
    setError(null);
    moviesApi.getById(movieId, topLang)
      .then(({ data }) => setMovie(data))
      .catch(() => setError('Movie not found.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDetail();
  }, [movieId, topLang]);

  return { movie, loading, error, refetch: fetchDetail };
};
