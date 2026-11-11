// Публичная часть: афиша с поиском и фильтрами, страница события, подборки.

import { api } from '../api.js';
import {
  esc, fmtHuman, fmtDateTime, dateParts, toApiDate, plural, session, toast, showError,
  confirmDialog, busy, badge, REQUEST_STATES,
} from '../util.js';
import { showMap } from '../map.js';

const PAGE = 12;

export function eventCard(e) {
  const { day, month } = dateParts(e.eventDate);
  const views = e.views ?? 0;
  const going = e.confirmedRequests ?? 0;
  return `
    <a class="card event-card" href="#/event/${e.id}">
      <div class="date-block"><b>${day}</b><span>${esc(month)}</span></div>
      <div class="event-body">
        <div class="meta-top">
          <span class="chip">${esc(e.category?.name || 'Без категории')}</span>
          <span class="chip ${e.paid ? 'paid' : 'free'}">${e.paid ? 'Платно' : 'Бесплатно'}</span>
        </div>
        <h3>${esc(e.title)}</h3>
        <p class="annotation">${esc(e.annotation)}</p>
        <div class="meta-bottom">
          <span>🕒 ${esc(fmtHuman(e.eventDate))}</span>
          <span>👥 ${going} ${plural(going, 'участник', 'участника', 'участников')}</span>
          <span>👁 ${views}</span>
        </div>
        <div class="organizer">Организатор: ${esc(e.initiator?.name || '—')}</div>
      </div>
    </a>`;
}

// ---------------- Афиша

const filters = { text: '', categories: [], paid: '', rangeStart: '', rangeEnd: '', onlyAvailable: false, sort: 'EVENT_DATE' };

