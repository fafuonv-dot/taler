// Главная: заставка, короткий текст, каталог с поиском, фильтрами, сортировкой и сравнением.

import { coinImg } from './images.js';
import { search, highlight } from './search.js';
import { h, icon, tr, plural, yearNumber, reducedMotion } from './util.js';
import { priceText, statusBadge } from './shared.js';
import { compareToggle } from './compare.js';

const SORTS = ['order', 'year_asc', 'year_desc', 'price_asc', 'price_desc', 'added'];

// Ценовые диапазоны для фильтра «Цена» (в рублях).
const PRICE_BANDS = [
  ['0-300000', 0, 300000], ['300000-1000000', 300000, 1000000], ['1000000-', 1000000, Infinity],
];
const band = (c) => {
  const a = c.price?.amount;
  if (a == null || c.price?.show === false) return '';
  return PRICE_BANDS.find(([, lo, hi]) => a >= lo && a < hi)?.[0] || '';
};

/**
 * Все фильтры в одном месте. Группа появляется сама, только если у монет
 * есть хотя бы два разных значения — пустых или бесполезных фильтров клиент не увидит.
 * value — ключ для адреса страницы, text — подпись на кнопке.
 */
function filterDefs(state) {
  const { lang, i18n } = state;
  const yesNo = (v) => (v ? 'yes' : 'no');
  return [
    { key: 'ruler', label: i18n['filter.ruler'], value: (c) => tr(c.ruler, 'ru'), text: (c) => tr(c.ruler, lang), sortBy: (c) => yearNumber(c.year) ?? 0 },
    { key: 'metal', label: i18n['spec.metal'], value: (c) => tr(c.metal, 'ru'), text: (c) => tr(c.metal, lang) },
    { key: 'mint', label: i18n['spec.mint'], value: (c) => tr(c.mint, 'ru'), text: (c) => tr(c.mint, lang) },
    { key: 'grade', label: i18n['spec.grade'], value: (c) => c.grade?.value || '', text: (c) => c.grade?.value || '' },
    { key: 'price', label: i18n['filter.price'], value: band, text: (c) => i18n[`price.band.${band(c)}`] },
    { key: 'status', label: i18n['filter.status'], value: (c) => c.status || 'available', text: (c) => i18n[`status.${c.status || 'available'}`] },
    { key: 'video', label: i18n['filter.video'], value: (c) => yesNo(c.media?.videos?.length), text: (c) => i18n[`filter.${yesNo(c.media?.videos?.length)}`] },
    { key: 'glb', label: i18n['filter.glb'], value: (c) => yesNo(c.media?.model3d?.src), text: (c) => i18n[`filter.${yesNo(c.media?.model3d?.src)}`] },
  ];
}
const FILTER_KEYS = ['ruler', 'metal', 'mint', 'grade', 'price', 'status', 'video', 'glb'];
const clearAll = () => Object.fromEntries(['q', ...FILTER_KEYS].map((k) => [k, null]));

export const hasActiveFilters = (p) => ['q', ...FILTER_KEYS].some((k) => p.get(k));

/** Применяет поиск, фильтры и сортировку. */
export function applyQuery(state, params) {
  const q = params.get('q') || '';
  let list = search(state.index, q);
  for (const f of filterDefs(state)) {
    const want = params.get(f.key);
    if (want) list = list.filter(({ coin }) => f.value(coin) === want);
  }
  const sort = params.get('sort') || (q ? 'relevance' : 'order');
  const by = {
    order: (a, b) => (a.coin.order ?? 999) - (b.coin.order ?? 999),
    year_asc: (a, b) => (yearNumber(a.coin.year) ?? 9999) - (yearNumber(b.coin.year) ?? 9999),
    year_desc: (a, b) => (yearNumber(b.coin.year) ?? 0) - (yearNumber(a.coin.year) ?? 0),
    price_asc: (a, b) => (a.coin.price?.amount ?? Infinity) - (b.coin.price?.amount ?? Infinity),
    price_desc: (a, b) => (b.coin.price?.amount ?? -1) - (a.coin.price?.amount ?? -1),
    added: (a, b) => String(b.coin.added || '').localeCompare(String(a.coin.added || '')),
  }[sort];
  if (by) list = [...list].sort(by);
  return { list, sort, q };
}

