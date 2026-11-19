import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, firefox, webkit } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { site } from '../src/config/site.ts';

const base = process.env.TEST_URL || 'http://127.0.0.1:4321';
const engines = new Map([['chromium', chromium], ['firefox', firefox], ['webkit', webkit]]);
const engineName = process.env.BROWSER_ENGINE || 'chromium';
const engine = engines.get(engineName);
if (!engine) throw new Error('BROWSER_ENGINE must be chromium, firefox or webkit');
const artifacts = engineName === 'chromium' ? '.local/browser' : `.local/browser/${engineName}`;
await mkdir(artifacts, { recursive: true });
const channel = engineName === 'chromium' ? process.env.BROWSER_CHANNEL || 'msedge' : undefined;
const browser = await engine.launch({ channel, headless: true });
const browserVersion = browser.version();
console.log(`Testing ${channel || engineName} ${browserVersion} at ${base}`);
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
          await page.locator('.lamp-image').scrollIntoViewIfNeeded();
          await page.waitForFunction(() => { const lamp = document.querySelector('.lamp-image'); return lamp.complete && lamp.naturalWidth > 0; });
          await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
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
      assert.equal(telegram.origin + telegram.pathname, `https://t.me/${site.telegram}`);
      assert.equal(telegram.searchParams.get('text'), await page.locator('#draft-text').inputValue());
      await page.locator('#channel-email').check();
      assert.equal(await page.locator('#inquiry-draft').isVisible(), false);
      await page.locator('#prepare-inquiry').click();
      const mail = new URL(await page.locator('#draft-open').getAttribute('href'));
      assert.equal(mail.protocol, 'mailto:');
      assert.equal(mail.pathname, site.email);
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
  await run('larger root text keeps navigation and content usable', async () => {
    const { page, context } = await newPage({ viewport: { width: 320, height: 800 } });
    try {
      assert.equal(await page.locator('meta[name="text-scale"]').getAttribute('content'), 'scale');
      // A larger browser default font is simulated for layout; this is not browser zoom.
      await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      for (const width of [320, 390, 768]) {
        await page.setViewportSize({ width, height: 900 });
        const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
        assert.ok(dimensions.scroll <= dimensions.viewport, `Text scaling at ${width}px: ${JSON.stringify(dimensions)}`);
        const toggle = page.locator('.menu-toggle');
        assert.equal(await toggle.isVisible(), true);
        const icon = await toggle.locator('span').first().boundingBox();
        assert.ok(icon.width >= 16 && icon.height >= 1, 'Menu icon must remain visible');
        await toggle.click();
        const menu = page.locator('#mobile-menu');
        assert.equal(await menu.evaluate(el => el.scrollWidth <= el.clientWidth), true);
        await page.keyboard.press('Escape');
        assert.equal(await menu.isVisible(), false);
      }
      await page.locator('.menu-toggle').click();
      await page.setViewportSize({ width: 1920, height: 1000 });
      await page.waitForFunction(() => !document.querySelector('#mobile-menu').open);
      assert.equal(await page.locator('.menu-toggle').isVisible(), false);
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
      const booking = page.locator('[data-booking]');
      await booking.getByRole('radio', { name: 'Завтра', exact: true }).press('ArrowRight');
      assert.equal(await booking.getByRole('radio', { name: 'Через 2 дня' }).isChecked(), true);
      assert.equal(await booking.getByRole('radio', { name: '11:30' }).count(), 0);
      assert.equal(await booking.locator('[name="booking-time"]:checked').count(), 0);
      assert.match(await booking.getByRole('status').textContent(), /Выберите время/);
      await page.keyboard.press('Tab');
      await page.keyboard.press('ArrowRight');
      assert.equal(await booking.getByRole('radio', { name: '13:00' }).isChecked(), true);
      assert.match(await booking.getByRole('status').textContent(), /через 2 дня, 13:00/);
      await page.locator('[data-tasks] input').nth(1).check(); await page.locator('[data-tasks] input').nth(2).check();
      assert.equal(await page.locator('#demo-progress').getAttribute('value'), '3');
      const summary = page.locator('.faq-list summary').first();
      assert.equal(await summary.locator('.faq-icon').getAttribute('aria-hidden'), 'true');
      await summary.focus(); await page.keyboard.press('Enter');
      assert.equal(await page.locator('.faq-list details').first().getAttribute('open'), '');
      await page.keyboard.press('Enter'); assert.equal(await page.locator('.faq-list details').first().getAttribute('open'), null);
    } finally { await context.close(); }
  });
  await run('theme wave starts at the toggle and recolors the selected lamp scene', async () => {
    const { page, context } = await newPage({ viewport: { width: 768, height: 900 }, reducedMotion: 'no-preference' });
    try {
      const button = page.locator('.theme-toggle');
      const stage = page.locator('.lamp-stage');
      const shell = page.locator('[data-lamp]');
      const cast = page.locator('.lamp-cast');
      await page.locator('#surface-chalk').check();
      await page.locator('#brightness').press('Home');
      await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.lamp-cast')).opacity) < .09);
      await page.locator('#brightness').press('End');
      await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.lamp-cast')).opacity) > .75);
      const lightStage = await stage.evaluate(el => getComputedStyle(el).backgroundColor);
      const lightShell = await shell.evaluate(el => getComputedStyle(el).backgroundImage);
      const bounds = await button.boundingBox();
      const supportsWave = await page.evaluate(() => typeof document.startViewTransition === 'function');
      await button.press('Enter');
      await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
      if (supportsWave) {
        const point = await page.evaluate(() => document.documentElement.style.getPropertyValue('--theme-wave-origin').match(/[\d.]+/g)?.map(Number));
        assert.ok(point && Math.abs(point[0] - bounds.x - bounds.width / 2) < 2 && Math.abs(point[1] - bounds.y - bounds.height / 2) < 2);
        const mask = await page.evaluate(() => getComputedStyle(document.documentElement, '::view-transition-new(root)').maskImage);
        assert.match(mask, /radial-gradient/);
        await page.waitForFunction(() => !document.documentElement.style.getPropertyValue('--theme-wave-origin'));
      }
      assert.equal(await button.evaluate(el => document.activeElement === el), true);
      assert.notEqual(await shell.evaluate(el => getComputedStyle(el).backgroundImage), lightShell);
      assert.notEqual(await stage.evaluate(el => getComputedStyle(el).backgroundColor), lightStage);
      assert.equal(await shell.getAttribute('data-surface'), 'chalk');
      assert.equal(await page.locator('#brightness').inputValue(), '100');
      await page.locator('.light-switch').click();
      await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.lamp-cast')).opacity) === 0);
      assert.equal(await cast.evaluate(el => getComputedStyle(el).opacity), '0');
    } finally { await context.close(); }
  });
  await run('live preview reflows with keyboard and retains the lamp settings', async () => {
    const { page, context } = await newPage();
    try {
      const slider = page.getByRole('slider', { name: 'Ширина витрины' });
      const stage = page.locator('.lamp-stage');
      const details = page.locator('.lamp-details');
      const wideStage = await stage.boundingBox();
      const wideDetails = await details.boundingBox();
      assert.ok(wideStage.x < wideDetails.x && wideStage.y + wideStage.height > wideDetails.y, 'Wide preview uses two columns');
      await page.locator('#surface-graphite').check();
      await slider.press('Home');
      assert.equal(await slider.getAttribute('aria-valuetext'), '320 пикселей');
      const compactStage = await stage.boundingBox();
      const compactDetails = await details.boundingBox();
      const compactFrame = await page.locator('[data-layout-viewport]').boundingBox();
      assert.ok(compactStage.y + compactStage.height <= compactDetails.y, 'Narrow preview places details below the image');
      assert.ok(compactStage.x + compactStage.width <= compactFrame.x + compactFrame.width + 1, 'Image fits the narrow preview');
      assert.equal(await page.locator('[data-lamp]').getAttribute('data-surface'), 'graphite');
      await slider.press('End');
      assert.equal(await slider.inputValue(), '832');
      assert.equal(await page.locator('[data-lamp]').getAttribute('data-surface'), 'graphite');
    } finally { await context.close(); }
  });
  await run('storefront is compact and touch controls stay usable at 320px', async () => {
    const { page, context } = await newPage({ viewport: { width: 320, height: 800 }, hasTouch: true });
    try {
      const frame = page.locator('[data-layout-viewport]');
      await frame.scrollIntoViewIfNeeded();
      const artwork = await page.locator('.lamp-stage').boundingBox();
      const details = await page.locator('.lamp-details').boundingBox();
      assert.ok(artwork && details && artwork.y + artwork.height <= details.y);
      assert.equal(await frame.evaluate(el => el.scrollWidth > el.clientWidth + 1), false);
      assert.equal(await page.getByRole('slider', { name: 'Ширина витрины' }).isVisible(), false);
      await page.getByRole('button', { name: 'Подсветка лампы' }).tap();
      assert.equal(await frame.locator('[data-lamp]').getAttribute('data-lit'), 'false');
    } finally { await context.close(); }
  });
  await run('background draws at device scale and pauses cleanly', async () => {
    const { page, context } = await newPage({ deviceScaleFactor: 2, reducedMotion: 'no-preference' });
    try {
      const canvas = page.locator('[data-hero-flow]');
      await page.waitForFunction(() => document.querySelector('[data-hero-flow]').width > 1000);
      const density = await canvas.evaluate(el => el.width / el.clientWidth);
      assert.ok(density > 1.5, 'Canvas uses a high-density backing buffer');
      const atStart = await canvas.evaluate(el => el.toDataURL());
      await page.waitForFunction(prior => document.querySelector('[data-hero-flow]').toDataURL() !== prior, atStart, { polling: 120 });
      await page.getByRole('button', { name: 'Остановить движение' }).click();
      const frame = await canvas.evaluate(el => el.toDataURL());
      await page.waitForTimeout(180);
      assert.equal(await canvas.evaluate(el => el.toDataURL()), frame, 'Paused background retains the same pixels');
      const field = page.locator('[data-page-light]');
      assert.equal(await field.evaluate(el => el.classList.contains('is-active')), false);
      assert.equal(await field.locator('.page-light-weave').evaluate(el => getComputedStyle(el).animationPlayState), 'paused');
      await page.getByRole('button', { name: 'Включить движение' }).click();
      await page.waitForFunction(prior => document.querySelector('[data-hero-flow]').toDataURL() !== prior, frame, { polling: 120 });
      await page.locator('#faq').scrollIntoViewIfNeeded();
      await page.mouse.move(23, 432);
      await page.waitForFunction(() => document.querySelector('[data-page-light]').classList.contains('is-active'));
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForFunction(() => !document.querySelector('[data-page-light]').classList.contains('is-active'));
      assert.equal(await page.getByRole('button', { name: 'Остановить движение' }).isVisible(), false);
    } finally { await context.close(); }
  });

  await run('service link suggests a project type without overwriting a visitor choice', async () => {
    const { page, context } = await newPage();
    try {
      await page.getByRole('link', {name:'Обсудить проект: Лендинги'}).click();
      assert.equal(await page.locator('#inquiry-project').inputValue(), 'Лендинг');
      await page.locator('#inquiry-project').selectOption('Доработка сайта');
      await page.getByRole('link', {name:'Обсудить проект: Сайты для бизнеса'}).click();
      assert.equal(await page.locator('#inquiry-project').inputValue(), 'Доработка сайта');
      await page.locator('#inquiry-project').selectOption('');
      await page.getByRole('link', {name:'Обсудить проект: Приложения'}).click();
      assert.equal(await page.locator('#inquiry-project').inputValue(), 'Приложение');
    } finally { await context.close(); }
  });
  await run('normal motion reveals once; reduced motion exposes final text', async () => {
    const { page, context } = await newPage({ reducedMotion: 'no-preference' });
    try {
      const section = page.locator('[data-reveal]').first();
      await page.waitForFunction(() => document.querySelector('[data-reveal]').classList.contains('reveal-ready'));
      assert.equal(await section.evaluate(el => getComputedStyle(el).opacity), '1', 'Offscreen text retains contrast before entering');
      await section.scrollIntoViewIfNeeded();
      await page.waitForFunction(() => document.querySelector('[data-reveal]').classList.contains('is-visible'));
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      assert.equal(await section.evaluate(el => el.classList.contains('is-visible')), true);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      assert.equal(await page.locator('.word-reveal span[aria-hidden]').first().evaluate(el => getComputedStyle(el).opacity), '1');
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.goto(`${base}/#faq`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.querySelector('#faq').getBoundingClientRect().top < window.innerHeight);
      assert.equal(await page.locator('.section-heading[data-reveal]').first().evaluate(el => !el.classList.contains('reveal-ready') || el.classList.contains('is-visible')), true, 'Content above a direct anchor must not be hidden');
    } finally { await context.close(); }
  });
  await run('no JavaScript and forced colors keep content and direct contact available', async () => {
    const { page, context } = await newPage({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    try {
      assert.equal(await page.locator('h1').isVisible(), true);
      assert.equal(await page.locator('.theme-toggle').isVisible(), false);
      assert.equal(await page.locator(`a[href="https://t.me/${site.telegram}"]`).first().isVisible(), true);
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
        assert.equal(await page.locator('meta[property="og:image"]').getAttribute('content'), '/og-v2.jpg');
        const broken = await page.locator('a[href^="#"]').evaluateAll(links => links.map(link => link.getAttribute('href')).filter(href => !document.getElementById(href.slice(1))));
        assert.deepEqual(broken, []);
      }
      assert.match(await (await page.request.get(base + '/robots.txt')).text(), /Disallow: \//);
      const socialImage=await page.request.get(base + '/og-v2.jpg');
      assert.equal(socialImage.status(),200);
      assert.match(socialImage.headers()['content-type'],/image\/jpeg/);
      assert.deepEqual(errors, []); assert.deepEqual(external, []);
    } finally { await context.close(); }
  });
} finally {
  await browser.close();
  await writeFile(`${artifacts}/results.json`, JSON.stringify({ base, engineName, channel, browserVersion, testedAt: new Date().toISOString(), results }, null, 2));
}
if (results.some(result => !result.passed)) process.exitCode = 1;
