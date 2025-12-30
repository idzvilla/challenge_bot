import { Telegraf, Context, Markup } from 'telegraf';
import { createDatabaseAdapter, DatabaseAdapter } from './database-adapter';
import { getConfig, getDateInTimezone, getDateTimeInTimezone, formatUsername, calculateDaysUntilEndOfYear, withTimeout } from './utils';
import * as http from 'http';

// Таймауты для операций (в миллисекундах)
const DB_TIMEOUT = 5000; // 5 секунд для запросов к БД
const TELEGRAM_TIMEOUT = 10000; // 10 секунд для запросов к Telegram API

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

// ============================================================================
// MIDDLEWARE - ДОЛЖЕН БЫТЬ ПЕРВЫМ, ПЕРЕД ВСЕМИ ХЭНДЛЕРАМИ!
// ============================================================================
// Логирование всех входящих апдейтов (самый верхний лог - ПЕРВЫЙ)
// ВАЖНО: Этот middleware должен быть ПЕРВЫМ, чтобы логировать все апдейты
bot.use(async (ctx, next) => {
  const startTime = Date.now();
  const updateId = ctx.update.update_id;
  const updateType = ctx.updateType;
  const userId = ctx.from?.id;
  
  // 1) ЛОГ "ПОЛУЧИЛИ АПДЕЙТ" - самый первый, до любой логики
  console.log(`📥 [UPDATE ${updateId}] Получили апдейт: type=${updateType}, userId=${userId || 'N/A'}`);
  
  // Логируем детали в зависимости от типа апдейта
  if (ctx.message && 'text' in ctx.message) {
    console.log(`📨 [UPDATE ${updateId}] Текст: "${ctx.message.text}" от user ${userId}`);
  } else if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
    console.log(`🔘 [UPDATE ${updateId}] Callback query: "${ctx.callbackQuery.data}" от user ${userId}`);
  }
  
  try {
    await next();
    const duration = Date.now() - startTime;
    console.log(`✅ [UPDATE ${updateId}] Обработан за ${duration}ms, type=${updateType}, userId=${userId || 'N/A'}`);
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error(`❌ [UPDATE ${updateId}] Ошибка обработки за ${duration}ms:`, err);
    console.error('Error details:', {
      updateId,
      updateType,
      userId,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    });
    throw err;
  }
});

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

// /ping (проверка жизни бота без БД)
bot.command('ping', async (ctx: Context) => {
  const updateId = ctx.update.update_id;
  console.log(`🏓 [UPDATE ${updateId}] Ping command received`);
  try {
    await ctx.reply('🏓 Pong! Бот работает.');
    console.log(`✅ [UPDATE ${updateId}] Ping replied successfully`);
  } catch (error) {
    console.error(`❌ [UPDATE ${updateId}] Ping failed:`, error);
  }
});

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
  const userId = ctx.from.id;
  const updateId = ctx.update.update_id;

  try {
    const reps = parseInt(repsStr, 10);

    if (isNaN(reps) || reps < 1) {
      await ctx.reply('❌ Введите целое число больше 0.');
      clearWaitingState(userId);
      return;
    }

    const user = await withTimeout(
      db.getOrCreateUser(userId, ctx.from.username, ctx.from.first_name),
      DB_TIMEOUT,
      'getOrCreateUser'
    );

    const todayDate = getDateInTimezone(config.timezone);
    const loggedAt = getDateTimeInTimezone(config.timezone);

    await withTimeout(
      db.addLog(user.id, reps, loggedAt, todayDate),
      DB_TIMEOUT,
      'addLog'
    );

    const [total, today] = await Promise.all([
      withTimeout(db.getTotalReps(user.id), DB_TIMEOUT, 'getTotalReps'),
      withTimeout(db.getTodayReps(user.id, todayDate), DB_TIMEOUT, 'getTodayReps')
    ]);

    clearWaitingState(userId);

    await ctx.reply(
      `✅ Добавлено ${reps} подтягиваний.\n📅 Сегодня: ${today}\n📊 Всего: ${total}`,
      getKeyboard()
    );
  } catch (error) {
    console.error(`❌ [UPDATE ${updateId}] Error in handleAddReps, userId=${userId}:`, error);
    clearWaitingState(userId);
    await ctx.reply('Произошла ошибка при добавлении подтягиваний. Попробуйте позже.').catch(console.error);
  }
}

