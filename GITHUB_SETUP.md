# Инструкция по выгрузке на GitHub

## Шаги для создания репозитория и выгрузки кода:

1. **Создайте репозиторий на GitHub:**
   - Откройте https://github.com/new
   - Название репозитория: `challenge_bot`
   - Выберите "Public" или "Private"
   - НЕ добавляйте README, .gitignore или лицензию (они уже есть)
   - Нажмите "Create repository"

2. **Выполните команды в терминале:**

```bash
cd /Users/test/Documents/Apps/Challenge
git remote add origin https://github.com/YOUR_USERNAME/challenge_bot.git
git branch -M main
git push -u origin main
```

Замените `YOUR_USERNAME` на ваш GitHub username.

## Альтернатива: через SSH

Если у вас настроен SSH ключ:

```bash
git remote add origin git@github.com:YOUR_USERNAME/challenge_bot.git
git branch -M main
git push -u origin main
```

## После выгрузки:

1. Откройте Railway.app
2. Создайте новый проект
3. Выберите "Deploy from GitHub repo"
4. Выберите репозиторий `challenge_bot`
5. Добавьте переменные окружения (BOT_TOKEN и др.)
6. Готово!



