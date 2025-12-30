# ПРОСТОЙ способ посмотреть данные в базе

## Способ 1: Через командную строку (САМЫЙ ПРОСТОЙ) ⭐⭐⭐

### Шаг 1: Установите psql

```bash
# macOS
brew install postgresql
```

### Шаг 2: Получите External Database URL

1. Render Dashboard → PostgreSQL → Info
2. Скопируйте **External Database URL** (весь целиком!)

### Шаг 3: Подключитесь

```bash
psql "ВСТАВЬТЕ_СЮДА_ВЕСЬ_EXTERNAL_URL"
```

Например:
```bash
psql "postgresql://challenge_user:password@dpg-xxxxx-a.frankfurt-postgres.render.com:5432/challenge_bot"
```

### Шаг 4: Выполняйте команды

```sql
-- Посмотреть всех пользователей
SELECT * FROM users;

-- Посмотреть все логи
SELECT * FROM logs;

-- Выйти
\q
```

---

## Способ 2: Через Render Dashboard (если есть SQL Editor)

1. Render Dashboard → PostgreSQL
2. Найдите вкладку "SQL Editor" или "Query"
3. Если есть - используйте его

---

## Способ 3: Простое подключение в DBeaver (упрощенное)

### ВАЖНО: Используйте External Database URL целиком!

1. **New Database Connection** → PostgreSQL
2. Перейдите на вкладку **"URL"** (не Main!)
3. Вставьте **весь External Database URL** целиком
4. Нажмите **"Test Connection"**

Если попросит скачать драйвер - скачайте.

---

## Если ничего не работает:

Можете просто использовать бота в Telegram - он показывает все данные через команды:
- `/me` - ваш прогресс
- `/top` - лидерборд
- `/today` - за сегодня

Все данные там видны!