// Кнопка "➕ Добавить"
bot.hears('➕ Добавить', async (ctx: Context) => {
  if (!ctx.from) return;
  const userId = ctx.from.id;
  const updateId = ctx.update.update_id;
  
  console.log(`➕ [UPDATE ${updateId}] Button clicked: Добавить, userId=${userId}`);
  
  try {
    state.waitingForReps.add(userId);
    await ctx.reply('Введите количество подтягиваний:', Markup.removeKeyboard());
    console.log(`✅ [UPDATE ${updateId}] Successfully set waiting state for user ${userId}`);
  } catch (error) {
    console.error(`❌ [UPDATE ${updateId}] Error in ➕ Добавить, userId=${userId}:`, error);
    await ctx.reply('Произошла ошибка. Попробуйте позже.').catch(console.error);
  }
});

// /me
bot.command('me', async (ctx: Context) => {
  if (!ctx.from) return;
  const userId = ctx.from.id;
  const updateId = ctx.update.update_id;

  try {
    clearWaitingState(userId);

    const user = await withTimeout(
      db.getOrCreateUser(userId, ctx.from.username, ctx.from.first_name),
      DB_TIMEOUT,
      'getOrCreateUser'
    );

    const todayDate = getDateInTimezone(config.timezone);
    const stats = await withTimeout(
      db.getUserStats(user.id, todayDate, config.challengeStartDate),
      DB_TIMEOUT,
      'getUserStats'
    );

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
  } catch (error) {
    console.error(`❌ [UPDATE ${updateId}] Error in /me, userId=${userId}:`, error);
    await ctx.reply('Произошла ошибка при получении данных. Попробуйте позже.').catch(console.error);
  }
});

