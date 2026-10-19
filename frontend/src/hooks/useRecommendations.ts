import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { recommendApi } from '../api/recommend';
import { useMoodStore } from '../store/moodStore';
import { useHistoryStore } from '../store/historyStore';
import { usePreferencesStore } from '../store/preferencesStore';
import type { RecommendRequest } from '../types';

export const useRecommendations = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryStatus, setRetryStatus] = useState<string | null>(null);
  const { moodText, selectedEmojis, filters, lastResults, setResults, seed, currentPage, setSeed, setCurrentPage, setMoodText } = useMoodStore();
  const { preferredLanguages, preferredAudioMode } = usePreferencesStore();
  const { addEntry } = useHistoryStore();
  const navigate = useNavigate();

  const fetchRecommendations = useCallback(async (overrides?: Partial<RecommendRequest>, isTryAgain: boolean = false) => {
    let currentSeed = seed;
    let page = currentPage;
    
    // If it's a completely new request or a try again, reset to page 1 and generate new seed
    if (isTryAgain || (!overrides?.page && overrides?.page !== currentPage)) {
      currentSeed = Math.floor(Math.random() * 1000000);
      setSeed(currentSeed);
      page = 1;
      setCurrentPage(1);
    } else if (overrides?.page) {
      page = overrides.page;
      setCurrentPage(page);
    }

    const payload: RecommendRequest = {
      mood_text: moodText || undefined,
      emotion_tags: selectedEmojis.length > 0 ? selectedEmojis : undefined,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      page: page,
      limit: 20,
      seed: currentSeed || undefined,
      preferred_languages: preferredLanguages.length > 0 ? preferredLanguages : undefined,
      preferred_audio_mode: preferredAudioMode,
      ...overrides,
    };

    if (!payload.mood_text && (!payload.emotion_tags || payload.emotion_tags.length === 0)) {
      setError('Please describe your mood or select an emotion tag.');
      return;
    }

    setLoading(true);
    setError(null);
    setRetryStatus(null);

    const maxAttempts = 3;
    let attempt = 0;
    let success = false;

    while (attempt < maxAttempts && !success) {
      attempt++;
      try {
        const { data } = await recommendApi.recommend(payload);
        setResults(data);

        // Save to 35mm film-strip journal
        if (data.recommendations && data.recommendations.length > 0) {
          addEntry({
            moodText: moodText || '',
            emojis: selectedEmojis || [],
            querySummary: data.query_summary || moodText || 'Custom Mood',
            movieCount: data.total_results || data.recommendations.length,
            movies: data.recommendations.slice(0, 5).map((r) => ({
              id: r.movie.id,
              title: r.movie.title,
              poster_path: r.movie.poster_path,
              vote_average: r.movie.vote_average,
            })),
          });
        }

        success = true;
        setRetryStatus(null);
        navigate('/recommendations');
      } catch (err: unknown) {
        const axiosErr = err as {
          response?: {
            status?: number;
            headers?: Record<string, string>;
            data?: { detail?: unknown };
          };
        };
        const status = axiosErr?.response?.status;
        const retryAfterSec = parseInt(axiosErr?.response?.headers?.['retry-after'] || '2', 10) || 2;

        if (status === 503 && attempt < maxAttempts) {
          setRetryStatus(`Cinema engine is currently busy. Automatically retrying in ${retryAfterSec}s... (Attempt ${attempt}/${maxAttempts})`);
          await new Promise((resolve) => setTimeout(resolve, retryAfterSec * 1000));
        } else {
          const msg =
            axiosErr?.response?.data?.detail ||
            (status === 503
              ? 'The projection room is experiencing high demand. Please try again shortly.'
              : 'Failed to get recommendations. Try again.');
          setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
          setRetryStatus(null);
          break;
        }
      }
    }
    setLoading(false);
  }, [moodText, selectedEmojis, filters, setResults, navigate, seed, currentPage, setSeed, setCurrentPage, addEntry]);


  const surpriseMe = useCallback(() => {
    const surprisePrompts = [
      "I want to be completely blown away by something unexpected",
      "Something I can watch on a rainy Sunday afternoon",
      "A hidden gem most people haven't seen",
      "I want to feel all the emotions at once",
      "Something that will make me think for days",
    ];
    const randomMood = surprisePrompts[Math.floor(Math.random() * surprisePrompts.length)];
    setMoodText(randomMood);
  }, [setMoodText]);

  return { loading, error, retryStatus, lastResults, fetchRecommendations, surpriseMe };
};