export async function homeView(root) {
  root.innerHTML = `
    <section class="hero">
      <h1>Чем заняться в свободное время</h1>
      <p>Встречи, мастер-классы, походы и игры — находите события по интересам и собирайте компанию.</p>
      <form class="search" id="search">
        <input type="search" name="text" placeholder="Поиск по анонсу и описанию события" value="${esc(filters.text)}">
        <button class="btn primary">Найти</button>
      </form>
    </section>
    <section id="pinned"></section>
    <div class="layout-filters">
      <form class="filters card" id="filters" onsubmit="return false">
        <h4>Фильтры</h4>
        <label>Категории</label>
        <div class="check-list" id="cat-list"><span class="muted">Загрузка…</span></div>
        <label for="f-paid">Стоимость</label>
        <select id="f-paid" name="paid">
          <option value="">Любая</option>
          <option value="false">Бесплатные</option>
          <option value="true">Платные</option>
        </select>
        <label for="f-from">С даты</label>
        <input type="datetime-local" id="f-from" name="rangeStart">
        <label for="f-to">По дату</label>
        <input type="datetime-local" id="f-to" name="rangeEnd">
        <label class="check"><input type="checkbox" name="onlyAvailable"> Только со свободными местами</label>
        <label for="f-sort">Сортировка</label>
        <select id="f-sort" name="sort">
          <option value="EVENT_DATE">По дате</option>
          <option value="VIEWS">По просмотрам</option>
        </select>
        <button class="btn ghost full" id="reset" type="button">Сбросить</button>
      </form>
      <section>
        <div class="list-head"><h2>Афиша</h2><span class="muted" id="count"></span></div>
        <div class="grid" id="events"></div>
        <div class="center"><button class="btn ghost" id="more" hidden>Показать ещё</button></div>
      </section>
    </div>`;

  const f = root.querySelector('#filters');
  const fe = f.elements;
  fe.paid.value = filters.paid;
  fe.rangeStart.value = filters.rangeStart;
  fe.rangeEnd.value = filters.rangeEnd;
  fe.onlyAvailable.checked = filters.onlyAvailable;
  fe.sort.value = filters.sort;

  const list = root.querySelector('#events');
  const more = root.querySelector('#more');
  let from = 0;
  let total = 0;

  async function load(reset) {
    if (reset) { from = 0; total = 0; list.innerHTML = '<div class="skeleton"></div>'.repeat(3); }
    more.hidden = true;
    try {
      const events = await api.events({
        text: filters.text || undefined,
        categories: filters.categories,
        paid: filters.paid || undefined,
        rangeStart: toApiDate(filters.rangeStart),
        rangeEnd: toApiDate(filters.rangeEnd),
        onlyAvailable: filters.onlyAvailable || undefined,
        sort: filters.sort,
        from,
        size: PAGE,
      });
      if (reset) list.innerHTML = '';
      total += events.length;
      list.insertAdjacentHTML('beforeend', events.map(eventCard).join(''));
      if (!total) {
        list.innerHTML = '<div class="empty">Ничего не нашлось. Попробуйте изменить фильтры.</div>';
      }
      root.querySelector('#count').textContent = total ? `${total}${events.length === PAGE ? '+' : ''} ${plural(total, 'событие', 'события', 'событий')}` : '';
      from += events.length;
      more.hidden = events.length < PAGE;
    } catch (e) {
      list.innerHTML = `<div class="empty">${esc(e.message)}</div>`;
    }
  }

  root.querySelector('#search').onsubmit = (e) => {
    e.preventDefault();
    filters.text = e.target.elements.text.value.trim();
    load(true);
  };
  f.onchange = (e) => {
    if (e.target.name === 'cat') {
      filters.categories = [...f.querySelectorAll('input[name=cat]:checked')].map((i) => Number(i.value));
    } else if (e.target.name === 'onlyAvailable') {
      filters.onlyAvailable = e.target.checked;
    } else if (e.target.name) {
      filters[e.target.name] = e.target.value;
    }
    load(true);
  };
  root.querySelector('#reset').onclick = () => {
    Object.assign(filters, { text: '', categories: [], paid: '', rangeStart: '', rangeEnd: '', onlyAvailable: false, sort: 'EVENT_DATE' });
    homeView(root);
  };
  more.onclick = () => load(false);

  load(true);

  api.categories().then((cats) => {
    root.querySelector('#cat-list').innerHTML = cats.length
      ? cats.map((c) => `<label class="check"><input type="checkbox" name="cat" value="${c.id}" ${filters.categories.includes(c.id) ? 'checked' : ''}> ${esc(c.name)}</label>`).join('')
      : '<span class="muted">Категорий пока нет</span>';
  }).catch(() => { root.querySelector('#cat-list').innerHTML = '<span class="muted">Не загрузились</span>'; });

  api.compilations({ pinned: true }).then((comps) => {
    if (!comps.length) return;
    root.querySelector('#pinned').innerHTML = `
      <div class="list-head"><h2>Подборки</h2><a href="#/compilations">Все подборки →</a></div>
      <div class="comp-row">${comps.map(compTile).join('')}</div>`;
  }).catch(() => {});
}

function compTile(c) {
  const n = c.events?.length || 0;
  return `<a class="card comp-tile" href="#/compilation/${c.id}">
    <span class="comp-title">${esc(c.title)}</span>
    <span class="muted">${n} ${plural(n, 'событие', 'события', 'событий')}</span>
  </a>`;
}

// ---------------- Подборки

export async function compilationsView(root) {
  root.innerHTML = '<h1>Подборки</h1><div class="comp-grid" id="list"><div class="skeleton"></div></div>';
  try {
    const comps = await api.compilations({});
    root.querySelector('#list').innerHTML = comps.length
      ? comps.map(compTile).join('')
      : '<div class="empty">Подборок пока нет</div>';
  } catch (e) {
    root.querySelector('#list').innerHTML = `<div class="empty">${esc(e.message)}</div>`;
  }
}

export async function compilationView(root, id) {
  root.innerHTML = '<div class="skeleton"></div>';
  try {
    const c = await api.compilation(id);
    const events = (c.events || []).slice().sort((a, b) => a.eventDate.localeCompare(b.eventDate));
    root.innerHTML = `
      <a class="back" href="#/compilations">← Все подборки</a>
      <h1>${esc(c.title)} ${c.pinned ? '<span class="badge ok">На главной</span>' : ''}</h1>
      <div class="grid">${events.length ? events.map(eventCard).join('') : '<div class="empty">В подборке пока нет событий</div>'}</div>`;
  } catch (e) {
    root.innerHTML = `<div class="empty">${esc(e.message)}</div>`;
  }
}