// Кнопка "👤 Мой прогресс"
bot.hears('👤 Мой прогресс', async (ctx: Context) => {
  if (!ctx.from) return;

  console.log('👤 Button clicked: Мой прогресс');
  clearWaitingState(ctx.from.id);

  try {
    // Используем логику из /me
    const user = await withTimeout(
      db.getOrCreateUser(ctx.from.id, ctx.from.username, ctx.from.first_name),
      DB_TIMEOUT,
      'getOrCreateUser'
    );

    const todayDate = getDateInTimezone(config.timezone);
    const stats = await withTimeout(
      db.getUserStats(user.id, todayDate, config.challengeStartDate),
      DB_TIMEOUT,
      'getUserStats'
    );

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

    const sentMessage = await ctx.reply(message, getKeyboard());
    console.log(`✅ [UPDATE ${ctx.update.update_id}] Sent progress message, message_id:`, sentMessage.message_id);
  } catch (error) {
    console.error(`❌ [UPDATE ${ctx.update.update_id}] Error in Мой прогресс, userId=${ctx.from?.id}:`, error);
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
  const updateId = ctx.update.update_id;
  const userId = ctx.from?.id;
  
  console.log(`🏆 [UPDATE ${updateId}] Button clicked: Лидерборд, userId=${userId}`);
  
  if (ctx.from) {
    clearWaitingState(ctx.from.id);
  }
  
  try {
    await showLeaderboard(ctx);
    console.log(`✅ [UPDATE ${updateId}] Successfully showed leaderboard for user ${userId}`);
  } catch (error) {
    console.error(`❌ [UPDATE ${updateId}] Error in Лидерборд, userId=${userId}:`, error);
    await ctx.reply('Произошла ошибка при получении лидерборда. Попробуйте позже.').catch(console.error);
  }
});

async function showLeaderboard(ctx: Context) {
  const updateId = ctx.update.update_id;
  const userId = ctx.from?.id;
  
  try {
    console.log(`📊 [UPDATE ${updateId}] Fetching leaderboard...`);
    const leaders = await withTimeout(
      db.getTopLeaders(20),
      DB_TIMEOUT,
      'getTopLeaders'
    );
    console.log(`📊 [UPDATE ${updateId}] Found ${leaders.length} leaders`);

    if (leaders.length === 0) {
      await ctx.reply('Пока нет участников в лидерборде.', getKeyboard());
      return;
    }

    let message = '🏆 Топ-20 лидеров:\n\n';
    leaders.forEach((entry, index) => {
      const name = formatUsername(entry.user);
      message += `${index + 1}) ${name} — ${entry.total.toLocaleString()}\n`;
    });

    const sentMessage = await ctx.reply(message, getKeyboard());
    console.log(`✅ [UPDATE ${updateId}] Sent leaderboard, message_id:`, sentMessage.message_id);
  } catch (error) {
    console.error(`❌ [UPDATE ${updateId}] Error in showLeaderboard, userId=${userId || 'N/A'}:`, error);
    throw error;
  }
}

// /today
bot.command('today', async (ctx: Context) => {
  if (!ctx.from) return;
  const userId = ctx.from.id;
  const updateId = ctx.update.update_id;

  try {
    clearWaitingState(userId);

    const user = await withTimeout(
      db.getOrCreateUser(userId, ctx.from.username, ctx.from.first_name),
      DB_TIMEOUT,
      'getOrCreateUser'
    );

    const todayDate = getDateInTimezone(config.timezone);
    const today = await withTimeout(
      db.getTodayReps(user.id, todayDate),
      DB_TIMEOUT,
      'getTodayReps'
    );

    await ctx.reply(`📅 Сегодня вы сделали: ${today} подтягиваний`, getKeyboard());
  } catch (error) {
    console.error(`❌ [UPDATE ${updateId}] Error in /today, userId=${userId}:`, error);
    await ctx.reply('Произошла ошибка при получении данных. Попробуйте позже.').catch(console.error);
  }
});

// Кнопка "📅 Сегодня"
bot.hears('📅 Сегодня', async (ctx: Context) => {
  if (!ctx.from) return;
  const userId = ctx.from.id;
  const updateId = ctx.update.update_id;

  try {
    clearWaitingState(userId);

    const user = await withTimeout(
      db.getOrCreateUser(userId, ctx.from.username, ctx.from.first_name),
      DB_TIMEOUT,
      'getOrCreateUser'
    );

    const todayDate = getDateInTimezone(config.timezone);
    const today = await withTimeout(
      db.getTodayReps(user.id, todayDate),
      DB_TIMEOUT,
      'getTodayReps'
    );

    await ctx.reply(`📅 Сегодня вы сделали: ${today} подтягиваний`, getKeyboard());
  } catch (error) {
    console.error(`❌ [UPDATE ${updateId}] Error in 📅 Сегодня, userId=${userId}:`, error);
    await ctx.reply('Произошла ошибка при получении данных. Попробуйте позже.').catch(console.error);
  }
});

// /undo
bot.command('undo', async (ctx: Context) => {
  if (!ctx.from) return;
  const userId = ctx.from.id;
  const updateId = ctx.update.update_id;

  try {
    clearWaitingState(userId);

    const user = await withTimeout(
      db.getOrCreateUser(userId, ctx.from.username, ctx.from.first_name),
      DB_TIMEOUT,
      'getOrCreateUser'
    );

    const lastLog = await withTimeout(
      db.getLastLog(user.id),
      DB_TIMEOUT,
      'getLastLog'
    );

    if (!lastLog) {
      await ctx.reply('❌ Нечего отменять. У вас нет записей.', getKeyboard());
      return;
    }

    const deleted = await withTimeout(
      db.deleteLog(lastLog.id),
      DB_TIMEOUT,
      'deleteLog'
    );

    if (!deleted) {
      await ctx.reply('❌ Ошибка при удалении записи.', getKeyboard());
      return;
    }

    const todayDate = getDateInTimezone(config.timezone);
    const [total, today] = await Promise.all([
      withTimeout(db.getTotalReps(user.id), DB_TIMEOUT, 'getTotalReps'),
      withTimeout(db.getTodayReps(user.id, todayDate), DB_TIMEOUT, 'getTodayReps')
    ]);

    await ctx.reply(
      `✅ Удалено ${lastLog.reps} подтягиваний.\n📅 Сегодня: ${today}\n📊 Всего: ${total}`,
      getKeyboard()
    );
  } catch (error) {
    console.error(`❌ [UPDATE ${updateId}] Error in /undo, userId=${userId}:`, error);
    await ctx.reply('Произошла ошибка при отмене записи. Попробуйте позже.').catch(console.error);
  }
});

// Кнопка "↩️ Undo"
bot.hears('↩️ Undo', async (ctx: Context) => {
  if (!ctx.from) return;
  const userId = ctx.from.id;
  const updateId = ctx.update.update_id;

  try {
    clearWaitingState(userId);

    const user = await withTimeout(
      db.getOrCreateUser(userId, ctx.from.username, ctx.from.first_name),
      DB_TIMEOUT,
      'getOrCreateUser'
    );

    const lastLog = await withTimeout(
      db.getLastLog(user.id),
      DB_TIMEOUT,
      'getLastLog'
    );

    if (!lastLog) {
      await ctx.reply('❌ Нечего отменять. У вас нет записей.', getKeyboard());
      return;
    }

    const deleted = await withTimeout(
      db.deleteLog(lastLog.id),
      DB_TIMEOUT,
      'deleteLog'
    );

    if (!deleted) {
      await ctx.reply('❌ Ошибка при удалении записи.', getKeyboard());
      return;
    }

    const todayDate = getDateInTimezone(config.timezone);
    const [total, today] = await Promise.all([
      withTimeout(db.getTotalReps(user.id), DB_TIMEOUT, 'getTotalReps'),
      withTimeout(db.getTodayReps(user.id, todayDate), DB_TIMEOUT, 'getTodayReps')
    ]);

    await ctx.reply(
      `✅ Удалено ${lastLog.reps} подтягиваний.\n📅 Сегодня: ${today}\n📊 Всего: ${total}`,
      getKeyboard()
    );
  } catch (error) {
    console.error(`❌ [UPDATE ${updateId}] Error in ↩️ Undo, userId=${userId}:`, error);
    await ctx.reply('Произошла ошибка при отмене записи. Попробуйте позже.').catch(console.error);
  }
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
  const updateId = ctx.update.update_id;
  const userId = ctx.from?.id;
  
  console.log(`📌 [UPDATE ${updateId}] Button clicked: Правила, userId=${userId}`);
  
  try {
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
    console.log(`✅ [UPDATE ${updateId}] Successfully showed rules for user ${userId}`);
  } catch (error) {
    console.error(`❌ [UPDATE ${updateId}] Error in 📌 Правила, userId=${userId}:`, error);
    await ctx.reply('Произошла ошибка. Попробуйте позже.').catch(console.error);
  }
});

// Обработка callback_query (для inline-кнопок)
// Важно: всегда отвечать на callback_query, иначе у пользователя будет "крутилка"
bot.on('callback_query', async (ctx: Context) => {
  const updateId = ctx.update.update_id;
  const userId = ctx.from?.id;
  
  try {
    // Всегда отвечаем на callback_query, даже если не обрабатываем
    await ctx.answerCbQuery().catch((err) => {
      console.error(`❌ [UPDATE ${updateId}] Failed to answer callback query:`, err);
    });
    
    // Если есть обработка - добавить здесь
    // Пока просто логируем
    if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
      console.log(`🔘 [UPDATE ${updateId}] Callback query received but not handled: "${ctx.callbackQuery.data}" от user ${userId}`);
    }
  } catch (error) {
    console.error(`❌ [UPDATE ${updateId}] Error in callback_query handler, userId=${userId}:`, error);
    // Пытаемся ответить на callback даже при ошибке
    await ctx.answerCbQuery('Произошла ошибка').catch(() => {});
  }
});

