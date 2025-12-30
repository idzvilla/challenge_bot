import { Telegraf, Context, Markup } from 'telegraf';
import { createDatabaseAdapter, DatabaseAdapter } from './database-adapter';
import { getConfig, getDateInTimezone, getDateTimeInTimezone, formatUsername, calculateDaysUntilEndOfYear } from './utils';
import * as http from 'http';

interface BotState {
  waitingForReps: Set<number>;
}

const config = getConfig();

if (!config.botToken) {
  console.error('BOT_TOKEN is not set in .env file');
  process.exit(1);
}

const bot = new Telegraf(config.botToken);

// Инициализация базы данных: PostgreSQL если есть DATABASE_URL, иначе SQLite
if (!config.databaseUrl && !config.databasePath) {
  console.error('❌ Neither DATABASE_URL nor DATABASE_PATH is set!');
  console.error('Please set DATABASE_URL (for PostgreSQL) or DATABASE_PATH (for SQLite)');
  process.exit(1);
}

const db: DatabaseAdapter = createDatabaseAdapter(config.databaseUrl, config.databasePath);
const state: BotState = {
  waitingForReps: new Set<number>()
};

const GOAL = 18250;
const MIN_PER_DAY = 50;

// Очистка состояния ожидания
function clearWaitingState(userId: number): void {
  state.waitingForReps.delete(userId);
}

// Клавиатура
const getKeyboard = () => {
  return Markup.keyboard([
    ['➕ Добавить', '👤 Мой прогресс'],
    ['🏆 Лидерборд', '📅 Сегодня'],
    ['📌 Правила', '↩️ Undo']
  ]).resize();
};

// /start
bot.command('start', async (ctx: Context) => {
  if (!ctx.from) return;

  clearWaitingState(ctx.from.id);

  const user = await db.getOrCreateUser(
    ctx.from.id,
    ctx.from.username,
    ctx.from.first_name
  );

  const welcomeText = `👋 Добро пожаловать в челлендж по подтягиваниям!

🎯 Цель: ${GOAL.toLocaleString()} подтягиваний за год
📊 Минимум: ${MIN_PER_DAY} подтягиваний в день
✨ Можно делать больше!

Используйте кнопки ниже для управления своим прогрессом.`;

  await ctx.reply(welcomeText, getKeyboard());
});

// /add <число>
bot.command('add', async (ctx: Context) => {
  if (!ctx.from) return;

  const args = ctx.message && 'text' in ctx.message ? ctx.message.text.split(' ') : [];
  const repsStr = args[1];

  if (!repsStr) {
    await ctx.reply('Используйте: /add <число>\nИли нажмите кнопку "➕ Добавить"');
    return;
  }

  await handleAddReps(ctx, repsStr);
});

// Обработка добавления подтягиваний
async function handleAddReps(ctx: Context, repsStr: string) {
  if (!ctx.from) return;

  const reps = parseInt(repsStr, 10);

  if (isNaN(reps) || reps < 1) {
    await ctx.reply('❌ Введите целое число больше 0.');
    clearWaitingState(ctx.from.id);
    return;
  }

  const user = await db.getOrCreateUser(
    ctx.from.id,
    ctx.from.username,
    ctx.from.first_name
  );

  const todayDate = getDateInTimezone(config.timezone);
  const loggedAt = getDateTimeInTimezone(config.timezone);

  await db.addLog(user.id, reps, loggedAt, todayDate);

  const total = await db.getTotalReps(user.id);
  const today = await db.getTodayReps(user.id, todayDate);

  clearWaitingState(ctx.from.id);

  await ctx.reply(
    `✅ Добавлено ${reps} подтягиваний.\n📅 Сегодня: ${today}\n📊 Всего: ${total}`,
    getKeyboard()
  );
}

// Кнопка "➕ Добавить"
bot.hears('➕ Добавить', async (ctx: Context) => {
  if (!ctx.from) return;

  state.waitingForReps.add(ctx.from.id);
  await ctx.reply('Введите количество подтягиваний:', Markup.removeKeyboard());
});

