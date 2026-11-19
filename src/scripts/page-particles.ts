const fullTurn = 2 * Math.PI;
const frameInterval = 1000 / 60;
const colors = {
  light: ['#a36367', '#94663e', '#57786b'],
  dark: ['#e4a3b1', '#f8d7ae', '#acd8ca'],
};

function particleSprite(color: string, hasRays: boolean) {
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = 40;
  const ink = sprite.getContext('2d');
  if (!ink) return sprite;

  const halo = ink.createRadialGradient(20, 20, 0, 20, 20, 19);
  halo.addColorStop(0, color);
  halo.addColorStop(.25, color + 'e8');
  halo.addColorStop(.34, color + '53');
  halo.addColorStop(.64, color + '18');
  halo.addColorStop(1, color + '00');
  ink.fillStyle = halo;
  ink.fillRect(0, 0, 40, 40);

  if (hasRays) {
    ink.translate(20, 20);
    ink.fillStyle = color;
    ink.globalAlpha = .7;
    for (let ray = 0; ray < 2; ray++) {
      ink.rotate(Math.PI / 2);
      ink.beginPath();
      ink.moveTo(-14, 0);
      ink.lineTo(0, -1.4);
      ink.lineTo(14, 0);
      ink.lineTo(0, 1.4);
      ink.fill();
    }
  }
  return sprite;
}

function makeParticles(count: number) {
  let seed = 27183;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  return Array.from({ length: count }, (_, index) => {
    const along = (index + random()) / count;
    const layer = random();
    const focus = random();
    const x = along * 1.04 - .02 + .054 * Math.sin(along * fullTurn * 2);
    const scatter = (random() + random() - 1) * .15;
    // Two unequal bands leave room for the copy, with spare points across the viewport.
    const y = layer < .57
      ? .76 + Math.sin((x - .12) * 4.9) * .13 - .135 * x + scatter
      : layer < .82
        ? .22 - .17 * x + scatter * .83
        : .08 + .84 * random();
    const spark = layer < .82 && focus > .955;
    return {
      x, y,
      tint: (x < .34 ? 0 : x < .73 ? 1 : 2) * 2 + Number(spark),
      phase: random() * fullTurn,
      drift: .37 + random() * .9,
      size: spark ? 12 + focus * 8 : 3 + focus ** 2 * 6,
      alpha: spark ? .92 : .32 + focus * .42,
      offsetX: 0, offsetY: 0,
    };
  });
}

