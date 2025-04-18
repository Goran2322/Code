const mysql = require('mysql2/promise');
const config = require('./config');
const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Error log file
const errorLogPath = path.join(logsDir, 'errors.log');
const queryLogPath = path.join(logsDir, 'queries.log');

// Create a connection pool
const pool = mysql.createPool(config);

// Log error to file
function logError(error, operation) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${operation}: ${error.message}\n${error.stack}\n\n`;
    
    fs.appendFile(errorLogPath, logEntry, (err) => {
        if (err) console.error('Failed to write to error log:', err);
    });
}

// Log slow query to file
function logQueryTime(sql, params, startTime) {
    const duration = Date.now() - startTime;
    if (duration > 500) { // Log slow queries (over 500ms)
        const timestamp = new Date().toISOString();
        const paramStr = params ? JSON.stringify(params) : '';
        const logEntry = `[${timestamp}] SLOW QUERY (${duration}ms): ${sql}\nParams: ${paramStr}\n\n`;
        
        fs.appendFile(queryLogPath, logEntry, (err) => {
            if (err) console.error('Failed to write to query log:', err);
        });
        
        console.warn(`Slow query (${duration}ms): ${sql.substring(0, 100)}${sql.length > 100 ? '...' : ''}`);
    }
}

// Test database connection
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Database connection established successfully');
        connection.release();
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        logError(error, 'Connection Test');
        return false;
    }
}

// Initialize database (run migrations)
async function initDatabase() {
    try {
        const migrations = require('./migrations');
        await migrations.run(pool);
        console.log('✅ Database initialized successfully');
        return true;
    } catch (error) {
        console.error('❌ Database initialization failed:', error.message);
        logError(error, 'Database Initialization');
        return false;
    }
}

// Database query executor with timing and error logging
async function query(sql, params = []) {
    const startTime = Date.now();
    try {
        const [results] = await pool.execute(sql, params);
        logQueryTime(sql, params, startTime);
        return results;
    } catch (error) {
        logQueryTime(sql, params, startTime);
        logError(error, `Query: ${sql}`);
        console.error('Query error:', error.message);
        throw error;
    }
}

// Database transaction helper
async function transaction(callback) {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
        const result = await callback(connection);
        await connection.commit();
        return result;
    } catch (error) {
        await connection.rollback();
        logError(error, 'Transaction');
        throw error;
    } finally {
        connection.release();
    }
}

// Schedule database backups
function scheduleBackups(interval = 12 * 60 * 60 * 1000) { // Default: 12 hours
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }
    
    setInterval(() => {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(backupDir, `backup-${timestamp}.sql`);
        
        const { exec } = require('child_process');
        const { user, password, database, host } = config;
        
        const command = `mysqldump -h ${host} -u ${user} -p${password} ${database} > "${backupFile}"`;
        
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Backup error: ${error.message}`);
                logError(error, 'Database Backup');
                return;
            }
            console.log(`Database backup created: ${backupFile}`);
        });
    }, interval);
}

// Export all functions
module.exports = {
    pool,
    testConnection,
    initDatabase,
    query,
    transaction,
    scheduleBackups
};