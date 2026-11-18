type Vector = [number, number, number];
type Curve = (angle: number) => Vector;

const TAU = Math.PI * 2;
const offset = (a: Vector, b: Vector): Vector => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vector, b: Vector): Vector => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v: Vector): Vector => {
  const length = Math.hypot(...v) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
};

// The surface follows a closed curve. Its elliptical cross section twists into a ribbon.
function ribbon(curve: Curve, width: number, thickness: number, twist: number, sections: number) {
  const sides = 14;
  const surface = (angle: number, around: number): Vector => {
    const center = curve(angle);
    const tangent = unit(offset(curve(angle + .001), center));
    const outward = unit(cross(tangent, [0, 0, 1]));
    const up = cross(outward, tangent);
    const a = Math.cos(around) * width;
    const b = Math.sin(around) * thickness;
    const turn = angle * twist;
    const x = a * Math.cos(turn) - b * Math.sin(turn);
    const y = a * Math.sin(turn) + b * Math.cos(turn);
    return [center[0] + outward[0] * x + up[0] * y, center[1] + outward[1] * x + up[1] * y, center[2] + up[2] * y];
  };
  const vertices: number[] = [];
  const indices: number[] = [];
  for (let ring = 0; ring < sections; ring++) {
    const t = TAU * ring / sections;
    for (let side = 0; side < sides; side++) {
      const u = TAU * side / sides;
      const p = surface(t, u);
      const normal = unit(cross(offset(surface(t + .001, u), p), offset(surface(t, u + .001), p)));
      vertices.push(...p, ...normal);
      const nextRing = (ring + 1) % sections * sides;
      const nextSide = (side + 1) % sides;
      const here = ring * sides + side;
      const across = ring * sides + nextSide;
      indices.push(here, nextRing + side, across, across, nextRing + side, nextRing + nextSide);
    }
  }
  return { vertices: new Float32Array(vertices), indices: new Uint16Array(indices) };
}

const vertexSource = `
  attribute vec3 position;
  attribute vec3 normal;
  uniform vec2 angle;
  uniform vec2 scale;
  uniform vec3 shift;
  varying vec3 n;
  varying vec3 world;

  vec3 rotate(vec3 p) {
    float sy = sin(angle.x), cy = cos(angle.x);
    float sx = sin(angle.y), cx = cos(angle.y);
    p = vec3(cy * p.x + sy * p.z, p.y, -sy * p.x + cy * p.z);
    return vec3(p.x, cx * p.y - sx * p.z, sx * p.y + cx * p.z);
  }

  void main() {
    world = rotate(position) + shift;
    n = rotate(normal);
    float distance = 5.0 - world.z;
    gl_Position = vec4(world.xy * scale, distance * 1.06 - 0.7, distance);
  }
`;

const fragmentSource = `
  precision mediump float;
  uniform vec3 tint;
  uniform float band;
  varying vec3 n;
  varying vec3 world;

  void main() {
    vec3 normal = normalize(n);
    vec3 view = normalize(vec3(0.0, 0.0, 5.0) - world);
    vec3 ray = reflect(-view, normal);
    float facing = max(0.0, dot(normal, view));
    float fresnel = pow(1.0 - facing, 2.4);
    float key = max(0.0, dot(normal, normalize(vec3(-0.55, 0.8, 0.7))));
    float softbox = pow(clamp(1.0 - abs(ray.x + 0.3), 0.0, 1.0), 24.0) * smoothstep(-0.35, 0.35, ray.y);
    float strip = pow(clamp(1.0 - abs(ray.y + 0.2 + ray.x * 0.28), 0.0, 1.0), 26.0) * smoothstep(-0.65, 0.3, ray.x);
    float film = 0.5 + 0.5 * sin(6.0 * ray.y + 3.0 * ray.x);
    vec3 glass = mix(tint * 0.27, tint * 0.92 + vec3(0.18, 0.15, 0.14), key);
    glass += vec3(0.18, 0.13, 0.16) * film + vec3(0.23, 0.27, 0.25) * fresnel;
    glass += vec3(0.86, 0.79, 0.65) * softbox * 0.65;
    glass += vec3(0.47, 0.61, 0.57) * strip;
    vec3 brass = vec3(0.38, 0.27, 0.17) + vec3(0.43, 0.35, 0.24) * key + vec3(0.27, 0.24, 0.2) * softbox;
    gl_FragColor = vec4(mix(glass, brass, band), 1.0);
  }
`;

