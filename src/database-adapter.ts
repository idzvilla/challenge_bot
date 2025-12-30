// Адаптер для унификации работы с SQLite и PostgreSQL
import { ChallengeDatabase as SQLiteDatabase } from './database';
import { ChallengeDatabase as PostgresDatabase } from './database-pg';
import { User, Log } from './database';

export interface DatabaseAdapter {
  getOrCreateUser(tgUserId: number, username: string | undefined, firstName: string | undefined): Promise<User>;
  addLog(userId: number, reps: number, loggedAt: string, logDate: string): Promise<Log>;
  getTotalReps(userId: number): Promise<number>;
  getTodayReps(userId: number, todayDate: string): Promise<number>;
  getLastLog(userId: number): Promise<Log | null>;
  deleteLog(logId: number): Promise<boolean>;
  getUserStats(userId: number, todayDate: string, startDate: string): Promise<{
    total: number;
    today: number;
    averagePerDay: number;
    daysSinceStart: number;
  }>;
  getTopLeaders(limit?: number): Promise<Array<{ user: User; total: number }>>;
  close(): Promise<void>;
}

// Адаптер для SQLite (синхронные методы оборачиваем в Promise)
class SQLiteAdapter implements DatabaseAdapter {
  private db: SQLiteDatabase;

  constructor(db: SQLiteDatabase) {
    this.db = db;
  }

  async getOrCreateUser(tgUserId: number, username: string | undefined, firstName: string | undefined): Promise<User> {
    return Promise.resolve(this.db.getOrCreateUser(tgUserId, username, firstName));
  }

  async addLog(userId: number, reps: number, loggedAt: string, logDate: string): Promise<Log> {
    return Promise.resolve(this.db.addLog(userId, reps, loggedAt, logDate));
  }

  async getTotalReps(userId: number): Promise<number> {
    return Promise.resolve(this.db.getTotalReps(userId));
  }

  async getTodayReps(userId: number, todayDate: string): Promise<number> {
    return Promise.resolve(this.db.getTodayReps(userId, todayDate));
  }

  async getLastLog(userId: number): Promise<Log | null> {
    return Promise.resolve(this.db.getLastLog(userId));
  }

  async deleteLog(logId: number): Promise<boolean> {
    return Promise.resolve(this.db.deleteLog(logId));
  }

  async getUserStats(userId: number, todayDate: string, startDate: string): Promise<{
    total: number;
    today: number;
    averagePerDay: number;
    daysSinceStart: number;
  }> {
    return Promise.resolve(this.db.getUserStats(userId, todayDate, startDate));
  }

  async getTopLeaders(limit: number = 20): Promise<Array<{ user: User; total: number }>> {
    return Promise.resolve(this.db.getTopLeaders(limit));
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

// Адаптер для PostgreSQL (уже async)
class PostgresAdapter implements DatabaseAdapter {
  private db: PostgresDatabase;

  constructor(db: PostgresDatabase) {
    this.db = db;
  }

  async getOrCreateUser(tgUserId: number, username: string | undefined, firstName: string | undefined): Promise<User> {
    return this.db.getOrCreateUser(tgUserId, username, firstName);
  }

  async addLog(userId: number, reps: number, loggedAt: string, logDate: string): Promise<Log> {
    return this.db.addLog(userId, reps, loggedAt, logDate);
  }

  async getTotalReps(userId: number): Promise<number> {
    return this.db.getTotalReps(userId);
  }

  async getTodayReps(userId: number, todayDate: string): Promise<number> {
    return this.db.getTodayReps(userId, todayDate);
  }

  async getLastLog(userId: number): Promise<Log | null> {
    return this.db.getLastLog(userId);
  }

  async deleteLog(logId: number): Promise<boolean> {
    return this.db.deleteLog(logId);
  }

  async getUserStats(userId: number, todayDate: string, startDate: string): Promise<{
    total: number;
    today: number;
    averagePerDay: number;
    daysSinceStart: number;
  }> {
    return this.db.getUserStats(userId, todayDate, startDate);
  }

  async getTopLeaders(limit: number = 20): Promise<Array<{ user: User; total: number }>> {
    return this.db.getTopLeaders(limit);
  }

  async close(): Promise<void> {
    return this.db.close();
  }
}

export function createDatabaseAdapter(databaseUrl?: string, databasePath?: string): DatabaseAdapter {
  if (databaseUrl) {
    console.log('Using PostgreSQL database');
    return new PostgresAdapter(new PostgresDatabase(databaseUrl));
  } else {
    console.log('Using SQLite database');
    return new SQLiteAdapter(new SQLiteDatabase(databasePath || './data/challenge.db'));
  }
}


