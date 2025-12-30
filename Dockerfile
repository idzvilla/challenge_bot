FROM node:20-alpine

WORKDIR /app

# Установка зависимостей для better-sqlite3
RUN apk add --no-cache python3 make g++ sqlite

# Копирование package файлов
COPY package*.json ./
COPY tsconfig.json ./

# Установка зависимостей
RUN npm ci

# Копирование исходного кода
COPY src ./src

# Сборка проекта
RUN npm run build

# Создание директории для базы данных
RUN mkdir -p /app/data

# Запуск приложения
CMD ["npm", "start"]