function shaderProgram(gl: WebGLRenderingContext) {
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  };
  const vertex = compile(gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.bindAttribLocation(program, 0, 'position');
  gl.bindAttribLocation(program, 1, 'normal');
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program;
  gl.deleteProgram(program);
  return null;
}

function buildRenderer(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: true, powerPreference: 'low-power' });
  if (!gl) return;
  const program = shaderProgram(gl);
  if (!program) return;
  const knot: Curve = t => {
    const radius = .99 + .37 * Math.cos(t * 3);
    return [radius * Math.cos(t * 2), radius * Math.sin(t * 2), .48 * Math.sin(t * 3)];
  };
  const circle = (radius: number, tilt: number): Curve => t => [radius * Math.cos(t), radius * Math.sin(t) * Math.cos(tilt), radius * Math.sin(t) * Math.sin(tilt)];
  const shapes = [ribbon(knot, .25, .105, 3, 160), ribbon(circle(1.56, .83), .016, .016, 0, 96), ribbon(circle(1.63, -.68), .012, .012, 0, 96)];
  gl.useProgram(program);
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0, 0, 0, 0);
  const angle = gl.getUniformLocation(program, 'angle');
  const scale = gl.getUniformLocation(program, 'scale');
  const shift = gl.getUniformLocation(program, 'shift');
  const tint = gl.getUniformLocation(program, 'tint');
  const band = gl.getUniformLocation(program, 'band');
  const meshes = shapes.map(shape => {
    const vertices = gl.createBuffer();
    const indices = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
    gl.bufferData(gl.ARRAY_BUFFER, shape.vertices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, shape.indices, gl.STATIC_DRAW);
    return { vertices, indices, count: shape.indices.length };
  });
  gl.enableVertexAttribArray(0);
  gl.enableVertexAttribArray(1);
  return (yaw: number, pitch: number, spread: number, color: Vector) => {
    const aspect = canvas.width / canvas.height;
    const magnification = 2.56;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniform2f(angle, yaw, pitch);
    gl.uniform2f(scale, magnification / Math.max(1, aspect), magnification * Math.min(1, aspect));
    gl.uniform3fv(tint, color);
    meshes.forEach((mesh, i) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vertices);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indices);
      const side = i === 1 ? -1 : 1;
      gl.uniform1f(band, i === 0 ? 0 : 1);
      gl.uniform3f(shift, i === 0 ? 0 : side * spread * .48, i === 0 ? 0 : side * spread * .36, i === 0 ? 0 : spread * .18);
      gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
    });
  };
}

const materials: Record<string, Vector> = {
  wine: [.62, .24, .36],
  forest: [.2, .47, .38],
  stone: [.57, .48, .37],
};

