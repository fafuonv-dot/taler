// Сравнение монет: клиент отмечает до 3 монет и видит их рядом.
// Выбор живёт в адресе страницы (#/compare?ids=a,b,c), поэтому сравнением можно поделиться.

import { coinImg } from './images.js';
import { priceText, statusBadge } from './shared.js';
import { h, icon, tr, toast } from './util.js';

const MAX = 3;
let selected = [];
try { selected = JSON.parse(sessionStorage.getItem('compare') || '[]'); } catch { selected = []; }
const listeners = new Set();

function save() {
  try { sessionStorage.setItem('compare', JSON.stringify(selected)); } catch { /* приватный режим */ }
  listeners.forEach((fn) => fn());
}

export const compareLink = (ids = selected) => `#/compare?ids=${ids.map(encodeURIComponent).join(',')}`;

export function toggleCompare(state, id) {
  if (selected.includes(id)) selected = selected.filter((x) => x !== id);
  else if (selected.length >= MAX) { toast(state.i18n['compare.limit']); return; }
  else selected = [...selected, id];
  save();
}

/** Кнопка «Сравнить» на карточке каталога. */
export function compareToggle(state, coin) {
  const { i18n } = state;
  const btn = h('button', { class: 'compare-toggle', type: 'button' });
  const paint = () => {
    const on = selected.includes(coin.id);
    btn.setAttribute('aria-pressed', String(on));
    btn.textContent = on ? `✓ ${i18n['compare.added']}` : `+ ${i18n['compare.add']}`;
    btn.setAttribute('aria-label', `${on ? i18n['compare.remove'] : i18n['compare.add']}: ${tr(coin.title, state.lang)}`);
  };
  btn.addEventListener('click', () => toggleCompare(state, coin.id));
  listeners.add(() => { if (btn.isConnected) paint(); });
  paint();
  return btn;
}

/** Плашка внизу экрана: «Выбрано 2 из 3 · Сравнить · Очистить». */
export function mountCompareBar(state) {
  const { i18n } = state;
  document.querySelector('.compare-bar')?.remove();
  const count = h('span', { class: 'num' });
  const open = h('a', { class: 'btn btn-primary' }, i18n['compare.open']);
  const bar = h('div', { class: 'compare-bar', role: 'region', 'aria-label': i18n['compare.title'] },
    count, open,
    h('button', { class: 'link-btn', type: 'button', onclick: () => { selected = []; save(); } }, i18n['compare.clear']));
  const paint = () => {
    const onComparePage = location.hash.startsWith('#/compare');
    bar.hidden = selected.length === 0 || onComparePage;
    count.textContent = i18n['compare.count'].replace('{n}', selected.length);
    open.href = compareLink();
    open.toggleAttribute('aria-disabled', selected.length < 2);
    open.classList.toggle('is-disabled', selected.length < 2);
  };
  listeners.add(paint);
  window.addEventListener('hashchange', paint);
  document.body.append(bar);
  paint();
}

/** Страница сравнения. */
export function renderCompare(state, ids, measure) {
  const { coins, lang, i18n } = state;
  const list = ids.map((id) => coins.find((c) => c.id === id)).filter(Boolean).slice(0, MAX);
  // Сравнение, открытое по ссылке, становится текущим выбором.
  if (list.length) { selected = list.map((c) => c.id); save(); }

  const back = h('a', { class: 'back-link', href: state.lastCatalogHash || '#/' }, icon('back'), i18n['coin.back']);
  if (!list.length) {
    return h('div', { class: 'container coin-page' }, back,
      h('div', { class: 'state-msg' }, h('h1', {}, i18n['compare.title']), h('p', {}, i18n['compare.empty'])));
  }

  const rows = [
    [i18n['spec.year'], (c) => tr(c.year, lang)],
    [i18n['spec.ruler'], (c) => tr(c.ruler, lang)],
    [i18n['spec.nominal'], (c) => tr(c.nominal, lang)],
    [i18n['spec.weight'], (c) => measure(c, 'weight_g', i18n['unit.g'], state)],
    [i18n['spec.diameter'], (c) => measure(c, 'diameter_mm', i18n['unit.mm'], state)],
    [i18n['spec.grade'], (c) => c.grade?.value || ''],
    [i18n['spec.metal'], (c) => [tr(c.metal, lang), c.fineness].filter(Boolean).join(' ')],
    [i18n['spec.condition'], (c) => tr(c.condition_notes, lang)],
  ];

  const head = h('tr', {}, h('th', { scope: 'col' }, h('span', { class: 'visually-hidden' }, i18n['compare.title'])),
    ...list.map((c) => h('th', { scope: 'col', class: 'cmp-coin' },
      h('a', { href: `#/coin/${c.id}`, class: 'cmp-link' },
        h('div', { class: 'card-coin cmp-img' }, coinImg(c, 'obverse', { lang, i18n, sizes: '30vw' })),
        h('span', { class: 'cmp-title' }, tr(c.title, lang))),
      statusBadge(c, i18n, 'badge-static'),
      priceText(state, c),
      h('button', { class: 'link-btn', type: 'button', onclick: () => {
        const rest = list.filter((x) => x.id !== c.id).map((x) => x.id);
        selected = rest; save();
        location.hash = rest.length ? compareLink(rest) : (state.lastCatalogHash || '#/');
      } }, i18n['compare.remove']))));

  const body = rows.map(([label, get]) => h('tr', {}, h('th', { scope: 'row' }, label),
    ...list.map((c) => h('td', {}, get(c) || '—'))));

  return h('div', { class: 'container coin-page' }, back,
    h('h1', { class: 'cmp-h1' }, i18n['compare.title']),
    h('div', { class: 'cmp-scroll' }, h('table', { class: 'spec-table cmp-table' }, h('thead', {}, head), h('tbody', {}, ...body))));
}
