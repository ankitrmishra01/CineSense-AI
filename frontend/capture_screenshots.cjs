const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const outputDir = path.resolve(__dirname, '../docs/screenshots');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const viewports = [
  { name: 'desktop', width: 1440, height: 900, isMobile: false },
  { name: 'mobile', width: 390, height: 844, isMobile: true },
];

const themes = ['dark', 'light'];

const pages = [
  { name: 'home', path: '/' },
  { name: 'results', path: '/recommendations?mood=melancholic%20noir' },
  { name: 'movie-details', path: '/movie/1561726' },
  { name: 'watchlist', path: '/watchlist' },
  { name: 'auth', path: '/auth' },
  { name: '404', path: '/not-found-404-test' },
];

async function capture() {
  console.log('Launching Chromium for screenshot capture...');
  const browser = await chromium.launch();

  for (const vp of viewports) {
    for (const theme of themes) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.isMobile,
        colorScheme: theme,
      });

      const page = await context.newPage();

      for (const p of pages) {
        const url = `http://localhost:5173${p.path}`;
        console.log(`Capturing: ${p.name} [${vp.name}] [${theme}] -> ${url}`);

        try {
          // Set initial localStorage theme before load
          await page.addInitScript((th) => {
            window.localStorage.setItem('theme', th);
            document.documentElement.setAttribute('data-theme', th);
          }, theme);

          await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {
            console.log(`Network idle timed out for ${url}, continuing...`);
          });

          // Ensure data-theme is correctly set
          await page.evaluate((th) => {
            document.documentElement.setAttribute('data-theme', th);
            window.localStorage.setItem('theme', th);
          }, theme);

          // Give Framer Motion animations 600ms to complete
          await page.waitForTimeout(700);

          const filename = `${p.name}-${vp.name}-${theme}.png`;
          const filePath = path.join(outputDir, filename);

          await page.screenshot({ path: filePath, fullPage: false });
          console.log(`Saved: ${filename}`);
        } catch (err) {
          console.error(`Error capturing ${p.name} (${vp.name}, ${theme}):`, err.message);
        }
      }

      await context.close();
    }
  }

  await browser.close();
  console.log('All screenshots captured successfully in docs/screenshots/');
}

capture().catch((err) => {
  console.error('Fatal capture error:', err);
  process.exit(1);
});
