# Решение проблем с ботом на Railway

## Проблема: Бот показывает "active", но не отвечает

### 1. Проверьте переменные окружения

В Railway Dashboard:
- Settings → Variables
- Убедитесь, что все переменные установлены:
  - `BOT_TOKEN` - токен бота (обязательно!)
  - `TIMEZONE` - Europe/Minsk
  - `CHALLENGE_START_DATE` - 2024-01-01
  - `DATABASE_PATH` - ./data/challenge.db

### 2. Проверьте логи

В Railway Dashboard:
- Откройте ваш сервис
- Перейдите на вкладку "Logs"
- Ищите ошибки или сообщения:
  - `✅ Bot is running!` - бот запущен успешно
  - `❌ Failed to start bot` - ошибка запуска
  - `BOT_TOKEN is not set` - не установлен токен

### 3. Проверьте команду запуска

В Railway Dashboard:
- Settings → Service
- Start Command должен быть: `npm start`
- Build Command: `npm install && npm run build`

### 4. Проблема с базой данных SQLite

SQLite на Railway может не сохраняться между перезапусками. Решения:

**Вариант А: Использовать Volume (рекомендуется)**
1. В Railway Dashboard → Settings → Volumes
2. Создайте новый Volume
3. Подключите его к `/app/data`
4. Перезапустите сервис

**Вариант Б: Использовать PostgreSQL (более надежно)**
Railway предоставляет бесплатный PostgreSQL. Можно переделать бота на PostgreSQL.

### 5. Проверьте токен бота

Убедитесь, что токен правильный:
1. Откройте [@BotFather](https://t.me/BotFather)
2. Отправьте `/mybots`
3. Выберите вашего бота
4. Проверьте токен

### 6. Проверьте, что бот запущен

Выполните в Telegram:
- Откройте вашего бота
- Отправьте `/start`
- Если бот не отвечает, проверьте логи в Railway

### 7. Перезапуск сервиса

В Railway Dashboard:
- Settings → Service
- Нажмите "Restart" или "Redeploy"

### 8. Проверка через CLI

```bash
railway login
railway link -p fdde51ea-b5c7-4e5f-8952-1eee8a100036
railway logs --tail 100
railway variables
```

## Частые ошибки

### "BOT_TOKEN is not set"
- Установите переменную `BOT_TOKEN` в Railway

### "Cannot find module"
- Убедитесь, что `buildCommand` выполняется: `npm install && npm run build`

### "Database locked"
- Проблема с SQLite. Используйте Volume или перейдите на PostgreSQL

### Бот не отвечает
- Проверьте логи на ошибки
- Убедитесь, что токен правильный
- Проверьте, что бот не заблокирован в Telegram

