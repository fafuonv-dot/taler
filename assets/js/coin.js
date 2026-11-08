// Страница монеты: аверс/реверс с переворотом, цена и связь, вкладки 3D · Фото · Видео · Характеристики.

import { coinImg } from './images.js';
import { mediaUrl } from './data.js';
import { openViewer } from './viewer.js';
import { hasWebGL } from './coin3d.js';
import { priceText, statusBadge, openRequest, shareCoin } from './shared.js';
import { h, icon, tr, isEmpty, yearNumber } from './util.js';

let dispose3d = null;
export function cleanupCoin() { dispose3d?.(); dispose3d = null; }

// ---------- Главный блок: монета, которую можно перевернуть ----------
function renderStage(state, coin) {
  const { lang, i18n } = state;
  const front = coinImg(coin, 'obverse', { lang, i18n, eager: true });
  const back = coinImg(coin, 'reverse', { lang, i18n, eager: true });
  front.style.viewTransitionName = `coin-${coin.id}`;
  const coinEl = h('div', { class: 'coin3d' },
    h('div', { class: 'coin3d-inner' },
      h('div', { class: 'coin3d-face front' }, front),
      h('div', { class: 'coin3d-face back' }, back)));

  const sideBtns = ['obverse', 'reverse'].map((side) =>
    h('button', { class: 'chip', type: 'button', 'aria-pressed': String(side === 'obverse'), onclick: () => setSide(side) }, i18n[`coin.${side}`]));
  const setSide = (side) => {
    coinEl.classList.toggle('is-reverse', side === 'reverse');
    sideBtns.forEach((b, i) => b.setAttribute('aria-pressed', String((i === 1) === (side === 'reverse'))));
  };
  const flip = () => setSide(coinEl.classList.contains('is-reverse') ? 'obverse' : 'reverse');
  const zoom = () => openViewer([
    { img: front, caption: `${tr(coin.title, lang)} · ${i18n['coin.obverse']}` },
    { img: back, caption: `${tr(coin.title, lang)} · ${i18n['coin.reverse']}` },
  ], coinEl.classList.contains('is-reverse') ? 1 : 0, i18n);

  const note = h('span', { class: 'stage-note', hidden: true }, i18n['coin.photoSoon']);
  const stage = h('div', { class: 'stage' },
    coinEl,
    h('button', { class: 'icon-btn stage-arrow prev', type: 'button', 'aria-label': i18n['coin.flip'], onclick: flip }, icon('back')),
    h('button', { class: 'icon-btn stage-arrow next', type: 'button', 'aria-label': i18n['coin.flip'], onclick: flip }, icon('next')),
    h('button', { class: 'icon-btn stage-zoom', type: 'button', 'aria-label': i18n['coin.zoom'], title: i18n['coin.zoom'], onclick: zoom }, icon('zoom')),
    note);
  stage.addEventListener('placeholder', () => { note.hidden = false; });
  if (front.dataset.placeholder || back.dataset.placeholder) note.hidden = false;

  // Нажатие на монету — во весь экран; свайп — перевернуть.
  let sx = null, swiped = false;
  coinEl.addEventListener('click', () => { if (!swiped) zoom(); });
  stage.addEventListener('pointerdown', (e) => { sx = e.clientX; swiped = false; });
  stage.addEventListener('pointerup', (e) => { if (sx != null && Math.abs(e.clientX - sx) > 40) { swiped = true; flip(); } sx = null; });
  stage.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') flip(); });

  return h('div', { class: 'stage-col' }, stage, h('div', { class: 'side-switch', role: 'group', 'aria-label': `${i18n['coin.obverse']} / ${i18n['coin.reverse']}` }, ...sideBtns));
}

