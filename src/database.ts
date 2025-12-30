import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

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
  private db: Database.Database;

  constructor(dbPath: string) {
    // Создаем директорию для базы данных, если её нет
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initTables();
  }

  private initTables(): void {
    // Таблица пользователей
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tg_user_id INTEGER UNIQUE NOT NULL,
        username TEXT,
        first_name TEXT,
        joined_at TEXT NOT NULL
      )
    `);

    // Таблица логов подтягиваний
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        reps INTEGER NOT NULL,
        logged_at TEXT NOT NULL,
        log_date TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Индексы для оптимизации
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_logs_user_id ON logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_logs_log_date ON logs(log_date);
      CREATE INDEX IF NOT EXISTS idx_logs_user_date ON logs(user_id, log_date);
    `);
  }

  // Регистрация или получение пользователя
  getOrCreateUser(tgUserId: number, username: string | undefined, firstName: string | undefined): User {
    const existing = this.db.prepare('SELECT * FROM users WHERE tg_user_id = ?').get(tgUserId) as User | undefined;
    
    if (existing) {
      // Обновляем username и first_name, если они изменились
      if (existing.username !== username || existing.first_name !== firstName) {
        this.db.prepare('UPDATE users SET username = ?, first_name = ? WHERE tg_user_id = ?')
          .run(username || null, firstName || null, tgUserId);
        return { ...existing, username: username || null, first_name: firstName || null };
      }
      return existing;
    }

    const joinedAt = new Date().toISOString();
    const result = this.db.prepare(`
      INSERT INTO users (tg_user_id, username, first_name, joined_at)
      VALUES (?, ?, ?, ?)
    `).run(tgUserId, username || null, firstName || null, joinedAt);

    return {
      id: Number(result.lastInsertRowid),
      tg_user_id: tgUserId,
      username: username || null,
      first_name: firstName || null,
      joined_at: joinedAt
    };
  }

  // Добавление лога подтягиваний
  addLog(userId: number, reps: number, loggedAt: string, logDate: string): Log {
    const result = this.db.prepare(`
      INSERT INTO logs (user_id, reps, logged_at, log_date)
      VALUES (?, ?, ?, ?)
    `).run(userId, reps, loggedAt, logDate);

    return {
      id: Number(result.lastInsertRowid),
      user_id: userId,
      reps: reps,
      logged_at: loggedAt,
      log_date: logDate
    };
  }

  // Получение общего количества подтягиваний пользователя
  getTotalReps(userId: number): number {
    const result = this.db.prepare('SELECT COALESCE(SUM(reps), 0) as total FROM logs WHERE user_id = ?')
      .get(userId) as { total: number };
    return result.total;
  }

  // Получение подтягиваний за сегодня
  getTodayReps(userId: number, todayDate: string): number {
    const result = this.db.prepare('SELECT COALESCE(SUM(reps), 0) as total FROM logs WHERE user_id = ? AND log_date = ?')
      .get(userId, todayDate) as { total: number };
    return result.total;
  }

  // Получение последнего лога пользователя
  getLastLog(userId: number): Log | null {
    const result = this.db.prepare('SELECT * FROM logs WHERE user_id = ? ORDER BY logged_at DESC LIMIT 1')
      .get(userId) as Log | undefined;
    return result || null;
  }

  // Удаление лога
  deleteLog(logId: number): boolean {
    const result = this.db.prepare('DELETE FROM logs WHERE id = ?').run(logId);
    return result.changes > 0;
  }

  // Получение статистики пользователя
  getUserStats(userId: number, todayDate: string, startDate: string): {
    total: number;
    today: number;
    averagePerDay: number;
    daysSinceStart: number;
  } {
    const total = this.getTotalReps(userId);
    const today = this.getTodayReps(userId, todayDate);
    
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
  getTopLeaders(limit: number = 20): Array<{ user: User; total: number }> {
    const results = this.db.prepare(`
      SELECT 
        u.id, u.tg_user_id, u.username, u.first_name, u.joined_at,
        COALESCE(SUM(l.reps), 0) as total
      FROM users u
      LEFT JOIN logs l ON u.id = l.user_id
      GROUP BY u.id
      ORDER BY total DESC
      LIMIT ?
    `).all(limit) as Array<{
      id: number;
      tg_user_id: number;
      username: string | null;
      first_name: string | null;
      joined_at: string;
      total: number;
    }>;

    return results.map(row => ({
      user: {
        id: row.id,
        tg_user_id: row.tg_user_id,
        username: row.username,
        first_name: row.first_name,
        joined_at: row.joined_at
      },
      total: row.total
    }));
  }

  close(): void {
    this.db.close();
  }
}

