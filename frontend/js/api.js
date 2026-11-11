// Обёртка над REST API ewm-service. Все запросы идут на /api/*, nginx проксирует их на Spring.

const BASE = '/api';

// Перевод сообщений бэкенда на русский (по началу строки).
const MESSAGES = [
  ['Annotation must be at least 20', 'Краткое описание — не короче 20 символов'],
  ['Annotation must not be blank', 'Укажите краткое описание'],
  ['Description must be at least 20', 'Полное описание — не короче 20 символов'],
  ['Description must not be blank', 'Укажите полное описание'],
  ['Title must be at least 3', 'Название — не короче 3 символов'],
  ['Title must not be blank', 'Укажите название'],
  ['Category must not be null', 'Выберите категорию'],
  ['Location must not be null', 'Укажите место на карте'],
  ['Event date must not be null', 'Укажите дату и время'],
  ['Event date must be at least 2 hours', 'Событие можно назначить не раньше чем через 2 часа от текущего момента'],
  ['Event date must be at least 1 hour', 'Опубликовать можно событие, до начала которого больше часа'],
  ['Only pending or canceled events can be changed', 'Опубликованное событие изменить нельзя'],
  ["Cannot publish the event because it's not in the right state", 'Опубликовать можно только событие, ожидающее модерации'],
  ["Cannot reject the event because it's already published", 'Опубликованное событие отклонить нельзя'],
  ['Cannot participate in unpublished event', 'Нельзя записаться на неопубликованное событие'],
  ['Initiator cannot participate in own event', 'Организатор не может подать заявку на своё событие'],
  ['Request already exists', 'Вы уже подали заявку на это событие'],
  ['The participant limit has been reached', 'Свободных мест больше нет'],
  ['Participant limit has been reached', 'Свободных мест больше нет'],
  ['Request moderation is disabled or limit is 0', 'У события нет ограничения мест или модерации — заявки подтверждаются автоматически'],
  ['Request must have status PENDING', 'Можно обработать только заявки в статусе «Ожидает»'],
  ['Category name already exists', 'Категория с таким названием уже есть'],
  ['The category is not empty', 'В категории есть события — удалить её нельзя'],
  ['Email already exists', 'Пользователь с таким email уже зарегистрирован'],
  ['Only author can edit comment', 'Редактировать комментарий может только автор'],
  ['Only author can delete comment', 'Удалить комментарий может только автор'],
  ['Event not found for this user', 'Событие не найдено'],
  ['rangeStart must be before rangeEnd', 'Начало периода должно быть раньше конца'],
  ['Event with id=', 'Событие не найдено'],
  ['User with id=', 'Пользователь не найден'],
  ['Category with id=', 'Категория не найдена'],
  ['Compilation with id=', 'Подборка не найдена'],
  ['Comment with id=', 'Комментарий не найден'],
  ['Request with id=', 'Заявка не найдена'],
];

function translate(message, status) {
  if (!message) {
    if (status === 0) return 'Сервер недоступен. Проверьте, что контейнеры запущены';
    return `Ошибка сервера (${status})`;
  }
  for (const [en, ru] of MESSAGES) {
    if (message.startsWith(en)) return ru;
  }
  if (status >= 500) return 'Внутренняя ошибка сервера. Попробуйте ещё раз';
  return message;
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function buildUrl(path, query) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query || {})) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(','));
    } else {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return BASE + path + (qs ? `?${qs}` : '');
}

async function request(method, path, { query, body } = {}) {
  let res;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, translate('', 0));
  }
  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (!res.ok) {
    // 502/504 от nginx — бэкенд ещё не поднялся
    if (res.status === 502 || res.status === 504) {
      throw new ApiError(res.status, 'Сервер ещё запускается или недоступен. Подождите немного');
    }
    const msg = data && typeof data === 'object' ? data.message : '';
    throw new ApiError(res.status, translate(msg, res.status));
  }
  return data;
}

const ALL = { from: 0, size: 1000 };

export const api = {
  // Публичная часть
  events: (q) => request('GET', '/events', { query: q }),
  event: (id) => request('GET', `/events/${id}`),
  categories: () => request('GET', '/categories', { query: ALL }),
  compilations: (q) => request('GET', '/compilations', { query: { ...ALL, ...q } }),
  compilation: (id) => request('GET', `/compilations/${id}`),
  comments: (eventId) => request('GET', `/events/${eventId}/comments`, { query: ALL }),

  // Личный кабинет
  myEvents: (uid) => request('GET', `/users/${uid}/events`, { query: ALL }),
  myEvent: (uid, id) => request('GET', `/users/${uid}/events/${id}`),
  createEvent: (uid, body) => request('POST', `/users/${uid}/events`, { body }),
  updateMyEvent: (uid, id, body) => request('PATCH', `/users/${uid}/events/${id}`, { body }),
  eventRequests: (uid, id) => request('GET', `/users/${uid}/events/${id}/requests`),
  setRequestStatus: (uid, id, body) => request('PATCH', `/users/${uid}/events/${id}/requests`, { body }),
  myRequests: (uid) => request('GET', `/users/${uid}/requests`),
  createRequest: (uid, eventId) => request('POST', `/users/${uid}/requests`, { query: { eventId } }),
  cancelRequest: (uid, id) => request('PATCH', `/users/${uid}/requests/${id}/cancel`),
  addComment: (uid, eventId, text) => request('POST', `/users/${uid}/comments/${eventId}`, { body: { text } }),
  editComment: (uid, id, text) => request('PATCH', `/users/${uid}/comments/${id}`, { body: { text } }),
  deleteComment: (uid, id) => request('DELETE', `/users/${uid}/comments/${id}`),

  // Администрирование
  users: (ids) => request('GET', '/admin/users', { query: { ...ALL, ids } }),
  createUser: (body) => request('POST', '/admin/users', { body }),
  deleteUser: (id) => request('DELETE', `/admin/users/${id}`),
  createCategory: (name) => request('POST', '/admin/categories', { body: { name } }),
  updateCategory: (id, name) => request('PATCH', `/admin/categories/${id}`, { body: { name } }),
  deleteCategory: (id) => request('DELETE', `/admin/categories/${id}`),
  adminEvents: (q) => request('GET', '/admin/events', { query: { ...ALL, ...q } }),
  adminUpdateEvent: (id, body) => request('PATCH', `/admin/events/${id}`, { body }),
  createCompilation: (body) => request('POST', '/admin/compilations', { body }),
  updateCompilation: (id, body) => request('PATCH', `/admin/compilations/${id}`, { body }),
  deleteCompilation: (id) => request('DELETE', `/admin/compilations/${id}`),
  adminDeleteComment: (id) => request('DELETE', `/admin/comments/${id}`),
};
