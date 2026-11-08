// Работа без интернета.
// Данные, страницы и код — «сначала сеть»: при интернете клиент всегда видит свежие цены,
// без интернета — последнюю сохранённую версию. Фото, шрифты и библиотеки — из кеша,
// с тихим обновлением в фоне. Номер версии менять вручную не нужно.

const SHELL = 'shell-v1';
const MEDIA = 'media-v1';
const PRECACHE = [
  './', 'index.html', 'assets/theme.css', 'assets/app.css',
  'assets/js/app.js', 'assets/js/util.js', 'assets/js/data.js', 'assets/js/search.js',
  'assets/js/catalog.js', 'assets/js/coin.js', 'assets/js/images.js', 'assets/js/shared.js',
  'assets/js/viewer.js', 'assets/js/coin3d.js', 'assets/js/compare.js',
  'i18n/ru.json', 'i18n/en.json', 'data/site.config.json', 'data/coins/index.json',
  'assets/fonts/cormorant-cyr-500.woff2', 'assets/fonts/cormorant-lat-500.woff2',
  'assets/fonts/cormorant-cyr-600.woff2', 'assets/fonts/cormorant-lat-600.woff2',
  'assets/fonts/inter-cyr-var.woff2', 'assets/fonts/inter-lat-var.woff2',
  'assets/icons/coin.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      .then((c) => Promise.all(PRECACHE.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => {}))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== MEDIA).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const isStatic = (url) => /\/(media|vendor|assets\/fonts|assets\/icons)\//.test(url.pathname);

async function networkFirst(request) {
  const cache = await caches.open(SHELL);
  try {
    const fresh = await fetch(request, { cache: 'no-cache' });
    if (fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === 'navigate') return cache.match('index.html');
    throw new Error('offline');
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(MEDIA);
  const cached = await cache.match(request);
  const update = fetch(request).then((res) => { if (res.ok) cache.put(request, res.clone()); return res; }).catch(() => null);
  return cached || (await update) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(isStatic(url) ? staleWhileRevalidate(request) : networkFirst(request));
});