export function initPageParticles(atmosphere: HTMLElement) {
  const canvas = atmosphere.querySelector<HTMLCanvasElement>('[data-page-particles]');
  const context = canvas?.getContext('2d');
  if (!canvas || !context || !('ResizeObserver' in window)) return;

  const root = document.documentElement;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const forcedColors = matchMedia('(forced-colors: active)');
  const finePointer = matchMedia('(any-hover: hover) and (any-pointer: fine)');
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0, present: false, weight: 0, speed: 0 };
  let width = 0, height = 0, pixelRatio = 1;
  let time = 0, lastFrame = 0, nextPaint = 0, frame = 0;
  let particles: ReturnType<typeof makeParticles> = [];
  let sprites: HTMLCanvasElement[] = [];

  const canAnimate = () => width > 0 && height > 0 && !document.hidden && !forcedColors.matches
    && !reducedMotion.matches && atmosphere.dataset.motionPaused !== 'true';

  const paint = (delta: number) => {
    if (!width || !height || forcedColors.matches) return;
    time += delta;
    const dark = root.dataset.theme === 'dark';
    const follow = 1 - Math.exp(-delta * 19);
    const ease = 1 - Math.exp(-delta * 9);
    const moveX = (pointer.targetX - pointer.x) * follow;
    const moveY = (pointer.targetY - pointer.y) * follow;
    pointer.x += moveX;
    pointer.y += moveY;
    pointer.weight += (Number(pointer.present) - pointer.weight) * ease;
    const speed = pointer.present && delta ? Math.min(1, Math.hypot(moveX, moveY) / (delta * 1050)) : 0;
    pointer.speed += (speed - pointer.speed) * ease;

    const radius = Math.min(278, Math.max(170, width * .22));
    const radiusSquared = radius * radius;
    const attraction = .85 - pointer.speed * 1.62;
    const swirl = .22 + pointer.speed * .60;
    context.clearRect(0, 0, canvas.width, canvas.height);

    for (const particle of particles) {
      const phase = time * particle.drift + particle.phase;
      const x = particle.x * width + Math.sin(phase * .38) * 14 * particle.drift;
      const y = particle.y * height + Math.cos(phase * .45) * 11 * particle.drift;
      const dx = x - pointer.x;
      const dy = y - pointer.y;
      const influence = Math.max(0, 1 - (dx * dx + dy * dy) / radiusSquared) ** 2 * pointer.weight;
      particle.offsetX += ((-dx * attraction - dy * swirl) * influence - particle.offsetX) * ease;
      particle.offsetY += ((-dy * attraction + dx * swirl) * influence - particle.offsetY) * ease;

      const sprite = sprites[particle.tint];
      if (!sprite) continue;
      const size = Math.max(2, Math.round(particle.size * pixelRatio * (1 + influence * .22)));
      const shimmer = .82 + .18 * Math.sin(phase * .73);
      context.globalAlpha = Math.min(1, particle.alpha * shimmer * (dark ? 1 : .85) + .55 * influence);
      context.drawImage(sprite, Math.round((x + particle.offsetX) * pixelRatio - size / 2),
        Math.round((y + particle.offsetY) * pixelRatio - size / 2), size, size);
    }
    context.globalAlpha = 1;
  };

  const tick = (now: number) => {
    frame = 0;
    if (!canAnimate()) return;
    // Keep a 60 Hz paint budget on fast displays without losing the fractional frame time.
    if (!lastFrame || now + 1 >= nextPaint) {
      paint(lastFrame ? Math.min(.04, (now - lastFrame) / 1000) : 0);
      nextPaint = Math.max((lastFrame ? nextPaint : now) + frameInterval, now);
      lastFrame = now;
    }
    frame = requestAnimationFrame(tick);
  };

  const sync = () => {
    if (canAnimate()) {
      if (!frame) { lastFrame = 0; frame = requestAnimationFrame(tick); }
    } else {
      cancelAnimationFrame(frame);
      frame = 0;
      pointer.present = false;
    }
  };

  const refreshPalette = () => {
    const palette = root.dataset.theme === 'dark' ? colors.dark : colors.light;
    sprites = palette.flatMap(color => [particleSprite(color, false), particleSprite(color, true)]);
    paint(0);
  };

  new ResizeObserver(([entry]) => {
    if (!entry) return;
    ({ width, height } = entry.contentRect);
    if (width && height) {
      pixelRatio = Math.min(devicePixelRatio || 1, 2, Math.sqrt(3_600_000 / (width * height)));
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      particles = makeParticles(Math.max(108, Math.min(285, Math.round(width * height / 4800))));
      paint(0);
    }
    sync();
  }).observe(canvas);

  refreshPalette();
  new MutationObserver(refreshPalette).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  new MutationObserver(sync).observe(atmosphere, { attributes: true, attributeFilter: ['data-motion-paused'] });
  reducedMotion.addEventListener('change', sync);
  forcedColors.addEventListener('change', sync);
  const leave = () => { pointer.present = false; };
  finePointer.addEventListener('change', leave);
  document.addEventListener('visibilitychange', sync);
  root.addEventListener('pointerleave', leave);
  window.addEventListener('blur', leave);
  window.addEventListener('pointermove', event => {
    if (!finePointer.matches || !canAnimate() || event.pointerType === 'touch') return;
    pointer.targetX = event.clientX;
    pointer.targetY = event.clientY;
    if (!pointer.present) {
      pointer.x = pointer.targetX;
      pointer.y = pointer.targetY;
    }
    pointer.present = true;
  }, { passive: true });
}