// Обработка текстового ввода в режиме добавления (должен быть после всех bot.hears)
// ВАЖНО: Этот обработчик должен быть ПОСЛЕДНИМ, чтобы не перехватывать кнопки
bot.on('text', async (ctx: Context) => {
  if (!ctx.from || !ctx.message || !('text' in ctx.message)) return;
  const userId = ctx.from.id;
  const updateId = ctx.update.update_id;

  // Пропускаем, если это одна из кнопок клавиатуры - они должны обрабатываться bot.hears
  const buttonTexts = ['➕ Добавить', '👤 Мой прогресс', '🏆 Лидерборд', '📅 Сегодня', '📌 Правила', '↩️ Undo'];
  if (buttonTexts.includes(ctx.message.text)) {
    console.log(`⚠️ [UPDATE ${updateId}] Text handler received button text "${ctx.message.text}" - should be handled by bot.hears`);
    // НЕ обрабатываем здесь - пусть bot.hears обработает
    return;
  }

  if (state.waitingForReps.has(userId)) {
    console.log(`📝 [UPDATE ${updateId}] Processing text input for user ${userId} in waiting state: "${ctx.message.text}"`);
    try {
      await handleAddReps(ctx, ctx.message.text);
    } catch (error) {
      console.error(`❌ [UPDATE ${updateId}] Error processing text input:`, error);
    }
    return;
  } else {
    // Логируем, если состояние не найдено (может быть после рестарта)
    console.log(`⚠️ [UPDATE ${updateId}] Text received but user ${userId} not in waiting state: "${ctx.message.text}"`);
  }
});

// Обработка ошибок с полным контекстом
bot.catch((err, ctx) => {
  const updateId = ctx.update.update_id;
  const userId = ctx.from?.id;
  
  console.error(`❌ [UPDATE ${updateId}] Bot error:`, err);
  console.error('Error context:', {
    updateId,
    updateType: ctx.updateType,
    userId,
    message: ctx.message ? (ctx.message as any).text : 'no message',
    callbackQuery: ctx.callbackQuery ? (ctx.callbackQuery as any).data : 'no callback',
    from: ctx.from ? { id: ctx.from.id, username: ctx.from.username } : 'no from',
    errorMessage: err instanceof Error ? err.message : String(err),
    errorStack: err instanceof Error ? err.stack : undefined
  });

  try {
    ctx.reply('Произошла ошибка. Попробуйте позже.').catch((replyErr) => {
      console.error(`❌ [UPDATE ${updateId}] Failed to send error message:`, replyErr);
    });
  } catch (e) {
    console.error(`❌ [UPDATE ${updateId}] Failed to send error message:`, e);
  }
});

