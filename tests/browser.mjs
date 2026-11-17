import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const base = process.env.TEST_URL || 'http://127.0.0.1:4321';
const artifacts = '.local/browser';
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
const results = [];
const run = async (name, fn) => {
  try { await fn(); results.push({ name, passed: true }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, passed: false, error: error.message }); console.error(`FAIL ${name}: ${error.message}`); }
};
const newPage = async (options = {}) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light', reducedMotion: 'reduce', ...options });
  const page = await context.newPage();
  await page.goto(base, { waitUntil: 'networkidle' });
  return { page, context };
};
try {
  for (const colorScheme of ['light', 'dark']) {
    for (const width of [360, 390, 430, 768, 1024, 1440, 1920]) {
      await run(`${colorScheme} layout at ${width}px`, async () => {
        const { page, context } = await newPage({ viewport: { width, height: width < 768 ? 844 : 1000 }, colorScheme });
        try {
          const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
          assert.ok(dimensions.scroll <= dimensions.viewport, JSON.stringify(dimensions));
          assert.equal(await page.locator('.menu-toggle').isVisible(), width <= 600);
          assert.equal(await page.locator('h1').count(), 1);
          const clippedButtons = await page.locator('button:visible, a.button:visible').evaluateAll(buttons => buttons.filter(button => button.scrollWidth > button.clientWidth + 1).map(button => button.textContent));
          assert.deepEqual(clippedButtons, [], 'Button labels must fit their controls');
          assert.equal(await page.locator('.lamp-image').evaluate(image => image.complete && image.naturalWidth > 0), true);
          if (width === 390) {
            const cta = await page.locator('.hero-action .button').boundingBox();
            assert.ok(cta.y + cta.height < 844, 'Primary action must fit first mobile screen');
          }
          await page.screenshot({ path: `${artifacts}/${colorScheme}-${width}.png`, fullPage: true });
          if ([390, 1440].includes(width)) {
            const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
            await writeFile(`${artifacts}/axe-${colorScheme}-${width}.json`, JSON.stringify(audit.violations, null, 2));
            assert.equal(audit.violations.length, 0, audit.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target).join(', ')}`).join('\n'));
          }
        } finally { await context.close(); }
      });
    }
  }
  await run('form validation, prepared draft, channel handoff and stale draft prevention', async () => {
    const { page, context } = await newPage();
    try {
      const external = [];
      page.on('request', request => { if (!request.url().startsWith(base)) external.push(request.url()); });
      await page.locator('#prepare-inquiry').click();
      assert.equal(await page.locator('#inquiry-name').getAttribute('aria-invalid'), 'true');
      assert.equal(await page.locator('#inquiry-name').evaluate(el => el === document.activeElement), true);
      await page.locator('#inquiry-name').fill('Анна');
      await page.locator('#inquiry-contact').fill('incorrect');
      await page.locator('#inquiry-project').selectOption('Лендинг');
      await page.locator('#prepare-inquiry').click();
      assert.equal(await page.locator('#inquiry-contact').getAttribute('aria-invalid'), 'true');
      await page.locator('#inquiry-contact').fill('@annatest');
      await page.locator('#inquiry-comment').fill('Нужен сайт для студии & запись на услуги.');
      await page.locator('#prepare-inquiry').click();
      assert.equal(await page.locator('#inquiry-draft').isVisible(), true);
      assert.equal(await page.locator('#draft-title').evaluate(el => el === document.activeElement), true);
      const telegram = new URL(await page.locator('#draft-open').getAttribute('href'));
      assert.equal(telegram.href.startsWith('https://t.me/kitsoe?text='), true);
      assert.equal(telegram.searchParams.get('text'), await page.locator('#draft-text').inputValue());
      await page.locator('#channel-email').check();
      assert.equal(await page.locator('#inquiry-draft').isVisible(), false);
      await page.locator('#prepare-inquiry').click();
      const mail = new URL(await page.locator('#draft-open').getAttribute('href'));
      assert.equal(mail.protocol, 'mailto:');
      assert.equal(mail.pathname, 'pimakarima@gmail.com');
      assert.equal(mail.searchParams.get('body'), await page.locator('#draft-text').inputValue());
      await page.locator('#inquiry-name').fill('Анна Мария');
      assert.equal(await page.locator('#inquiry-draft').isVisible(), false);
      assert.deepEqual(external, [], 'Form must not transmit requests');
    } finally { await context.close(); }
  });
  await run('copy failure selects the draft and provides a usable fallback', async () => {
    const { page, context } = await newPage();
    try {
      await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('Denied for test')) }, configurable: true }));
      await page.locator('#inquiry-name').fill('Иван');
      await page.locator('#inquiry-contact').fill('ivan@example.com');
      await page.locator('#inquiry-project').selectOption('Пока не знаю');
      await page.locator('#prepare-inquiry').click();
      await page.locator('#draft-copy').click();
      await page.waitForFunction(() => document.querySelector('#copy-status').textContent.includes('вручную'));
      assert.equal(await page.locator('#draft-text').evaluate(el => { const textarea = /** @type {HTMLTextAreaElement} */ (el); return textarea.selectionEnd - textarea.selectionStart === textarea.value.length; }), true);
    } finally { await context.close(); }
  });
  await run('theme follows system, persists preference, syncs tabs and survives blocked storage', async () => {
    const { page, context } = await newPage();
    try {
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
      const second = await context.newPage(); await second.goto(base);
      await page.locator('.theme-toggle').click();
      await second.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
      await page.reload(); assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
      await page.locator('.theme-toggle').click();
      assert.equal(await page.evaluate(() => localStorage.getItem('kitsoe-theme')), null);
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
      await context.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new Error('Blocked for test'); } }));
      await page.reload(); await page.locator('.theme-toggle').click();
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    } finally { await context.close(); }
  });
  await run('mobile menu keyboard, Escape, return focus and anchor navigation', async () => {
    const { page, context } = await newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    try {
      await page.locator('.menu-toggle').focus(); await page.keyboard.press('Enter');
      assert.equal(await page.locator('#mobile-menu').evaluate(el => el.matches(':modal')), true);
      for (let i = 0; i < 9; i++) { await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement === document.body || !!document.activeElement.closest('#mobile-menu')), true); }
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.querySelector('.menu-toggle').getAttribute('aria-expanded') === 'false');
      assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'false');
      assert.equal(await page.locator('.menu-toggle').evaluate(el => el === document.activeElement), true);
      await page.locator('.menu-toggle').click();
      await page.locator('#mobile-menu a[href="#contact"]').click();
      assert.equal(await page.locator('#mobile-menu').isVisible(), false);
      assert.equal(new URL(page.url()).hash, '#contact');
    } finally { await context.close(); }
  });
  await run('demonstrations and FAQ work with keyboard', async () => {
    const { page, context } = await newPage();
    try {
      await page.locator('.light-switch').focus(); await page.keyboard.press('Space');
      assert.equal(await page.locator('[data-lamp]').getAttribute('data-lit'), 'false');
      await page.locator('#surface-graphite').check();
      assert.equal(await page.locator('[data-lamp]').getAttribute('data-surface'), 'graphite');
      await page.locator('#brightness').focus(); await page.keyboard.press('ArrowRight');
      assert.equal(await page.locator('#brightness-value').textContent(), '71%');
      await page.locator('[data-day="Сегодня"]').click(); await page.locator('[data-slot="15:00"]').click();
      assert.match(await page.locator('[data-booking-result]').textContent(), /сегодня, 15:00/);
      await page.locator('[data-tasks] input').nth(1).check(); await page.locator('[data-tasks] input').nth(2).check();
      assert.equal(await page.locator('#demo-progress').getAttribute('value'), '3');
      const summary = page.locator('.faq-list summary').first(); await summary.focus(); await page.keyboard.press('Enter');
      assert.equal(await page.locator('.faq-list details').first().getAttribute('open'), '');
      await page.keyboard.press('Enter'); assert.equal(await page.locator('.faq-list details').first().getAttribute('open'), null);
    } finally { await context.close(); }
  });
  await run('normal motion reveals once; reduced motion exposes final text', async () => {
    const { page, context } = await newPage({ reducedMotion: 'no-preference' });
    try {
      const section = page.locator('[data-reveal]').first();
      await section.scrollIntoViewIfNeeded();
      await page.waitForFunction(() => document.querySelector('[data-reveal]').classList.contains('is-visible'));
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      assert.equal(await section.evaluate(el => el.classList.contains('is-visible')), true);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      assert.equal(await page.locator('.word-reveal span[aria-hidden]').first().evaluate(el => getComputedStyle(el).opacity), '1');
    } finally { await context.close(); }
  });
  await run('no JavaScript and forced colors keep content and direct contact available', async () => {
    const { page, context } = await newPage({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    try {
      assert.equal(await page.locator('h1').isVisible(), true);
      assert.equal(await page.locator('.theme-toggle').isVisible(), false);
      assert.equal(await page.locator('a[href="https://t.me/kitsoe"]').first().isVisible(), true);
      assert.equal(await page.locator('#prepare-inquiry').isDisabled(), true);
    } finally { await context.close(); }
    const forced = await newPage({ forcedColors: 'active' });
    try { assert.notEqual(await forced.page.locator('h1').evaluate(el => getComputedStyle(el).color), 'rgba(0, 0, 0, 0)'); }
    finally { await forced.context.close(); }
  });
  await run('routes, metadata, links, no external assets and no console errors', async () => {
    const context = await browser.newContext(); const page = await context.newPage();
    const errors = [], external = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (!request.url().startsWith(base)) external.push(request.url()); });
    try {
      for (const route of ['/', '/privacy/', '/terms/', '/404/']) {
        const response = await page.goto(base + route, { waitUntil: 'networkidle' });
        assert.ok([200, 404].includes(response.status()));
        assert.ok((await page.title()).includes('kitsoe'));
        assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex, nofollow');
        const broken = await page.locator('a[href^="#"]').evaluateAll(links => links.map(link => link.getAttribute('href')).filter(href => !document.getElementById(href.slice(1))));
        assert.deepEqual(broken, []);
      }
      assert.match(await (await page.request.get(base + '/robots.txt')).text(), /Disallow: \//);
      assert.deepEqual(errors, []); assert.deepEqual(external, []);
    } finally { await context.close(); }
  });
} finally {
  await browser.close();
  await writeFile(`${artifacts}/results.json`, JSON.stringify({ base, testedAt: new Date().toISOString(), results }, null, 2));
}
if (results.some(result => !result.passed)) process.exitCode = 1;
