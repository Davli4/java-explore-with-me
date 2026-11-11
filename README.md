# java-explore-with-me
Template repository for ExploreWithMe project.

## Ссылка на Pull Request с дополнительной функциональностью

[Pull Request: feature_comments → main](https://github.com/Davli4/java-explore-with-me/pull/6)

## Веб-интерфейс «Досуг вместе»

Информационная система для организации коллективного досуга: афиша событий, запись на участие,
обсуждения и модерация. Фронтенд лежит в папке [`frontend/`](frontend) — HTML, CSS и JavaScript
без фреймворков и сборки. Карта — Leaflet + OpenStreetMap. Время событий указывается по Минску.

| Раздел | Что умеет |
|---|---|
| Афиша | Поиск по тексту, фильтры по категориям, стоимости, датам и свободным местам, сортировка по дате или просмотрам, закреплённые подборки |
| Страница события | Описание, место на карте, число участников и свободных мест, запись и отмена участия, комментарии (свои можно изменить и удалить) |
| Мои события | Создание события с выбором места на карте, редактирование, отправка на модерацию и снятие с неё |
| Заявки на моё событие | Подтверждение и отклонение заявок участников, в том числе пачкой |
| Мои заявки | Статусы всех заявок, отмена |
| Администрирование | Модерация событий (опубликовать / отклонить), пользователи, категории, подборки, удаление комментариев |

В бэкенде нет авторизации (пользователь передаётся в пути `/users/{userId}`), поэтому вход на сайте —
выбор своего профиля или регистрация по имени и email; режим администратора включается кнопкой на странице входа.

### Запуск через Docker

```bash
mvn -DskipTests package
docker compose up --build
```

Сайт: http://localhost:3000 (запросы `/api/*` nginx проксирует на `ewm-service:8080`).

### Запуск без Docker

Нужны JDK 17, Maven, PostgreSQL и Node.js 18+.

1. Создать базы `ewm` и `stats`, собрать проект: `mvn -DskipTests package`.
2. Запустить сервис статистики и основной сервис (подставьте свои логин и пароль PostgreSQL):
   ```bash
   java -Duser.timezone=Europe/Minsk -jar stats/stats-server/target/stats-server-0.0.1-SNAPSHOT.jar --spring.datasource.url=jdbc:postgresql://localhost:5432/stats --spring.datasource.username=postgres --spring.datasource.password=ПАРОЛЬ
   java -Duser.timezone=Europe/Minsk -jar main-service/target/main-service-0.0.1-SNAPSHOT.jar --spring.datasource.url=jdbc:postgresql://localhost:5432/ewm --spring.datasource.username=postgres --spring.datasource.password=ПАРОЛЬ --stats-server.url=http://localhost:9090
   ```
3. Запустить фронтенд: `node frontend/dev-server.js` → http://localhost:3000

### Демо-данные

На пустой базе можно загрузить пользователей, категории, события в Минске, заявки, комментарии и подборки:

```bash
node frontend/seed-demo.js http://localhost:8080
```