// ---------- Название, цена, кнопки ----------
function renderInfo(state, coin) {
  const { lang, i18n } = state;
  const sub = [tr(coin.ruler, lang), tr(coin.year, lang)].filter(Boolean).join(' · ');
  const fact = (label, value) => !isEmpty(value) && h('div', { class: 'fact' }, h('dt', {}, label), h('dd', {}, value));
  return h('div', { class: 'coin-info' },
    statusBadge(coin, i18n, 'badge-static'),
    h('h1', {}, tr(coin.title, lang)),
    sub && h('p', { class: 'coin-sub' }, sub),
    priceText(state, coin, 'coin-price'),
    h('div', { class: 'coin-actions' },
      h('button', { class: 'btn btn-primary', type: 'button', onclick: () => openRequest(state, coin), disabled: coin.status === 'sold' }, icon('chat'), i18n['coin.request']),
      h('button', { class: 'btn', type: 'button', onclick: () => shareCoin(state, coin) }, icon('share'), i18n['coin.share'])),
    h('dl', { class: 'facts' },
      fact(i18n['spec.nominal'], tr(coin.nominal, lang)),
      fact(i18n['spec.grade'], coin.grade?.value ? `${coin.grade.value}` : ''),
      fact(i18n['spec.mint'], tr(coin.mint, lang)),
      fact(i18n['spec.metal'], [tr(coin.metal, lang), coin.fineness].filter(Boolean).join(' ')),
    ),
    !isEmpty(coin.description) && h('p', { class: 'coin-desc' }, tr(coin.description, lang)));
}

/** Вес или диаметр. Если взяты из справочника (specs_source: "reference") — с «≈» и пометкой. */
export function measure(coin, field, unit, state) {
  const v = coin[field];
  if (v == null || v === '') return '';
  const num = String(v).replace('.', state.lang === 'ru' ? ',' : '.').replace(',', state.lang === 'ru' ? ',' : '.');
  if (coin.specs_source !== 'reference') return `${num} ${unit}`;
  return h('span', {}, `≈ ${num} ${unit} `, h('span', { class: 'spec-note' }, state.i18n['spec.reference']));
}

// ---------- Вкладки ----------
function specsPanel(state, coin) {
  const { lang, i18n } = state;
  const rows = [];
  const row = (label, value) => { if (!isEmpty(value)) rows.push(h('tr', {}, h('th', { scope: 'row' }, label), h('td', {}, value))); };
  row(i18n['spec.issuer'], tr(coin.issuer, lang));
  row(i18n['spec.ruler'], tr(coin.ruler, lang));
  row(i18n['spec.nominal'], tr(coin.nominal, lang));
  row(i18n['spec.year'], tr(coin.year, lang));
  row(i18n['spec.mint'], tr(coin.mint, lang));
  row(i18n['spec.metal'], tr(coin.metal, lang));
  row(i18n['spec.fineness'], coin.fineness);
  row(i18n['spec.weight'], measure(coin, 'weight_g', i18n['unit.g'], state));
  row(i18n['spec.diameter'], measure(coin, 'diameter_mm', i18n['unit.mm'], state));
  row(i18n['spec.edge'], tr(coin.edge, lang));
  const cats = Object.entries(coin.catalog || {}).filter(([, v]) => v);
  if (cats.length) row(i18n['spec.catalog'], h('span', { class: 'ref-list' }, ...cats.map(([k, v]) => h('span', { class: 'num' }, `${k === 'Dav' ? 'Dav.' : k} ${v}`))));
  row(i18n['spec.legendObv'], coin.legend?.obverse && h('span', { class: 'legend-text' }, coin.legend.obverse));
  row(i18n['spec.legendRev'], coin.legend?.reverse && h('span', { class: 'legend-text' }, coin.legend.reverse));
  row(i18n['spec.grade'], coin.grade?.value && `${coin.grade.value} — ${i18n['spec.sheldon']}`);
  row(i18n['spec.cert'], [coin.grade?.service, coin.grade?.cert].filter(Boolean).join(' № '));
  row(i18n['spec.rarity'], tr(coin.rarity, lang));
  row(i18n['spec.provenance'], tr(coin.provenance, lang));
  row(i18n['spec.condition'], tr(coin.condition_notes, lang));
  row(i18n['spec.description'], tr(coin.description, lang));
  if (coin.links?.length) row(i18n['spec.links'], h('span', { class: 'ref-list' },
    ...coin.links.map((l) => h('a', { class: 'ext-link', href: l.url, target: '_blank', rel: 'noopener' }, l.title, ' ↗'))));
  return h('div', { class: 'specs-wrap' }, h('table', { class: 'spec-table' }, h('tbody', {}, ...rows)));
}

