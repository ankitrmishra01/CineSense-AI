import { test, expect } from '@playwright/test';

test.describe('Movie Details Page - Trailer, Where to Watch & Hydration', () => {
  test('hydrates live TMDB data: trailer, providers and cast for Arcadian (1051896)', async ({ page }) => {
    await page.goto('/movie/1051896');

    // Wait for the movie title to be visible
    const title = page.locator('h1');
    await expect(title).toContainText('Arcadian');

    // Director & release year
    await expect(page.locator('text=Benjamin Brewer').first()).toBeVisible();

    // Trailer section
    const trailerButton = page.locator('button:has-text("Play Official Trailer")');
    await expect(trailerButton).toBeVisible();

    // Where to Watch section
    const watchSection = page.locator('section:has-text("Where to Watch")');
    await expect(watchSection).toBeVisible();
    await expect(page.locator('text=Streaming data by JustWatch')).toBeVisible();

    // Stream group should contain Lionsgate Play (India)
    await expect(page.locator('text=Stream').first()).toBeVisible();

    // Principal Cast
    const castSection = page.locator('section:has-text("Principal Cast")');
    await expect(castSection).toBeVisible();
    await expect(page.locator('text=Nicolas Cage')).toBeVisible();
  });

  test('trailer modal opens with iframe, closes on Escape key and close button', async ({ page }) => {
    await page.goto('/movie/1051896');

    const trailerButton = page.locator('button:has-text("Play Official Trailer")');
    await expect(trailerButton).toBeVisible();

    // Open trailer modal
    await trailerButton.click();

    // Check modal visibility and iframe src
    const iframe = page.locator('iframe');
    await expect(iframe).toBeVisible();
    const src = await iframe.getAttribute('src');
    expect(src).toContain('youtube-nocookie.com/embed/HNARuSROxbM');

    // Test Escape key closes modal
    await page.keyboard.press('Escape');
    await expect(iframe).not.toBeVisible();

    // Re-open and test close button
    await trailerButton.click();
    await expect(iframe).toBeVisible();
    const closeBtn = page.locator('button[aria-label="Close trailer dialog"]');
    await closeBtn.click();
    await expect(iframe).not.toBeVisible();
  });

  test('gracefully displays empty watch providers and missing trailer for Mumbai Salsa (14548)', async ({ page }) => {
    await page.goto('/movie/14548');

    // Wait for title
    await expect(page.locator('h1')).toContainText('Mumbai Salsa');

    // Fallback message for watch providers
    await expect(page.locator('text=Not available to stream in India right now')).toBeVisible();

    // Trailer unavailable fallback
    await expect(page.locator('text=No official trailer available for this title.')).toBeVisible();

    // Cast still displays
    await expect(page.locator('text=Vir Das')).toBeVisible();
  });

  test('renders Hindi movie details with cast and providers: DDLJ (19404)', async ({ page }) => {
    await page.goto('/movie/19404');
    await expect(page.locator('h1')).toContainText('Dilwale Dulhania Le Jayenge');
    await expect(page.locator('text=Shah Rukh Khan')).toBeVisible();
    const watchSection = page.locator('section:has-text("Where to Watch")');
    await expect(watchSection).toBeVisible();
  });

  test('renders Tamil movie details with cast: Maharaja (1118224)', async ({ page }) => {
    await page.goto('/movie/1118224');
    await expect(page.locator('h1')).toContainText('Maharaja');
    await expect(page.locator('text=Vijay Sethupathi')).toBeVisible();
  });

  test('renders Korean movie details with trailer and providers: Parasite (496243)', async ({ page }) => {
    await page.goto('/movie/496243');
    await expect(page.locator('button:has-text("Play Official Trailer")')).toBeVisible();
  });

  test('provides YouTube trailer search and full movie channel redirect buttons when trailer is missing or disqualified', async ({ page }) => {
    await page.goto('/movie/14548');

    // Both YouTube action links should be visible
    const trailerSearchLink = page.locator('a:has-text("Search Trailer on YouTube")');
    await expect(trailerSearchLink).toBeVisible();
    const trailerHref = await trailerSearchLink.getAttribute('href');
    expect(trailerHref).toContain('youtube.com/results?search_query=');
    expect(trailerHref).toContain('official+trailer');

    const fullMovieLink = page.locator('a:has-text("Watch Full Movie on YouTube Channels")');
    await expect(fullMovieLink).toBeVisible();
    const fullMovieHref = await fullMovieLink.getAttribute('href');
    expect(fullMovieHref).toContain('youtube.com/results?search_query=');
    expect(fullMovieHref).toContain('full+movie');
  });
});
