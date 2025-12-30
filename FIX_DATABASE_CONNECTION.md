# Исправление ошибки подключения к базе данных

## Проблема

Ошибка `getaddrinfo ENOTFOUND base` означает, что бот не может подключиться к PostgreSQL базе данных.

**Причина:** Переменная `DATABASE_URL` не установлена или неправильная в Render.

## Решение:

### 1. Проверьте, что PostgreSQL создан

1. В Render Dashboard найдите ваш PostgreSQL сервис
2. Убедитесь, что он запущен (статус "Available")

### 2. Получите правильный DATABASE_URL

1. Откройте ваш PostgreSQL сервис в Render
2. Перейдите на вкладку **"Info"** или **"Connections"**
3. Найдите **"Internal Database URL"** (НЕ External!)
4. Скопируйте этот URL - он выглядит так:
   ```
   postgresql://challenge_user:password@dpg-xxxxx-a/challenge_bot
   ```

### 3. Установите DATABASE_URL в Web Service

1. Откройте ваш Web Service (бот) в Render
2. Перейдите в **Settings** → **Environment**
3. Найдите переменную `DATABASE_URL`
4. Если её нет - нажмите **"Add Environment Variable"**
5. Вставьте скопированный **Internal Database URL**
6. Сохраните

### 4. Перезапустите сервис

1. В Render Dashboard откройте ваш Web Service
2. Нажмите **"Manual Deploy"** → **"Deploy latest commit"**
3. Или просто подождите автоматического перезапуска

## Важно:

- Используйте **Internal Database URL**, а не External!
- Internal URL работает только внутри Render (между сервисами)
- External URL нужен только для подключения извне Render

## Проверка:

После перезапуска в логах должно быть:
- `Using PostgreSQL database` ✅
- `Database connection successful` ✅
- `Database tables initialized successfully` ✅

Если видите `Using SQLite database` - значит `DATABASE_URL` не установлен или неправильный.



