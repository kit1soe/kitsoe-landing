/** Draw two families of light lines at device resolution, with a quiet center for the copy. */
export function initHeroFlow(hero: HTMLElement) {
  const canvas = hero.querySelector<HTMLCanvasElement>('[data-hero-flow]');
  const context = canvas?.getContext('2d');
  if (!canvas || !context || !('ResizeObserver' in window) || !('IntersectionObserver' in window)) return;

  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const highContrast = matchMedia('(forced-colors: active)');
  let visible = false;
  let width = 0, height = 0, ratio = 1;
  let frame = 0, lastFrame = 0, phase = 0;
  let pointerX = 0, pointerY = 0, offsetX = 0, offsetY = 0;

  const draw = () => {
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    if (highContrast.matches) return;
    const dark = document.documentElement.dataset.theme === 'dark';
    const mobile = width < 600;
    const burgundy = dark ? '#df8bb7' : '#98516a';
    const copper = dark ? '#d4a791' : '#b87768';
    const jade = dark ? '#92b4a4' : '#597f71';
    const ink = context.createLinearGradient(0, 0, width, 0);
    ink.addColorStop(0, burgundy);
    ink.addColorStop(.43, copper);
    ink.addColorStop(.72, burgundy);
    ink.addColorStop(1, jade);
    context.strokeStyle = ink;
    const spread = mobile ? height * .125 : height * .18;
    const sway = Math.sin(phase) * height * .029;
    const bend = Math.cos(phase * .72) * height * .018;
    const start = mobile ? .81 : .72;
    const crest = mobile ? .70 : .58;
    const count = mobile ? 20 : 32;

    for (let index = 0; index < count; index++) {
      const across = index / (count - 1);
      const distance = (across - .5) * spread;
      const emphasis = Math.pow(Math.sin(Math.PI * across), .85);
      context.globalAlpha = (dark ? .29 : .22) * emphasis;
      context.lineWidth = index % 7 === 3 ? 1.1 : .62;
      context.beginPath();
      context.moveTo(-width * .09, height * start + distance * .93 + sway);
      context.bezierCurveTo(width * .16, height * (start - .18) + distance * .35 + offsetY,
        width * .26 + offsetX, height * .95 + distance * .9 + bend,
        width * .52, height * .83 + distance * .74 + sway);
      context.bezierCurveTo(width * .76 + offsetX, height * .71 + distance * .87 - bend,
        width * .78, height * (crest - .16) + distance * .3 + offsetY,
        width * 1.1, height * crest + distance * 1.12 - sway);
      context.stroke();
    }
    if (!mobile) {
      // The far arc keeps the center quiet while giving the foreground wave another plane.
      const farInk = context.createLinearGradient(width * .72, 0, width, height * .5);
      farInk.addColorStop(0, 'transparent');
      farInk.addColorStop(.6, jade);
      farInk.addColorStop(1, burgundy);
      context.strokeStyle = farInk;
      context.lineWidth = .6;
      for (let layer = 0; layer < 15; layer++) {
        const step = layer * 5;
        context.globalAlpha = (dark ? .21 : .15) * Math.sin((layer + 1) / 16 * Math.PI);
        context.beginPath();
        context.moveTo(width * .91 + step, -height * .06);
        context.bezierCurveTo(width * .82 + step - offsetX, height * .08 + sway,
          width * .84 + step, height * .24 + bend - offsetY, width * 1.1, height * .34 + step * .65);
        context.stroke();
      }
    }
    context.globalAlpha = 1;
  };

  const active = () => visible && !document.hidden && !motion.matches && !highContrast.matches && hero.dataset.motionPaused !== 'true';
  const tick = (now: number) => {
    frame = 0;
    if (!active()) return;
    const elapsed = now - lastFrame;
    if (elapsed >= 30) {
      phase += Math.min(45, elapsed) * .00036;
      offsetX += (pointerX - offsetX) * .065;
      offsetY += (pointerY - offsetY) * .065;
      lastFrame = now;
      draw();
    }
    frame = requestAnimationFrame(tick);
  };
  const sync = () => {
    if (active() && !frame) {
      lastFrame = performance.now();
      frame = requestAnimationFrame(tick);
    } else if (!active() && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
    if (width && height) draw();
  };

  new ResizeObserver(([entry]) => {
    if (!entry) return;
    ({ width, height } = entry.contentRect);
    if (!width || !height) return;
    ratio = Math.min(devicePixelRatio || 1, 2.5, Math.sqrt(5_000_000 / (width * height)));
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    sync();
  }).observe(canvas);
  new IntersectionObserver(([entry]) => { visible = !!entry?.isIntersecting; sync(); }).observe(canvas);
  new MutationObserver(sync).observe(hero, { attributes: true, attributeFilter: ['data-motion-paused'] });
  new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  motion.addEventListener('change', sync);
  highContrast.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  hero.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' || !active()) return;
    pointerX = (event.clientX / Math.max(1, width) - .5) * 68;
    pointerY = (event.clientY / Math.max(1, height) - .5) * 42;
  }, { passive: true });
  hero.addEventListener('pointerleave', () => { pointerX = pointerY = 0; });
}
