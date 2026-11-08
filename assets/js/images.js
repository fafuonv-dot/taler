// Изображения монет.
// Если в папке media/<id>/ ещё нет фото, сайт сам рисует аккуратную заглушку
// с настоящей легендой монеты. Как только вы положите obverse.jpg / reverse.jpg — появятся фото.

import { mediaUrl } from './data.js';
import { tr } from './util.js';

const cache = new Map();
const failed = new Set(); // какие файлы уже не нашлись — второй раз не запрашиваем

function seededRandom(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}

async function fontsReady() {
  try { await document.fonts.load('600 40px Cormorant'); } catch { /* нет шрифта — нарисуем системным */ }
}

function drawPlaceholder(coin, side, size = 800) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const r = size / 2, cx = r, cy = r;
  const rand = seededRandom(coin.id + side);

  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r - 2, 0, Math.PI * 2); ctx.clip();

  // Металл: серебро с лёгкой патиной
  const base = ctx.createRadialGradient(cx * 0.8, cy * 0.7, r * 0.1, cx, cy, r);
  base.addColorStop(0, '#d7d8da'); base.addColorStop(0.55, '#a9abb0'); base.addColorStop(1, '#6f737a');
  ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);
  const tint = ctx.createLinearGradient(0, size, size, 0);
  tint.addColorStop(0, 'rgba(70,90,120,0.22)'); tint.addColorStop(1, 'rgba(160,140,110,0.10)');
  ctx.fillStyle = tint; ctx.fillRect(0, 0, size, size);

  // Зернистость поверхности
  for (let i = 0; i < 2600; i++) {
    const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * r;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';
    ctx.fillRect(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1.6, 1.6);
  }

  // Ободок и бусинный круг
  ctx.lineWidth = r * 0.07; ctx.strokeStyle = 'rgba(40,42,48,0.28)';
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.965, 0, Math.PI * 2); ctx.stroke();
  const beads = 132;
  for (let i = 0; i < beads; i++) {
    const a = (i / beads) * Math.PI * 2;
    const x = cx + Math.cos(a) * r * 0.905, y = cy + Math.sin(a) * r * 0.905;
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.arc(x - 0.8, y - 0.8, r * 0.0085, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(30,32,38,0.45)'; ctx.beginPath(); ctx.arc(x + 0.8, y + 0.8, r * 0.0085, 0, 7); ctx.fill();
  }
  for (const [rr, col] of [[0.66, 'rgba(30,32,38,0.35)'], [0.663, 'rgba(255,255,255,0.35)']]) {
    ctx.lineWidth = 1.5; ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(cx, cy, r * rr, 0, Math.PI * 2); ctx.stroke();
  }

  // Легенда по кругу
  const legend = (side === 'obverse' ? coin.legend?.obverse : coin.legend?.reverse) || tr(coin.title, 'en').toUpperCase();
  const text = legend.replace(/\s+/g, ' · ').toUpperCase();
  const radius = r * 0.78;
  let fs = r * 0.11;
  ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  const measure = () => { ctx.font = `600 ${fs}px Cormorant, Georgia, serif`; return [...text].reduce((s, ch) => s + ctx.measureText(ch).width + fs * 0.08, 0) / radius; };
  let total = measure();
  while (total > Math.PI * 1.86 && fs > 12) { fs -= 1; total = measure(); }
  const engrave = (draw) => {
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; draw(1.2);
    ctx.fillStyle = 'rgba(28,30,36,0.78)'; draw(0);
  };
  engrave((off) => {
    let ang = -Math.PI / 2 - total / 2;
    for (const ch of text) {
      const w = (ctx.measureText(ch).width + fs * 0.08) / radius;
      ang += w / 2;
      ctx.save(); ctx.translate(cx + Math.cos(ang) * radius + off, cy + Math.sin(ang) * radius + off); ctx.rotate(ang + Math.PI / 2);
      ctx.fillText(ch, 0, 0); ctx.restore();
      ang += w / 2;
    }
  });

  // Центр: имя правителя на аверсе, год (или двор) на реверсе
  const year = (tr(coin.year, 'en').match(/\d{4}/) || [])[0];
  const big = side === 'obverse' ? (coin.legend?.obverse || '').split(' ')[0] || 'AVERS' : (year || 'TIROL');
  const small = side === 'obverse' ? (year || '') : 'HALL';
  let bfs = r * (side === 'obverse' ? 0.2 : 0.3);
  ctx.font = `600 ${bfs}px Cormorant, Georgia, serif`;
  while (ctx.measureText(big).width > r * 1.08 && bfs > 20) { bfs -= 2; ctx.font = `600 ${bfs}px Cormorant, Georgia, serif`; }
  engrave((off) => { ctx.font = `600 ${bfs}px Cormorant, Georgia, serif`; ctx.fillText(big, cx + off, cy + off); });
  if (small) {
    ctx.font = `600 ${r * 0.085}px Cormorant, Georgia, serif`;
    const yOff = side === 'obverse' ? bfs * 0.85 : -bfs * 0.78;
    engrave((off) => { ctx.font = `600 ${r * 0.085}px Cormorant, Georgia, serif`; ctx.fillText(small.split('').join(' '), cx + off, cy + yOff + off); });
  }

  // Свет и тень, чтобы металл выглядел объёмным
  const light = ctx.createLinearGradient(0, 0, size, size);
  light.addColorStop(0, 'rgba(255,255,255,0.22)'); light.addColorStop(0.5, 'rgba(255,255,255,0)'); light.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = light; ctx.fillRect(0, 0, size, size);
  ctx.restore();
  return c;
}

