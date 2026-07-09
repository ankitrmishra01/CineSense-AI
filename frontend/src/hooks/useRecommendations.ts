import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { recommendApi } from '../api/recommend';
import { useMoodStore } from '../store/moodStore';
import type { RecommendRequest } from '../types';

export const useRecommendations = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { moodText, selectedEmojis, filters, lastResults, setResults } = useMoodStore();
  const navigate = useNavigate();

  const fetchRecommendations = useCallback(async (overrides?: Partial<RecommendRequest>) => {
    const payload: RecommendRequest = {
      mood_text: moodText || undefined,
      emotion_tags: selectedEmojis.length > 0 ? selectedEmojis : undefined,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      top_k: 8,
      ...overrides,
    };

    if (!payload.mood_text && (!payload.emotion_tags || payload.emotion_tags.length === 0)) {
      setError('Please describe your mood or select an emotion tag.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data } = await recommendApi.recommend(payload);
      setResults(data);
      navigate('/recommendations');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: unknown } } };
      const msg = axiosErr?.response?.data?.detail || 'Failed to get recommendations. Try again.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  }, [moodText, selectedEmojis, filters, setResults, navigate]);

  const surpriseMe = useCallback(async () => {
    const surprisePrompts = [
      "I want to be completely blown away by something unexpected",
      "Something I can watch on a rainy Sunday afternoon",
      "A hidden gem most people haven't seen",
      "I want to feel all the emotions at once",
      "Something that will make me think for days",
    ];
    const randomMood = surprisePrompts[Math.floor(Math.random() * surprisePrompts.length)];
    await fetchRecommendations({ mood_text: randomMood, emotion_tags: undefined });
  }, [fetchRecommendations]);

  return { loading, error, lastResults, fetchRecommendations, surpriseMe };
};
