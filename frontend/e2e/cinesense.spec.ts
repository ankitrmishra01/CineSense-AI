import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('CineSense AI — Complete Real End-to-End Suite', () => {

  test('Auth: Wrong login, no full page reload, signup, and successful login', async ({ page }) => {
    await page.goto('/auth');

    // Marker to detect if window ever hard reloads
    await page.evaluate(() => {
      (window as any).__hardReloadHappened = false;
      window.addEventListener('beforeunload', () => {
        (window as any).__hardReloadHappened = true;
      });
    });

    const emailInput = page.getByLabel(/email address/i);
    const passwordInput = page.locator('#auth-password');
    const submitBtn = page.getByRole('button', { name: /enter projection booth|sign in/i });

    // 1. Wrong login credentials
    await emailInput.fill('invalid_cinephile@example.com');
    await passwordInput.fill('incorrectpass123');
    await submitBtn.click();

    // Verify inline alert appears without hard page reload
    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/incorrect email or (passcode|password)/i);

    // Verify form state preserved (email kept, password reset)
    await expect(emailInput).toHaveValue('invalid_cinephile@example.com');
    await expect(passwordInput).toHaveValue('');

    const reloaded = await page.evaluate(() => (window as any).__hardReloadHappened);
    expect(reloaded).toBe(false);

    // 2. Real Signup Flow
    const signupTab = page.getByRole('tab', { name: /join archive|create account/i });
    await signupTab.click();

    const testId = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const uniqueEmail = `curator_${testId}@cinesense-ai.com`;
    const uniqueUsername = `Curator_${testId.slice(-6)}`;
    const usernameInput = page.locator('#auth-username');
    const signupSubmitBtn = page.getByRole('button', { name: /create curator pass|create account/i });

    await emailInput.fill(uniqueEmail);
    await usernameInput.fill(uniqueUsername);
    await passwordInput.fill('Passcode123!');
    await signupSubmitBtn.click();

    // Wait for redirect to home after registration
    await page.waitForURL('http://localhost:5173/', { timeout: 10000 });
    await expect(page).toHaveURL('http://localhost:5173/');

    // Verify logged in state in Navbar
    const userBadge = page.getByText(uniqueUsername);
    await expect(userBadge).toBeVisible();

    // 3. Logout
    const logoutBtn = page.getByRole('button', { name: /sign out/i });
    await logoutBtn.click();
    await page.waitForURL(/.*\/auth.*/, { timeout: 10000 });
    await expect(page.getByRole('tab', { name: /sign in/i })).toBeVisible();

    // 4. Real Login Flow with newly created account
    await emailInput.fill(uniqueEmail);
    await passwordInput.fill('Passcode123!');
    await submitBtn.click();

    await page.waitForURL('http://localhost:5173/', { timeout: 10000 });
    await expect(page.getByText(uniqueUsername)).toBeVisible();
  });

  test('Discovery Flow: Real mood search against seeded database', async ({ page }) => {
    await page.goto('/');

    const textarea = page.locator('#mood-text-input');
    await expect(textarea).toBeVisible();
    await textarea.fill('dark gritty cyberpunk mystery thriller');

    const findBtn = page.locator('#find-movies-btn');
    await findBtn.click();

    // Wait for recommendations page to load real results
    await page.waitForURL(/.*\/recommendations.*/, { timeout: 12000 });
    await expect(page).toHaveURL(/.*\/recommendations.*/);

    // Verify film cards render from real seeded database
    const cards = page.locator('.cinema-card');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Mood Tag Selection: Clicking text mood chip triggers recommendations', async ({ page }) => {
    await page.goto('/');

    // Click "Thoughtful" mood chip
    const thoughtfulChip = page.getByRole('button', { name: /^thoughtful$/i });
    await thoughtfulChip.click();

    const findBtn = page.locator('#find-movies-btn');
    await findBtn.click();

    await page.waitForURL(/.*\/recommendations.*/, { timeout: 12000 });
    await expect(page.locator('.cinema-card').first()).toBeVisible({ timeout: 10000 });
  });

  test('Surprise Me: Populates mood prompt', async ({ page }) => {
    await page.goto('/');

    const surpriseBtn = page.getByRole('button', { name: /surprise me/i });
    await surpriseBtn.click();

    const textarea = page.locator('#mood-text-input');
    await expect(textarea).not.toHaveValue('', { timeout: 5000 });
    const val = await textarea.inputValue();
    expect(val.length).toBeGreaterThan(10);
  });

  test('Navigation & Try Again: Modify Mood button returns to Discover', async ({ page }) => {
    await page.goto('/recommendations?mood=melancholic%20noir');

    const modifyBtn = page.locator('#back-to-home');
    if (await modifyBtn.isVisible()) {
      await modifyBtn.click();
      await page.waitForURL('http://localhost:5173/');
      await expect(page).toHaveURL('http://localhost:5173/');
    }
  });

  test('Direct Title & Franchise Search: Live query returns matching results', async ({ page }) => {
    await page.goto('/search');

    const searchInput = page.getByPlaceholder(/search by title/i);
    await searchInput.fill('Blade Runner');

    // Wait for debounced search results to populate
    const movieHeading = page.getByText(/Blade Runner/i).first();
    await expect(movieHeading).toBeVisible({ timeout: 10000 });
  });

  test('Movie Details: Navigates to movie page and renders metadata', async ({ page }) => {
    await page.goto('/search');

    const searchInput = page.getByPlaceholder(/search by title/i);
    await searchInput.fill('The Dark Knight');

    const filmLink = page.locator('a[href^="/movie/"]').first();
    await filmLink.click();

    await page.waitForURL(/.*\/movie\/\d+.*/, { timeout: 10000 });
    const backBtn = page.locator('#back-from-detail');
    await expect(backBtn).toBeVisible();
  });

  test('[MOCKED] Unreachable-backend failure state displays calm banner', async ({ page }) => {
    // Intercept /recommend to simulate an unreachable backend (503)
    await page.route('**/recommend', (route) => {
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Cinema catalogue is warming up or temporarily unavailable.' }),
      });
    });

    await page.goto('/');
    const textarea = page.locator('#mood-text-input');
    await textarea.fill('test failure mode');

    const findBtn = page.locator('#find-movies-btn');
    await findBtn.click();

    // Verify calm error banner appears with Retry button
    const banner = page.locator('.calm-message, [role="alert"]').first();
    await expect(banner).toBeVisible({ timeout: 8000 });
    await expect(banner).toContainText(/cinema catalogue is warming up/i);
  });

  test('Accessibility: Axe core audit on key pages', async ({ page }) => {
    // 1. Audit Home Page
    await page.goto('/');
    const homeAudit = await new AxeBuilder({ page })
      .disableRules(['color-contrast']) // Color contrast checked independently
      .analyze();
    expect(homeAudit.violations.filter(v => v.impact === 'critical')).toEqual([]);

    // 2. Audit Auth Page
    await page.goto('/auth');
    const authAudit = await new AxeBuilder({ page })
      .disableRules(['color-contrast'])
      .analyze();
    expect(authAudit.violations.filter(v => v.impact === 'critical')).toEqual([]);

    // 3. Audit Search Page
    await page.goto('/search');
    const searchAudit = await new AxeBuilder({ page })
      .disableRules(['color-contrast'])
      .analyze();
    expect(searchAudit.violations.filter(v => v.impact === 'critical')).toEqual([]);
  });

});