// ---------- Заставка ----------
function renderHero(state) {
  const { config, coins, lang, i18n } = state;
  const featured = coins.find((c) => c.featured) || coins[0];
  // все годы из строк вроде «без даты (1711–1740)», чтобы период учитывал обе границы
  const years = coins.flatMap((c) => (tr(c.year, 'ru').match(/\d{4}/g) || []).map(Number));
  const period = years.length ? `${Math.min(...years)}–${Math.max(...years)}` : '';

  const coinEl = h('div', { class: 'coin3d spin', 'aria-hidden': 'true' },
    h('div', { class: 'coin3d-inner' },
      h('div', { class: 'coin3d-face front' }, coinImg(featured, 'obverse', { lang, i18n, eager: true })),
      h('div', { class: 'coin3d-face back' }, coinImg(featured, 'reverse', { lang, i18n, eager: true }))));
  const parallax = h('a', { class: 'hero-parallax', href: `#/coin/${featured.id}`, 'aria-label': tr(featured.title, lang) }, coinEl);

  const stat = (value, label) => h('div', { class: 'stat' }, h('div', { class: 'stat-value num' }, value), h('div', { class: 'stat-label' }, label));

  const hero = h('section', { class: 'hero', 'aria-labelledby': 'hero-title' },
    h('div', { class: 'container hero-inner' },
      h('div', { class: 'hero-copy' },
        h('p', { class: 'eyebrow' }, i18n['hero.eyebrow']),
        h('h1', { id: 'hero-title' }, tr(config.title, lang)),
        h('p', { class: 'hero-about' }, tr(config.about, lang)),
        h('div', { class: 'hero-actions' },
          h('a', { class: 'btn btn-primary', href: '#catalog', onclick: (e) => { e.preventDefault(); document.getElementById('catalog')?.scrollIntoView(); document.getElementById('catalog-title')?.focus({ preventScroll: true }); } }, i18n['hero.cta'])),
        h('div', { class: 'stats' },
          stat(String(coins.length), i18n['stats.coins']),
          period && stat(period, i18n['stats.period']),
          stat(tr(featured.mint, lang) || '—', i18n['stats.mint']))),
      h('div', { class: 'hero-stage' }, parallax)));

  // Медленный параллакс при прокрутке
  if (!reducedMotion()) {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return; ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        if (!parallax.isConnected) { window.removeEventListener('scroll', onScroll); return; }
        parallax.style.transform = `translate3d(0, ${Math.min(window.scrollY, 800) * 0.12}px, 0)`;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
  }
  return hero;
}

// ---------- Карточка в сетке ----------
function renderCard(state, coin, terms, i) {
  const { lang, i18n } = state;
  const img = coinImg(coin, 'obverse', { lang, i18n, eager: i < 4, sizes: '(min-width: 1400px) 22vw, (min-width: 960px) 25vw, (min-width: 560px) 37vw, 74vw' });
  img.style.viewTransitionName = `coin-${coin.id}`;
  const meta = [tr(coin.year, lang), tr(coin.nominal, lang)].filter(Boolean).join(' · ');
  return h('article', { class: 'card reveal', style: { '--d': `${Math.min(i, 8) * 60}ms` } },
    h('a', { class: 'card-link', href: `#/coin/${coin.id}` },
      statusBadge(coin, i18n),
      h('div', { class: 'card-media' }, h('div', { class: 'card-coin' }, img)),
      h('div', { class: 'card-body' },
        h('h3', { class: 'card-title' }, ...highlight(tr(coin.title, lang), terms)),
        h('p', { class: 'card-meta' }, ...highlight(meta, terms)),
        h('div', { class: 'card-foot' },
          h('span', { class: 'grade' }, coin.grade?.value || ''),
          priceText(state, coin)))),
    compareToggle(state, coin)); // кнопка вне ссылки, чтобы не открывать монету при нажатии
}

