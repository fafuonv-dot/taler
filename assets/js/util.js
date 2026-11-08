// Небольшие помощники, которыми пользуются все модули.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Создаёт элемент: h('a', {href: '#', class: 'x'}, 'текст', otherNode) */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/** Текст в нужном языке: поле может быть строкой или {ru, en}. */
export function tr(value, lang) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return value[lang] ?? value.ru ?? Object.values(value)[0] ?? '';
}

export const isEmpty = (v) =>
  v == null || v === false || v === '' || (Array.isArray(v) && v.length === 0) ||
  (!(v instanceof Node) &&
  typeof v === 'object' && !Array.isArray(v) && Object.values(v).every(isEmpty));

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function plural(n, forms, lang) {
  if (lang !== 'ru') return n === 1 ? forms[0] : forms[1];
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return forms[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return forms[1];
  return forms[2];
}

/** Первый четырёхзначный год из строки вроде «без даты (1711–1740)». */
export function yearNumber(year) {
  const m = tr(year, 'ru').match(/\d{4}/);
  return m ? Number(m[0]) : null;
}

export function formatMoney(amount, currency, lang) {
  return new Intl.NumberFormat(lang === 'ru' ? 'ru-RU' : 'en-US', {
    style: 'currency', currency, maximumFractionDigits: 0,
  }).format(amount);
}

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function storage(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch { /* приватный режим — просто не запоминаем */ }
  return null;
}

let toastTimer;
export function toast(text) {
  document.querySelector('.toast')?.remove();
  const el = h('div', { class: 'toast', role: 'status' }, text);
  document.body.append(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 2400);
}

/** Иконки в одном месте, чтобы не тянуть отдельную библиотеку. */
const ICONS = {
  back: '<path d="M15 6l-6 6 6 6"/>',
  next: '<path d="M9 6l6 6-6 6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  zoom: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  share: '<path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
  chat: '<path d="M4 5h16v11H8l-4 4z"/>',
  telegram: '<path d="M21 4 3 11l6 2 2 6 3-4 5 4z"/><path d="m9 13 8-6"/>',
  whatsapp: '<path d="M4 20l1.4-4.2A8 8 0 1 1 8.4 18.7z"/><path d="M9 9.5c.5 2.5 2.5 4.5 5 5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  reset: '<path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v5h5"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
};
export function icon(name) {
  const span = document.createElement('span');
  span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  return span.firstChild;
}
