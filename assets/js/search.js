// Нечёткий поиск без внешних библиотек.
// Терпит опечатки и регистр, понимает «давенпорт 3336», «Dav 3336», «дав3336», ищет на обоих языках.

import { tr } from './util.js';

// Синонимы каталогов: всё сводится к латинскому сокращению.
// (\b в JavaScript не работает с кириллицей, поэтому границы слова — через \p{L}.)
const ALIASES = [
  [/давенпорт\p{L}*|(?<!\p{L})дав\.?(?=\s|\d|$)|davenport|dav\./gu, 'dav '],
  [/(?<!\p{L})км(?!\p{L})|km\./gu, 'km '],
  [/(?<!\p{L})мт(?!\p{L})|mt\./gu, 'mt '],
];

export function normalize(s) {
  let t = String(s).toLowerCase().replace(/ё/g, 'е');
  for (const [re, to] of ALIASES) t = t.replace(re, to);
  return t.replace(/[^\p{L}\p{N}.]+/gu, ' ').replace(/(?<!\d)\.|\.(?!\d)/g, ' ').trim();
}

const tokenize = (s) => normalize(s).split(/\s+/).filter(Boolean);

/** Расстояние Левенштейна (с ограничением, чтобы было быстро). */
function distance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** Насколько слово запроса q похоже на слово из каталога w (0 — не похоже). */
function matchScore(q, w) {
  if (q === w) return 3;
  const numeric = /^\d/.test(q);
  if (w.startsWith(q) && (q.length >= 2 || numeric)) return 2;
  if (numeric) return 0; // в номерах и годах опечатки не прощаем — иначе найдётся чужая монета
  if (q.length >= 5 && w.length >= 5 && q.startsWith(w)) return 1.5; // «леопольда» → «леопольд»
  if (q.length >= 4 && w.includes(q)) return 1.5;
  if (q.length >= 4) {
    const max = q.length >= 7 ? 2 : 1;
    if (distance(q, w, max) <= max) return 1;
    if (w.length > q.length && distance(q, w.slice(0, q.length), max) <= max) return 0.8;
  }
  return 0;
}

export function buildIndex(coins) {
  return coins.map((coin) => {
    const parts = [];
    for (const lang of ['ru', 'en']) {
      parts.push(tr(coin.title, lang), tr(coin.ruler, lang), tr(coin.year, lang), tr(coin.nominal, lang),
        tr(coin.issuer, lang), tr(coin.mint, lang), tr(coin.metal, lang), tr(coin.description, lang));
    }
    parts.push(coin.legend?.obverse, coin.legend?.reverse, coin.grade?.value, ...(coin.tags || []));
    const words = new Set(tokenize(parts.filter(Boolean).join(' ')));
    // Каталожные номера: и «dav», «3336», и слитно «dav3336».
    for (const [cat, num] of Object.entries(coin.catalog || {})) {
      const c = normalize(cat).replace(/\s/g, '');
      const n = normalize(num).replace(/\s/g, '');
      words.add(c); words.add(n); words.add(c + n);
    }
    return { coin, words: [...words] };
  });
}

/** Возвращает [{coin, score, terms}] — terms нужны для подсветки. */
export function search(index, query) {
  const qTokens = tokenize(query);
  if (!qTokens.length) return index.map(({ coin }) => ({ coin, score: 0, terms: [] }));
  const out = [];
  for (const { coin, words } of index) {
    let total = 0;
    const terms = [];
    let ok = true;
    for (const q of qTokens) {
      let best = 0, bestWord = '';
      for (const w of words) {
        const s = matchScore(q, w);
        if (s > best) { best = s; bestWord = w; }
      }
      if (!best) { ok = false; break; }
      total += best;
      terms.push(q, bestWord);
    }
    if (ok) out.push({ coin, score: total, terms });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** Подсвечивает совпадения в тексте: возвращает массив строк и <mark>. */
export function highlight(text, terms) {
  if (!terms?.length || !text) return [text];
  const useful = [...new Set(terms.filter((t) => t.length >= 2))].sort((a, b) => b.length - a.length);
  if (!useful.length) return [text];
  const esc = useful.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/е/g, '[её]'));
  const re = new RegExp(`(${esc.join('|')})`, 'gi');
  return String(text).split(re).map((part, i) => {
    if (i % 2 === 0) return part;
    const m = document.createElement('mark');
    m.textContent = part;
    return m;
  });
}