function photosPanel(state, coin) {
  const { lang, i18n } = state;
  const side = (s) => ({ make: () => coinImg(coin, s, { lang, i18n }), caption: i18n[`coin.${s}`] });
  const items = [
    side('obverse'), side('reverse'),
    ...(coin.media?.gallery || []).map((g) => {
      const file = typeof g === 'string' ? g : g.src;
      const caption = tr(g.caption, lang) || '';
      return { make: () => h('img', { src: mediaUrl(coin, file), alt: `${tr(coin.title, lang)} — ${caption}`, loading: 'lazy' }), caption };
    }),
  ];
  items.forEach((it) => { it.img = it.make(); });
  let current = 0;
  const main = h('div', { class: 'gallery-main' });
  const cap = h('p', { class: 'gallery-caption' });
  const thumbs = items.map((it, i) =>
    h('button', { class: 'thumb', type: 'button', 'aria-label': it.caption, onclick: () => select(i) }, it.make()));
  const select = (i) => {
    current = (i + items.length) % items.length;
    main.replaceChildren(items[current].img);
    cap.textContent = items[current].caption;
    thumbs.forEach((b, j) => b.setAttribute('aria-current', String(j === current)));
  };
  items.forEach((it, i) => { it.img.addEventListener('click', () => openViewer(items, i, i18n)); });
  let sx = null;
  main.addEventListener('pointerdown', (e) => { sx = e.clientX; });
  main.addEventListener('pointerup', (e) => { if (sx != null && Math.abs(e.clientX - sx) > 40) select(current + (e.clientX < sx ? 1 : -1)); sx = null; });
  select(0);
  return h('div', {}, main, cap, h('div', { class: 'thumbs' }, ...thumbs));
}

function videoPanel(state, coin) {
  const { i18n, lang } = state;
  const vids = coin.media?.videos || [];
  if (!vids.length) return h('div', { class: 'video-soon' }, icon('video'), h('p', {}, i18n['video.soon']));
  // Полноценный плеер (файлы и YouTube/VK/RuTube по клику) — на этапе 2.
  return h('div', {}, ...vids.map((v) => v.type === 'file'
    ? h('video', { src: mediaUrl(coin, v.src), poster: mediaUrl(coin, v.poster), controls: true, preload: 'none', playsinline: true, muted: true, style: { width: '100%', borderRadius: '14px' } })
    : h('a', { class: 'btn', href: v.src, target: '_blank', rel: 'noopener' }, icon('video'), tr(v.title, lang) || v.src)));
}

function threeDPanel(state, coin) {
  const { lang, i18n } = state;
  const poster = h('div', { class: 'poster' }, coinImg(coin, 'obverse', { lang, i18n }), h('span', {}, i18n['3d.loading']));
  const panel = h('div', { class: 'panel-3d' }, poster);
  panel.mount = async () => {
    if (panel.dataset.mounted) return;
    panel.dataset.mounted = '1';
    if (!hasWebGL()) {
      // Нет WebGL — показываем обе стороны с переворотом.
      const c = h('div', { class: 'coin3d' }, h('div', { class: 'coin3d-inner' },
        h('div', { class: 'coin3d-face front' }, coinImg(coin, 'obverse', { lang, i18n })),
        h('div', { class: 'coin3d-face back' }, coinImg(coin, 'reverse', { lang, i18n }))));
      panel.replaceChildren(h('div', { class: 'fallback-2d' }, c,
        h('button', { class: 'btn', type: 'button', onclick: () => c.classList.toggle('is-reverse') }, i18n['coin.flip']),
        h('p', { class: 'hint' }, i18n['3d.noWebgl'])));
      return;
    }
    try {
      const { mountCoin3D } = await import('./coin3d.js');
      cleanupCoin();
      dispose3d = await mountCoin3D(panel, coin, { labels: i18n, onReady: () => panel.classList.add('is-ready') });
    } catch (err) {
      console.error('3D не запустилось:', err);
      panel.dataset.mounted = '';
    }
  };
  return panel;
}

