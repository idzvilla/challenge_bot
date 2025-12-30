#!/bin/bash

# Скрипт деплоя на Railway
# Сначала выполните: railway login

set -e

echo "🚀 Начинаю деплой на Railway..."

# Проверка авторизации
echo "📋 Проверка авторизации..."
if ! railway whoami &>/dev/null; then
    echo "❌ Не авторизован. Выполните: railway login"
    exit 1
fi

echo "✅ Авторизован"

# Подключение к проекту
echo "🔗 Подключение к проекту..."
railway link -p fdde51ea-b5c7-4e5f-8952-1eee8a100036

# Добавление переменных окружения
echo "⚙️  Установка переменных окружения..."
railway variables set BOT_TOKEN=8545493908:AAFB-7bDNIpDD6p-jTcLon8kyfru--5j7Tg
railway variables set TIMEZONE=Europe/Minsk
railway variables set CHALLENGE_START_DATE=2024-01-01
railway variables set DATABASE_PATH=./data/challenge.db

# Сборка проекта
echo "🔨 Сборка проекта..."
npm run build

# Деплой
echo "🚀 Деплой на Railway..."
railway up

echo "✅ Деплой завершен!"
echo "📊 Проверить логи: railway logs"
echo "📈 Проверить статус: railway status"