// /me
bot.command('me', async (ctx: Context) => {
  if (!ctx.from) return;

  clearWaitingState(ctx.from.id);

  const user = await db.getOrCreateUser(
    ctx.from.id,
    ctx.from.username,
    ctx.from.first_name
  );

  const todayDate = getDateInTimezone(config.timezone);
  const stats = await db.getUserStats(user.id, todayDate, config.challengeStartDate);

  const remaining = Math.max(0, GOAL - stats.total);
  const daysUntilEnd = calculateDaysUntilEndOfYear(config.challengeStartDate, config.timezone);
  const neededPerDay = Math.ceil(remaining / daysUntilEnd);

  let tempoText = '';
  if (stats.averagePerDay >= MIN_PER_DAY) {
    tempoText = `✅ Вы опережаете план (${MIN_PER_DAY}/день)`;
  } else {
    tempoText = `⚠️ Вы отстаете от плана (${MIN_PER_DAY}/день)`;
  }

  const message = `👤 Ваш прогресс:

📊 Всего: ${stats.total.toLocaleString()} подтягиваний
📅 Сегодня: ${stats.today}
📈 Среднее в день: ${stats.averagePerDay.toFixed(1)}
🎯 Осталось до цели: ${remaining.toLocaleString()}
${tempoText}
📉 Нужно в день до конца года: ${neededPerDay}`;

  await ctx.reply(message, getKeyboard());
});

// Кнопка "👤 Мой прогресс"
bot.hears('👤 Мой прогресс', async (ctx: Context) => {
  if (!ctx.from) return;
  
  console.log('👤 Button clicked: Мой прогресс');
  clearWaitingState(ctx.from.id);
  
  try {
    // Используем логику из /me
    const user = await db.getOrCreateUser(
      ctx.from.id,
      ctx.from.username,
      ctx.from.first_name
    );

    const todayDate = getDateInTimezone(config.timezone);
    const stats = await db.getUserStats(user.id, todayDate, config.challengeStartDate);

    const remaining = Math.max(0, GOAL - stats.total);
    const daysUntilEnd = calculateDaysUntilEndOfYear(config.challengeStartDate, config.timezone);
    const neededPerDay = Math.ceil(remaining / daysUntilEnd);

    let tempoText = '';
    if (stats.averagePerDay >= MIN_PER_DAY) {
      tempoText = `✅ Вы опережаете план (${MIN_PER_DAY}/день)`;
    } else {
      tempoText = `⚠️ Вы отстаете от плана (${MIN_PER_DAY}/день)`;
    }

    const message = `👤 Ваш прогресс:

📊 Всего: ${stats.total.toLocaleString()} подтягиваний
📅 Сегодня: ${stats.today}
📈 Среднее в день: ${stats.averagePerDay.toFixed(1)}
🎯 Осталось до цели: ${remaining.toLocaleString()}
${tempoText}
📉 Нужно в день до конца года: ${neededPerDay}`;

    await ctx.reply(message, getKeyboard());
    console.log('✅ Sent progress message');
  } catch (error) {
    console.error('❌ Error in Мой прогресс:', error);
    await ctx.reply('Произошла ошибка при получении данных. Попробуйте позже.').catch(console.error);
  }
});

// /top
bot.command('top', async (ctx: Context) => {
  if (ctx.from) {
    clearWaitingState(ctx.from.id);
  }
  await showLeaderboard(ctx);
});

// Кнопка "🏆 Лидерборд"
bot.hears('🏆 Лидерборд', async (ctx: Context) => {
  console.log('🏆 Button clicked: Лидерборд');
  if (ctx.from) {
    clearWaitingState(ctx.from.id);
  }
  try {
    await showLeaderboard(ctx);
  } catch (error) {
    console.error('❌ Error in Лидерборд:', error);
    await ctx.reply('Произошла ошибка при получении лидерборда. Попробуйте позже.').catch(console.error);
  }
});

async function showLeaderboard(ctx: Context) {
  try {
    console.log('📊 Fetching leaderboard...');
    const leaders = await db.getTopLeaders(20);
    console.log(`📊 Found ${leaders.length} leaders`);

    if (leaders.length === 0) {
      await ctx.reply('Пока нет участников в лидерборде.', getKeyboard());
      return;
    }

    let message = '🏆 Топ-20 лидеров:\n\n';
    leaders.forEach((entry, index) => {
      const name = formatUsername(entry.user);
      message += `${index + 1}) ${name} — ${entry.total.toLocaleString()}\n`;
    });

    await ctx.reply(message, getKeyboard());
    console.log('✅ Sent leaderboard');
  } catch (error) {
    console.error('❌ Error in showLeaderboard:', error);
    throw error;
  }
}

