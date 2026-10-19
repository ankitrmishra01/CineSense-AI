import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageWrapper } from '../components/layout/PageWrapper';
import { MovieGrid } from '../components/movie/MovieGrid';
import { moviesApi } from '../api/movies';
import { Spinner } from '../components/ui/Spinner';
import type { Movie } from '../types';

export const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(!!initialQuery);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleSearch = React.useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setHasSearched(true);
    setSearchParams({ q: searchQuery });

    try {
      const { data } = await moviesApi.search(searchQuery, 24, controller.signal);
      setResults(data.results);
      setLoading(false);
    } catch (err: any) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') {
        return;
      }
      setLoading(false);
    }
  }, [setSearchParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        handleSearch(query);
      } else {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        setResults([]);
        setHasSearched(false);
        setSearchParams({});
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query, setSearchParams, handleSearch]);


  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) handleSearch(query);
  };

  return (
    <PageWrapper>
      <div style={{ maxWidth: '780px', margin: '0 auto', textAlign: 'center', paddingTop: '28px' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'var(--color-accent-subtle)',
            border: '1px solid var(--color-accent-border)',
            borderRadius: 'var(--radius-pill)',
            padding: '3px 12px',
            fontSize: '11px',
            color: 'var(--color-accent-primary)',
            fontFamily: 'var(--font-sans)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: '12px',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span>Catalog Search</span>
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'clamp(28px, 4vw, 42px)',
            fontWeight: 700,
            marginBottom: '20px',
            color: 'var(--color-text-primary)',
          }}
        >
          Search Movies
        </h1>

        <form onSubmit={onSubmit} style={{ display: 'flex', gap: '10px', marginBottom: '44px' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, director, or franchise (e.g., Blade Runner, Nolan, Dune)..."
            style={{
              flex: 1,
              padding: '14px 20px',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg-secondary)',
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-sans)',
              fontSize: '15px',
              outline: 'none',
              transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-accent-border)';
              e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-accent-subtle)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-border)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            autoFocus
          />
          <button
            type="submit"
            className="btn-cinema"
            disabled={!query.trim() || loading}
            style={{ padding: '0 28px' }}
          >
            {loading ? <Spinner size={16} color="#0c0b0a" /> : 'Search'}
          </button>
        </form>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spinner size={32} color="var(--color-accent-primary)" />
          <p style={{ marginTop: '16px', color: 'var(--color-text-muted)', fontSize: '13px' }}>
            Searching movies...
          </p>
        </div>
      ) : hasSearched && results.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-secondary)' }}>
          <div style={{ width: '48px', height: '48px', margin: '0 auto 16px', color: 'var(--color-text-muted)' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', marginBottom: '8px' }}>
            No titles found
          </h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
            No films matched "{query}". Try checking the spelling or searching by a key actor/director.
          </p>
        </div>
      ) : results.length > 0 ? (
        <>
          <p
            style={{
              color: 'var(--color-text-muted)',
              marginBottom: '20px',
              fontSize: '13px',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Found {results.length} movies
          </p>
          <MovieGrid
            items={results.map((m) => ({
              movie: m,
              explanation: '',
              similarity_score: 1.0,
            }))}
          />
        </>
      ) : null}
    </PageWrapper>
  );
};
