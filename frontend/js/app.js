// Маршрутизация по hash и шапка сайта.

import { esc, session, toast } from './util.js';
import { homeView, eventView, compilationsView, compilationView } from './views/public.js';
import {
  loginView, myEventsView, eventFormView, eventRequestsView, myRequestsView,
} from './views/account.js';
import { adminView } from './views/admin.js';

const app = document.getElementById('app');

// [шаблон, обработчик, требование доступа: 'user' | 'admin' | undefined]
// Каждая страница рисуется в свой контейнер: если пользователь ушёл со страницы
// до ответа сервера, запоздалый ответ попадёт в отсоединённый элемент и ничего не сломает.
const routes = [
  [/^\/$/, (v) => homeView(v)],
  [/^\/event\/(\d+)$/, (v, id) => eventView(v, Number(id))],
  [/^\/compilations$/, (v) => compilationsView(v)],
  [/^\/compilation\/(\d+)$/, (v, id) => compilationView(v, Number(id))],
  [/^\/login$/, (v) => loginView(v)],
  [/^\/my\/events$/, (v) => myEventsView(v), 'user'],
  [/^\/my\/events\/new$/, (v) => eventFormView(v, null), 'user'],
  [/^\/my\/events\/(\d+)\/edit$/, (v, id) => eventFormView(v, Number(id)), 'user'],
  [/^\/my\/events\/(\d+)\/requests$/, (v, id) => eventRequestsView(v, Number(id)), 'user'],
  [/^\/my\/requests$/, (v) => myRequestsView(v), 'user'],
  [/^\/admin\/?(\w*)$/, (v, tab) => adminView(v, tab || 'events'), 'admin'],
];

function renderHeader() {
  const user = session.user();
  const admin = session.isAdmin();
  const path = location.hash.slice(1) || '/';
  const link = (href, text) => `<a href="#${href}" class="${path === href || (href !== '/' && path.startsWith(href)) ? 'active' : ''}">${text}</a>`;
  let nav = link('/', 'Афиша') + link('/compilations', 'Подборки');
  if (user) nav += link('/my/events', 'Мои события') + link('/my/requests', 'Мои заявки');
  if (admin) nav += link('/admin', 'Администрирование');
  const who = user
    ? `<span class="who">👤 ${esc(user.name)}</span><button class="btn small ghost" id="logout">Выйти</button>`
    : admin
      ? '<span class="who">🛡 Администратор</span><button class="btn small ghost" id="logout">Выйти</button>'
      : '<a class="btn small primary" href="#/login">Войти</a>';
  document.getElementById('header').innerHTML = `
    <div class="container header-inner">
      <a class="logo" href="#/"><span class="logo-mark">◎</span> Досуг вместе</a>
      <button class="icon-btn burger" id="burger" aria-label="Меню">☰</button>
      <nav class="nav" id="nav">${nav}</nav>
      <div class="user-box">${who}</div>
    </div>`;
  const out = document.getElementById('logout');
  if (out) out.onclick = () => { session.logout(); toast('Вы вышли'); location.hash = '#/'; };
  document.getElementById('burger').onclick = () => document.getElementById('nav').classList.toggle('open');
}

function route() {
  const path = location.hash.slice(1) || '/';
  renderHeader();
  document.getElementById('modal-root').innerHTML = '';
  window.scrollTo(0, 0);
  for (const [re, handler, need] of routes) {
    const m = path.match(re);
    if (!m) continue;
    if (need === 'user' && !session.user()) {
      toast('Сначала войдите', 'bad');
      location.hash = '#/login';
      return;
    }
    if (need === 'admin' && !session.isAdmin()) {
      toast('Раздел доступен только администратору', 'bad');
      location.hash = '#/login';
      return;
    }
    const view = document.createElement('div');
    app.replaceChildren(view);
    handler(view, ...m.slice(1));
    return;
  }
  app.innerHTML = '<div class="empty">Страница не найдена. <a href="#/">На главную</a></div>';
}

window.addEventListener('hashchange', route);
window.addEventListener('session', renderHeader);
route();