// /today
bot.command('today', async (ctx: Context) => {
  if (!ctx.from) return;

  clearWaitingState(ctx.from.id);

  const user = await db.getOrCreateUser(
    ctx.from.id,
    ctx.from.username,
    ctx.from.first_name
  );

  const todayDate = getDateInTimezone(config.timezone);
  const today = await db.getTodayReps(user.id, todayDate);

  await ctx.reply(`📅 Сегодня вы сделали: ${today} подтягиваний`, getKeyboard());
});

// Кнопка "📅 Сегодня"
bot.hears('📅 Сегодня', async (ctx: Context) => {
  if (!ctx.from) return;

  clearWaitingState(ctx.from.id);

  const user = await db.getOrCreateUser(
    ctx.from.id,
    ctx.from.username,
    ctx.from.first_name
  );

  const todayDate = getDateInTimezone(config.timezone);
  const today = await db.getTodayReps(user.id, todayDate);

  await ctx.reply(`📅 Сегодня вы сделали: ${today} подтягиваний`, getKeyboard());
});

// /undo
bot.command('undo', async (ctx: Context) => {
  if (!ctx.from) return;

  clearWaitingState(ctx.from.id);

  const user = await db.getOrCreateUser(
    ctx.from.id,
    ctx.from.username,
    ctx.from.first_name
  );

  const lastLog = await db.getLastLog(user.id);

  if (!lastLog) {
    await ctx.reply('❌ Нечего отменять. У вас нет записей.', getKeyboard());
    return;
  }

  const deleted = await db.deleteLog(lastLog.id);

  if (!deleted) {
    await ctx.reply('❌ Ошибка при удалении записи.', getKeyboard());
    return;
  }

  const todayDate = getDateInTimezone(config.timezone);
  const total = await db.getTotalReps(user.id);
  const today = await db.getTodayReps(user.id, todayDate);

  await ctx.reply(
    `✅ Удалено ${lastLog.reps} подтягиваний.\n📅 Сегодня: ${today}\n📊 Всего: ${total}`,
    getKeyboard()
  );
});

// Кнопка "↩️ Undo"
bot.hears('↩️ Undo', async (ctx: Context) => {
  if (!ctx.from) return;

  clearWaitingState(ctx.from.id);

  const user = await db.getOrCreateUser(
    ctx.from.id,
    ctx.from.username,
    ctx.from.first_name
  );

  const lastLog = await db.getLastLog(user.id);

  if (!lastLog) {
    await ctx.reply('❌ Нечего отменять. У вас нет записей.', getKeyboard());
    return;
  }

  const deleted = await db.deleteLog(lastLog.id);

  if (!deleted) {
    await ctx.reply('❌ Ошибка при удалении записи.', getKeyboard());
    return;
  }

  const todayDate = getDateInTimezone(config.timezone);
  const total = await db.getTotalReps(user.id);
  const today = await db.getTodayReps(user.id, todayDate);

  await ctx.reply(
    `✅ Удалено ${lastLog.reps} подтягиваний.\n📅 Сегодня: ${today}\n📊 Всего: ${total}`,
    getKeyboard()
  );
});

// /rules
bot.command('rules', async (ctx: Context) => {
  if (ctx.from) {
    clearWaitingState(ctx.from.id);
  }
  const message = `📌 Правила челленджа:

🎯 Цель: ${GOAL.toLocaleString()} подтягиваний за год
📊 Минимум: ${MIN_PER_DAY} подтягиваний в день
✨ Можно делать больше!
⏰ Важно регулярно логировать свой прогресс

Используйте команды или кнопки для управления.`;

  await ctx.reply(message, getKeyboard());
});

// Кнопка "📌 Правила"
bot.hears('📌 Правила', async (ctx: Context) => {
  if (ctx.from) {
    clearWaitingState(ctx.from.id);
  }
  const message = `📌 Правила челленджа:

🎯 Цель: ${GOAL.toLocaleString()} подтягиваний за год
📊 Минимум: ${MIN_PER_DAY} подтягиваний в день
✨ Можно делать больше!
⏰ Важно регулярно логировать свой прогресс

Используйте команды или кнопки для управления.`;

  await ctx.reply(message, getKeyboard());
});

