import * as dotenv from 'dotenv';

dotenv.config();

export function getDateInTimezone(timezone: string): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(now);
}

export function getDateTimeInTimezone(timezone: string): string {
  return new Date().toISOString();
}

export function getConfig() {
  return {
    botToken: process.env.BOT_TOKEN || '',
    timezone: process.env.TIMEZONE || 'Europe/Minsk',
    challengeStartDate: process.env.CHALLENGE_START_DATE || '2024-01-01',
    databasePath: process.env.DATABASE_PATH || './data/challenge.db',
    databaseUrl: process.env.DATABASE_URL || '' // PostgreSQL connection string
  };
}

export function formatUsername(user: { username?: string | null; first_name?: string | null; tg_user_id: number }): string {
  if (user.username) {
    return user.username;
  }
  const idStr = user.tg_user_id.toString();
  const last4 = idStr.slice(-4);
  return `${user.first_name || 'User'} (${last4})`;
}

export function calculateDaysUntilEndOfYear(startDate: string, timezone: string): number {
  // Дата окончания челленджа = startDate + 1 год
  const start = new Date(startDate + 'T00:00:00');
  const endDate = new Date(start);
  endDate.setFullYear(start.getFullYear() + 1);
  
  // Получаем текущую дату в нужной таймзоне
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const todayStr = formatter.format(now);
  const today = new Date(todayStr + 'T00:00:00');
  
  // Вычисляем разницу в днях
  const diffTime = endDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(1, diffDays);
}

/**
 * Обертка для добавления таймаута к Promise
 * Полезно для предотвращения зависаний на запросах к БД или внешним API
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Timeout: ${operation} превысил ${timeoutMs}ms`));
      }, timeoutMs);
    })
  ]);
}