function renderTabs(state, coin) {
  const { i18n } = state;
  const defs = [
    ['3d', i18n['tab.3d'], () => threeDPanel(state, coin)],
    ['photos', i18n['tab.photos'], () => photosPanel(state, coin)],
    ['video', i18n['tab.video'], () => videoPanel(state, coin)],
    ['specs', i18n['tab.specs'], () => specsPanel(state, coin)],
  ];
  const panels = new Map();
  const tabs = defs.map(([key, label]) => h('button', {
    class: 'tab', type: 'button', role: 'tab', id: `tab-${key}`, 'aria-controls': `panel-${key}`, 'aria-selected': 'false', tabindex: '-1',
    onclick: () => select(key),
  }, label));
  const holder = h('div', {});
  const select = (key, focus = false) => {
    defs.forEach(([k], i) => {
      const on = k === key;
      tabs[i].setAttribute('aria-selected', String(on));
      tabs[i].tabIndex = on ? 0 : -1;
      if (on && focus) tabs[i].focus();
    });
    if (!panels.has(key)) {
      const [, , make] = defs.find(([k]) => k === key);
      const content = make();
      panels.set(key, h('div', { class: 'tabpanel', role: 'tabpanel', id: `panel-${key}`, 'aria-labelledby': `tab-${key}`, tabindex: '0' }, content));
    }
    holder.replaceChildren(panels.get(key));
    const content = panels.get(key).firstChild;
    content.mount?.(); // 3D грузится только здесь
  };
  const keys = defs.map(([k]) => k);
  const tablist = h('div', { class: 'tablist', role: 'tablist', 'aria-label': i18n['tab.specs'] }, ...tabs);
  tablist.addEventListener('keydown', (e) => {
    const cur = keys.indexOf(tabs.find((t) => t.getAttribute('aria-selected') === 'true').id.slice(4));
    if (e.key === 'ArrowRight') select(keys[(cur + 1) % keys.length], true);
    if (e.key === 'ArrowLeft') select(keys[(cur - 1 + keys.length) % keys.length], true);
  });
  // На телефоне вкладки листаются свайпом (кроме 3D — там свайп вращает монету).
  let sx = null, sy = null;
  holder.addEventListener('touchstart', (e) => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; }, { passive: true });
  holder.addEventListener('touchend', (e) => {
    if (sx == null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy;
    sx = null;
    const cur = tabs.findIndex((tb) => tb.getAttribute('aria-selected') === 'true');
    if (keys[cur] === '3d' || keys[cur] === 'photos' || Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx)) return;
    select(keys[Math.min(keys.length - 1, Math.max(0, cur + (dx < 0 ? 1 : -1)))]);
  }, { passive: true });

  select('specs');
  return h('section', { class: 'tabs' }, tablist, holder);
}

function renderSimilar(state, coin) {
  const { coins, lang, i18n } = state;
  const y = yearNumber(coin.year) ?? 0;
  const list = coins.filter((c) => c.id !== coin.id)
    .map((c) => ({ c, score: (tr(c.ruler, 'ru') === tr(coin.ruler, 'ru') ? 100 : 0) - Math.abs((yearNumber(c.year) ?? 0) - y) / 10 }))
    .sort((a, b) => b.score - a.score).slice(0, 4).map(({ c }) => c);
  if (!list.length) return null;
  return h('section', { class: 'similar', 'aria-labelledby': 'similar-title' },
    h('h2', { id: 'similar-title' }, i18n['coin.similar']),
    h('div', { class: 'grid' }, ...list.map((c) => h('article', { class: 'card' },
      h('a', { class: 'card-link', href: `#/coin/${c.id}` },
        statusBadge(c, i18n),
        h('div', { class: 'card-media' }, h('div', { class: 'card-coin' }, coinImg(c, 'obverse', { lang, i18n }))),
        h('div', { class: 'card-body' },
          h('h3', { class: 'card-title' }, tr(c.title, lang)),
          h('p', { class: 'card-meta' }, [tr(c.year, lang), tr(c.nominal, lang)].filter(Boolean).join(' · ')),
          h('div', { class: 'card-foot' }, h('span', { class: 'grade' }, c.grade?.value || ''), priceText(state, c))))))));
}

export function renderCoin(state, id) {
  const { coins, i18n } = state;
  const coin = coins.find((c) => c.id === id);
  if (!coin) {
    return h('div', { class: 'container not-found' },
      h('h1', {}, i18n['coin.notFound']),
      h('a', { class: 'btn btn-primary', href: '#/' }, i18n['coin.toCatalog']));
  }
  return h('article', { class: 'container coin-page' },
    // «Назад» ведёт в каталог с тем же поиском и фильтрами, что были открыты.
    h('a', { class: 'back-link', href: state.lastCatalogHash || '#/' }, icon('back'), i18n['coin.back']),
    h('div', { class: 'coin-main' }, renderStage(state, coin), renderInfo(state, coin)),
    renderTabs(state, coin),
    renderSimilar(state, coin));
}