/** dataURL заглушки (рисуется один раз и запоминается). */
export async function placeholderUrl(coin, side) {
  const key = `${coin.id}:${side}`;
  if (!cache.has(key)) {
    cache.set(key, fontsReady().then(() => drawPlaceholder(coin, side).toDataURL('image/webp', 0.86)));
  }
  return cache.get(key);
}

export function altText(coin, side, lang, i18n) {
  return `${tr(coin.title, lang)} — ${i18n[side === 'obverse' ? 'coin.obverse' : 'coin.reverse'].toLowerCase()}`;
}

/** <img> стороны монеты. Если файла нет — подставляет заглушку и ставит data-placeholder. */
export function coinImg(coin, side, { lang, i18n, eager = false, cls = '', sizes = '' } = {}) {
  const url = mediaUrl(coin, coin.media?.[side]);
  const img = document.createElement('img');
  img.alt = altText(coin, side, lang, i18n);
  img.decoding = 'async';
  img.loading = eager ? 'eager' : 'lazy';
  img.draggable = false;
  if (cls) img.className = cls;
  img.width = img.height = 800;
  img.dataset.full = url; // полноэкранный просмотр берёт оригинал
  // Уменьшенные копии лежат рядом: obverse-480.jpg, obverse-960.jpg (список размеров — media.sizes).
  const list = coin.media?.sizes;
  if (url && list?.length && !/^https?:\/\//.test(url) && !failed.has(url)) {
    const m = url.match(/^(.*)\.(\w+)$/);
    if (m) {
      img.srcset = [...list.map((s) => `${m[1]}-${s}.${m[2]} ${s}w`), `${url} 1280w`].join(', ');
      img.sizes = sizes || '(min-width: 960px) 45vw, 90vw';
    }
  }
  const usePlaceholder = () => {
    img.onerror = null;
    img.removeAttribute('srcset');
    failed.add(url);
    img.dataset.placeholder = '1';
    placeholderUrl(coin, side).then((src) => { img.src = src; img.dispatchEvent(new CustomEvent('placeholder', { bubbles: true })); });
  };
  if (!url || failed.has(url)) usePlaceholder();
  else { img.onerror = usePlaceholder; img.src = url; }
  return img;
}

/** Круглая текстура для 3D: фото, обрезанное по кругу, или заглушка. */
export async function faceCanvas(coin, side, size = 1024) {
  const url = mediaUrl(coin, coin.media?.[side]);
  const src = await new Promise((resolve) => {
    if (!url || failed.has(url)) return resolve(null);
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => { failed.add(url); resolve(null); };
    im.src = url;
  });
  if (!src) { await fontsReady(); return drawPlaceholder(coin, side, size); }
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#9a9ca1'; ctx.fillRect(0, 0, size, size);
  ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); ctx.clip();
  const s = Math.min(src.naturalWidth, src.naturalHeight); // монета по центру кадра
  ctx.drawImage(src, (src.naturalWidth - s) / 2, (src.naturalHeight - s) / 2, s, s, 0, 0, size, size);
  return c;
}
