// Общие помощники: экранирование, даты, уведомления, модальные окна, сессия.

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------- Даты. Бэкенд хранит LocalDateTime в формате "yyyy-MM-dd HH:mm:ss" по времени Минска.

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля',
  'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

export function parseDate(s) {
  if (!s) return null;
  const [d, t = '00:00:00'] = s.replace('T', ' ').split(' ');
  const [y, m, day] = d.split('-').map(Number);
  const [h, min, sec = 0] = t.split(':').map(Number);
  return new Date(y, m - 1, day, h, min, sec);
}

const pad = (n) => String(n).padStart(2, '0');

// 14.11.2026 19:00
export function fmtDateTime(s) {
  const d = parseDate(s);
  if (!d) return '—';
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// «сб, 14 ноября, 19:00»
export function fmtHuman(s) {
  const d = parseDate(s);
  if (!d) return '—';
  const year = d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : '';
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}${year}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function dateParts(s) {
  const d = parseDate(s);
  return d ? { day: d.getDate(), month: MONTHS[d.getMonth()].slice(0, 3) } : { day: '', month: '' };
}

// значение <input type="datetime-local"> → формат API
export function toApiDate(local) {
  if (!local) return undefined;
  const [d, t] = local.split('T');
  return `${d} ${t.length === 5 ? `${t}:00` : t}`;
}

// формат API → значение <input type="datetime-local">
export function toInputDate(s) {
  const d = parseDate(s);
  if (!d) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function nowPlusHours(h) {
  const d = new Date(Date.now() + h * 3600 * 1000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ---------- Склонения

export function plural(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

// ---------- Справочники статусов

export const EVENT_STATES = {
  PENDING: { label: 'На модерации', cls: 'warn' },
  PUBLISHED: { label: 'Опубликовано', cls: 'ok' },
  CANCELED: { label: 'Отменено', cls: 'muted' },
};

export const REQUEST_STATES = {
  PENDING: { label: 'Ожидает', cls: 'warn' },
  CONFIRMED: { label: 'Подтверждена', cls: 'ok' },
  REJECTED: { label: 'Отклонена', cls: 'bad' },
  CANCELED: { label: 'Отменена', cls: 'muted' },
};

export function badge(map, key) {
  const s = map[key] || { label: key, cls: 'muted' };
  return `<span class="badge ${s.cls}">${esc(s.label)}</span>`;
}

// ---------- Уведомления

export function toast(message, type = 'ok') {
  const box = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  box.appendChild(el);
  setTimeout(() => el.classList.add('hide'), 3500);
  setTimeout(() => el.remove(), 4000);
}

export function showError(e) {
  toast(e && e.message ? e.message : 'Что-то пошло не так', 'bad');
}

// ---------- Модальное окно. Возвращает элемент тела и функцию закрытия.

export function modal(title, html, { wide = false } = {}) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
        <div class="modal-head">
          <h3>${esc(title)}</h3>
          <button class="icon-btn" data-close aria-label="Закрыть">✕</button>
        </div>
        <div class="modal-body">${html}</div>
      </div>
    </div>`;
  const close = () => { root.innerHTML = ''; document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  root.querySelector('[data-close]').onclick = close;
  root.querySelector('.modal-backdrop').addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('modal-backdrop')) close();
  });
  return { body: root.querySelector('.modal-body'), close };
}

export function confirmDialog(text, okLabel = 'Удалить') {
  return new Promise((resolve) => {
    const { body, close } = modal('Подтверждение', `
      <p>${esc(text)}</p>
      <div class="actions">
        <button class="btn ghost" data-no>Отмена</button>
        <button class="btn danger" data-yes>${esc(okLabel)}</button>
      </div>`);
    body.querySelector('[data-no]').onclick = () => { close(); resolve(false); };
    body.querySelector('[data-yes]').onclick = () => { close(); resolve(true); };
  });
}

// Блокирует кнопку на время запроса
export async function busy(button, fn) {
  if (button) button.disabled = true;
  try {
    return await fn();
  } finally {
    if (button) button.disabled = false;
  }
}

// ---------- Сессия (в бэкенде нет авторизации, поэтому вход — выбор пользователя на клиенте)

const KEY = 'ewm.session';

export const session = {
  get() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
  },
  set(value) {
    try { localStorage.setItem(KEY, JSON.stringify(value)); } catch { /* приватный режим */ }
    window.dispatchEvent(new Event('session'));
  },
  user() { return this.get().user || null; },
  isAdmin() { return !!this.get().admin; },
  logout() { this.set({}); },
};
