// Вход, личный кабинет: мои события, создание/редактирование, заявки участников, мои заявки.

import { api } from '../api.js';
import {
  esc, fmtHuman, fmtDateTime, toApiDate, toInputDate, nowPlusHours, plural, session, toast,
  showError, confirmDialog, busy, badge, EVENT_STATES, REQUEST_STATES,
} from '../util.js';
import { pickMap } from '../map.js';

function go(hash) { location.hash = hash; }

// ---------------- Вход и регистрация

export async function loginView(root) {
  root.innerHTML = `
    <div class="login">
      <section class="card pad">
        <h2>Вход</h2>
        <p class="muted">Выберите свой профиль.</p>
        <input type="search" id="user-filter" placeholder="Поиск по имени или email">
        <div class="user-list" id="users"><div class="skeleton"></div></div>
      </section>
      <section class="card pad">
        <h2>Регистрация</h2>
        <form id="reg" class="form">
          <label>Имя<input name="name" required minlength="2" maxlength="250" placeholder="Анна Ковалёва"></label>
          <label>Email<input name="email" type="email" required minlength="6" maxlength="254" placeholder="anna@mail.by"></label>
          <button class="btn primary">Зарегистрироваться и войти</button>
        </form>
        <hr>
        <h2>Администрирование</h2>
        <p class="muted">Модерация событий, пользователи, категории и подборки.</p>
        <button class="btn ghost full" id="as-admin">Войти как администратор</button>
      </section>
    </div>`;

  let users = [];
  const box = root.querySelector('#users');
  const render = (q = '') => {
    const s = q.toLowerCase();
    const shown = users.filter((u) => !s || u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s));
    box.innerHTML = shown.length
      ? shown.map((u) => `
        <button class="user-row" data-id="${u.id}">
          <span class="avatar">${esc(u.name.trim()[0] || '?').toUpperCase()}</span>
          <span><b>${esc(u.name)}</b><br><span class="muted">${esc(u.email)}</span></span>
        </button>`).join('')
      : '<p class="muted">Пользователей не найдено. Зарегистрируйтесь справа.</p>';
  };
  try {
    users = await api.users();
    render();
  } catch (e) {
    box.innerHTML = `<p class="muted">${esc(e.message)}</p>`;
  }
  root.querySelector('#user-filter').oninput = (e) => render(e.target.value);
  box.onclick = (e) => {
    const row = e.target.closest('.user-row');
    if (!row) return;
    const u = users.find((x) => x.id === Number(row.dataset.id));
    session.set({ user: u });
    toast(`Здравствуйте, ${u.name}!`);
    go('#/');
  };
  root.querySelector('#reg').onsubmit = async (e) => {
    e.preventDefault();
    const name = e.target.elements.name.value.trim();
    const email = e.target.elements.email.value.trim();
    await busy(e.target.querySelector('button'), async () => {
      try {
        const u = await api.createUser({ name, email });
        session.set({ user: u });
        toast('Профиль создан');
        go('#/');
      } catch (err) { showError(err); }
    });
  };
  root.querySelector('#as-admin').onclick = () => {
    session.set({ admin: true });
    go('#/admin/events');
  };
}

// ---------------- Мои события

