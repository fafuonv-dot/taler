// Загрузка данных: настройки сайта, тексты интерфейса и монеты.
// Список монет берётся из data/coins/index.json, каждая монета — из data/coins/<id>.json.

async function getJson(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

export async function loadI18n(lang) {
  return getJson(`i18n/${lang}.json`);
}

export async function loadData() {
  const [config, ids] = await Promise.all([
    getJson('data/site.config.json'),
    getJson('data/coins/index.json'),
  ]);
  const results = await Promise.allSettled(ids.map((id) => getJson(`data/coins/${id}.json`)));
  const coins = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') coins.push(r.value);
    else console.warn(`Монета «${ids[i]}» не загрузилась:`, r.reason?.message);
  });
  return { config, coins: coins.filter((c) => !c.hidden) };
}

/** Путь к файлу монеты: media/<id>/<файл>. Внешние ссылки (http…) остаются как есть. */
export function mediaUrl(coin, file) {
  if (!file) return '';
  if (/^https?:\/\//.test(file)) return file;
  return `media/${coin.id}/${file}`;
}
