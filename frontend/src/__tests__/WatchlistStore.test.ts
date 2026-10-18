import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useWatchlistStore } from '../store/watchlistStore';
import { watchlistApi } from '../api/watchlist';
import type { Movie } from '../types';

vi.mock('../api/watchlist', () => ({
  watchlistApi: {
    getAll: vi.fn(),
    add: vi.fn(),
    remove: vi.fn(),
  },
}));

const mockMovie: Movie = {
  id: 101,
  title: 'Inception',
  overview: 'A thief who steals corporate secrets...',
  poster_path: '/inception.jpg',
  backdrop_path: '/backdrop.jpg',
  vote_average: 8.8,
  release_date: '2010-07-16',
  genres: [{ id: 878, name: 'Sci-Fi' }],
};

describe('WatchlistStore - Optimistic Updates & Error Rollbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWatchlistStore.getState().clearWatchlist();
  });

  it('initializes with empty items and loading false', () => {
    const state = useWatchlistStore.getState();
    expect(state.items).toEqual([]);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('optimistically adds movie and replaces temporary id on API success', async () => {
    let resolveAdd: (val: any) => void = () => {};
    const addPromise = new Promise((resolve) => {
      resolveAdd = resolve;
    });

    vi.mocked(watchlistApi.add).mockReturnValue(addPromise as any);

    // Call optimistic add
    const addAction = useWatchlistStore.getState().addToWatchlistOptimistic(mockMovie);

    // Immediately after calling, item should be present in store with temp id
    const intermediateState = useWatchlistStore.getState();
    expect(intermediateState.items.length).toBe(1);
    expect(intermediateState.items[0].movie.id).toBe(101);
    expect(intermediateState.items[0].id.startsWith('temp-')).toBe(true);
    expect(useWatchlistStore.getState().isInWatchlist(101)).toBe(true);

    // Resolve API
    resolveAdd({ data: { id: 'real-db-id-123', movie_id: 101, added_at: '2026-10-18T00:00:00Z' } });
    const success = await addAction;

    expect(success).toBe(true);
    const finalState = useWatchlistStore.getState();
    expect(finalState.items.length).toBe(1);
    expect(finalState.items[0].id).toBe('real-db-id-123');
  });

  it('rolls back optimistic add on API failure', async () => {
    vi.mocked(watchlistApi.add).mockRejectedValue(new Error('Network error'));

    const success = await useWatchlistStore.getState().addToWatchlistOptimistic(mockMovie);

    expect(success).toBe(false);
    const state = useWatchlistStore.getState();
    expect(state.items.length).toBe(0);
    expect(state.error).toBe('Failed to add movie to watchlist.');
    expect(state.isInWatchlist(101)).toBe(false);
  });

  it('optimistically removes item and rolls back on API failure', async () => {
    // Seed store with an item
    useWatchlistStore.setState({
      items: [
        {
          id: 'server-id-456',
          movie: mockMovie,
          added_at: '2026-10-18T00:00:00Z',
        },
      ],
      loading: false,
      error: null,
    });

    expect(useWatchlistStore.getState().items.length).toBe(1);

    // Mock API remove failure
    vi.mocked(watchlistApi.remove).mockRejectedValue(new Error('Server 500'));

    const success = await useWatchlistStore.getState().removeFromWatchlistOptimistic('server-id-456');

    expect(success).toBe(false);
    // Rolled back
    const state = useWatchlistStore.getState();
    expect(state.items.length).toBe(1);
    expect(state.items[0].id).toBe('server-id-456');
    expect(state.error).toBe('Failed to remove movie from watchlist.');
  });
});
