import React from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Navbar } from './components/layout/Navbar';
import { AuthPage } from './pages/AuthPage';
import { HomePage } from './pages/HomePage';
import { RecommendationsPage } from './pages/RecommendationsPage';
import { MovieDetailPage } from './pages/MovieDetailPage';
import { WatchlistPage } from './pages/WatchlistPage';

const AnimatedRoutes: React.FC = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/" element={<HomePage />} />
        <Route path="/recommendations" element={<RecommendationsPage />} />
        <Route path="/movie/:id" element={<MovieDetailPage />} />
        <Route path="/watchlist" element={<WatchlistPage />} />
      </Routes>
    </AnimatePresence>
  );
};

const App: React.FC = () => (
  <BrowserRouter>
    <Navbar />
    <main>
      <AnimatedRoutes />
    </main>
  </BrowserRouter>
);

export default App;
