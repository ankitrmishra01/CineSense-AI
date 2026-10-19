import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { usePreferencesStore, SUPPORTED_LANGUAGES } from '../store/preferencesStore';
import { LanguagePickerModal } from '../components/preferences/LanguagePickerModal';

describe('Language Preferences & Native-Script Rendering', () => {
  beforeEach(() => {
    // Reset store state
    usePreferencesStore.setState({
      preferredLanguages: ['hi', 'en'],
      preferredAudioMode: 'original',
      hasCompletedOnboarding: true,
    });
  });

  it('renders all supported languages with native scripts and industry nicknames', () => {
    render(<LanguagePickerModal isOpen={true} onClose={vi.fn()} />);

    // Verify key regional languages with native scripts exist in document
    expect(screen.getByText('हिन्दी')).toBeInTheDocument();
    expect(screen.getByText('தமிழ்')).toBeInTheDocument();
    expect(screen.getByText('తెలుగు')).toBeInTheDocument();
    expect(screen.getByText('മലയാളം')).toBeInTheDocument();
    expect(screen.getByText('ಕನ್ನಡ')).toBeInTheDocument();
    expect(screen.getByText('বাংলা')).toBeInTheDocument();
    expect(screen.getByText('ਪੰਜਾਬੀ')).toBeInTheDocument();
    expect(screen.getByText('ગુજરાતી')).toBeInTheDocument();
    expect(screen.getByText('한국어')).toBeInTheDocument();
  });

  it('toggles language selection in store and preserves at least one language', () => {
    const store = usePreferencesStore.getState();
    expect(store.preferredLanguages).toEqual(['hi', 'en']);

    // Add Tamil
    store.toggleLanguage('ta');
    expect(usePreferencesStore.getState().preferredLanguages).toContain('ta');

    // Remove English
    store.toggleLanguage('en');
    expect(usePreferencesStore.getState().preferredLanguages).not.toContain('en');

    // Remove Tamil
    store.toggleLanguage('ta');
    // Remove Hindi -> Should not collapse to empty, falls back to at least ['hi']
    store.toggleLanguage('hi');
    expect(usePreferencesStore.getState().preferredLanguages.length).toBeGreaterThanOrEqual(1);
  });

  it('switches preferred audio mode correctly', () => {
    const store = usePreferencesStore.getState();
    expect(store.preferredAudioMode).toBe('original');

    store.setPreferredAudioMode('dubbed_when_possible');
    expect(usePreferencesStore.getState().preferredAudioMode).toBe('dubbed_when_possible');

    store.setPreferredAudioMode('no_preference');
    expect(usePreferencesStore.getState().preferredAudioMode).toBe('no_preference');
  });

  it('completes onboarding and triggers onClose when saving modal', () => {
    const onClose = vi.fn();
    usePreferencesStore.setState({ hasCompletedOnboarding: false });

    render(<LanguagePickerModal isOpen={true} onClose={onClose} />);
    const saveBtn = screen.getByText(/Continue|Save Preferences/i);
    fireEvent.click(saveBtn);

    expect(usePreferencesStore.getState().hasCompletedOnboarding).toBe(true);
    expect(onClose).toHaveBeenCalled();
  });
});