export function initSculpture(lab: HTMLElement, motionControl?: HTMLElement | null) {
  const stage = lab.querySelector<HTMLElement>('[data-sculpture-stage]');
  const canvas = stage?.querySelector<HTMLCanvasElement>('canvas');
  const controls = lab.querySelector<HTMLElement>('[data-scene-controls]');
  const hint = lab.querySelector<HTMLElement>('[data-scene-hint]');
  const angle = controls?.querySelector<HTMLInputElement>('#lab-angle');
  const layers = controls?.querySelector<HTMLButtonElement>('[data-scene-layers]');
  if (!stage || !canvas || !controls || !angle || !layers) return;

  let draw = buildRenderer(canvas);
  if (!draw) {
    stage.dataset.rendering = 'image';
    return;
  }

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let targetYaw = -.27, targetPitch = .28, yaw = targetYaw, pitch = targetPitch;
  let targetSpread = 0, spread = 0, spin = 0;
  let frame = 0, visible = false, lastTime = 0, pendulum = 0;
  let drag: { id: number; start: number; spin: number } | undefined;
  let stageWidth = 1, stageHeight = 1;
  const color: Vector = [...materials.wine!];

  const requestDraw = () => {
    if (visible && draw && !frame) frame = requestAnimationFrame(render);
  };
  const render = (now: number) => {
    frame = 0;
    if (!draw || !visible) return;
    const motion = !reducedMotion.matches && motionControl?.dataset.motionPaused !== 'true';
    const delta = Math.min(40, now - (lastTime || now));
    lastTime = now;
    if (motion) pendulum += delta * .00034;
    const smoothing = motion ? .12 : 1;
    yaw += (targetYaw - yaw) * smoothing;
    pitch += (targetPitch - pitch) * smoothing;
    spread += (targetSpread - spread) * smoothing;
    const tint = materials[lab.dataset.palette || 'wine'] ?? materials.wine!;
    for (const channel of [0, 1, 2] as const) color[channel] += (tint[channel] - color[channel]) * smoothing;
    draw(spin + yaw + .16 * Math.sin(pendulum), pitch, spread, color);
    if (stage.dataset.rendering !== 'live') show(true);
    if (motion) requestDraw();
  };

  const resize = new ResizeObserver(([entry]) => {
    if (!entry) return;
    const { width, height } = entry.contentRect;
    stageWidth = Math.max(width, 1);
    stageHeight = Math.max(height, 1);
    const density = Math.min(window.devicePixelRatio, 1.6, 720 / Math.max(stageWidth, stageHeight));
    canvas.width = Math.max(1, Math.round(stageWidth * density));
    canvas.height = Math.max(1, Math.round(stageHeight * density));
    requestDraw();
  });
  resize.observe(stage);
  new IntersectionObserver(([entry]) => {
    visible = !!entry?.isIntersecting;
    if (!visible) { cancelAnimationFrame(frame); frame = 0; lastTime = 0; }
    requestDraw();
  }).observe(stage);

  const updateAngle = (degrees: number) => {
    spin = degrees * Math.PI / 180;
    angle.value = String(Math.round(degrees / 5) * 5);
    angle.setAttribute('aria-valuetext', `${angle.value}°`);
    requestDraw();
  };
  angle.addEventListener('input', () => updateAngle(Number(angle.value)));
  angle.setAttribute('aria-valuetext', '0°');
  layers.addEventListener('click', () => {
    targetSpread = targetSpread ? 0 : 1;
    layers.setAttribute('aria-pressed', String(!!targetSpread));
    requestDraw();
  });
  stage.addEventListener('pointerdown', event => {
    if (!draw || !event.isPrimary || event.button !== 0) return;
    drag = { id: event.pointerId, start: event.clientX, spin: spin * 180 / Math.PI };
    stage.setPointerCapture(event.pointerId);
    stage.dataset.dragging = 'true';
  });
  stage.addEventListener('pointermove', event => {
    if (drag?.id === event.pointerId) {
      const degrees = drag.spin + (event.clientX - drag.start) * 180 / stageWidth;
      updateAngle(((degrees + 180) % 360 + 360) % 360 - 180);
      return;
    }
    if (event.pointerType === 'touch' || reducedMotion.matches || motionControl?.dataset.motionPaused === 'true') return;
    targetYaw = -.27 + (event.offsetX / stageWidth - .5) * .56;
    targetPitch = .28 - (event.offsetY / stageHeight - .5) * .39;
  });
  stage.addEventListener('pointerleave', () => { targetYaw = -.27; targetPitch = .28; });
  stage.addEventListener('lostpointercapture', () => { drag = undefined; delete stage.dataset.dragging; });
  const refresh = () => { targetYaw = -.27; targetPitch = .28; requestDraw(); };
  motionControl?.querySelector('.atmosphere-toggle')?.addEventListener('click', refresh);
  reducedMotion.addEventListener('change', refresh);
  new MutationObserver(requestDraw).observe(lab, { attributes: true, attributeFilter: ['data-palette', 'data-tone'] });

  const show = (ready: boolean) => {
    stage.dataset.rendering = ready ? 'live' : 'image';
    controls.hidden = !ready;
    if (hint) hint.textContent = ready ? 'Потяните форму, чтобы повернуть' : 'Исследование формы';
  };
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    draw = undefined;
    cancelAnimationFrame(frame);
    frame = 0;
    show(false);
  });
  canvas.addEventListener('webglcontextrestored', () => {
    draw = buildRenderer(canvas);
    requestDraw();
  });
}
