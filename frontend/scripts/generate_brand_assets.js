import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const PUBLIC_DIR = 'C:/Users/ankit/OneDrive/Desktop/CineSense-AI/frontend/public';

const ICON_HTML = `
<!DOCTYPE html>
<html>
<head>
<style>
  body { margin: 0; padding: 0; background: transparent; display: flex; align-items: center; justify-content: center; width: 100vw; height: 100vh; overflow: hidden; }
  svg { width: 100%; height: 100%; }
</style>
</head>
<body>
  <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="7" fill="#090d14" />
    <path d="M16 4C9.37 4 4 9.37 4 16s5.37 12 12 12c3.32 0 6.35-1.35 8.54-3.54-4.8 0-8.69-3.89-8.69-8.69 0-3.77 2.4-6.97 5.79-8.18C19.85 5.14 18 4 16 4z" fill="#14b8a6"/>
    <path d="M23.5 10.5l1.1 2.6 2.6 1.1-2.6 1.1-1.1 2.6-1.1-2.6-2.6-1.1 2.6-1.1 1.1-2.6z" fill="#38bdf8"/>
  </svg>
</body>
</html>
`;

const OG_HTML = `
<!DOCTYPE html>
<html>
<head>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  body {
    margin: 0;
    padding: 0;
    width: 1200px;
    height: 630px;
    background: #090d14;
    color: #f8fafc;
    font-family: 'Inter', sans-serif;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
  }
  .glow {
    position: absolute;
    width: 700px;
    height: 700px;
    background: radial-gradient(circle, rgba(20, 184, 166, 0.18) 0%, transparent 70%);
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
  }
  .logo-box {
    margin-bottom: 24px;
    display: flex;
    align-items: center;
    gap: 20px;
  }
  .title {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: 84px;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin: 0;
  }
  .ai-badge {
    font-family: 'Inter', sans-serif;
    font-size: 24px;
    font-weight: 700;
    padding: 6px 18px;
    border-radius: 9999px;
    border: 2px solid #14b8a6;
    color: #14b8a6;
    letter-spacing: 0.08em;
    background: rgba(20, 184, 166, 0.1);
  }
  .subtitle {
    font-size: 26px;
    color: #94a3b8;
    margin-top: 12px;
    margin-bottom: 36px;
    max-width: 780px;
    text-align: center;
    line-height: 1.4;
  }
  .tag-row {
    display: flex;
    gap: 16px;
  }
  .tag {
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 6px 16px;
    border-radius: 9999px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid #22314b;
    color: #14b8a6;
  }
</style>
</head>
<body>
  <div class="glow"></div>
  <div class="logo-box">
    <svg width="88" height="88" viewBox="0 0 32 32" fill="none">
      <path d="M16 3C8.82 3 3 8.82 3 16s5.82 13 13 13c3.6 0 6.88-1.46 9.25-3.83-5.2 0-9.42-4.22-9.42-9.42 0-4.08 2.6-7.55 6.27-8.86C20.17 4.24 18.17 3 16 3z" fill="#14b8a6"/>
      <path d="M24 10l1.2 2.8L28 14l-2.8 1.2L24 18l-1.2-2.8L20 14l2.8-1.2L24 10z" fill="#38bdf8"/>
    </svg>
    <h1 class="title">CineSense</h1>
    <span class="ai-badge">AI</span>
  </div>
  <p class="subtitle">Describe a mood or a movie you loved. We'll find what fits.</p>
  <div class="tag-row">
    <span class="tag">Emotion-Aware Discovery</span>
    <span class="tag">14+ Languages</span>
    <span class="tag">Zero Tracking</span>
  </div>
</body>
</html>
`;

async function generate() {
  const browser = await chromium.launch({ headless: true });

  const iconSizes = [
    { name: 'favicon-16x16.png', size: 16 },
    { name: 'favicon-32x32.png', size: 32 },
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'android-chrome-192x192.png', size: 192 },
    { name: 'android-chrome-512x512.png', size: 512 },
  ];

  for (const item of iconSizes) {
    const page = await browser.newPage({
      viewport: { width: item.size, height: item.size },
      deviceScaleFactor: 1,
    });
    await page.setContent(ICON_HTML);
    const outPath = path.join(PUBLIC_DIR, item.name);
    await page.screenshot({ path: outPath, omitBackground: true });
    console.log(`Generated ${item.name} (${item.size}x${item.size})`);
    await page.close();
  }

  // Open Graph Image
  const ogPage = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await ogPage.setContent(OG_HTML);
  await ogPage.waitForLoadState('networkidle');
  const ogPath = path.join(PUBLIC_DIR, 'og-image.png');
  await ogPage.screenshot({ path: ogPath });
  console.log('Generated og-image.png (1200x630)');
  await ogPage.close();

  await browser.close();
  console.log('All brand assets successfully generated.');
}

generate().catch(err => {
  console.error(err);
  process.exit(1);
});
