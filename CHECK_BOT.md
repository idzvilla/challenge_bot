# Проверка работы бота на Railway

## Быстрая диагностика

### 1. Проверьте логи в Railway Dashboard

1. Откройте https://railway.app
2. Выберите ваш проект
3. Откройте вкладку **"Logs"**
4. Ищите следующие сообщения:

**✅ Если видите:**
```
Starting bot...
Config: { timezone: 'Europe/Minsk', ... }
Database initialized successfully
✅ Bot is running!
Bot username: your_bot_username
```
→ Бот запущен успешно!

**❌ Если видите:**
```
BOT_TOKEN is not set in .env file
```
→ Установите переменную `BOT_TOKEN` в Railway

**❌ Если видите:**
```
Failed to initialize database
```
→ Проблема с базой данных, нужен Volume

**❌ Если видите:**
```
Failed to start bot: Error: ...
```
→ Проверьте токен бота и интернет-соединение

### 2. Проверьте переменные окружения

В Railway Dashboard:
- Settings → Variables
- Должны быть установлены:
  ```
  BOT_TOKEN=8545493908:AAFB-7bDNIpDD6p-jTcLon8kyfru--5j7Tg
  TIMEZONE=Europe/Minsk
  CHALLENGE_START_DATE=2024-01-01
  DATABASE_PATH=./data/challenge.db
  ```

### 3. Проверьте команды запуска

Settings → Service:
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`

### 4. Проверьте токен бота

1. Откройте [@BotFather](https://t.me/BotFather) в Telegram
2. Отправьте `/mybots`
3. Выберите вашего бота
4. Проверьте, что токен совпадает с тем, что в Railway

### 5. Проверьте бота в Telegram

1. Найдите вашего бота в Telegram
2. Отправьте `/start`
3. Если бот не отвечает:
   - Проверьте логи в Railway
   - Убедитесь, что статус сервиса "Active"
   - Попробуйте перезапустить сервис

### 6. Настройка Volume для базы данных (важно!)

SQLite файл может теряться при перезапуске. Настройте Volume:

1. В Railway Dashboard → Settings → Volumes
2. Нажмите "New Volume"
3. Название: `bot-data`
4. Mount Path: `/app/data`
5. Сохраните
6. Перезапустите сервис

### 7. Перезапуск сервиса

Если бот не работает:
1. Settings → Service
2. Нажмите "Restart" или "Redeploy"
3. Проверьте логи после перезапуска

## Частые проблемы и решения

### Бот показывает "Active", но не отвечает

**Причина:** Скорее всего проблема с токеном или бот не запустился

**Решение:**
1. Проверьте логи - должно быть `✅ Bot is running!`
2. Проверьте переменную `BOT_TOKEN`
3. Убедитесь, что токен правильный в BotFather

### Ошибка "BOT_TOKEN is not set"

**Решение:** Установите переменную `BOT_TOKEN` в Railway Settings → Variables

### База данных не сохраняется

**Решение:** Настройте Volume (см. пункт 6 выше)

### Бот падает сразу после запуска

**Решение:**
1. Проверьте логи на ошибки
2. Убедитесь, что все зависимости установлены
3. Проверьте, что `dist/` папка создается при сборке