// ---------------- Страница события

export async function eventView(root, id) {
  root.innerHTML = '<div class="skeleton tall"></div>';
  let e;
  try {
    e = await api.event(id);
  } catch (err) {
    root.innerHTML = `<div class="empty">${err.status === 404 ? 'Событие не найдено или ещё не опубликовано' : esc(err.message)}</div>`;
    return;
  }
  const user = session.user();
  const limit = e.participantLimit || 0;
  const going = e.confirmedRequests || 0;
  const left = limit ? Math.max(limit - going, 0) : null;

  root.innerHTML = `
    <a class="back" href="#/">← К афише</a>
    <div class="event-page">
      <article class="card pad">
        <div class="meta-top">
          <span class="chip">${esc(e.category?.name || '')}</span>
          <span class="chip ${e.paid ? 'paid' : 'free'}">${e.paid ? 'Платно' : 'Бесплатно'}</span>
        </div>
        <h1>${esc(e.title)}</h1>
        <p class="lead">${esc(e.annotation)}</p>
        <div class="description">${esc(e.description).replace(/\n/g, '<br>')}</div>
        <h3>Место проведения</h3>
        <div class="map" id="map"></div>
      </article>
      <aside class="card pad side">
        <dl class="facts">
          <dt>Когда</dt><dd>${esc(fmtHuman(e.eventDate))}</dd>
          <dt>Организатор</dt><dd>${esc(e.initiator?.name || '—')}</dd>
          <dt>Участники</dt><dd>${going}${limit ? ` из ${limit}` : ''} ${limit ? '' : '<span class="muted">(без ограничений)</span>'}</dd>
          ${left !== null ? `<dt>Свободно мест</dt><dd>${left}</dd>` : ''}
          <dt>Заявки</dt><dd>${e.requestModeration && limit ? 'подтверждает организатор' : 'принимаются сразу'}</dd>
          <dt>Просмотры</dt><dd>${e.views ?? 0}</dd>
          <dt>Опубликовано</dt><dd>${esc(fmtDateTime(e.publishedOn))}</dd>
        </dl>
        <div id="participation"></div>
      </aside>
    </div>
    <section class="card pad comments">
      <h2>Обсуждение</h2>
      <div id="comment-form"></div>
      <div id="comments"></div>
    </section>`;

  showMap(root.querySelector('#map'), e.location?.lat, e.location?.lon);
  renderParticipation(root.querySelector('#participation'), e, user, left, root);
  renderComments(root, e, user);
}

async function renderParticipation(box, e, user, left, root) {
  if (session.isAdmin()) {
    box.innerHTML = '<p class="muted">Вы вошли как администратор.</p>';
    return;
  }
  if (!user) {
    box.innerHTML = '<a class="btn primary full" href="#/login">Войдите, чтобы записаться</a>';
    return;
  }
  if (e.initiator?.id === user.id) {
    box.innerHTML = `<a class="btn ghost full" href="#/my/events/${e.id}/requests">Заявки на моё событие</a>`;
    return;
  }
  let mine;
  try {
    mine = (await api.myRequests(user.id)).filter((r) => r.event === e.id && r.status !== 'CANCELED');
  } catch (err) {
    box.innerHTML = `<p class="muted">${esc(err.message)}</p>`;
    return;
  }
  const req = mine[0];
  if (req) {
    box.innerHTML = `
      <p>Ваша заявка: ${badge(REQUEST_STATES, req.status)}</p>
      ${req.status === 'PENDING' || req.status === 'CONFIRMED' ? '<button class="btn ghost full" id="cancel">Отменить участие</button>' : ''}`;
    const btn = box.querySelector('#cancel');
    if (btn) {
      btn.onclick = async () => {
        if (!(await confirmDialog('Отменить заявку на участие?', 'Отменить заявку'))) return;
        await busy(btn, async () => {
          try {
            await api.cancelRequest(user.id, req.id);
            toast('Заявка отменена');
            eventView(root, e.id);
          } catch (err) { showError(err); }
        });
      };
    }
    return;
  }
  if (left === 0) {
    box.innerHTML = '<button class="btn primary full" disabled>Мест нет</button>';
    return;
  }
  box.innerHTML = '<button class="btn primary full" id="join">Записаться</button>';
  const btn = box.querySelector('#join');
  btn.onclick = () => busy(btn, async () => {
    try {
      const r = await api.createRequest(user.id, e.id);
      toast(r.status === 'CONFIRMED' ? 'Вы записаны на событие' : 'Заявка отправлена организатору');
      eventView(root, e.id);
    } catch (err) { showError(err); }
  });
}

