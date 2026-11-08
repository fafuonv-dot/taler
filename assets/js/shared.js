// Общие элементы: цена, статус, окно «Запросить монету», «Поделиться».

import { h, icon, tr, formatMoney, toast } from './util.js';

export function priceValue(state, coin) {
  const showAll = state.config.prices !== 'on-request';
  const p = coin.price;
  if (!showAll || !p || p.show === false || p.amount == null) return null;
  const base = p.currency || state.config.currency || 'RUB';
  const want = state.currency || base;
  const rate = Number(state.config.rates?.[want]); // сколько рублей стоит 1 USD / 1 EUR
  if (want !== base && base === 'RUB' && rate > 0) {
    return `≈ ${formatMoney(Math.round(p.amount / rate / 10) * 10, want, state.lang)}`; // по курсу из настроек
  }
  return formatMoney(p.amount, base, state.lang);
}

export function priceText(state, coin, cls = 'price') {
  const v = priceValue(state, coin);
  return v
    ? h('span', { class: `${cls} num` }, v)
    : h('span', { class: `${cls} muted` }, state.i18n['price.onRequest']);
}

export function statusBadge(coin, i18n, extra = '') {
  const s = coin.status || 'available';
  return h('span', { class: `badge ${s} ${extra}` }, i18n[`status.${s}`] || s);
}

/** Ссылка на монету. Если для неё собрана страница-превью (tools/build.py) — ведём на неё,
    чтобы мессенджер показал красивую карточку; иначе — обычная ссылка на сайт. */
let shareIds = null;
export function coinLink(coin) {
  const dir = `${location.origin}${location.pathname.replace(/[^/]*$/, '')}`;
  return shareIds?.has(coin.id) ? `${dir}coin/${coin.id}.html` : `${dir}#/coin/${coin.id}`;
}
export function setShareIds(ids) { shareIds = new Set(ids || []); }

export async function shareCoin(state, coin) {
  const url = coinLink(coin);
  const title = tr(coin.title, state.lang);
  if (navigator.share) {
    try { await navigator.share({ title, url }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(url); toast(state.i18n['coin.linkCopied']); }
  catch { prompt(title, url); }
}

/** Окно с вариантами связи. Сообщение уже содержит название и ссылку. */
export function openRequest(state, coin) {
  const { config, i18n, lang } = state;
  const c = config.contact || {};
  const msg = i18n['request.message'].replace('{title}', tr(coin.title, lang)).replace('{url}', coinLink(coin));
  const enc = encodeURIComponent(msg);
  const options = [];
  if (c.telegram) options.push(['telegram', 'Telegram', `https://t.me/${c.telegram.replace(/^@|https?:\/\/t\.me\//g, '')}?text=${enc}`]);
  if (c.whatsapp) options.push(['whatsapp', 'WhatsApp', `https://wa.me/${c.whatsapp.replace(/\D/g, '')}?text=${enc}`]);
  if (c.email) options.push(['mail', c.email, `mailto:${c.email}?subject=${encodeURIComponent(tr(coin.title, lang))}&body=${enc}`]);
  if (c.phone) options.push(['phone', `${i18n['request.phone']}: ${c.phone}`, `tel:${c.phone.replace(/[^\d+]/g, '')}`]);

  const dlg = h('dialog', { class: 'sheet', 'aria-labelledby': 'req-title' },
    h('div', { class: 'sheet-panel' },
      h('button', { class: 'icon-btn sheet-close', type: 'button', 'aria-label': i18n.close, onclick: () => dlg.close() }, icon('close')),
      h('h2', { id: 'req-title' }, i18n['request.title']),
      h('p', {}, options.length ? i18n['request.text'] : i18n['request.noContacts']),
      options.length && h('div', { class: 'sheet-list' },
        ...options.map(([ic, label, href]) => h('a', { class: 'btn', href, target: ic === 'phone' || ic === 'mail' ? null : '_blank', rel: 'noopener' }, icon(ic), label)))));
  dlg.addEventListener('close', () => dlg.remove());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  document.body.append(dlg);
  dlg.showModal();
}