export async function myEventsView(root) {
  const user = session.user();
  root.innerHTML = `
    <div class="list-head"><h1>Мои события</h1><a class="btn primary" href="#/my/events/new">+ Создать событие</a></div>
    <div id="list"><div class="skeleton"></div></div>`;
  const list = root.querySelector('#list');

  async function load() {
    let events;
    try {
      events = await api.myEvents(user.id);
    } catch (e) {
      list.innerHTML = `<div class="empty">${esc(e.message)}</div>`;
      return;
    }
    if (!events.length) {
      list.innerHTML = '<div class="empty">Вы ещё не создали ни одного события.<br><a href="#/my/events/new">Создать первое</a></div>';
      return;
    }
    // EventShortDto не содержит статус — догружаем полные карточки
    const full = await Promise.all(events.map((e) => api.myEvent(user.id, e.id).catch(() => e)));
    full.sort((a, b) => b.eventDate.localeCompare(a.eventDate));
    list.innerHTML = `
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Событие</th><th>Дата</th><th>Статус</th><th>Участники</th><th></th></tr></thead>
        <tbody>${full.map((e) => `
          <tr data-id="${e.id}">
            <td><b>${esc(e.title)}</b><br><span class="muted">${esc(e.category?.name || '')}</span></td>
            <td>${esc(fmtDateTime(e.eventDate))}</td>
            <td>${badge(EVENT_STATES, e.state)}</td>
            <td>${e.confirmedRequests ?? 0}${e.participantLimit ? ` / ${e.participantLimit}` : ''}</td>
            <td class="row-actions">
              ${e.state === 'PUBLISHED' ? `<a class="btn small ghost" href="#/event/${e.id}">Открыть</a>
                <a class="btn small ghost" href="#/my/events/${e.id}/requests">Заявки</a>` : ''}
              ${e.state !== 'PUBLISHED' ? `<a class="btn small ghost" href="#/my/events/${e.id}/edit">Изменить</a>` : ''}
              ${e.state === 'PENDING' ? '<button class="btn small ghost" data-act="CANCEL_REVIEW">Снять с модерации</button>' : ''}
              ${e.state === 'CANCELED' ? '<button class="btn small primary" data-act="SEND_TO_REVIEW">На модерацию</button>' : ''}
            </td>
          </tr>`).join('')}
        </tbody>
      </table></div>`;
  }

  list.onclick = async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const id = Number(btn.closest('tr').dataset.id);
    await busy(btn, async () => {
      try {
        await api.updateMyEvent(user.id, id, { stateAction: btn.dataset.act });
        toast(btn.dataset.act === 'SEND_TO_REVIEW' ? 'Событие отправлено на модерацию' : 'Событие снято с модерации');
        load();
      } catch (err) { showError(err); }
    });
  };
  load();
}

// ---------------- Форма события (создание и редактирование)

