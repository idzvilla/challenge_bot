# Исправление ошибки подключения в DBeaver

## Проблема: "Invalid JDBC URL"

Ошибка возникает, потому что в URL отсутствует **порт** или неправильно указаны параметры.

## Решение:

### Вариант 1: Правильно заполните поля подключения (РЕКОМЕНДУЕТСЯ)

В DBeaver при создании подключения **НЕ используйте URL напрямую**, а заполните поля отдельно:

1. **New Database Connection** → **PostgreSQL** → **Next**

2. **Заполните поля вручную:**

   Из вашего External Database URL:
   ```
   postgresql://challenge_user:password@dpg-xxxxx-a.frankfurt-postgres.render.com/challenge_bot
   ```

   Извлеките:
   - **Host:** `dpg-d5a373ur433s7385uo7g-a.frankfurt-postgres.render.com`
   - **Port:** `5432` (добавьте вручную, если его нет в URL)
   - **Database:** `challenge_bot` (или `challenge_bot_diai` - проверьте в Render)
   - **Username:** `challenge_user`
   - **Password:** `9Ir5KADjQuMAY72gPcbBUhLqTEjhBWof` (из URL)

3. **НЕ заполняйте поле "URL"** - оставьте его пустым или используйте только для просмотра

4. Нажмите **"Test Connection"**

---

### Вариант 2: Исправьте JDBC URL

Если хотите использовать URL напрямую, добавьте порт:

**Неправильно:**
```
postgresql://challenge_user:password@host/database
```

**Правильно:**
```
postgresql://challenge_user:password@host:5432/database
```

**Ваш правильный URL должен быть:**
```
postgresql://challenge_user:9Ir5KADjQuMAY72gPcbBUhLqTEjhBWof@dpg-d5a373ur433s7385uo7g-a.frankfurt-postgres.render.com:5432/challenge_bot
```

Обратите внимание на `:5432` после домена!

---

### Вариант 3: Проверьте имя базы данных

В вашем URL указано `challenge_bot_diai` - проверьте в Render, какое правильное имя базы:

1. Render Dashboard → PostgreSQL сервис → **Info**
2. Найдите **"Database"** - там должно быть правильное имя
3. Используйте это имя в поле **Database**

---

## Пошаговая инструкция для DBeaver:

1. **New Database Connection** (иконка вилки)
2. Выберите **PostgreSQL**
3. Нажмите **Next**
4. **Заполните вкладку "Main":**
   - **Host:** `dpg-d5a373ur433s7385uo7g-a.frankfurt-postgres.render.com`
   - **Port:** `5432`
   - **Database:** `challenge_bot` (проверьте правильное имя в Render)
   - **Username:** `challenge_user`
   - **Password:** `9Ir5KADjQuMAY72gPcbBUhLqTEjhBWof`
5. **НЕ трогайте вкладку "URL"** - оставьте её как есть
6. Нажмите **"Test Connection"**
7. Если попросит скачать драйвер - скачайте
8. Если успешно - **Finish**

---

## Если все еще не работает:

1. **Проверьте External Database URL в Render:**
   - Убедитесь, что используете **External**, а не Internal
   - External URL работает извне Render

2. **Проверьте имя базы данных:**
   - В Render PostgreSQL → Info → Database
   - Используйте точное имя

3. **Проверьте пароль:**
   - Если пароль не работает, сбросьте его в Render
   - PostgreSQL → Settings → Reset Database Password

4. **Проверьте сеть:**
   - Убедитесь, что ваш IP не заблокирован
   - External Database URL должен быть доступен извне

---

## Альтернатива: Используйте psql (командная строка)

Если DBeaver не работает, попробуйте через командную строку:

```bash
# Установите psql (macOS)
brew install postgresql

# Подключитесь с правильным URL (с портом!)
psql "postgresql://challenge_user:9Ir5KADjQuMAY72gPcbBUhLqTEjhBWof@dpg-d5a373ur433s7385uo7g-a.frankfurt-postgres.render.com:5432/challenge_bot"
```

Обратите внимание на `:5432` после домена!