// Fallback обработчик для НЕОБРАБОТАННЫХ текстовых сообщений (кнопок)
// ВАЖНО: Этот обработчик должен быть ПОСЛЕДНИМ, после всех bot.hears и bot.on('text')
// Он срабатывает только если bot.hears не обработал кнопку
bot.on('message', async (ctx: Context) => {
  if (!ctx.message || !('text' in ctx.message)) return;
  
  const updateId = ctx.update.update_id;
  const userId = ctx.from?.id;
  const text = ctx.message.text;
  
  // Проверяем, это ли кнопка клавиатуры
  const buttonTexts = ['➕ Добавить', '👤 Мой прогресс', '🏆 Лидерборд', '📅 Сегодня', '📌 Правила', '↩️ Undo'];
  
  if (buttonTexts.includes(text)) {
    console.error(`🚨 [UPDATE ${updateId}] КРИТИЧНО: Кнопка "${text}" не обработана bot.hears! userId=${userId}`);
    console.error(`🚨 [UPDATE ${updateId}] Это означает, что bot.hears не сработал - это НЕ НОРМАЛЬНО!`);
    
    // Пытаемся обработать вручную как fallback - вызываем логику напрямую
    try {
      if (text === '➕ Добавить' && ctx.from) {
        state.waitingForReps.add(ctx.from.id);
        await ctx.reply('Введите количество подтягиваний:', Markup.removeKeyboard());
        console.log(`✅ [UPDATE ${updateId}] Fallback: обработал ➕ Добавить для user ${userId}`);
      } else if (text === '👤 Мой прогресс' && ctx.from) {
        // Вызываем логику напрямую
        const user = await withTimeout(
          db.getOrCreateUser(ctx.from.id, ctx.from.username, ctx.from.first_name),
          DB_TIMEOUT,
          'getOrCreateUser'
        );
        const todayDate = getDateInTimezone(config.timezone);
        const stats = await withTimeout(
          db.getUserStats(user.id, todayDate, config.challengeStartDate),
          DB_TIMEOUT,
          'getUserStats'
        );
        const remaining = Math.max(0, GOAL - stats.total);
        const daysUntilEnd = calculateDaysUntilEndOfYear(config.challengeStartDate, config.timezone);
        const neededPerDay = Math.ceil(remaining / daysUntilEnd);
        let tempoText = stats.averagePerDay >= MIN_PER_DAY 
          ? `✅ Вы опережаете план (${MIN_PER_DAY}/день)`
          : `⚠️ Вы отстаете от плана (${MIN_PER_DAY}/день)`;
        const message = `👤 Ваш прогресс:\n\n📊 Всего: ${stats.total.toLocaleString()} подтягиваний\n📅 Сегодня: ${stats.today}\n📈 Среднее в день: ${stats.averagePerDay.toFixed(1)}\n🎯 Осталось до цели: ${remaining.toLocaleString()}\n${tempoText}\n📉 Нужно в день до конца года: ${neededPerDay}`;
        await ctx.reply(message, getKeyboard());
        console.log(`✅ [UPDATE ${updateId}] Fallback: обработал 👤 Мой прогресс для user ${userId}`);
      } else if (text === '🏆 Лидерборд') {
        await showLeaderboard(ctx);
        console.log(`✅ [UPDATE ${updateId}] Fallback: обработал 🏆 Лидерборд для user ${userId}`);
      } else {
        console.error(`⚠️ [UPDATE ${updateId}] Fallback не знает как обработать кнопку: "${text}"`);
      }
    } catch (error) {
      console.error(`❌ [UPDATE ${updateId}] Fallback обработка упала:`, error);
      await ctx.reply('Произошла ошибка. Попробуйте позже.').catch(() => {});
    }
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
      
      // Heartbeat для polling - логируем раз в минуту, что процесс жив
      setInterval(() => {
        console.log('💓 [HEARTBEAT] Polling процесс жив, время:', new Date().toISOString());
      }, 60000); // Каждую минуту
      
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

// Обработка необработанных ошибок с метками
process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 [UNHANDLED REJECTION]', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
    promise: promise.toString(),
    timestamp: new Date().toISOString()
  });
});

process.on('uncaughtException', (error) => {
  console.error('🚨 [UNCAUGHT EXCEPTION]', {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });
  process.exit(1);
});

