// Администрирование: модерация событий, пользователи, категории, подборки.

import { api } from '../api.js';
import {
  esc, fmtDateTime, fmtHuman, toApiDate, plural, toast, showError, confirmDialog, busy, modal,
  badge, EVENT_STATES,
} from '../util.js';
import { showMap } from '../map.js';

const TABS = [
  ['events', 'Модерация событий'],
  ['users', 'Пользователи'],
  ['categories', 'Категории'],
  ['compilations', 'Подборки'],
];

function tabs(active) {
  return `<nav class="tabs">${TABS.map(([k, t]) =>
    `<a href="#/admin/${k}" class="${k === active ? 'active' : ''}">${t}</a>`).join('')}</nav>`;
}

export function adminView(root, tab) {
  root.innerHTML = `<h1>Администрирование</h1>${tabs(tab)}<div id="tab"></div>`;
  const box = root.querySelector('#tab');
  ({ events, users, categories, compilations }[tab] || events)(box);
}

// ---------------- Модерация событий

const evFilter = { states: ['PENDING'], categories: [], rangeStart: '', rangeEnd: '' };

async function events(box) {
  let cats = [];
  try { cats = await api.categories(); } catch { /* фильтр по категориям просто будет пустым */ }
  box.innerHTML = `
    <form class="toolbar" id="filter" onsubmit="return false">
      <div class="seg">
        ${Object.entries(EVENT_STATES).map(([k, s]) =>
          `<label class="check"><input type="checkbox" name="state" value="${k}" ${evFilter.states.includes(k) ? 'checked' : ''}> ${s.label}</label>`).join('')}
      </div>
      <select name="category">
        <option value="">Все категории</option>
        ${cats.map((c) => `<option value="${c.id}" ${evFilter.categories[0] === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
      </select>
      <label class="inline">с <input type="datetime-local" name="rangeStart" value="${evFilter.rangeStart}"></label>
      <label class="inline">по <input type="datetime-local" name="rangeEnd" value="${evFilter.rangeEnd}"></label>
    </form>
    <div id="list"><div class="skeleton"></div></div>`;

  const form = box.querySelector('#filter');
  const list = box.querySelector('#list');

  async function load() {
    try {
      const evs = await api.adminEvents({
        states: evFilter.states,
        categories: evFilter.categories,
        rangeStart: toApiDate(evFilter.rangeStart),
        rangeEnd: toApiDate(evFilter.rangeEnd),
      });
      evs.sort((a, b) => a.eventDate.localeCompare(b.eventDate));
      list.innerHTML = evs.length ? evs.map((e) => `
        <div class="card pad mod-card" data-id="${e.id}">
          <div class="mod-head">
            <div>
              <h3>${esc(e.title)} ${badge(EVENT_STATES, e.state)}</h3>
              <div class="muted">${esc(e.category?.name || '')} · ${esc(fmtHuman(e.eventDate))} · ${esc(e.initiator?.name || '')}
                · создано ${esc(fmtDateTime(e.createdOn))}</div>
            </div>
            <div class="row-actions">
              <button class="btn small ghost" data-act="view">Подробнее</button>
              ${e.state === 'PENDING' ? `
                <button class="btn small primary" data-act="PUBLISH_EVENT">Опубликовать</button>
                <button class="btn small danger" data-act="REJECT_EVENT">Отклонить</button>` : ''}
              ${e.state === 'PUBLISHED' ? `<a class="btn small ghost" href="#/event/${e.id}">На сайте</a>` : ''}
            </div>
          </div>
          <p>${esc(e.annotation)}</p>
          <div class="muted small">${e.paid ? 'Платное' : 'Бесплатное'} · лимит ${e.participantLimit || 'не ограничен'}
            · подтверждено ${e.confirmedRequests ?? 0} · просмотров ${e.views ?? 0}</div>
        </div>`).join('') : '<div class="empty">Событий с такими условиями нет</div>';
      list._events = evs;
    } catch (err) {
      list.innerHTML = `<div class="empty">${esc(err.message)}</div>`;
    }
  }

  form.onchange = () => {
    evFilter.states = [...form.querySelectorAll('input[name=state]:checked')].map((i) => i.value);
    evFilter.categories = form.elements.category.value ? [Number(form.elements.category.value)] : [];
    evFilter.rangeStart = form.elements.rangeStart.value;
    evFilter.rangeEnd = form.elements.rangeEnd.value;
    load();
  };

  list.onclick = async (ev) => {
    const btn = ev.target.closest('[data-act]');
    if (!btn) return;
    const id = Number(btn.closest('[data-id]').dataset.id);
    const e = list._events.find((x) => x.id === id);
    if (btn.dataset.act === 'view') {
      const { body } = modal(e.title, `
        <p class="lead">${esc(e.annotation)}</p>
        <div class="description">${esc(e.description).replace(/\n/g, '<br>')}</div>
        <dl class="facts">
          <dt>Когда</dt><dd>${esc(fmtHuman(e.eventDate))}</dd>
          <dt>Организатор</dt><dd>${esc(e.initiator?.name || '')}</dd>
          <dt>Модерация заявок</dt><dd>${e.requestModeration ? 'да' : 'нет'}</dd>
        </dl>
        <div class="map" id="mmap"></div>`, { wide: true });
      showMap(body.querySelector('#mmap'), e.location?.lat, e.location?.lon);
      return;
    }
    if (btn.dataset.act === 'REJECT_EVENT' && !(await confirmDialog(`Отклонить событие «${e.title}»?`, 'Отклонить'))) return;
    await busy(btn, async () => {
      try {
        await api.adminUpdateEvent(id, { stateAction: btn.dataset.act });
        toast(btn.dataset.act === 'PUBLISH_EVENT' ? 'Событие опубликовано' : 'Событие отклонено');
        load();
      } catch (err) { showError(err); }
    });
  };
  load();
}

// ---------------- Пользователи

async function users(box) {
  box.innerHTML = `
    <form class="toolbar" id="add">
      <input name="name" placeholder="Имя" required minlength="2" maxlength="250">
      <input name="email" type="email" placeholder="Email" required minlength="6" maxlength="254">
      <button class="btn primary">Добавить пользователя</button>
    </form>
    <div id="list"><div class="skeleton"></div></div>`;
  const list = box.querySelector('#list');

  async function load() {
    try {
      const us = await api.users();
      list.innerHTML = us.length ? `
        <div class="table-wrap"><table class="table">
          <thead><tr><th>ID</th><th>Имя</th><th>Email</th><th></th></tr></thead>
          <tbody>${us.map((u) => `<tr data-id="${u.id}" data-name="${esc(u.name)}">
            <td>${u.id}</td><td>${esc(u.name)}</td><td>${esc(u.email)}</td>
            <td><button class="btn small danger" data-del>Удалить</button></td></tr>`).join('')}</tbody>
        </table></div>
        <p class="muted small">${us.length} ${plural(us.length, 'пользователь', 'пользователя', 'пользователей')}</p>`
        : '<div class="empty">Пользователей нет</div>';
    } catch (err) {
      list.innerHTML = `<div class="empty">${esc(err.message)}</div>`;
    }
  }

  box.querySelector('#add').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target.elements;
    await busy(e.target.querySelector('button'), async () => {
      try {
        await api.createUser({ name: f.name.value.trim(), email: f.email.value.trim() });
        e.target.reset();
        toast('Пользователь добавлен');
        load();
      } catch (err) { showError(err); }
    });
  };
  list.onclick = async (e) => {
    if (!e.target.matches('[data-del]')) return;
    const row = e.target.closest('tr');
    if (!(await confirmDialog(`Удалить пользователя «${row.dataset.name}»?`))) return;
    try {
      await api.deleteUser(Number(row.dataset.id));
      toast('Пользователь удалён');
      load();
    } catch (err) { showError(err); }
  };
  load();
}

// ---------------- Категории

async function categories(box) {
  box.innerHTML = `
    <form class="toolbar" id="add">
      <input name="cname" placeholder="Название категории" required maxlength="50">
      <button class="btn primary">Добавить категорию</button>
    </form>
    <div id="list"><div class="skeleton"></div></div>`;
  const list = box.querySelector('#list');

  async function load() {
    try {
      const cs = await api.categories();
      list.innerHTML = cs.length ? `
        <div class="table-wrap"><table class="table">
          <thead><tr><th>ID</th><th>Название</th><th></th></tr></thead>
          <tbody>${cs.map((c) => `<tr data-id="${c.id}" data-name="${esc(c.name)}">
            <td>${c.id}</td><td>${esc(c.name)}</td>
            <td class="row-actions"><button class="btn small ghost" data-edit>Переименовать</button>
              <button class="btn small danger" data-del>Удалить</button></td></tr>`).join('')}</tbody>
        </table></div>` : '<div class="empty">Категорий нет</div>';
    } catch (err) {
      list.innerHTML = `<div class="empty">${esc(err.message)}</div>`;
    }
  }

  box.querySelector('#add').onsubmit = async (e) => {
    e.preventDefault();
    await busy(e.target.querySelector('button'), async () => {
      try {
        await api.createCategory(e.target.elements.cname.value.trim());
        e.target.reset();
        toast('Категория добавлена');
        load();
      } catch (err) { showError(err); }
    });
  };
  list.onclick = async (e) => {
    const row = e.target.closest('tr');
    if (!row) return;
    const id = Number(row.dataset.id);
    if (e.target.matches('[data-del]')) {
      if (!(await confirmDialog(`Удалить категорию «${row.dataset.name}»?`))) return;
      try { await api.deleteCategory(id); toast('Категория удалена'); load(); } catch (err) { showError(err); }
    }
    if (e.target.matches('[data-edit]')) {
      const { body, close } = modal('Переименовать категорию', `
        <form class="form"><label>Название<input name="cname" required maxlength="50" value="${esc(row.dataset.name)}"></label>
        <div class="actions"><button class="btn primary">Сохранить</button></div></form>`);
      body.querySelector('form').onsubmit = async (se) => {
        se.preventDefault();
        try {
          await api.updateCategory(id, se.target.elements.cname.value.trim());
          close(); toast('Категория переименована'); load();
        } catch (err) { showError(err); }
      };
    }
  };
  load();
}

// ---------------- Подборки

async function compilations(box) {
  box.innerHTML = `
    <div class="toolbar"><button class="btn primary" id="new">+ Новая подборка</button></div>
    <div id="list"><div class="skeleton"></div></div>`;
  const list = box.querySelector('#list');
  let comps = [];

  async function load() {
    try {
      comps = await api.compilations({});
      list.innerHTML = comps.length ? comps.map((c) => `
        <div class="card pad mod-card" data-id="${c.id}">
          <div class="mod-head">
            <h3>${esc(c.title)} ${c.pinned ? '<span class="badge ok">На главной</span>' : ''}</h3>
            <div class="row-actions">
              <button class="btn small ghost" data-edit>Изменить</button>
              <button class="btn small danger" data-del>Удалить</button>
            </div>
          </div>
          <div class="muted">${(c.events || []).map((e) => esc(e.title)).join(' · ') || 'Без событий'}</div>
        </div>`).join('') : '<div class="empty">Подборок нет</div>';
    } catch (err) {
      list.innerHTML = `<div class="empty">${esc(err.message)}</div>`;
    }
  }

  async function edit(c) {
    let published = [];
    try { published = await api.adminEvents({ states: ['PUBLISHED'] }); } catch (err) { showError(err); return; }
    const chosen = new Set((c?.events || []).map((e) => e.id));
    published.sort((a, b) => a.eventDate.localeCompare(b.eventDate));
    const { body, close } = modal(c ? 'Изменить подборку' : 'Новая подборка', `
      <form class="form">
        <label>Название<input name="ctitle" required maxlength="50" value="${esc(c?.title)}"></label>
        <label class="check"><input type="checkbox" name="pinned" ${c?.pinned ? 'checked' : ''}> Закрепить на главной</label>
        <label>События <span class="muted">(только опубликованные)</span></label>
        <div class="check-list tall">${published.length ? published.map((e) => `
          <label class="check"><input type="checkbox" name="ev" value="${e.id}" ${chosen.has(e.id) ? 'checked' : ''}>
            ${esc(e.title)} <span class="muted">— ${esc(fmtDateTime(e.eventDate))}</span></label>`).join('')
          : '<span class="muted">Опубликованных событий пока нет</span>'}</div>
        <div class="actions"><button class="btn primary">Сохранить</button></div>
      </form>`, { wide: true });
    body.querySelector('form').onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target.elements;
      const payload = {
        title: f.ctitle.value.trim(),
        pinned: f.pinned.checked,
        events: [...e.target.querySelectorAll('input[name=ev]:checked')].map((i) => Number(i.value)),
      };
      try {
        if (c) await api.updateCompilation(c.id, payload);
        else await api.createCompilation(payload);
        close();
        toast('Подборка сохранена');
        load();
      } catch (err) { showError(err); }
    };
  }

  box.querySelector('#new').onclick = () => edit(null);
  list.onclick = async (e) => {
    const card = e.target.closest('[data-id]');
    if (!card) return;
    const c = comps.find((x) => x.id === Number(card.dataset.id));
    if (e.target.matches('[data-edit]')) edit(c);
    if (e.target.matches('[data-del]')) {
      if (!(await confirmDialog(`Удалить подборку «${c.title}»?`))) return;
      try { await api.deleteCompilation(c.id); toast('Подборка удалена'); load(); } catch (err) { showError(err); }
    }
  };
  load();
}
