import { createDatabaseAdapter } from '../src/database-adapter';
import { getConfig } from '../src/utils';
import * as fs from 'fs';
import * as path from 'path';

const config = getConfig();

interface ExportData {
  users: Array<{
    id: number;
    tg_user_id: number;
    username: string | null;
    first_name: string | null;
    joined_at: string;
  }>;
  logs: Array<{
    id: number;
    user_id: number;
    reps: number;
    logged_at: string;
    log_date: string;
  }>;
  stats: Array<{
    user_id: number;
    tg_user_id: number;
    username: string | null;
    first_name: string | null;
    total_reps: number;
    log_count: number;
    first_log: string | null;
    last_log: string | null;
  }>;
  export_date: string;
}

async function exportData() {
  console.log('📦 Начинаю экспорт данных...');
  
  // Создаем адаптер БД
  const db = createDatabaseAdapter(config.databaseUrl, config.databasePath);
  
  try {
    // Получаем всех пользователей
    console.log('📊 Получаю пользователей...');
    const users = await getAllUsers(db);
    console.log(`✅ Найдено пользователей: ${users.length}`);
    
    // Получаем все логи
    console.log('📊 Получаю логи...');
    const logs = await getAllLogs(db);
    console.log(`✅ Найдено логов: ${logs.length}`);
    
    // Вычисляем статистику
    console.log('📊 Вычисляю статистику...');
    const stats = calculateStats(users, logs);
    
    const exportData: ExportData = {
      users,
      logs,
      stats,
      export_date: new Date().toISOString()
    };
    
    // Создаем директорию для экспорта
    const exportDir = path.join(process.cwd(), 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    
    // Экспорт в JSON
    const jsonPath = path.join(exportDir, `export-${timestamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(exportData, null, 2), 'utf-8');
    console.log(`✅ JSON экспорт: ${jsonPath}`);
    
    // Экспорт в CSV
    const csvPath = path.join(exportDir, `export-${timestamp}.csv`);
    exportToCSV(exportData, csvPath);
    console.log(`✅ CSV экспорт: ${csvPath}`);
    
    // Экспорт статистики в отдельный файл
    const statsPath = path.join(exportDir, `stats-${timestamp}.json`);
    fs.writeFileSync(statsPath, JSON.stringify(exportData.stats, null, 2), 'utf-8');
    console.log(`✅ Статистика: ${statsPath}`);
    
    // Сводка
    console.log('\n📋 Сводка экспорта:');
    console.log(`   Пользователей: ${users.length}`);
    console.log(`   Логов: ${logs.length}`);
    console.log(`   Всего подтягиваний: ${stats.reduce((sum, s) => sum + s.total_reps, 0)}`);
    console.log(`\n✅ Экспорт завершен! Файлы сохранены в: ${exportDir}`);
    
  } catch (error) {
    console.error('❌ Ошибка при экспорте:', error);
    throw error;
  } finally {
    await db.close();
  }
}

async function getAllUsers(db: any): Promise<ExportData['users']> {
  // Для PostgreSQL
  if (config.databaseUrl) {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseUrl.includes('supabase') || config.databaseUrl.includes('render.com') 
        ? { rejectUnauthorized: false } 
        : false,
    });
    
    const result = await pool.query('SELECT * FROM users ORDER BY id');
    await pool.end();
    return result.rows;
  } 
  // Для SQLite
  else {
    const Database = require('better-sqlite3');
    const dbPath = config.databasePath || './data/challenge.db';
    const sqliteDb = new Database(dbPath);
    
    const users = sqliteDb.prepare('SELECT * FROM users ORDER BY id').all() as ExportData['users'];
    sqliteDb.close();
    return users;
  }
}

async function getAllLogs(db: any): Promise<ExportData['logs']> {
  // Для PostgreSQL
  if (config.databaseUrl) {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseUrl.includes('supabase') || config.databaseUrl.includes('render.com') 
        ? { rejectUnauthorized: false } 
        : false,
    });
    
    const result = await pool.query('SELECT * FROM logs ORDER BY logged_at DESC');
    await pool.end();
    return result.rows;
  } 
  // Для SQLite
  else {
    const Database = require('better-sqlite3');
    const dbPath = config.databasePath || './data/challenge.db';
    const sqliteDb = new Database(dbPath);
    
    const logs = sqliteDb.prepare('SELECT * FROM logs ORDER BY logged_at DESC').all() as ExportData['logs'];
    sqliteDb.close();
    return logs;
  }
}

function calculateStats(users: ExportData['users'], logs: ExportData['logs']): ExportData['stats'] {
  const statsMap = new Map<number, {
    user_id: number;
    tg_user_id: number;
    username: string | null;
    first_name: string | null;
    total_reps: number;
    log_count: number;
    first_log: string | null;
    last_log: string | null;
  }>();
  
  // Инициализируем статистику для всех пользователей
  users.forEach(user => {
    statsMap.set(user.id, {
      user_id: user.id,
      tg_user_id: user.tg_user_id,
      username: user.username,
      first_name: user.first_name,
      total_reps: 0,
      log_count: 0,
      first_log: null,
      last_log: null
    });
  });
  
  // Считаем статистику по логам
  logs.forEach(log => {
    const stat = statsMap.get(log.user_id);
    if (stat) {
      stat.total_reps += log.reps;
      stat.log_count += 1;
      
      if (!stat.first_log || log.logged_at < stat.first_log) {
        stat.first_log = log.logged_at;
      }
      if (!stat.last_log || log.logged_at > stat.last_log) {
        stat.last_log = log.logged_at;
      }
    }
  });
  
  return Array.from(statsMap.values()).sort((a, b) => b.total_reps - a.total_reps);
}

function exportToCSV(data: ExportData, filePath: string) {
  const lines: string[] = [];
  
  // Заголовок
  lines.push('=== ЭКСПОРТ ДАННЫХ ===');
  lines.push(`Дата экспорта: ${data.export_date}`);
  lines.push(`Пользователей: ${data.users.length}`);
  lines.push(`Логов: ${data.logs.length}`);
  lines.push('');
  
  // Пользователи
  lines.push('=== ПОЛЬЗОВАТЕЛИ ===');
  lines.push('ID,TG User ID,Username,First Name,Joined At');
  data.users.forEach(user => {
    lines.push([
      user.id,
      user.tg_user_id,
      user.username || '',
      user.first_name || '',
      user.joined_at
    ].join(','));
  });
  lines.push('');
  
  // Логи
  lines.push('=== ЛОГИ ===');
  lines.push('ID,User ID,Reps,Logged At,Log Date');
  data.logs.forEach(log => {
    lines.push([
      log.id,
      log.user_id,
      log.reps,
      log.logged_at,
      log.log_date
    ].join(','));
  });
  lines.push('');
  
  // Статистика
  lines.push('=== СТАТИСТИКА ===');
  lines.push('User ID,TG User ID,Username,First Name,Total Reps,Log Count,First Log,Last Log');
  data.stats.forEach(stat => {
    lines.push([
      stat.user_id,
      stat.tg_user_id,
      stat.username || '',
      stat.first_name || '',
      stat.total_reps,
      stat.log_count,
      stat.first_log || '',
      stat.last_log || ''
    ].join(','));
  });
  
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
}

// Запуск
if (require.main === module) {
  exportData()
    .then(() => {
      console.log('\n✅ Готово!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Ошибка:', error);
      process.exit(1);
    });
}

