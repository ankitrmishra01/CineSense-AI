import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('WCAG 2.1 AA Color Contrast Automated Audit', () => {
  const PAGES = [
    { name: 'Home Page', path: '/' },
    { name: 'Recommendations Results', path: '/recommendations?mood=cozy%20mystery' },
    { name: 'Direct Search', path: '/search' },
    { name: 'Auth Page', path: '/auth' },
    { name: 'Watchlist Page', path: '/watchlist' },
  ];

  for (const p of PAGES) {
    for (const theme of ['dark', 'light']) {
      test(`${p.name} passes axe color-contrast in [${theme}] mode`, async ({ page }) => {
        await page.goto(p.path);

        // Apply theme
        await page.evaluate((t) => {
          document.documentElement.setAttribute('data-theme', t);
        }, theme);

        // Wait for network settle and render
        await page.waitForTimeout(600);

        // Run axe specifically targeting color-contrast rule
        const accessibilityScanResults = await new AxeBuilder({ page })
          .withRules(['color-contrast'])
          .analyze();

        if (accessibilityScanResults.violations.length > 0) {
          console.error(
            `Contrast violations on ${p.name} [${theme}]:`,
            JSON.stringify(accessibilityScanResults.violations, null, 2)
          );
        }

        expect(accessibilityScanResults.violations).toEqual([]);
      });
    }
  }
});
