import { test, expect } from '@playwright/test';

test.describe('Hero Responsiveness, Multilingual Text & First-Screen Fold Tests', () => {
  const VIEWPORTS = [
    { width: 360, height: 740, name: '360px (Small Mobile)' },
    { width: 390, height: 844, name: '390px (iPhone 12/13/14)' },
    { width: 768, height: 1024, name: '768px (iPad/Tablet)' },
    { width: 1024, height: 768, name: '1024px (Small Desktop/Landscape)' },
    { width: 1366, height: 768, name: '1366px (Standard Laptop)' },
    { width: 1440, height: 900, name: '1440px (MacBook / Desktop)' },
    { width: 1920, height: 1080, name: '1920px (Full HD)' },
  ];

  for (const vp of VIEWPORTS) {
    for (const theme of ['dark', 'light']) {
      test(`Headline stays inside viewport at ${vp.name} [${theme} theme]`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto('/');

        await page.evaluate((t) => {
          document.documentElement.setAttribute('data-theme', t);
        }, theme);

        const headline = page.locator('h1').first();
        await expect(headline).toBeVisible();

        // 1. Verify headline element does not overflow viewport width
        const box = await headline.boundingBox();
        expect(box).not.toBeNull();
        if (box) {
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 2); // 2px margin of error for subpixel rendering
        }

        // 2. Verify page has NO horizontal scrollbar
        const hasHorizontalScroll = await page.evaluate(() => {
          return document.documentElement.scrollWidth > window.innerWidth;
        });
        expect(hasHorizontalScroll).toBe(false);
      });
    }
  }

  test('Headline scales cleanly with browser zoom at 150% and 200%', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/');

    for (const zoom of ['1.5', '2.0']) {
      await page.evaluate((z) => {
        (document.body.style as any).zoom = z;
      }, zoom);

      const headline = page.locator('h1').first();
      await expect(headline).toBeVisible();

      const box = await headline.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(1366 + 5);
      }

      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      expect(hasHorizontalScroll).toBe(false);
    }
  });

  test('Headline accommodates longer multilingual text (Hindi & Tamil) without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const longPhrases = [
      'आज रात आप कैसा महसूस कर रहे हैं?', // Hindi
      'இன்று இரவு நீங்கள் எப்படி உணர்கிறீர்கள்?', // Tamil
      'ఈ రాత్రి మీరు ఎలా భావిస్తున్నారు?', // Telugu
    ];

    for (const phrase of longPhrases) {
      await page.evaluate((text) => {
        const h1 = document.querySelector('h1');
        if (h1) h1.textContent = text;
      }, phrase);

      const headline = page.locator('h1').first();
      await expect(headline).toHaveText(phrase);

      const box = await headline.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(390 + 2);
      }

      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      expect(hasHorizontalScroll).toBe(false);
    }
  });

  test('First-Screen Budget: Mood search is visible on first screen at 1366x768 without scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/');

    const findBtn = page.locator('#find-movies-btn');
    await expect(findBtn).toBeVisible();

    const box = await findBtn.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      // Find movies button must be strictly above the fold (768px)
      expect(box.y + box.height).toBeLessThanOrEqual(768);
    }

    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBe(0);
  });

  test('First-Screen Budget: Mood search is visible on first screen at 390x844 without scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const findBtn = page.locator('#find-movies-btn');
    await expect(findBtn).toBeVisible();

    const box = await findBtn.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      // Find movies button must be strictly above the fold (844px)
      expect(box.y + box.height).toBeLessThanOrEqual(844);
    }

    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBe(0);
  });
});