let revealObserver;
function observeReveal(root) {
  if (reducedMotion() || !('IntersectionObserver' in window)) { root.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-in')); return; }
  revealObserver ??= new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); revealObserver.unobserve(e.target); }
  }, { rootMargin: '0px 0px -40px 0px' });
  root.querySelectorAll('.reveal:not(.is-in)').forEach((el) => revealObserver.observe(el));
}

// ---------- Панель фильтров ----------
function renderToolbar(state, params, setParams) {
  const { coins, i18n } = state;
  const chip = (label, active, onclick) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(active), onclick }, label);

  const groups = [];
  const active = [];
  if (params.get('q')) active.push(['q', `«${params.get('q')}»`]);

  for (const f of filterDefs(state)) {
    const options = new Map(); // value -> монета-пример (для подписи и сортировки)
    for (const c of coins) { const v = f.value(c); if (v && !options.has(v)) options.set(v, c); }
    const cur = params.get(f.key) || '';
    if (cur && options.has(cur)) active.push([f.key, f.text(options.get(cur))]);
    if (options.size < 2) continue;
    let items = [...options.entries()];
    if (f.sortBy) items.sort((a, b) => f.sortBy(a[1]) - f.sortBy(b[1]));
    groups.push(h('div', { class: 'filter-group', role: 'group', 'aria-label': f.label },
      h('span', { class: 'filter-label', 'aria-hidden': 'true' }, f.label),
      chip(i18n['filter.all'], !cur, () => setParams({ [f.key]: null })),
      ...items.map(([v, c]) => chip(f.text(c), cur === v, () => setParams({ [f.key]: cur === v ? null : v })))));
  }

  const sortSel = h('select', { id: 'sort', onchange: (e) => setParams({ sort: e.target.value === 'order' ? null : e.target.value }) },
    ...(params.get('q') ? ['relevance', ...SORTS] : SORTS).map((s) => h('option', { value: s }, i18n[`sort.${s}`])));
  sortSel.value = params.get('sort') || (params.get('q') ? 'relevance' : 'order');

  return h('div', { class: 'toolbar' },
    ...groups,
    h('div', { class: 'toolbar-row' },
      h('div', { class: 'active-chips' },
        ...active.map(([k, label]) => h('span', { class: 'active-chip' }, label,
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': `${i18n['filter.removeChip']}: ${label}`, onclick: () => setParams({ [k]: null }) }, icon('close')))),
        active.length > 1 && h('button', { class: 'link-btn', type: 'button', onclick: () => setParams(clearAll()) }, i18n['filter.reset'])),
      h('label', { class: 'select-wrap', for: 'sort' }, i18n['sort.label'], sortSel)));
}

/** Перерисовывает только каталог (без заставки) — при вводе в поиск фокус не теряется. */
export function updateCatalog(state, params, setParams) {
  const section = document.getElementById('catalog');
  if (!section) return;
  const { lang, i18n } = state;
  const { list, q } = applyQuery(state, params);

  document.querySelector('.hero')?.toggleAttribute('hidden', hasActiveFilters(params));

  section.querySelector('.count').textContent = `${list.length} ${plural(list.length, i18n['plural.coin'], lang)}`;
  section.querySelector('.toolbar').replaceWith(renderToolbar(state, params, setParams));

  const grid = section.querySelector('.grid-wrap');
  grid.replaceChildren(list.length
    ? h('div', { class: 'grid' }, ...list.map(({ coin, terms: t }, i) => renderCard(state, coin, q ? t : [], i)))
    : h('div', { class: 'empty', role: 'status' },
        h('h3', {}, i18n['empty.title']),
        h('p', {}, i18n['empty.text']),
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => setParams(clearAll()) }, i18n['empty.reset'])));
  observeReveal(grid);
}

export function renderHome(state, params, setParams) {
  const { i18n } = state;
  const frag = document.createDocumentFragment();
  frag.append(renderHero(state));
  frag.append(h('section', { class: 'catalog container', id: 'catalog', 'aria-labelledby': 'catalog-title' },
    h('div', { class: 'catalog-head' },
      h('h2', { id: 'catalog-title', tabindex: '-1' }, i18n['catalog.title']),
      h('span', { class: 'count num', 'aria-live': 'polite' })),
    h('div', { class: 'toolbar' }),
    h('div', { class: 'grid-wrap' })));
  return frag;
}
