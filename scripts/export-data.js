"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const database_adapter_1 = require("../src/database-adapter");
const utils_1 = require("../src/utils");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const config = (0, utils_1.getConfig)();
async function exportData() {
    console.log('📦 Начинаю экспорт данных...');
    // Создаем адаптер БД
    const db = (0, database_adapter_1.createDatabaseAdapter)(config.databaseUrl, config.databasePath);
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
        const exportData = {
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
    }
    catch (error) {
        console.error('❌ Ошибка при экспорте:', error);
        throw error;
    }
    finally {
        await db.close();
    }
}
async function getAllUsers(db) {
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
        const users = sqliteDb.prepare('SELECT * FROM users ORDER BY id').all();
        sqliteDb.close();
        return users;
    }
}
async function getAllLogs(db) {
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
        const logs = sqliteDb.prepare('SELECT * FROM logs ORDER BY logged_at DESC').all();
        sqliteDb.close();
        return logs;
    }
}
function calculateStats(users, logs) {
    const statsMap = new Map();
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
function exportToCSV(data, filePath) {
    const lines = [];
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
