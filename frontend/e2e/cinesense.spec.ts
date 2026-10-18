import { test, expect } from '@playwright/test';

const mockRecommendResponse = {
  session_id: 'session-e2e-test',
  query_summary: 'Atmospheric rainy cyberpunk mystery',
  total_results: 1,
  recommendations: [
    {
      movie: {
        id: 1561726,
        title: 'Blade Runner 2049',
        overview: 'A young blade runner unearths a long-buried secret that has the potential to plunge what is left of society into chaos.',
        tagline: 'There are still pages left in the book.',
        genres: [{ id: 878, name: 'Science Fiction' }],
        keywords: ['cyberpunk', 'noir', 'future'],
        poster_path: '/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg',
        backdrop_path: '/ilRyASD5v7G3Y1JvhY1wL47vW57.jpg',
        runtime: 164,
        vote_average: 8.0,
        vote_count: 12500,
        release_date: '2017-10-06',
        trailer_key: 'gCcx85zbxz4',
        watch_providers: null,
      },
      similarity_score: 0.94,
      match_percentage: 94,
      explanation: 'Matches your yearning for deep atmospheric rain, neon melancholia, and deliberate noir investigation.',
    },
  ],
};

test.describe('CineSense AI End-to-End Test Suite', () => {
  test('Auth Page: Tab keyboard navigation, inline alert on wrong credentials, and email retention', async ({ page }) => {
    await page.goto('http://localhost:5173/auth');

    const loginTab = page.getByRole('tab', { name: /sign in/i });
    const signupTab = page.getByRole('tab', { name: /join archive/i });

    // Initial state
    await expect(loginTab).toHaveAttribute('aria-selected', 'true');
    await expect(signupTab).toHaveAttribute('aria-selected', 'false');

    // Arrow navigation
    await loginTab.press('ArrowRight');
    await expect(signupTab).toHaveAttribute('aria-selected', 'true');
    await expect(loginTab).toHaveAttribute('aria-selected', 'false');

    await signupTab.press('ArrowLeft');
    await expect(loginTab).toHaveAttribute('aria-selected', 'true');

    // Enter wrong credentials
    const emailInput = page.getByLabel(/email address/i);
    const passwordInput = page.getByLabel(/^passcode$/i);
    const submitBtn = page.getByRole('button', { name: /enter projection booth/i });

    await emailInput.fill('cinephile_test@example.com');
    await passwordInput.fill('wrongpassword123');
    await submitBtn.click();

    // Verify inline alert appears
    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();

    // Verify email was retained and password was cleared
    await expect(emailInput).toHaveValue('cinephile_test@example.com');
    await expect(passwordInput).toHaveValue('');
  });

  test('Discovery Flow: Mood input, inspiration chips, and recommendation navigation', async ({ page }) => {
    // Intercept /recommend network request with valid mock response
    await page.route('**/recommend', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockRecommendResponse),
      });
    });

    await page.goto('http://localhost:5173/');

    // Check heading
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/How are you feeling/i);

    // Type mood prompt into textarea
    const textarea = page.locator('#mood-text-input');
    await expect(textarea).toBeVisible();
    await textarea.fill('Atmospheric rainy cyberpunk mystery');
    await expect(textarea).toHaveValue('Atmospheric rainy cyberpunk mystery');

    // Click "Find My Movies" button
    const findBtn = page.locator('#find-movies-btn');
    await expect(findBtn).toBeVisible();
    await findBtn.click();

    // Verify navigation to /recommendations
    await page.waitForURL(/.*\/recommendations.*/, { timeout: 10000 });
    await expect(page).toHaveURL(/.*\/recommendations.*/);

    // Verify recommended film card renders
    await expect(page.getByText(/Blade Runner 2049/i)).toBeVisible();
  });

  test('404 Page: Renders classic error page and navigates back to lobby', async ({ page }) => {
    await page.goto('http://localhost:5173/non-existent-reel-test');

    // Verify 404 heading
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Reel Missing from the Archives/i);

    // Click return link
    const lobbyLink = page.getByRole('link', { name: /return to cinema lobby/i });
    await expect(lobbyLink).toBeVisible();
    await lobbyLink.click();

    // Should return to /
    await page.waitForURL('http://localhost:5173/');
    await expect(page).toHaveURL('http://localhost:5173/');
  });
});
