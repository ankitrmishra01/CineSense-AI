import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { SearchPage } from '../pages/SearchPage';
import { moviesApi } from '../api/movies';

vi.mock('../api/movies', () => ({
  moviesApi: {
    search: vi.fn(),
  },
}));

describe('SearchPage - Debounced Search & Race Condition Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces rapid typing and only fires search for the final query', async () => {
    vi.mocked(moviesApi.search).mockResolvedValue({
      data: {
        results: [
          {
            id: 1,
            title: 'Interstellar',
            overview: 'Space exploration...',
            vote_average: 8.6,
          },
        ],
        total: 1,
      },
    } as any);

    render(
      <MemoryRouter>
        <SearchPage />
      </MemoryRouter>
    );

    const input = screen.getByPlaceholderText(/search by title/i);

    // Type rapidly
    fireEvent.change(input, { target: { value: 'In' } });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    fireEvent.change(input, { target: { value: 'Inter' } });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    fireEvent.change(input, { target: { value: 'Interstellar' } });

    // No search call yet before 400ms debounce
    expect(moviesApi.search).not.toHaveBeenCalled();

    // Advance past debounce
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // Should only have called search once with final string
    expect(moviesApi.search).toHaveBeenCalledTimes(1);
    expect(moviesApi.search).toHaveBeenCalledWith(
      'Interstellar',
      24,
      expect.any(AbortSignal)
    );
  });

  it('aborts in-flight request when user submits a new search immediately', async () => {
    let capturedSignal1: AbortSignal | undefined;
    let capturedSignal2: AbortSignal | undefined;

    vi.mocked(moviesApi.search).mockImplementation((q: string, _limit?: number, signal?: AbortSignal) => {
      if (q === 'QueryA') {
        capturedSignal1 = signal;
        return new Promise(() => {}); // never resolves
      }
      if (q === 'QueryB') {
        capturedSignal2 = signal;
        return Promise.resolve({
          data: {
            results: [{ id: 2, title: 'Blade Runner', vote_average: 8.1 }],
            total: 1,
          },
        } as any);
      }
      return Promise.resolve({ data: { results: [], total: 0 } } as any);
    });

    render(
      <MemoryRouter>
        <SearchPage />
      </MemoryRouter>
    );

    const input = screen.getByPlaceholderText(/search by title/i);
    const form = input.closest('form')!;

    // Type QueryA and submit immediately
    fireEvent.change(input, { target: { value: 'QueryA' } });
    fireEvent.submit(form);

    expect(moviesApi.search).toHaveBeenCalledWith('QueryA', 24, expect.any(AbortSignal));
    expect(capturedSignal1).toBeDefined();
    expect(capturedSignal1?.aborted).toBe(false);

    // Now type QueryB and submit immediately
    fireEvent.change(input, { target: { value: 'QueryB' } });
    fireEvent.submit(form);

    // QueryA's signal should now be ABORTED by the controller
    expect(capturedSignal1?.aborted).toBe(true);
    expect(capturedSignal2?.aborted).toBe(false);
  });
});
