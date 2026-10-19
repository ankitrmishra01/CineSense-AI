import React from "react";
import {
  usePreferencesStore,
  SUPPORTED_LANGUAGES,
  type AudioMode,
} from "../../store/preferencesStore";

interface LanguagePickerModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  isFirstVisit?: boolean;
}

export const LanguagePickerModal: React.FC<LanguagePickerModalProps> = ({
  isOpen,
  onClose,
  isFirstVisit = false,
}) => {
  const {
    preferredLanguages,
    preferredAudioMode,
    hasCompletedOnboarding,
    toggleLanguage,
    setPreferredAudioMode,
    setHasCompletedOnboarding,
  } = usePreferencesStore();

  const showModal = isOpen !== undefined ? isOpen : !hasCompletedOnboarding;

  if (!showModal) return null;

  const handleSave = () => {
    setHasCompletedOnboarding(true);
    if (onClose) onClose();
  };

  const handleSkip = () => {
    setHasCompletedOnboarding(true);
    if (onClose) onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="language-picker-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        className="cinema-card"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "680px",
          maxHeight: "90vh",
          overflowY: "auto",
          borderRadius: "var(--radius-lg)",
          padding: "28px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          border: "1px solid var(--color-border)",
          backgroundColor: "var(--color-bg-card)",
          color: "var(--color-text-primary)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "16px" }}>
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "3px 10px",
                marginBottom: "8px",
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                borderRadius: "var(--radius-pill)",
                backgroundColor: "var(--color-accent-subtle)",
                color: "var(--color-accent-primary)",
                border: "1px solid var(--color-accent-border)",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <span>Language & Preferences</span>
            </div>
            <h2 id="language-picker-title" style={{ fontFamily: "var(--font-serif)", fontSize: "24px", fontWeight: 700, margin: 0 }}>
              What languages do you enjoy?
            </h2>
            <p style={{ marginTop: "4px", fontSize: "13px", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
              Pick your preferred languages. CineSense tailors recommendations, trending films, and search results to your taste.
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="btn-outline"
              style={{ padding: "6px 10px", borderRadius: "50%", cursor: "pointer", border: "1px solid var(--color-border)" }}
              aria-label="Close"
            >
              ✕
            </button>
          )}
        </div>

        {/* Multi-language Selector */}
        <div style={{ margin: "20px 0" }}>
          <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px" }}>
            Select Languages (Multi-select enabled)
          </label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(135px, 1fr))",
              gap: "10px",
            }}
          >
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isSelected = preferredLanguages.includes(lang.code);
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => toggleLanguage(lang.code)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    padding: "10px 12px",
                    borderRadius: "var(--radius-md)",
                    border: isSelected ? "1px solid var(--color-accent-primary)" : "1px solid var(--color-border)",
                    backgroundColor: isSelected ? "var(--color-accent-subtle)" : "var(--color-bg-secondary)",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                    <span className="font-indic" style={{ fontSize: "15px", fontWeight: 700, color: "var(--color-text-primary)" }}>
                      {lang.native}
                    </span>
                    {isSelected && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "18px",
                          height: "18px",
                          borderRadius: "50%",
                          backgroundColor: "var(--color-accent-primary)",
                          color: "var(--color-btn-primary-text)",
                          fontSize: "11px",
                          fontWeight: 700,
                        }}
                      >
                        ✓
                      </span>
                    )}
                  </div>
                  <div style={{ marginTop: "4px", display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--color-text-secondary)" }}>
                    <span>{lang.name}</span>
                    {lang.industry && (
                      <span
                        style={{
                          fontSize: "9px",
                          padding: "1px 5px",
                          borderRadius: "3px",
                          backgroundColor: "var(--color-bg-card)",
                          border: "1px solid var(--color-border)",
                        }}
                      >
                        {lang.industry}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Audio / Dubbing Mode Preference */}
        <div style={{ margin: "20px 0 0", paddingTop: "16px", borderTop: "1px solid var(--color-border)" }}>
          <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px" }}>
            Audio & Subtitle Mode
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
            {[
              {
                id: "original",
                title: "Original Language",
                desc: "Subtitles in English or preferred",
              },
              {
                id: "dubbed_when_possible",
                title: "Dubbed Preferred",
                desc: "When confirmed dubbed tracks exist",
              },
              {
                id: "no_preference",
                title: "No Preference",
                desc: "Discover both original and dubbed",
              },
            ].map((mode) => {
              const isSelected = preferredAudioMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setPreferredAudioMode(mode.id as AudioMode)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "var(--radius-md)",
                    border: isSelected ? "1px solid var(--color-accent-primary)" : "1px solid var(--color-border)",
                    backgroundColor: isSelected ? "var(--color-accent-subtle)" : "var(--color-bg-secondary)",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--color-text-primary)" }}>
                    {mode.title}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--color-text-secondary)", marginTop: "2px" }}>
                    {mode.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: "20px",
            marginTop: "16px",
            borderTop: "1px solid var(--color-border)",
          }}
        >
          {isFirstVisit || !hasCompletedOnboarding ? (
            <button
              type="button"
              onClick={handleSkip}
              className="btn-outline"
              style={{ fontSize: "12px", padding: "6px 14px" }}
            >
              Skip for now
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            id="save-preferences-btn"
            onClick={handleSave}
            className="btn-cinema"
            style={{ padding: "8px 22px", fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <span>✨</span>
            <span>Save Preferences</span>
          </button>
        </div>
      </div>
    </div>
  );
};
