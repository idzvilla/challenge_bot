import { Pool, QueryResult } from 'pg';

export interface User {
  id: number;
  tg_user_id: number;
  username: string | null;
  first_name: string | null;
  joined_at: string;
}

export interface Log {
  id: number;
  user_id: number;
  reps: number;
  logged_at: string;
  log_date: string;
}

export class ChallengeDatabase {
  private pool: Pool;

  constructor(databaseUrl: string) {
    try {
      console.log('Initializing PostgreSQL database...');
      this.pool = new Pool({
        connectionString: databaseUrl,
        ssl: databaseUrl.includes('supabase') || databaseUrl.includes('render.com') 
          ? { rejectUnauthorized: false } 
          : false
      });

      // Проверка подключения
      this.pool.query('SELECT NOW()').then(() => {
        console.log('Database connection successful');
      }).catch((err: Error) => {
        console.error('Database connection failed:', err);
        throw err;
      });

      this.initTables();
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  private async initTables(): Promise<void> {
    const client = await this.pool.connect();
    try {
      // Таблица пользователей
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          tg_user_id BIGINT UNIQUE NOT NULL,
          username TEXT,
          first_name TEXT,
          joined_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);

      // Таблица логов подтягиваний
      await client.query(`
        CREATE TABLE IF NOT EXISTS logs (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          reps INTEGER NOT NULL,
          logged_at TIMESTAMP NOT NULL DEFAULT NOW(),
          log_date DATE NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // Индексы для оптимизации
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_logs_user_id ON logs(user_id)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_logs_log_date ON logs(log_date)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_logs_user_date ON logs(user_id, log_date)
      `);

      console.log('Database tables initialized successfully');
    } catch (error) {
      console.error('Failed to initialize tables:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Регистрация или получение пользователя
  async getOrCreateUser(tgUserId: number, username: string | undefined, firstName: string | undefined): Promise<User> {
    const client = await this.pool.connect();
    try {
      // Проверяем существующего пользователя
      const existingResult = await client.query<User>(
        'SELECT * FROM users WHERE tg_user_id = $1',
        [tgUserId]
      );

      if (existingResult.rows.length > 0) {
        const existing = existingResult.rows[0];
        // Обновляем username и first_name, если они изменились
        if (existing.username !== username || existing.first_name !== firstName) {
          await client.query(
            'UPDATE users SET username = $1, first_name = $2 WHERE tg_user_id = $3',
            [username || null, firstName || null, tgUserId]
          );
          return { ...existing, username: username || null, first_name: firstName || null };
        }
        return existing;
      }

      // Создаем нового пользователя
      const joinedAt = new Date().toISOString();
      const result = await client.query<User>(
        `INSERT INTO users (tg_user_id, username, first_name, joined_at)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [tgUserId, username || null, firstName || null, joinedAt]
      );

      return result.rows[0];
    } finally {
      client.release();
    }
  }

  // Добавление лога подтягиваний
  async addLog(userId: number, reps: number, loggedAt: string, logDate: string): Promise<Log> {
    const client = await this.pool.connect();
    try {
      const result = await client.query<Log>(
        `INSERT INTO logs (user_id, reps, logged_at, log_date)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [userId, reps, loggedAt, logDate]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  // Получение общего количества подтягиваний пользователя
  async getTotalReps(userId: number): Promise<number> {
    const client = await this.pool.connect();
    try {
      const result = await client.query<{ total: string }>(
        'SELECT COALESCE(SUM(reps), 0) as total FROM logs WHERE user_id = $1',
        [userId]
      );
      return parseInt(result.rows[0].total, 10);
    } finally {
      client.release();
    }
  }

  // Получение подтягиваний за сегодня
  async getTodayReps(userId: number, todayDate: string): Promise<number> {
    const client = await this.pool.connect();
    try {
      const result = await client.query<{ total: string }>(
        'SELECT COALESCE(SUM(reps), 0) as total FROM logs WHERE user_id = $1 AND log_date = $2',
        [userId, todayDate]
      );
      return parseInt(result.rows[0].total, 10);
    } finally {
      client.release();
    }
  }

  // Получение последнего лога пользователя
  async getLastLog(userId: number): Promise<Log | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query<Log>(
        'SELECT * FROM logs WHERE user_id = $1 ORDER BY logged_at DESC LIMIT 1',
        [userId]
      );
      return result.rows.length > 0 ? result.rows[0] : null;
    } finally {
      client.release();
    }
  }

  // Удаление лога
  async deleteLog(logId: number): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const result = await client.query('DELETE FROM logs WHERE id = $1', [logId]);
      return (result.rowCount || 0) > 0;
    } finally {
      client.release();
    }
  }

  // Получение статистики пользователя
  async getUserStats(userId: number, todayDate: string, startDate: string): Promise<{
    total: number;
    today: number;
    averagePerDay: number;
    daysSinceStart: number;
  }> {
    const total = await this.getTotalReps(userId);
    const today = await this.getTodayReps(userId, todayDate);
    
    // Подсчет дней с начала челленджа
    const start = new Date(startDate);
    const now = new Date();
    const daysSinceStart = Math.max(1, Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    
    const averagePerDay = total / daysSinceStart;

    return {
      total,
      today,
      averagePerDay,
      daysSinceStart
    };
  }

  // Получение топ-20 лидеров
  async getTopLeaders(limit: number = 20): Promise<Array<{ user: User; total: number }>> {
    const client = await this.pool.connect();
    try {
      const result = await client.query<{
        id: number;
        tg_user_id: number;
        username: string | null;
        first_name: string | null;
        joined_at: string;
        total: string;
      }>(`
        SELECT 
          u.id, u.tg_user_id, u.username, u.first_name, u.joined_at,
          COALESCE(SUM(l.reps), 0) as total
        FROM users u
        LEFT JOIN logs l ON u.id = l.user_id
        GROUP BY u.id
        ORDER BY total DESC
        LIMIT $1
      `, [limit]);

      return result.rows.map((row: {
        id: number;
        tg_user_id: number;
        username: string | null;
        first_name: string | null;
        joined_at: string;
        total: string;
      }) => ({
        user: {
          id: row.id,
          tg_user_id: row.tg_user_id,
          username: row.username,
          first_name: row.first_name,
          joined_at: row.joined_at
        },
        total: parseInt(row.total, 10)
      }));
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