export async function eventFormView(root, id) {
  const user = session.user();
  let ev = null;
  let cats = [];
  try {
    [cats, ev] = await Promise.all([api.categories(), id ? api.myEvent(user.id, id) : null]);
  } catch (e) {
    root.innerHTML = `<div class="empty">${esc(e.message)}</div>`;
    return;
  }
  if (ev && ev.state === 'PUBLISHED') {
    root.innerHTML = '<div class="empty">Опубликованное событие изменить нельзя.</div>';
    return;
  }
  if (!cats.length) {
    root.innerHTML = '<div class="empty">Нет ни одной категории. Попросите администратора создать категории.</div>';
    return;
  }
  const min = nowPlusHours(2);
  root.innerHTML = `
    <a class="back" href="#/my/events">← Мои события</a>
    <h1>${ev ? 'Редактирование события' : 'Новое событие'}</h1>
    <form class="card pad form event-form" id="form" novalidate>
      <label>Название<input name="title" maxlength="120" value="${esc(ev?.title)}" placeholder="Настольные игры в «Ход конём»"></label>
      <label>Краткое описание <span class="muted">(20–2000 символов, видно в афише)</span>
        <textarea name="annotation" rows="2" maxlength="2000">${esc(ev?.annotation)}</textarea></label>
      <label>Полное описание <span class="muted">(20–7000 символов)</span>
        <textarea name="description" rows="6" maxlength="7000">${esc(ev?.description)}</textarea></label>
      <div class="row">
        <label>Категория
          <select name="category">${cats.map((c) => `<option value="${c.id}" ${ev?.category?.id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
        </label>
        <label>Дата и время (Минск)
          <input type="datetime-local" name="eventDate" min="${min}" value="${ev ? toInputDate(ev.eventDate) : ''}">
        </label>
      </div>
      <div class="row">
        <label>Лимит участников <span class="muted">(0 — без ограничений)</span>
          <input type="number" name="participantLimit" min="0" value="${ev?.participantLimit ?? 0}">
        </label>
        <div class="checks">
          <label class="check"><input type="checkbox" name="paid" ${ev?.paid ? 'checked' : ''}> Платное участие</label>
          <label class="check"><input type="checkbox" name="requestModeration" ${ev ? (ev.requestModeration ? 'checked' : '') : 'checked'}> Подтверждать заявки вручную</label>
        </div>
      </div>
      <label>Место проведения <span class="muted">— кликните по карте</span></label>
      <div class="map pick" id="map"></div>
      <div class="muted small" id="coords"></div>
      <div class="errors" id="errors"></div>
      <div class="actions">
        <a class="btn ghost" href="#/my/events">Отмена</a>
        <button class="btn primary">${ev ? 'Сохранить и отправить на модерацию' : 'Отправить на модерацию'}</button>
      </div>
    </form>`;

  let place = ev?.location ? { lat: ev.location.lat, lon: ev.location.lon } : null;
  const coords = root.querySelector('#coords');
  pickMap(root.querySelector("#map"), place, (p) => {
    place = p;
    coords.textContent = `Выбрано: ${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}`;
  });

  const form = root.querySelector('#form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const v = {
      title: form.elements.title.value.trim(),
      annotation: form.elements.annotation.value.trim(),
      description: form.elements.description.value.trim(),
      category: Number(form.elements.category.value),
      eventDate: toApiDate(form.elements.eventDate.value),
      participantLimit: Number(form.elements.participantLimit.value || 0),
      paid: form.elements.paid.checked,
      requestModeration: form.elements.requestModeration.checked,
      location: place ? { lat: Number(place.lat.toFixed(6)), lon: Number(place.lon.toFixed(6)) } : null,
    };
    const errors = [];
    if (v.title.length < 3) errors.push('Название — от 3 до 120 символов');
    if (v.annotation.length < 20) errors.push('Краткое описание — не короче 20 символов');
    if (v.description.length < 20) errors.push('Полное описание — не короче 20 символов');
    if (!v.eventDate) errors.push('Укажите дату и время');
    else if (form.elements.eventDate.value < nowPlusHours(2)) errors.push('Событие можно назначить не раньше чем через 2 часа');
    if (v.participantLimit < 0 || !Number.isInteger(v.participantLimit)) errors.push('Лимит участников — целое число от 0');
    if (!v.location) errors.push('Отметьте место проведения на карте');
    root.querySelector('#errors').innerHTML = errors.map((x) => `<div>• ${esc(x)}</div>`).join('');
    if (errors.length) return;

    await busy(form.querySelector('button.primary'), async () => {
      try {
        if (ev) {
          await api.updateMyEvent(user.id, ev.id, { ...v, stateAction: 'SEND_TO_REVIEW' });
          toast('Изменения сохранены, событие на модерации');
        } else {
          await api.createEvent(user.id, v);
          toast('Событие создано и отправлено на модерацию');
        }
        go('#/my/events');
      } catch (err) { showError(err); }
    });
  };
}

// ---------------- Заявки на моё событие

export async function eventRequestsView(root, id) {
  const user = session.user();
  root.innerHTML = '<div class="skeleton"></div>';
  let ev;
  try {
    ev = await api.myEvent(user.id, id);
  } catch (e) {
    root.innerHTML = `<div class="empty">${esc(e.message)}</div>`;
    return;
  }

  async function load() {
    let reqs = [];
    let names = {};
    try {
      reqs = await api.eventRequests(user.id, id);
      const ids = [...new Set(reqs.map((r) => r.requester))];
      if (ids.length) (await api.users(ids)).forEach((u) => { names[u.id] = u.name; });
      ev = await api.myEvent(user.id, id);
    } catch (e) {
      showError(e);
    }
    const pending = reqs.filter((r) => r.status === 'PENDING');
    const manual = ev.requestModeration && ev.participantLimit > 0;
    root.innerHTML = `
      <a class="back" href="#/my/events">← Мои события</a>
      <h1>Заявки: ${esc(ev.title)}</h1>
      <p class="muted">${esc(fmtHuman(ev.eventDate))} · подтверждено ${ev.confirmedRequests ?? 0}${ev.participantLimit ? ` из ${ev.participantLimit}` : ''}
        ${manual ? '' : ' · заявки подтверждаются автоматически'}</p>
      ${manual && pending.length ? `
        <div class="toolbar">
          <label class="check"><input type="checkbox" id="all"> Выбрать все ожидающие</label>
          <button class="btn primary small" data-status="CONFIRMED">Подтвердить выбранные</button>
          <button class="btn danger small" data-status="REJECTED">Отклонить выбранные</button>
        </div>` : ''}
      ${reqs.length ? `
      <div class="table-wrap"><table class="table">
        <thead><tr><th></th><th>Участник</th><th>Подана</th><th>Статус</th></tr></thead>
        <tbody>${reqs.map((r) => `
          <tr>
            <td>${r.status === 'PENDING' && manual ? `<input type="checkbox" value="${r.id}">` : ''}</td>
            <td>${esc(names[r.requester] || `Пользователь #${r.requester}`)}</td>
            <td>${esc(fmtDateTime(r.created))}</td>
            <td>${badge(REQUEST_STATES, r.status)}</td>
          </tr>`).join('')}</tbody>
      </table></div>` : '<div class="empty">Заявок пока нет</div>'}`;

    const all = root.querySelector('#all');
    if (all) all.onchange = () => root.querySelectorAll('tbody input').forEach((i) => { i.checked = all.checked; });
    root.querySelectorAll('[data-status]').forEach((btn) => {
      btn.onclick = async () => {
        const ids = [...root.querySelectorAll('tbody input:checked')].map((i) => Number(i.value));
        if (!ids.length) { toast('Отметьте заявки в списке', 'bad'); return; }
        await busy(btn, async () => {
          try {
            const res = await api.setRequestStatus(user.id, id, { requestIds: ids, status: btn.dataset.status });
            const c = res.confirmedRequests?.length || 0;
            const r = res.rejectedRequests?.length || 0;
            toast(`Подтверждено: ${c}, отклонено: ${r}`);
            load();
          } catch (err) { showError(err); }
        });
      };
    });
  }
  load();
}

// ---------------- Мои заявки

export async function myRequestsView(root) {
  const user = session.user();
  root.innerHTML = '<h1>Мои заявки</h1><div id="list"><div class="skeleton"></div></div>';
  const list = root.querySelector('#list');

  async function load() {
    try {
      const reqs = await api.myRequests(user.id);
      if (!reqs.length) {
        list.innerHTML = '<div class="empty">Вы ещё никуда не записались. <a href="#/">Посмотреть афишу</a></div>';
        return;
      }
      const events = {};
      await Promise.all([...new Set(reqs.map((r) => r.event))].map((id) =>
        api.event(id).then((e) => { events[id] = e; }).catch(() => {})));
      reqs.sort((a, b) => b.created.localeCompare(a.created));
      list.innerHTML = `
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Событие</th><th>Когда</th><th>Заявка подана</th><th>Статус</th><th></th></tr></thead>
          <tbody>${reqs.map((r) => {
            const e = events[r.event];
            return `<tr data-id="${r.id}">
              <td>${e ? `<a href="#/event/${e.id}">${esc(e.title)}</a>` : `Событие #${r.event}`}</td>
              <td>${e ? esc(fmtDateTime(e.eventDate)) : '—'}</td>
              <td>${esc(fmtDateTime(r.created))}</td>
              <td>${badge(REQUEST_STATES, r.status)}</td>
              <td>${r.status === 'PENDING' || r.status === 'CONFIRMED' ? '<button class="btn small ghost" data-cancel>Отменить</button>' : ''}</td>
            </tr>`;
          }).join('')}</tbody>
        </table></div>
        <p class="muted small">${reqs.length} ${plural(reqs.length, 'заявка', 'заявки', 'заявок')}</p>`;
    } catch (e) {
      list.innerHTML = `<div class="empty">${esc(e.message)}</div>`;
    }
  }

  list.onclick = async (e) => {
    const btn = e.target.closest('[data-cancel]');
    if (!btn) return;
    if (!(await confirmDialog('Отменить заявку на участие?', 'Отменить заявку'))) return;
    try {
      await api.cancelRequest(user.id, Number(btn.closest('tr').dataset.id));
      toast('Заявка отменена');
      load();
    } catch (err) { showError(err); }
  };
  load();
}
