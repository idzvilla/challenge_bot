#!/bin/bash
# Быстрый деплой после авторизации
railway link -p fdde51ea-b5c7-4e5f-8952-1eee8a100036
railway variables set BOT_TOKEN=8545493908:AAFB-7bDNIpDD6p-jTcLon8kyfru--5j7Tg
railway variables set TIMEZONE=Europe/Minsk
railway variables set CHALLENGE_START_DATE=2024-01-01
railway variables set DATABASE_PATH=./data/challenge.db
npm run build
railway up
