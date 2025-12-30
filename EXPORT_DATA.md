# Экспорт данных из базы данных

## Быстрый старт

```bash
npm run export
```

Скрипт автоматически:
- Подключится к вашей БД (PostgreSQL или SQLite)
- Выгрузит всех пользователей и все логи
- Создаст файлы в директории `exports/`:
  - `export-YYYY-MM-DDTHH-MM-SS.json` - полный экспорт в JSON
  - `export-YYYY-MM-DDTHH-MM-SS.csv` - экспорт в CSV
  - `stats-YYYY-MM-DDTHH-MM-SS.json` - статистика по пользователям

## Что экспортируется

### 1. Пользователи (users)
- ID пользователя
- Telegram User ID
- Username
- First Name
- Дата регистрации

### 2. Логи (logs)
- ID лога
- User ID
- Количество подтягиваний
- Дата и время записи
- Дата (только дата)

### 3. Статистика (stats)
- User ID и Telegram User ID
- Username и First Name
- Общее количество подтягиваний
- Количество записей
- Первая и последняя запись

## Форматы экспорта

### JSON
Полный экспорт всех данных в структурированном формате JSON. Удобно для программной обработки.

### CSV
Экспорт в CSV формат, разделенный на секции:
- Пользователи
- Логи
- Статистика

Удобно для открытия в Excel/Google Sheets.

## Пример использования

```bash
# Экспорт данных
npm run export

# Результат:
# ✅ Найдено пользователей: 5
# ✅ Найдено логов: 150
# ✅ JSON экспорт: exports/export-2024-01-15T10-30-45.json
# ✅ CSV экспорт: exports/export-2024-01-15T10-30-45.csv
# ✅ Статистика: exports/stats-2024-01-15T10-30-45.json
```

## Альтернативные способы экспорта

### PostgreSQL (через psql)

```bash
# Экспорт в SQL
pg_dump "postgresql://user:pass@host:port/db" > backup.sql

# Экспорт только данных (без схемы)
pg_dump --data-only "postgresql://user:pass@host:port/db" > data.sql

# Экспорт в CSV
psql "postgresql://user:pass@host:port/db" -c "COPY users TO STDOUT WITH CSV HEADER" > users.csv
psql "postgresql://user:pass@host:port/db" -c "COPY logs TO STDOUT WITH CSV HEADER" > logs.csv
```

### SQLite

```bash
# Экспорт в SQL
sqlite3 data/challenge.db .dump > backup.sql

# Экспорт в CSV
sqlite3 data/challenge.db -header -csv "SELECT * FROM users;" > users.csv
sqlite3 data/challenge.db -header -csv "SELECT * FROM logs;" > logs.csv
```

## Восстановление данных

### Из JSON (через скрипт)

Можно создать скрипт для импорта из JSON, если понадобится.

### Из SQL

```bash
# PostgreSQL
psql "postgresql://user:pass@host:port/db" < backup.sql

# SQLite
sqlite3 data/challenge.db < backup.sql
```

## Важно

- Экспорт создает **копию** данных, не удаляя оригиналы
- Файлы сохраняются в директории `exports/` (создается автоматически)
- Каждый экспорт создает новые файлы с временной меткой
- Старые экспорты не удаляются автоматически

