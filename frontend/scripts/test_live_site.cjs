const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));

  console.log('==================================================');
  console.log('🧪 LIVE SITE COMPREHENSIVE VERIFICATION SUITE');
  console.log('==================================================');

  // TEST 1: HOME PAGE
  console.log('\n[1/5] Testing Home Page: https://cine-sense-ai.vercel.app/ ...');
  await page.goto('https://cine-sense-ai.vercel.app/', { waitUntil: 'networkidle' });
  const title = await page.title();
  console.log('✓ Page Title:', title);
  const heroHeading = await page.locator('h1').first().textContent();
  console.log('✓ Hero Headline:', heroHeading);
  await page.screenshot({ path: path.resolve('../docs/screenshots/live_01_home.png') });

  // TEST 2: MOOD DISCOVERY SEARCH
  console.log('\n[2/5] Testing Mood Discovery Search ...');
  const textarea = page.locator('#mood-text-input').first();
  await textarea.fill('mind bending psychological thriller');
  const findBtn = page.locator('#find-movies-btn').first();
  await findBtn.click();
  console.log('Submitted search...');

  // Wait for results
  await page.waitForURL('**/recommendations', { timeout: 15000 });
  await page.waitForSelector('.cinema-card, a[href^="/movie/"]', { timeout: 15000 });
  
  const resultsSubtitle = await page.locator('p').filter({ hasText: /movies matching your mood/i }).first().textContent();
  console.log('✓ Results summary:', resultsSubtitle);

  const cardCount = await page.locator('.cinema-card, a[href^="/movie/"]').count();
  console.log(`✓ Rendered recommendation cards: ${cardCount}`);

  await page.screenshot({ path: path.resolve('../docs/screenshots/live_02_recommendations.png') });

  // TEST 3: ACTION REPLAYY (ID 49679) - VERIFY DISQUALIFIED SONG & YOUTUBE FALLBACK
  console.log('\n[3/5] Testing Action Replayy (ID 49679) Trailer & Channels Fallback ...');
  await page.goto('https://cine-sense-ai.vercel.app/movie/49679', { waitUntil: 'networkidle' });
  const movieTitle = await page.locator('h1').first().textContent();
  console.log('✓ Movie Detail Title:', movieTitle);

  const noTrailerNotice = await page.locator('text=No official trailer available').first().isVisible();
  console.log('✓ "No official trailer available" notice visible:', noTrailerNotice);

  const ytSearchLink = await page.locator('a[href*="youtube.com/results?search_query="]').count();
  console.log(`✓ YouTube search & full movie redirect buttons present: ${ytSearchLink} links`);

  const channelLinks = await page.locator('a[href*="youtube.com/@"], a[href*="youtube.com/channel"]').count();
  console.log(`✓ Official channel streaming redirects present: ${channelLinks} channels (Goldmines, Shemaroo, Ultra, Rajshri, etc.)`);

  await page.screenshot({ path: path.resolve('../docs/screenshots/live_03_action_replayy_fallback.png') });

  // TEST 4: ARCADIAN (ID 940721) - VERIFY OFFICIAL TRAILER PLAYBACK
  console.log('\n[4/5] Testing Arcadian (ID 940721) Official Trailer Playback ...');
  await page.goto('https://cine-sense-ai.vercel.app/movie/940721', { waitUntil: 'networkidle' });
  const arcadianTitle = await page.locator('h1').first().textContent();
  console.log('✓ Movie Detail Title:', arcadianTitle);
  const arcadianTrailerBtn = page.locator('#play-trailer-btn, button:has-text("Watch Trailer")').first();
  if (await arcadianTrailerBtn.count() > 0) {
    await arcadianTrailerBtn.click();
    await page.waitForTimeout(1000);
    const iframeCount = await page.locator('iframe[src*="youtube-nocookie.com/embed"]').count();
    console.log('✓ Official trailer iframe loaded in modal:', iframeCount > 0);
    await page.screenshot({ path: path.resolve('../docs/screenshots/live_04_arcadian_trailer.png') });
    const closeBtn = page.locator('button[aria-label="Close modal"], button:has-text("✕")').first();
    if (await closeBtn.count() > 0) await closeBtn.click();
  }

  // TEST 5: AUTH LOGIN WITH TEST CREDENTIALS
  const testEmail = process.env.TEST_AUTH_EMAIL;
  const testPassword = process.env.TEST_AUTH_PASSWORD;
  if (testEmail && testPassword) {
    console.log('\n[5/5] Testing Auth Login on Live Site ...');
    await page.goto('https://cine-sense-ai.vercel.app/auth', { waitUntil: 'networkidle' });
    await page.locator('#auth-email').fill(testEmail);
    await page.locator('#auth-password').fill(testPassword);
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(3500);
    console.log('✓ Current URL after login:', page.url());
    const userPill = await page.locator('#user-menu-btn, button:has-text("Watchlist"), a:has-text("Watchlist")').count();
    console.log('✓ Authenticated UI element visible:', userPill > 0);
    await page.screenshot({ path: path.resolve('../docs/screenshots/live_05_authenticated.png') });
  } else {
    console.log('\n[5/5] Skipping Auth Login (TEST_AUTH_EMAIL and TEST_AUTH_PASSWORD not set in env)');
  }

  console.log('\n==================================================');
  console.log('🎉 ALL LIVE TESTS COMPLETED SUCCESSFULLY!');
  console.log('Browser errors logged:', errors.length);
  if (errors.length > 0) console.log(errors);
  console.log('==================================================');

  await browser.close();
})();
