// 3D-монета. Если у монеты есть model.glb — позже здесь подключится model-viewer (этап 2).
// Пока строим «запасную» монету в three.js: цилиндр, на торцах аверс и реверс, металлический гурт.
// three.js грузится только при открытии вкладки «3D».

import { faceCanvas } from './images.js';
import { h, icon, reducedMotion } from './util.js';

const THICKNESS_RATIO = 0.075; // толщина / диаметр — типично для двойного талера (~3,5 мм при ~47 мм)

export function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

function edgeTexture(THREE) {
  // Насечка на гурте: частые вертикальные полосы
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 32;
  const ctx = c.getContext('2d');
  for (let x = 0; x < c.width; x += 4) {
    ctx.fillStyle = x % 8 === 0 ? '#c9cbcf' : '#8d9096';
    ctx.fillRect(x, 0, 4, c.height);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

function studioEnvironment(THREE, renderer) {
  // Мягкая «студия» для отражений металла: светлый верх, тёмный низ, два софтбокса.
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#f4efe6'); g.addColorStop(0.45, '#8a8780'); g.addColorStop(1, '#141414');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = 'rgba(255,250,240,0.95)';
  ctx.fillRect(60, 40, 90, 60); ctx.fillRect(330, 55, 120, 40);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(tex).texture;
  tex.dispose(); pmrem.dispose();
  return env;
}

/**
 * Монтирует 3D-монету в container. Возвращает функцию уничтожения.
 * labels — тексты интерфейса (подсказка, «сбросить вид»).
 */
export async function mountCoin3D(container, coin, { labels, onReady } = {}) {
  const THREE = await import('../../vendor/three.module.min.js');

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', labels['3d.label']);
  container.prepend(canvas);

  const scene = new THREE.Scene();
  scene.environment = studioEnvironment(THREE, renderer);
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  const BASE_Z = 5.4;
  camera.position.set(0, 0, BASE_Z);

  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const key = new THREE.DirectionalLight(0xfff4e2, 1.6); key.position.set(3, 4, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfd2ff, 0.7); rim.position.set(-4, -2, -3); scene.add(rim);

  const [front, back] = await Promise.all([faceCanvas(coin, 'obverse'), faceCanvas(coin, 'reverse')]);
  const toTex = (cv, mirror) => {
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    t.center.set(0.5, 0.5);
    if (mirror) { t.wrapS = THREE.RepeatWrapping; t.repeat.x = -1; }
    return t;
  };

  const radius = 1;
  const thickness = 2 * radius * THICKNESS_RATIO;
  const geo = new THREE.CylinderGeometry(radius, radius, thickness, 160, 1, false);
  geo.rotateX(Math.PI / 2); // торцы смотрят на зрителя
  const edge = edgeTexture(THREE);
  edge.repeat.x = 6;
  const sideMat = new THREE.MeshStandardMaterial({ map: edge, metalness: 1, roughness: 0.38, color: 0xd9dade });
  const faceMat = (tex) => new THREE.MeshStandardMaterial({ map: tex, metalness: 0.35, roughness: 0.5, envMapIntensity: 0.6 });
  // Группы CylinderGeometry: 0 — бок, 1 — верхний торец, 2 — нижний торец.
  const frontTex = toTex(front, false), backTex = toTex(back, false);
  frontTex.rotation = Math.PI / 2; backTex.rotation = Math.PI / 2;
  const mesh = new THREE.Mesh(geo, [sideMat, faceMat(frontTex), faceMat(backTex)]);
  // После rotateX верхний торец (аверс) смотрит на зрителя.
  const pivot = new THREE.Group();
  pivot.add(mesh);
  scene.add(pivot);

  // --- Управление: перетаскивание, колесо, щипок, клавиатура ---
  const state = { rx: -0.18, ry: 0.35, vx: 0, vy: 0, zoom: 1, dragging: false, hover: false };
  const pointers = new Map();
  let pinchStart = 0, zoomStart = 1, lastX = 0, lastY = 0, lastInteraction = 0;
  const still = reducedMotion();

  const clampZoom = (z) => Math.min(2.2, Math.max(0.7, z));
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchStart = Math.hypot(a.x - b.x, a.y - b.y); zoomStart = state.zoom;
    }
    state.dragging = true; lastX = e.clientX; lastY = e.clientY; lastInteraction = performance.now();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      state.zoom = clampZoom(zoomStart * Math.hypot(a.x - b.x, a.y - b.y) / (pinchStart || 1));
      return;
    }
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    state.vy = dx * 0.008; state.vx = dy * 0.006;
    state.ry += state.vy; state.rx = Math.max(-1.2, Math.min(1.2, state.rx + state.vx));
    lastInteraction = performance.now();
  });
  const up = (e) => { pointers.delete(e.pointerId); if (!pointers.size) state.dragging = false; };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointerenter', () => { state.hover = true; });
  canvas.addEventListener('pointerleave', () => { state.hover = false; });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    state.zoom = clampZoom(state.zoom * (e.deltaY > 0 ? 0.92 : 1.08));
    lastInteraction = performance.now();
  }, { passive: false });
  canvas.addEventListener('keydown', (e) => {
    const step = 0.25;
    const actions = {
      ArrowLeft: () => { state.ry -= step; }, ArrowRight: () => { state.ry += step; },
      ArrowUp: () => { state.rx = Math.max(-1.2, state.rx - step); }, ArrowDown: () => { state.rx = Math.min(1.2, state.rx + step); },
      '+': () => { state.zoom = clampZoom(state.zoom * 1.12); }, '=': () => { state.zoom = clampZoom(state.zoom * 1.12); },
      '-': () => { state.zoom = clampZoom(state.zoom / 1.12); },
    };
    if (actions[e.key]) { e.preventDefault(); actions[e.key](); state.vx = state.vy = 0; lastInteraction = performance.now(); }
  });

  const reset = () => { state.rx = -0.18; state.ry = 0.35; state.vx = state.vy = 0; state.zoom = 1; };
  const bar = h('div', { class: 'panel-3d-bar' },
    h('span', { class: 'hint' }, labels['3d.hint']),
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': labels['3d.reset'], title: labels['3d.reset'], onclick: reset }, icon('reset')));
  container.append(bar);

  // --- Размер и цикл отрисовки (только когда панель видна) ---
  const resize = () => {
    const w = container.clientWidth, hgt = container.clientHeight;
    if (!w || !hgt) return;
    renderer.setSize(w, hgt, false);
    camera.aspect = w / hgt;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  let visible = true, raf = 0;
  const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) loop(); });
  io.observe(container);

  function loop() {
    cancelAnimationFrame(raf);
    if (!visible || document.hidden) return;
    raf = requestAnimationFrame(loop);
    const idle = performance.now() - lastInteraction > 1500;
    if (!state.dragging) {
      // инерция после броска
      state.ry += state.vy; state.vy *= 0.92;
      state.rx = Math.max(-1.2, Math.min(1.2, state.rx + state.vx)); state.vx *= 0.9;
      if (idle && !still) state.ry += state.hover ? 0.006 : 0.0025; // лёгкое вращение, чуть быстрее при наведении
    }
    pivot.rotation.set(state.rx, state.ry, 0);
    camera.position.z += (BASE_Z / state.zoom - camera.position.z) * 0.2;
    renderer.render(scene, camera);
  }
  document.addEventListener('visibilitychange', loop);
  loop();
  onReady?.();

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect(); io.disconnect();
    document.removeEventListener('visibilitychange', loop);
    geo.dispose(); edge.dispose(); frontTex.dispose(); backTex.dispose();
    sideMat.dispose(); mesh.material.forEach((m) => m.dispose());
    scene.environment?.dispose();
    renderer.dispose();
    canvas.remove(); bar.remove();
  };
}
