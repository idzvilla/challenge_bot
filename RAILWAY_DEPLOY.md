# Деплой на Railway через CLI

Railway CLI установлен! Теперь выполните следующие шаги:

## 1. Войдите в Railway

В терминале выполните:
```bash
railway login
```

Это откроет браузер для авторизации через GitHub.

## 2. Подключите проект

После входа выполните:
```bash
cd /Users/test/Documents/Apps/Challenge
railway link -p fdde51ea-b5c7-4e5f-8952-1eee8a100036
```

## 3. Добавьте переменные окружения

```bash
railway variables set BOT_TOKEN=8545493908:AAFB-7bDNIpDD6p-jTcLon8kyfru--5j7Tg
railway variables set TIMEZONE=Europe/Minsk
railway variables set CHALLENGE_START_DATE=2024-01-01
railway variables set DATABASE_PATH=./data/challenge.db
```

## 4. Задеплойте проект

```bash
railway up
```

Или если нужно собрать проект сначала:
```bash
npm run build && railway up
```

## Альтернатива: через веб-интерфейс Railway

Если CLI не работает, можно:
1. Открыть https://railway.app
2. Выбрать проект
3. Перейти в Settings → Variables
4. Добавить переменные окружения
5. Проект автоматически задеплоится

## Проверка статуса

```bash
railway status
railway logs
```

