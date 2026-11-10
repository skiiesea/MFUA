# Vesper на Windows: запуск по шагам

Короткая инструкция «от архива до открытого мессенджера». Все команды вводятся в **PowerShell** (подходит и Windows PowerShell 5, и PowerShell 7). Полное описание проекта: `README.md`.

## Что нужно заранее

1. **Node.js 22 LTS**: https://nodejs.org (самая новая версия, например 26, может не подойти для `argon2`, `sharp` и `prisma`).
2. **Docker Desktop**: https://www.docker.com/products/docker-desktop (нужен для базы данных PostgreSQL). После установки запустите его и дождитесь, пока значок станет зелёным.

Проверка:

```powershell
node -v
docker --version
```

Первая команда должна показать `v22.x` (или `v20.x`).

## Шаг 1. Распаковать архив

Распакуйте `vesper.zip` в `C:\Users\ВАШ_ПОЛЬЗОВАТЕЛЬ\Desktop`. **Не** внутрь папки `vesper`: в архиве уже есть папка `vesper`, иначе получится `vesper\vesper`. Если папка уже есть, на вопрос о замене файлов отвечайте «Заменить все». Ваши данные и `server\.env` в архиве не лежат, поэтому не пропадут.

Совет: храните проект не в папке, которая синхронизируется с OneDrive (например, `C:\dev\vesper`). Синхронизация и антивирус иногда ломают установку пакетов.

Откройте PowerShell и перейдите в папку проекта:

```powershell
cd C:\Users\ВАШ_ПОЛЬЗОВАТЕЛЬ\Desktop\vesper
```

## Шаг 2. Установить зависимости

```powershell
npm install
```

Если раньше были ошибки установки (например, `Cannot find module ...\tsx\dist\cli.mjs`), сначала сделайте чистую переустановку:

```powershell
Remove-Item -Recurse -Force node_modules, server\node_modules, web\node_modules -ErrorAction SilentlyContinue
Remove-Item package-lock.json -ErrorAction SilentlyContinue
npm install
```

## Шаг 3. Проверить окружение

```powershell
npm run doctor
```

Команда сама покажет, что не так (версия Node, недостающие пакеты, `.env`, доступность базы), и подскажет, что делать. На этом шаге ошибки про `.env` и PostgreSQL нормальны: их мы исправим дальше.

## Шаг 4. Запустить базу данных

Docker Desktop должен быть запущен.

```powershell
docker compose up -d
```

Проверка: `docker compose ps` должен показать контейнер `db` в состоянии `running`.

## Шаг 5. Создать настройки (`.env`)

```powershell
npm run setup
```

Создаётся файл `server\.env` с автоматически сгенерированными секретами. Если файл уже есть, команда ничего не меняет.

## Шаг 6. Создать таблицы в базе

```powershell
npm run db:validate
npm run db:init
```

Первая команда проверяет схему базы, вторая создаёт таблицы. В конце `db:init` должна появиться строка `Your database is now in sync with your schema`.

## Шаг 7. Создать администратора

```powershell
npm run create-admin
```

Ответьте на вопросы: логин (латиница, цифры, `_`), имя, email, пароль (при вводе пароля символы не отображаются, это нормально). Пароль: минимум 10 символов, 3 типа символов (строчные, заглавные, цифры, спецсимволы).

## Шаг 8. Запустить мессенджер

```powershell
npm run dev
```

Откройте в браузере http://localhost:5173 и войдите под созданным администратором. В левой панели будет раздел «Админ».

**Письма с подтверждением email.** Пока почта не настроена, письма не отправляются, а печатаются в окне PowerShell, где запущен сервер (блок `DEV MAIL`). Для новых пользователей скопируйте оттуда ссылку и откройте её в браузере. Администратор, созданный командой `create-admin`, подтверждён автоматически.

## Каждый следующий запуск

```powershell
cd C:\Users\ВАШ_ПОЛЬЗОВАТЕЛЬ\Desktop\vesper
docker compose up -d
npm run dev
```

Остановить: `Ctrl+C` в окне с `npm run dev`. База остановится командой `docker compose down` (данные сохранятся).

## Если что-то пошло не так

| Что вы видите | Что делать |
|---|---|
| `Cannot find module ...\tsx\dist\cli.mjs` или другие «не найден модуль» | Чистая переустановка из шага 2, затем `npm run doctor`. Если `npm install` падает, поставьте Node 22 LTS |
| `P1012`, `Error validating`, `This line is not an enum value definition` | В вашем `server\prisma\schema.prisma` старая схема. Распакуйте свежий архив (шаг 1) или замените блок из приложения ниже |
| `P1001` (не удаётся достучаться до сервера БД) | Запустите Docker Desktop, затем `docker compose up -d` и проверьте `docker compose ps` |
| `P1000` (ошибка аутентификации) | Порт 5432 занят вашим установленным PostgreSQL. В `docker-compose.yml` замените `127.0.0.1:5432:5432` на `127.0.0.1:5433:5432`, в `server\.env` в `DATABASE_URL` порт `5432` на `5433`, затем `docker compose down` и `docker compose up -d` |
| «Некорректная конфигурация (.env)» | Сервер назвал, какая переменная неверна. Самое простое: удалите `server\.env` и выполните `npm run setup` |
| `EADDRINUSE` (порт занят) | Закройте предыдущий запуск (`Ctrl+C`) или другую программу на порту 4000 или 5173 |
| После входа сразу выбрасывает на экран входа | Открывайте именно http://localhost:5173 (не 127.0.0.1 и не порт 4000) |
| Не приходит письмо подтверждения | Смотрите окно PowerShell с сервером: письмо печатается туда |

**Если ничего не помогло**, пришлите разработчику: вывод `npm run doctor` и **весь** текст ошибки целиком. Настоящая причина обычно написана выше строк `npm error Lifecycle script ... failed`, поэтому копируйте с начала команды.

## Приложение: блок `enum` для ручной замены

Нужен только если в файле `server\prisma\schema.prisma` строки с `enum` записаны в одну строку (например, `enum Role { USER ADMIN }`). Замените все десять таких строк (примерно строки 10–19) на этот блок и сохраните файл в кодировке UTF-8:

```prisma
enum Role {
  USER
  ADMIN
}
enum Activity {
  AUTO
  DND
  OFFLINE
  WORK
  FREE
}
enum Visibility {
  EVERYONE
  FRIENDS
  NOBODY
}
enum FriendshipStatus {
  PENDING
  ACCEPTED
}
enum ChatType {
  DIRECT
  GROUP
}
enum MemberRole {
  MEMBER
  ADMIN
  OWNER
}
enum AttachmentKind {
  IMAGE
  FILE
}
enum NotificationType {
  FRIEND_REQUEST
  FRIEND_ACCEPTED
  MENTION
  SECURITY
}
enum EmailTokenType {
  VERIFY
  EMAIL_CHANGE
}
enum ReportStatus {
  OPEN
  RESOLVED
  DISMISSED
}
```
