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

  const movies = [
    { name: 'details_with_providers', path: '/movie/1051896' }, // Arcadian
    { name: 'details_empty_providers', path: '/movie/14548' },   // Mumbai Salsa
  ];

  const viewports = [
    { width: 390, height: 844, name: '390' },
    { width: 1440, height: 900, name: '1440' },
  ];

  const themes = ['dark', 'light'];

  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });

    for (const theme of themes) {
      for (const m of movies) {
        await page.goto(`${BASE_URL}${m.path}`, { waitUntil: 'networkidle' });

        await page.evaluate(({ t }) => {
          document.documentElement.setAttribute('data-theme', t);
          document.documentElement.setAttribute('data-palette', 'ember');
        }, { t: theme });

        // Wait for hydration & image loading
        await page.waitForTimeout(600);

        const filename = `${m.name}_${vp.name}_${theme}.png`;
        const filepath = path.join(SCREENSHOT_DIR, filename);
        await page.screenshot({ path: filepath, fullPage: false });
        console.log(`Saved screenshot: ${filepath}`);

        const artifactPath = path.join(ARTIFACT_DIR, filename);
        fs.copyFileSync(filepath, artifactPath);
      }
    }
  }

  // Also capture the trailer modal open state on desktop dark
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE_URL}/movie/1051896`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.setAttribute('data-palette', 'ember');
  });
  await page.waitForTimeout(400);
  const playBtn = page.locator('#play-trailer-btn');
  if (await playBtn.isVisible()) {
    await playBtn.click();
    await page.waitForTimeout(600);
    const modalFilename = 'details_trailer_modal_1440_dark.png';
    const modalPath = path.join(SCREENSHOT_DIR, modalFilename);
    await page.screenshot({ path: modalPath, fullPage: false });
    console.log(`Saved modal screenshot: ${modalPath}`);
    fs.copyFileSync(modalPath, path.join(ARTIFACT_DIR, modalFilename));
  }

  await browser.close();
  console.log('All Movie Details screenshots captured successfully.');
}

capture().catch((err) => {
  console.error('Error capturing details screenshots:', err);
  process.exit(1);
});
