import { Telegraf, Context, Markup } from 'telegraf';
import { ChallengeDatabase } from './database';
import { getConfig, getDateInTimezone, getDateTimeInTimezone, formatUsername, calculateDaysUntilEndOfYear } from './utils';

interface BotState {
  waitingForReps: Set<number>;
}

const config = getConfig();

if (!config.botToken) {
  console.error('BOT_TOKEN is not set in .env file');
  process.exit(1);
}

const bot = new Telegraf(config.botToken);
const db = new ChallengeDatabase(config.databasePath);
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

  const user = db.getOrCreateUser(
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

  const user = db.getOrCreateUser(
    ctx.from.id,
    ctx.from.username,
    ctx.from.first_name
  );

  const todayDate = getDateInTimezone(config.timezone);
  const loggedAt = getDateTimeInTimezone(config.timezone);

  db.addLog(user.id, reps, loggedAt, todayDate);

  const total = db.getTotalReps(user.id);
  const today = db.getTodayReps(user.id, todayDate);

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

  const user = db.getOrCreateUser(
    ctx.from.id,
    ctx.from.username,
    ctx.from.first_name
  );

  const todayDate = getDateInTimezone(config.timezone);
  const stats = db.getUserStats(user.id, todayDate, config.challengeStartDate);

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
  
  clearWaitingState(ctx.from.id);
  
  // Используем логику из /me
  const user = db.getOrCreateUser(
    ctx.from.id,
    ctx.from.username,
    ctx.from.first_name
  );

  const todayDate = getDateInTimezone(config.timezone);
  const stats = db.getUserStats(user.id, todayDate, config.challengeStartDate);

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

// /top
bot.command('top', async (ctx: Context) => {
  if (ctx.from) {
    clearWaitingState(ctx.from.id);
  }
  await showLeaderboard(ctx);
});

// Кнопка "🏆 Лидерборд"
bot.hears('🏆 Лидерборд', async (ctx: Context) => {
  if (ctx.from) {
    clearWaitingState(ctx.from.id);
  }
  await showLeaderboard(ctx);
});

async function showLeaderboard(ctx: Context) {
  const leaders = db.getTopLeaders(20);

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
}

// /today
bot.command('today', async (ctx: Context) => {
  if (!ctx.from) return;

  clearWaitingState(ctx.from.id);

  const user = db.getOrCreateUser(
    ctx.from.id,
    ctx.from.username,
    ctx.from.first_name
  );

  const todayDate = getDateInTimezone(config.timezone);
  const today = db.getTodayReps(user.id, todayDate);

  await ctx.reply(`📅 Сегодня вы сделали: ${today} подтягиваний`, getKeyboard());
});

// Кнопка "📅 Сегодня"
bot.hears('📅 Сегодня', async (ctx: Context) => {
  if (!ctx.from) return;

  clearWaitingState(ctx.from.id);

  const user = db.getOrCreateUser(
    ctx.from.id,
    ctx.from.username,
    ctx.from.first_name
  );

  const todayDate = getDateInTimezone(config.timezone);
  const today = db.getTodayReps(user.id, todayDate);

  await ctx.reply(`📅 Сегодня вы сделали: ${today} подтягиваний`, getKeyboard());
});

// /undo
bot.command('undo', async (ctx: Context) => {
  if (!ctx.from) return;

  clearWaitingState(ctx.from.id);

  const user = db.getOrCreateUser(
    ctx.from.id,
    ctx.from.username,
    ctx.from.first_name
  );

  const lastLog = db.getLastLog(user.id);

  if (!lastLog) {
    await ctx.reply('❌ Нечего отменять. У вас нет записей.', getKeyboard());
    return;
  }

  const deleted = db.deleteLog(lastLog.id);

  if (!deleted) {
    await ctx.reply('❌ Ошибка при удалении записи.', getKeyboard());
    return;
  }

  const todayDate = getDateInTimezone(config.timezone);
  const total = db.getTotalReps(user.id);
  const today = db.getTodayReps(user.id, todayDate);

  await ctx.reply(
    `✅ Удалено ${lastLog.reps} подтягиваний.\n📅 Сегодня: ${today}\n📊 Всего: ${total}`,
    getKeyboard()
  );
});

// Кнопка "↩️ Undo"
bot.hears('↩️ Undo', async (ctx: Context) => {
  if (!ctx.from) return;

  clearWaitingState(ctx.from.id);

  const user = db.getOrCreateUser(
    ctx.from.id,
    ctx.from.username,
    ctx.from.first_name
  );

  const lastLog = db.getLastLog(user.id);

  if (!lastLog) {
    await ctx.reply('❌ Нечего отменять. У вас нет записей.', getKeyboard());
    return;
  }

  const deleted = db.deleteLog(lastLog.id);

  if (!deleted) {
    await ctx.reply('❌ Ошибка при удалении записи.', getKeyboard());
    return;
  }

  const todayDate = getDateInTimezone(config.timezone);
  const total = db.getTotalReps(user.id);
  const today = db.getTodayReps(user.id, todayDate);

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
  console.error('Error:', err);
  ctx.reply('Произошла ошибка. Попробуйте позже.').catch(console.error);
});

// Graceful shutdown
process.once('SIGINT', () => {
  console.log('Shutting down...');
  db.close();
  bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
  console.log('Shutting down...');
  db.close();
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

bot.launch().then(() => {
  console.log('✅ Bot is running!');
  console.log('Bot username:', bot.botInfo?.username || 'Unknown');
}).catch((err) => {
  console.error('❌ Failed to start bot:', err);
  console.error('Error details:', JSON.stringify(err, null, 2));
  process.exit(1);
});

// Обработка необработанных ошибок
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

