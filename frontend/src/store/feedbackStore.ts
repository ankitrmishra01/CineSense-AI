import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface FeedbackState {
  likedMovieIds: number[];
  dislikedMovieIds: number[];
  hiddenMovieIds: number[];
  toggleLike: (movieId: number) => void;
  toggleDislike: (movieId: number) => void;
  hideMovie: (movieId: number) => void;
  unhideMovie: (movieId: number) => void;
  isLiked: (movieId: number) => boolean;
  isDisliked: (movieId: number) => boolean;
  isHidden: (movieId: number) => boolean;
  resetFeedback: () => void;
}

export const useFeedbackStore = create<FeedbackState>()(
  persist(
    (set, get) => ({
      likedMovieIds: [],
      dislikedMovieIds: [],
      hiddenMovieIds: [],

      toggleLike: (movieId) =>
        set((state) => {
          const isCurrentlyLiked = state.likedMovieIds.includes(movieId);
          return {
            likedMovieIds: isCurrentlyLiked
              ? state.likedMovieIds.filter((id) => id !== movieId)
              : [...state.likedMovieIds, movieId],
            dislikedMovieIds: state.dislikedMovieIds.filter((id) => id !== movieId),
          };
        }),

      toggleDislike: (movieId) =>
        set((state) => {
          const isCurrentlyDisliked = state.dislikedMovieIds.includes(movieId);
          return {
            dislikedMovieIds: isCurrentlyDisliked
              ? state.dislikedMovieIds.filter((id) => id !== movieId)
              : [...state.dislikedMovieIds, movieId],
            likedMovieIds: state.likedMovieIds.filter((id) => id !== movieId),
          };
        }),

      hideMovie: (movieId) =>
        set((state) => ({
          hiddenMovieIds: state.hiddenMovieIds.includes(movieId)
            ? state.hiddenMovieIds
            : [...state.hiddenMovieIds, movieId],
        })),

      unhideMovie: (movieId) =>
        set((state) => ({
          hiddenMovieIds: state.hiddenMovieIds.filter((id) => id !== movieId),
        })),

      isLiked: (movieId) => get().likedMovieIds.includes(movieId),
      isDisliked: (movieId) => get().dislikedMovieIds.includes(movieId),
      isHidden: (movieId) => get().hiddenMovieIds.includes(movieId),

      resetFeedback: () =>
        set({ likedMovieIds: [], dislikedMovieIds: [], hiddenMovieIds: [] }),
    }),
    {
      name: 'cinesense-feedback-storage',
    }
  )
);