// Обработка текстового ввода в режиме добавления (должен быть после всех bot.hears)
bot.on('text', async (ctx: Context) => {
  if (!ctx.from || !ctx.message || !('text' in ctx.message)) return;

  // Пропускаем, если это одна из кнопок клавиатуры
  const buttonTexts = ['➕ Добавить', '👤 Мой прогресс', '🏆 Лидерборд', '📅 Сегодня', '📌 Правила', '↩️ Undo'];
  if (buttonTexts.includes(ctx.message.text)) {
    return; // Позволяем bot.hears обработать это
  }

  if (state.waitingForReps.has(ctx.from.id)) {
    const text = ctx.message.text;
    await handleAddReps(ctx, text);
    return;
  }
});

// Обработка ошибок
bot.catch((err, ctx) => {
  console.error('❌ Bot error:', err);
  console.error('Error context:', {
    updateType: ctx.updateType,
    message: ctx.message ? (ctx.message as any).text : 'no message',
    from: ctx.from ? ctx.from.id : 'no from'
  });
  
  try {
    ctx.reply('Произошла ошибка. Попробуйте позже.').catch(console.error);
  } catch (e) {
    console.error('Failed to send error message:', e);
  }
});

// Логирование всех входящих сообщений для отладки
bot.use(async (ctx, next) => {
  if (ctx.message && 'text' in ctx.message) {
    console.log(`📨 Received: "${ctx.message.text}" from user ${ctx.from?.id}`);
  }
  try {
    await next();
  } catch (err) {
    console.error('❌ Middleware error:', err);
    throw err;
  }
});

// Запуск простого HTTP сервера для Render (health check)
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'telegram-bot' }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`HTTP server listening on port ${PORT} (for Render health checks)`);
});

// Graceful shutdown
process.once('SIGINT', async () => {
  console.log('Shutting down...');
  server.close();
  await db.close();
  bot.stop('SIGINT');
});
process.once('SIGTERM', async () => {
  console.log('Shutting down...');
  server.close();
  await db.close();
  bot.stop('SIGTERM');
});

// Запуск бота
console.log('Starting bot...');
console.log('Config:', {
  timezone: config.timezone,
  challengeStartDate: config.challengeStartDate,
  databasePath: config.databasePath,
  hasBotToken: !!config.botToken
});

// Функция запуска бота с повторными попытками
async function startBotWithRetry(retries = 3, delay = 10000) {
  for (let i = 0; i < retries; i++) {
    try {
      // Останавливаем предыдущие обновления перед запуском
      try {
        await bot.telegram.deleteWebhook({ drop_pending_updates: true });
        console.log('Cleared webhook and pending updates');
      } catch (webhookErr: any) {
        // Игнорируем ошибки при очистке webhook
        console.log('Webhook clear attempt:', webhookErr.message || 'ok');
      }
      
      // Небольшая задержка перед запуском
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      await bot.launch();
      console.log('✅ Bot is running!');
      console.log('Bot username:', bot.botInfo?.username || 'Unknown');
      return;
    } catch (err: any) {
      console.error(`❌ Failed to start bot (attempt ${i + 1}/${retries}):`, err);
      
      // Если это ошибка авторизации - не повторяем
      if (err.response?.error_code === 401 || err.message?.includes('Unauthorized')) {
        console.error('❌ Invalid bot token! Check BOT_TOKEN variable.');
        process.exit(1);
      }
      
      // Если это конфликт (409) - увеличиваем задержку и повторяем
      if (err.response?.error_code === 409) {
        console.error('⚠️ Another bot instance is running. Waiting longer before retry...');
        const conflictDelay = delay * 2; // Удваиваем задержку для конфликта
        if (i < retries - 1) {
          console.log(`⏳ Waiting ${conflictDelay / 1000} seconds for other instance to stop...`);
          await new Promise(resolve => setTimeout(resolve, conflictDelay));
          continue;
        }
      }
      
      if (i < retries - 1) {
        console.log(`⏳ Retrying in ${delay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error('❌ All retry attempts failed. Exiting...');
        console.error('💡 Make sure no other bot instances are running (Railway, local, etc.)');
        process.exit(1);
      }
    }
  }
}

startBotWithRetry();

// Обработка необработанных ошибок
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

