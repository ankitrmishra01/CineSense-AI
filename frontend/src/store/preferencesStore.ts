import { create } from "zustand";
import { persist } from "zustand/middleware";
import { apiClient } from "../api/client";

export interface LanguageOption {
  code: string;
  name: string;
  native: string;
  industry?: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: "hi", name: "Hindi", native: "हिन्दी", industry: "Bollywood" },
  { code: "en", name: "English", native: "English", industry: "Hollywood" },
  { code: "ta", name: "Tamil", native: "தமிழ்", industry: "Kollywood" },
  { code: "te", name: "Telugu", native: "తెలుగు", industry: "Tollywood" },
  { code: "ml", name: "Malayalam", native: "മലയാളം", industry: "Mollywood" },
  { code: "kn", name: "Kannada", native: "ಕನ್ನಡ", industry: "Sandalwood" },
  { code: "bn", name: "Bengali", native: "বাংলা", industry: "Tollywood Bangla" },
  { code: "mr", name: "Marathi", native: "मराठी", industry: "Marathi Cinema" },
  { code: "pa", name: "Punjabi", native: "ਪੰਜਾਬੀ", industry: "Pollywood" },
  { code: "gu", name: "Gujarati", native: "ગુજરાતી", industry: "Dhollywood" },
  { code: "ko", name: "Korean", native: "한국어", industry: "K-Cinema" },
  { code: "ja", name: "Japanese", native: "日本語", industry: "Anime & J-Cinema" },
  { code: "es", name: "Spanish", native: "Español", industry: "Spanish Cinema" },
  { code: "fr", name: "French", native: "Français", industry: "French Cinema" },
];

export type AudioMode = "original" | "dubbed_when_possible" | "no_preference";

interface PreferencesState {
  preferredLanguages: string[];
  preferredAudioMode: AudioMode;
  hasCompletedOnboarding: boolean;
  toggleLanguage: (code: string) => void;
  setPreferredLanguages: (langs: string[]) => void;
  setPreferredAudioMode: (mode: AudioMode) => void;
  setHasCompletedOnboarding: (completed: boolean) => void;
  syncWithBackend: () => Promise<void>;
  loadFromUser: (languages?: string[], audioMode?: string) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set, get) => ({
      preferredLanguages: ["hi", "en"],
      preferredAudioMode: "original",
      hasCompletedOnboarding: false,

      toggleLanguage: (code: string) => {
        const current = get().preferredLanguages;
        const next = current.includes(code)
          ? current.filter((c) => c !== code)
          : [...current, code];
        // Ensure at least one language remains
        const finalLangs = next.length > 0 ? next : ["hi"];
        set({ preferredLanguages: finalLangs });
        get().syncWithBackend();
      },

      setPreferredLanguages: (langs: string[]) => {
        set({ preferredLanguages: langs.length > 0 ? langs : ["hi", "en"] });
        get().syncWithBackend();
      },

      setPreferredAudioMode: (mode: AudioMode) => {
        set({ preferredAudioMode: mode });
        get().syncWithBackend();
      },

      setHasCompletedOnboarding: (completed: boolean) => {
        set({ hasCompletedOnboarding: completed });
      },

      loadFromUser: (languages?: string[], audioMode?: string) => {
        if (languages && languages.length > 0) {
          set({ preferredLanguages: languages });
        }
        if (audioMode) {
          set({ preferredAudioMode: audioMode as AudioMode });
        }
      },

      syncWithBackend: async () => {
        try {
          const token = localStorage.getItem("cinesense_token");
          if (!token) return;

          const state = get();
          await apiClient.put("/users/me/preferences", {
            preferred_languages: state.preferredLanguages,
            preferred_audio_mode: state.preferredAudioMode,
          });
        } catch {
          // Silent fallback for guest / network error
        }
      },
    }),
    {
      name: "cinesense_user_preferences",
    }
  )
);
