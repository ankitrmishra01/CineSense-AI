import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { recommendApi } from '../api/recommend';
import { useMoodStore } from '../store/moodStore';
import type { RecommendRequest } from '../types';

export const useRecommendations = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { moodText, selectedEmojis, filters, lastResults, setResults, seed, currentPage, setSeed, setCurrentPage } = useMoodStore();
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
  }, [moodText, selectedEmojis, filters, setResults, navigate, seed, currentPage, setSeed, setCurrentPage]);

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
