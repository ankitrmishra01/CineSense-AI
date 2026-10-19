import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/ankit/.gemini/antigravity/brain/e85a2ba9-ab32-4392-9db4-86c39d9a6f75';
const DOCS_DIR = 'C:/Users/ankit/OneDrive/Desktop/CineSense-AI/docs/screenshots';

fs.mkdirSync(DOCS_DIR, { recursive: true });

async function saveScreenshot(page, filename) {
  const docsPath = path.join(DOCS_DIR, filename);
  const artifactPath = path.join(ARTIFACT_DIR, filename);
  await page.screenshot({ path: docsPath, fullPage: false });
  fs.copyFileSync(docsPath, artifactPath);
  console.log(`Saved screenshot: ${filename}`);
}

async function run() {
  const browser = await chromium.launch({ headless: true });

  const viewports = [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ];

  const themes = ['dark', 'light'];

  for (const vp of viewports) {
    for (const theme of themes) {
      console.log(`Starting ${vp.name} [${theme}]...`);
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 2,
      });
      const page = await context.newPage();

      // Go to Home Page
      await page.goto('http://localhost:5173/');
      await page.waitForLoadState('networkidle');

      // Set Theme
      await page.evaluate((t) => {
        document.documentElement.setAttribute('data-theme', t);
        localStorage.setItem('theme', t);
        window.dispatchEvent(new Event('themechange'));
      }, theme);
      await page.waitForTimeout(400);

      // 1. Home Page Screenshot
      await saveScreenshot(page, `home_${vp.name}_${theme}.png`);

      // 2. Language Picker Modal Screenshot
      const langBtn = page.locator('#language-picker-btn');
      if (await langBtn.isVisible()) {
        await langBtn.click();
        await page.waitForSelector('#language-picker-title', { timeout: 5000 });
        await page.waitForTimeout(400);
        await saveScreenshot(page, `modal_languages_${vp.name}_${theme}.png`);

        // Close modal
        const closeBtn = page.locator('button[aria-label="Close"]');
        if (await closeBtn.isVisible()) {
          await closeBtn.click();
          await page.waitForTimeout(300);
        }
      }

      // 3. Find My Movies -> Recommendations Page Screenshot
      const moodInput = page.locator('textarea#mood-text-input, textarea');
      if (await moodInput.isVisible()) {
        await moodInput.fill('Soul-stirring Malayalam and Hindi slice-of-life drama');
      }
      const findBtn = page.locator('#find-movies-btn');
      await findBtn.click();

      // Wait for recommendations page to load results
      await page.waitForURL('**/recommendations**', { timeout: 15000 });
      await page.waitForSelector('.cinema-card', { timeout: 15000 });
      await page.waitForTimeout(800);

      // Recommendations Page Screenshot
      await saveScreenshot(page, `recommendations_${vp.name}_${theme}.png`);

      await context.close();
    }
  }

  await browser.close();
  console.log('All screenshots captured successfully.');
}

run().catch((err) => {
  console.error('Error capturing screenshots:', err);
  process.exit(1);
});
