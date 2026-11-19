const curveSteps = Array.from({ length: 29 }, (_, index) => {
  const t = index / 28;
  const rest = 1 - t;
  return [rest ** 3, 3 * rest ** 2 * t, 3 * rest * t ** 2, t ** 3] as const;
});

/** Bend the nearby strands and paint their reflection in the same pass. */
export function initHeroFlow(hero: HTMLElement) {
  const canvas = hero.querySelector<HTMLCanvasElement>('[data-hero-flow]');
  const context = canvas?.getContext('2d');
  if (!canvas || !context || !('ResizeObserver' in window) || !('IntersectionObserver' in window)) return;

  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const highContrast = matchMedia('(forced-colors: active)');
  let visible = false;
  let width = 0, height = 0, ratio = 1;
  let pageTop = 0, left = 0;
  let frame = 0, lastFrame = 0, phase = 0;
  let pointerX = 0, pointerY = 0, lensX = 0, lensY = 0, presence = 0;
  let tracking = false;

  const strand = (x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, radiusSquared: number) => {
    if (presence < .01) {
      context.lineTo(x0, y0);
      context.bezierCurveTo(x1, y1, x2, y2, x3, y3);
      return;
    }
    for (const [a, b, c, d] of curveSteps) {
      const x = a * x0 + b * x1 + c * x2 + d * x3;
      const y = a * y0 + b * y1 + c * y2 + d * y3;
      const dx = x - lensX, dy = y - lensY;
      const influence = Math.max(0, 1 - (dx * dx + dy * dy) / radiusSquared) ** 2 * presence;
      context.lineTo(x + dx * influence * .19, y + (42 + dy * .8) * influence);
    }
  };

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
    const radius = Math.max(186, Math.min(350, width * .26));
    const radiusSquared = radius * radius;
    const reflection = presence > .02 ? context.createRadialGradient(lensX, lensY, 5, lensX, lensY, radius) : null;
    if (reflection) {
      reflection.addColorStop(0, dark ? '#f5d0a3' : '#a74b63');
      reflection.addColorStop(.41, dark ? '#c9b69b88' : '#9a626a75');
      reflection.addColorStop(1, '#0000');
    }
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
      const startY = height * start + distance * .93 + sway;
      const joinY = height * .83 + distance * .74 + sway;
      context.strokeStyle = ink;
      context.globalAlpha = (dark ? .29 : .22) * emphasis;
      context.lineWidth = index % 7 === 3 ? 1.1 : .62;
      context.beginPath();
      strand(-width * .09, startY, width * .16, height * (start - .18) + distance * .35,
        width * .26, height * .95 + distance * .9 + bend, width * .52, joinY, radiusSquared);
      strand(width * .52, joinY, width * .76, height * .71 + distance * .87 - bend,
        width * .78, height * (crest - .16) + distance * .3,
        width * 1.1, height * crest + distance * 1.12 - sway, radiusSquared);
      context.stroke();
      if (reflection) {
        context.strokeStyle = reflection;
        context.globalAlpha = (dark ? .68 : .39) * emphasis * presence;
        context.stroke();
      }
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
        strand(width * .91 + step, -height * .06, width * .82 + step, height * .08 + sway,
          width * .84 + step, height * .24 + bend, width * 1.1, height * .34 + step * .65, radiusSquared);
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
      lensX += (pointerX - lensX) * .21;
      lensY += (pointerY - lensY) * .21;
      presence += ((tracking ? 1 : 0) - presence) * .17;
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
      tracking = false;
      presence = 0;
    }
    if (width && height) draw();
  };

  new ResizeObserver(([entry]) => {
    if (!entry) return;
    ({ width, height } = entry.contentRect);
    if (!width || !height) return;
    const bounds = canvas.getBoundingClientRect();
    pageTop = bounds.top + scrollY;
    left = bounds.left;
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
    pointerX = event.clientX - left;
    pointerY = event.clientY + scrollY - pageTop;
    if (!tracking && presence < .02) { lensX = pointerX; lensY = pointerY; }
    tracking = true;
  }, { passive: true });
  const clearPointer = () => { tracking = false; };
  hero.addEventListener('pointerleave', clearPointer);
  window.addEventListener('blur', clearPointer);
}
