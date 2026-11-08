// Точка входа: загрузка данных, маршруты (#/ и #/coin/<id>), шапка, язык, тема.

import { loadData, loadI18n } from './data.js';
import { buildIndex } from './search.js';
import { renderHome, updateCatalog } from './catalog.js';
import { renderCoin, cleanupCoin, measure } from './coin.js';
import { renderCompare, mountCompareBar } from './compare.js';
import { setShareIds } from './shared.js';
import { $, h, icon, tr, storage, toast, reducedMotion } from './util.js';

const state = { config: null, coins: [], index: [], lang: 'ru', i18n: {}, currency: 'RUB', view: null, lastCatalogHash: '#/', homeScroll: 0 };
const app = $('#app');
const qInput = $('#q');

// ---------- Адрес страницы ----------
function parseHash() {
  const raw = location.hash.slice(1) || '/';
  const [path, qs = ''] = raw.split('?');
  return { path, params: new URLSearchParams(qs) };
}
const hashFor = (params) => { const s = params.toString(); return s ? `#/?${s}` : '#/'; };

/** Меняет поиск/фильтры. push=true — с записью в историю (кнопка «Назад» вернёт прежний выбор). */
function setParams(patch, { push = true } = {}) {
  const { path, params } = parseHash();
  const next = state.view === 'home' ? params : new URLSearchParams();
  for (const [k, v] of Object.entries(patch)) { if (v == null || v === '') next.delete(k); else next.set(k, v); }
  const hash = hashFor(next);
  if (state.view !== 'home') { location.hash = hash; return; } // со страницы монеты — в каталог
  history[push ? 'pushState' : 'replaceState'](null, '', hash);
  state.lastCatalogHash = hash;
  updateCatalog(state, next, setParams);
  syncSearchInput(next);
}

function syncSearchInput(params) {
  const q = params.get('q') || '';
  if (document.activeElement !== qInput) qInput.value = q;
  $('#q-clear').hidden = !qInput.value;
}

// ---------- Отрисовка ----------
function withTransition(fn) {
  // Первая отрисовка — без анимации: переходить не из чего, а первый экран должен появиться сразу.
  if (state.view === null || !document.startViewTransition || reducedMotion() || document.visibilityState !== 'visible') { fn(); return; }
  // Отрисовка обязана случиться, даже если браузер прервёт анимацию (быстрый клик, скрытая вкладка).
  let done = false;
  const run = () => { if (!done) { done = true; fn(); } };
  const t = document.startViewTransition(run);
  t.updateCallbackDone.catch((err) => { if (done) console.error(err); });
  t.ready.catch(() => {});
  t.finished.catch(() => {}).finally(run);
}

function route() {
  const { path, params } = parseHash();
  const coinMatch = path.match(/^\/coin\/([\w-]+)/);
  syncSearchInput(params);

  if (coinMatch) {
    if (state.view === 'home') state.homeScroll = window.scrollY;
    withTransition(() => {
      cleanupCoin();
      app.replaceChildren(renderCoin(state, coinMatch[1]));
      state.view = 'coin';
      window.scrollTo(0, 0);
      const coin = state.coins.find((c) => c.id === coinMatch[1]);
      document.title = coin ? `${tr(coin.title, state.lang)} — ${tr(state.config.title, state.lang)}` : tr(state.config.title, state.lang);
    });
    return;
  }

  if (path.startsWith('/compare')) {
    if (state.view === 'home') state.homeScroll = window.scrollY;
    cleanupCoin();
    app.replaceChildren(renderCompare(state, (params.get('ids') || '').split(',').filter(Boolean), measure));
    state.view = 'compare';
    window.scrollTo(0, 0);
    document.title = `${state.i18n['compare.title']} — ${tr(state.config.title, state.lang)}`;
    return;
  }

  state.lastCatalogHash = hashFor(params);
  if (state.view === 'home') { updateCatalog(state, params, setParams); return; }
  const fromCoin = state.view === 'coin' || state.view === 'compare';
  withTransition(() => {
    cleanupCoin();
    app.replaceChildren(renderHome(state, params, setParams));
    state.view = 'home';
    updateCatalog(state, params, setParams);
    document.title = `${tr(state.config.title, state.lang)} — ${state.i18n['hero.eyebrow'].toLowerCase()}`;
    if (fromCoin) window.scrollTo(0, state.homeScroll);
  });
}

function rerender() { state.view = null; route(); }

