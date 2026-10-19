import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = path.resolve('..', 'docs', 'screenshots');
const ARTIFACT_DIR = path.resolve('C:\\Users\\ankit\\.gemini\\antigravity\\brain\\e85a2ba9-ab32-4392-9db4-86c39d9a6f75');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function capture() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const BASE_URL = 'http://localhost:5173';

  // 1. Recommended Palette: Midnight Teal
  const pagesToCapture = [
    { name: 'home', path: '/' },
    { name: 'results', path: '/recommendations?mood=cozy%20mystery%20with%20rain' },
    { name: 'search', path: '/search?q=Blade%20Runner' },
    { name: 'auth', path: '/auth' },
    { name: 'watchlist', path: '/watchlist' },
    { name: 'details', path: '/movie/1051896' },
    { name: 'notfound', path: '/non-existent-page-404' },
  ];

  const viewports = [
    { width: 390, height: 844, name: '390' },
    { width: 1440, height: 900, name: '1440' },
  ];

  const themes = ['dark', 'light'];

  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });

    for (const theme of themes) {
      for (const p of pagesToCapture) {
        await page.goto(`${BASE_URL}${p.path}`, { waitUntil: 'networkidle' });

        await page.evaluate(({ t, pal }) => {
          document.documentElement.setAttribute('data-theme', t);
          document.documentElement.setAttribute('data-palette', pal);
        }, { t: theme, pal: 'midnight' });

        await page.waitForTimeout(400);

        const filename = `${p.name}_${vp.name}_${theme}_midnight.png`;
        const filepath = path.join(SCREENSHOT_DIR, filename);
        await page.screenshot({ path: filepath, fullPage: false });
        console.log(`Saved: ${filepath}`);

        // Also copy to artifact dir
        const artifactPath = path.join(ARTIFACT_DIR, filename);
        fs.copyFileSync(filepath, artifactPath);
      }
    }
  }

  // 2. Comparison palettes: Velvet and Indigo on Home screen
  const comparisonPalettes = ['velvet', 'indigo'];
  for (const pal of comparisonPalettes) {
    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const theme of themes) {
        await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });

        await page.evaluate(({ t, p }) => {
          document.documentElement.setAttribute('data-theme', t);
          document.documentElement.setAttribute('data-palette', p);
        }, { t: theme, p: pal });

        await page.waitForTimeout(400);

        const filename = `home_${vp.name}_${theme}_${pal}.png`;
        const filepath = path.join(SCREENSHOT_DIR, filename);
        await page.screenshot({ path: filepath, fullPage: false });
        console.log(`Saved: ${filepath}`);

        const artifactPath = path.join(ARTIFACT_DIR, filename);
        fs.copyFileSync(filepath, artifactPath);
      }
    }
  }

  // Reset to default midnight
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-palette', 'midnight');
  });

  await browser.close();
  console.log('All overhaul screenshots captured successfully.');
}

capture().catch((err) => {
  console.error('Error capturing screenshots:', err);
  process.exit(1);
});
