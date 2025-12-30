-- SQL скрипт для создания таблиц в PostgreSQL
-- Используется автоматически при первом запуске бота

-- Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  tg_user_id BIGINT UNIQUE NOT NULL,
  username TEXT,
  first_name TEXT,
  joined_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Таблица логов подтягиваний
CREATE TABLE IF NOT EXISTS logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  reps INTEGER NOT NULL,
  logged_at TIMESTAMP NOT NULL DEFAULT NOW(),
  log_date DATE NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Индексы для оптимизации
CREATE INDEX IF NOT EXISTS idx_logs_user_id ON logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_log_date ON logs(log_date);
CREATE INDEX IF NOT EXISTS idx_logs_user_date ON logs(user_id, log_date);