// ---------- Шапка: тексты, язык, тема ----------
function applyTexts() {
  const { i18n, config, lang } = state;
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = i18n[el.dataset.i18n] ?? el.textContent; });
  qInput.placeholder = i18n['search.placeholder'];
  $('#brand-title').textContent = tr(config.title, lang);
  $('#brand-sub').textContent = tr(config.subtitle, lang);
  $('#footer-title').textContent = `© ${tr(config.title, lang)}`;
  const other = lang === 'ru' ? 'EN' : 'RU';
  const lb = $('#lang-btn');
  lb.textContent = other;
  lb.setAttribute('aria-label', i18n['lang.switch']);
  lb.hidden = (config.languages || []).length < 2;
  // Валюта: переключатель появляется, только если в site.config.json указан курс USD или EUR.
  const cs = $('#currency');
  const rates = Object.entries(config.rates || {}).filter(([, r]) => Number(r) > 0).map(([c]) => c);
  const base = config.currency || 'RUB';
  cs.hidden = !rates.length;
  cs.setAttribute('aria-label', i18n['currency.label']);
  cs.replaceChildren(...[base, ...rates].map((c) => h('option', { value: c }, c)));
  if (![base, ...rates].includes(state.currency)) state.currency = base;
  cs.value = state.currency;
  updateThemeButton();
}

function updateThemeButton() {
  const dark = document.documentElement.dataset.theme !== 'light';
  const btn = $('#theme-btn');
  btn.replaceChildren(icon(dark ? 'sun' : 'moon'));
  btn.setAttribute('aria-label', state.i18n[dark ? 'theme.toLight' : 'theme.toDark'] || '');
  document.querySelector('meta[name="theme-color"]').content = dark ? '#111113' : '#f4f0e8';
}

function bindHeader() {
  qInput.addEventListener('input', () => {
    $('#q-clear').hidden = !qInput.value;
    const wasEmpty = !parseHash().params.get('q');
    // первая буква — новая запись в истории, дальше просто уточняем
    setParams({ q: qInput.value.trim() || null }, { push: wasEmpty });
  });
  $('#search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    qInput.blur();
    document.getElementById('catalog')?.scrollIntoView();
  });
  $('#q-clear').addEventListener('click', () => { qInput.value = ''; setParams({ q: null }); qInput.focus(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement?.tagName)) { e.preventDefault(); qInput.focus(); }
  });

  $('#lang-btn').addEventListener('click', async () => {
    state.lang = state.lang === 'ru' ? 'en' : 'ru';
    storage('lang', state.lang);
    state.i18n = await loadI18n(state.lang);
    applyTexts();
    mountCompareBar(state);
    rerender();
  });
  $('#currency').addEventListener('change', (e) => {
    state.currency = e.target.value;
    storage('currency', state.currency);
    rerender();
  });
  $('#theme-btn').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    storage('theme', next);
    updateThemeButton();
  });

  window.addEventListener('offline', () => toast(state.i18n.offline));
}

// ---------- Ошибка загрузки ----------
async function renderError(err) {
  console.error(err);
  let i18n = {};
  try { i18n = await loadI18n(state.lang); } catch { /* тексты тоже не загрузились */ }
  const isFile = location.protocol === 'file:';
  app.replaceChildren(h('div', { class: 'container state-msg', role: 'alert' },
    h('h1', {}, i18n['error.title'] || 'Каталог не загрузился'),
    h('p', {}, isFile
      ? (i18n['error.file'] || 'Сайт открыт как файл с диска. Дважды щёлкните «Открыть сайт.bat» в папке проекта.')
      : (i18n['error.text'] || 'Проверьте подключение к интернету и обновите страницу.')),
    !isFile && h('button', { class: 'btn btn-primary', type: 'button', onclick: () => location.reload() }, '↻')));
}

// ---------- Запуск ----------
async function boot() {
  try {
    const { config, coins } = await loadData();
    state.config = config;
    state.coins = coins;
    state.index = buildIndex(coins);
    const saved = storage('lang');
    state.lang = (config.languages || ['ru']).includes(saved) ? saved : (config.defaultLanguage || 'ru');
    state.i18n = await loadI18n(state.lang);
    state.currency = storage('currency') || config.currency || 'RUB';
    setShareIds(config.sharePages);
  } catch (err) {
    renderError(err);
    return;
  }
  if (!storage('theme') && state.config.theme?.default) document.documentElement.dataset.theme = state.config.theme.default;
  if (state.config.theme?.accent) document.documentElement.style.setProperty('--accent', state.config.theme.accent);
  applyTexts();
  bindHeader();
  mountCompareBar(state);
  window.addEventListener('hashchange', route); // срабатывает и на ссылки, и на «Назад»
  route();
  // Работа без интернета (только на настоящем сайте, не при открытии файла с диска)
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

boot();