async function renderComments(root, e, user) {
  const list = root.querySelector('#comments');
  const formBox = root.querySelector('#comment-form');
  const admin = session.isAdmin();

  if (user) {
    formBox.innerHTML = `
      <form class="comment-form" id="cform">
        <textarea name="text" rows="3" maxlength="2000" placeholder="Задайте вопрос организатору или поделитесь впечатлениями" required></textarea>
        <button class="btn primary">Отправить</button>
      </form>`;
    formBox.querySelector('#cform').onsubmit = async (ev) => {
      ev.preventDefault();
      const text = ev.target.elements.text.value.trim();
      if (!text) return;
      await busy(ev.target.querySelector('button'), async () => {
        try {
          await api.addComment(user.id, e.id, text);
          ev.target.reset();
          load();
        } catch (err) { showError(err); }
      });
    };
  } else if (!admin) {
    formBox.innerHTML = '<p class="muted"><a href="#/login">Войдите</a>, чтобы оставить комментарий.</p>';
  }

  async function load() {
    try {
      const comments = await api.comments(e.id);
      if (!comments.length) {
        list.innerHTML = '<p class="muted">Комментариев пока нет.</p>';
        return;
      }
      list.innerHTML = comments.map((c) => {
        const own = user && c.authorId === user.id;
        return `
          <div class="comment" data-id="${c.id}">
            <div class="comment-head">
              <b>${esc(c.authorName)}</b>
              ${c.authorId === e.initiator?.id ? '<span class="badge ok">организатор</span>' : ''}
              <span class="muted">${esc(fmtDateTime(c.createdOn))}${c.updatedOn ? ' · изменён' : ''}</span>
              <span class="spacer"></span>
              ${own ? '<button class="link" data-edit>Изменить</button>' : ''}
              ${own || admin ? '<button class="link danger" data-del>Удалить</button>' : ''}
            </div>
            <div class="comment-text">${esc(c.text).replace(/\n/g, '<br>')}</div>
          </div>`;
      }).join('');
    } catch (err) {
      list.innerHTML = `<p class="muted">${esc(err.message)}</p>`;
    }
  }

  list.onclick = async (ev) => {
    const item = ev.target.closest('.comment');
    if (!item) return;
    const id = Number(item.dataset.id);
    if (ev.target.matches('[data-del]')) {
      if (!(await confirmDialog('Удалить комментарий?'))) return;
      try {
        if (admin) await api.adminDeleteComment(id);
        else await api.deleteComment(user.id, id);
        toast('Комментарий удалён');
        load();
      } catch (err) { showError(err); }
    }
    if (ev.target.matches('[data-edit]')) {
      const textEl = item.querySelector('.comment-text');
      const old = textEl.innerText;
      textEl.innerHTML = `<form class="comment-form"><textarea rows="3" maxlength="2000" required>${esc(old)}</textarea>
        <div class="actions"><button type="button" class="btn ghost" data-cancel>Отмена</button><button class="btn primary">Сохранить</button></div></form>`;
      const form = textEl.querySelector('form');
      form.querySelector('[data-cancel]').onclick = load;
      form.onsubmit = async (se) => {
        se.preventDefault();
        try {
          await api.editComment(user.id, id, form.querySelector('textarea').value.trim());
          load();
        } catch (err) { showError(err); }
      };
    }
  };

  load();
}
