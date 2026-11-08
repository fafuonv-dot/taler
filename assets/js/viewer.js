// Полноэкранный просмотр фото: зум (двойной тап, щипок, колесо), перетаскивание, стрелки, Esc.

import { h, icon } from './util.js';

/** items: [{img: HTMLImageElement (источник src/alt), caption}] */
export function openViewer(items, startIndex, i18n) {
  let index = startIndex;
  let scale = 1, x = 0, y = 0;
  const pointers = new Map();
  let pinch = null, drag = null, lastTap = 0;

  const img = h('img', { alt: '', draggable: 'false' });
  const caption = h('span', { class: 'viewer-caption', 'aria-live': 'polite' });
  const stage = h('div', { class: 'viewer-stage' }, img);

  const apply = () => { img.style.transform = `translate(${x}px, ${y}px) scale(${scale})`; };
  const setScale = (s, cx = 0, cy = 0) => {
    const ns = Math.min(5, Math.max(1, s));
    // зум к точке под пальцем/курсором
    x = cx - (cx - x) * (ns / scale); y = cy - (cy - y) * (ns / scale);
    scale = ns;
    if (scale === 1) { x = 0; y = 0; }
    apply();
  };
  const show = (i) => {
    index = (i + items.length) % items.length;
    const it = items[index];
    img.src = (!it.img.dataset.placeholder && it.img.dataset.full) || it.img.currentSrc || it.img.src;
    img.alt = it.img.alt;
    caption.textContent = it.caption;
    scale = 1; x = 0; y = 0; apply();
  };
  const center = (e) => { const r = stage.getBoundingClientRect(); return [e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2]; };

  stage.addEventListener('wheel', (e) => { e.preventDefault(); setScale(scale * (e.deltaY > 0 ? 0.85 : 1.18), ...center(e)); }, { passive: false });
  stage.addEventListener('pointerdown', (e) => {
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, e);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), s: scale };
    } else {
      drag = { x: e.clientX - x, y: e.clientY - y, sx: e.clientX };
      const now = Date.now();
      if (now - lastTap < 300) setScale(scale > 1 ? 1 : 2.5, ...center(e));
      lastTap = now;
    }
  });
  stage.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, e);
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      setScale(pinch.s * Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / pinch.d);
    } else if (drag && scale > 1) {
      x = e.clientX - drag.x; y = e.clientY - drag.y; apply();
    }
  });
  const end = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!pointers.size && drag) {
      // свайп при обычном масштабе — к следующему фото
      const dx = e.clientX - drag.sx;
      if (scale === 1 && Math.abs(dx) > 60 && items.length > 1) show(index + (dx < 0 ? 1 : -1));
      drag = null;
    }
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);

  const btn = (name, label, onclick, cls = '') => h('button', { class: `icon-btn ${cls}`, type: 'button', 'aria-label': label, title: label, onclick }, icon(name));
  const dlg = h('dialog', { class: 'viewer', 'aria-label': caption.textContent },
    stage,
    h('div', { class: 'viewer-top' }, caption,
      h('div', { class: 'viewer-tools' },
        btn('minus', i18n['viewer.zoomOut'], () => setScale(scale / 1.4)),
        btn('plus', i18n['viewer.zoomIn'], () => setScale(scale * 1.4)),
        btn('close', i18n.close, () => dlg.close()))),
    items.length > 1 && btn('back', i18n['viewer.prev'], () => show(index - 1), 'viewer-nav prev'),
    items.length > 1 && btn('next', i18n['viewer.next'], () => show(index + 1), 'viewer-nav next'));

  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(index - 1);
    else if (e.key === 'ArrowRight') show(index + 1);
    else if (e.key === '+' || e.key === '=') setScale(scale * 1.4);
    else if (e.key === '-') setScale(scale / 1.4);
  });
  const opener = document.activeElement;
  dlg.addEventListener('close', () => { dlg.remove(); opener?.focus?.(); });
  document.body.append(dlg);
  show(startIndex);
  dlg.showModal();
}
