// TypeScript interfaces matching the FastAPI response shapes

export interface User {
  id: string;
  email: string;
  username: string;
  created_at: string;
  preferred_languages?: string[];
  preferred_audio_mode?: string;
}

export interface TokenRefreshResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface Genre {
  id: number;
  name: string;
}

export interface CastMember {
  id: number;
  name: string;
  character?: string;
  profile_path?: string | null;
  order?: number;
}

export interface CrewMember {
  id: number;
  name: string;
  job?: string;
}

export interface CastCrewData {
  cast?: CastMember[];
  crew?: CrewMember[];
}

export interface CollectionData {
  id: number;
  name: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
}

export interface WatchProviderEntry {
  provider_name: string;
  logo_path: string | null;
}

export interface WatchProvidersRegion {
  link?: string;
  flatrate?: WatchProviderEntry[];
  rent?: WatchProviderEntry[];
  buy?: WatchProviderEntry[];
}

export interface Movie {
  id: number;
  title: string;
  overview: string | null;
  tagline: string | null;
  genres: Genre[] | null;
  keywords: string[] | null;
  poster_path: string | null;
  backdrop_path: string | null;
  runtime: number | null;
  vote_average: number | null;
  vote_count: number | null;
  release_date: string | null;
  trailer_key: string | null;
  trailer_name?: string | null;
  watch_providers: Record<string, any> | null;
  cast_crew?: CastCrewData | null;
  belongs_to_collection?: CollectionData | null;
  original_language?: string | null;
  original_title?: string | null;
  popularity?: number | null;
  cohort_quality_score?: number | null;
  origin_country?: string[] | null;
  spoken_languages?: string[] | null;
}

export interface RecommendFilters {
  genre_ids?: number[];
  min_rating?: number;
  max_runtime?: number;
  min_year?: number;
  original_language?: string;
  preferred_languages?: string[];
}

export interface RecommendRequest {
  mood_text?: string;
  emotion_tags?: string[];
  filters?: RecommendFilters;
  page?: number;
  limit?: number;
  seed?: number;
  preferred_languages?: string[];
  preferred_audio_mode?: string;
}

export interface RecommendationItem {
  movie: Movie;
  similarity_score: number;
  match_percentage?: number;
  explanation: string;
}

export interface JournalEntry {
  id: string;
  timestamp: string;
  moodText: string;
  emojis: string[];
  querySummary: string;
  movieCount: number;
  movies: Array<{ id: number; title: string; poster_path: string | null; vote_average: number | null }>;
}

export interface RecommendResponse {
  session_id: string | null;
  query_summary: string;
  total_results: number;
  total_pages: number;
  current_page: number;
  recommendations: RecommendationItem[];
}

export interface WatchlistItem {
  id: string;
  movie: Movie;
  added_at: string;
}

export interface WatchlistResponse {
  total: number;
  items: WatchlistItem[];
}

export interface WatchlistAddResponse {
  id: string;
  movie_id: number;
  added_at: string;
}

export interface MovieSearchResult {
  results: Movie[];
  total: number;
}

// Mood / UI types
export interface EmotionTag {
  emoji: string;
  label: string;
}

export const EMOTION_TAGS: EmotionTag[] = [
  { emoji: "😢", label: "Sad" },
  { emoji: "😂", label: "Happy" },
  { emoji: "😰", label: "Anxious" },
  { emoji: "🤗", label: "Cozy" },
  { emoji: "😮", label: "Shocked" },
  { emoji: "🤔", label: "Thoughtful" },
  { emoji: "😍", label: "Romantic" },
  { emoji: "😎", label: "Action" },
  { emoji: "😴", label: "Calm" },
  { emoji: "🔥", label: "Intense" },
  { emoji: "👻", label: "Scary" },
  { emoji: "🌙", label: "Dreamy" },
];

export const GENRES: Genre[] = [
  { id: 28, name: "Action" },
  { id: 12, name: "Adventure" },
  { id: 16, name: "Animation" },
  { id: 35, name: "Comedy" },
  { id: 80, name: "Crime" },
  { id: 99, name: "Documentary" },
  { id: 18, name: "Drama" },
  { id: 10751, name: "Family" },
  { id: 14, name: "Fantasy" },
  { id: 36, name: "History" },
  { id: 27, name: "Horror" },
  { id: 10402, name: "Music" },
  { id: 9648, name: "Mystery" },
  { id: 10749, name: "Romance" },
  { id: 878, name: "Sci-Fi" },
  { id: 53, name: "Thriller" },
  { id: 10752, name: "War" },
  { id: 37, name: "Western" },
];
