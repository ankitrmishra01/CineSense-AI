import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageWrapper } from '../components/layout/PageWrapper';
import { MovieGrid } from '../components/movie/MovieGrid';
import { moviesApi } from '../api/movies';
import type { Movie } from '../types';

export const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(!!initialQuery);

  useEffect(() => {
    if (initialQuery) {
      handleSearch(initialQuery);
    }
  }, [initialQuery]);

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    setHasSearched(true);
    setSearchParams({ q: searchQuery });
    
    try {
      const { data } = await moviesApi.search(searchQuery);
      setResults(data.results);
    } catch (err) {
      console.error('Search failed', err);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query);
  };

  return (
    <PageWrapper>
      <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center', paddingTop: '40px' }}>
        <h1 style={{ fontFamily: 'var(--font-primary)', fontSize: '32px', fontWeight: 800, marginBottom: '24px' }}>
          Search Movies
        </h1>
        
        <form onSubmit={onSubmit} style={{ display: 'flex', gap: '12px', marginBottom: '48px' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a movie name (e.g., Inception, The Matrix)..."
            style={{
              flex: 1,
              padding: '16px 24px',
              borderRadius: 'var(--border-radius)',
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: '16px',
              outline: 'none',
              boxShadow: 'var(--shadow-sm)',
            }}
            autoFocus
          />
          <button 
            type="submit" 
            className="btn-primary" 
            disabled={!query.trim() || loading}
            style={{ padding: '0 32px' }}
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
          <style>
            {`
              @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `}
          </style>
        </div>
      ) : hasSearched && results.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-secondary)' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🤷‍♂️</div>
          <p>No movies found for "{initialQuery}". Try another search!</p>
        </div>
      ) : results.length > 0 ? (
        <>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
            Found {results.length} results
          </p>
          <MovieGrid items={results.map(m => ({ movie: m, explanation: '', similarity_score: 0 }))} />
        </>
      ) : null}
    </PageWrapper>
  );
};
