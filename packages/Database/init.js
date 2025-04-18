const db = require('./index');
const playerController = require('./controllers/playerController');
const vehicleController = require('./controllers/vehicleController');

// Initialize all database components
async function initializeDatabase() {
    console.log('Initializing database...');
    
    try {
        // Test database connection
        const connected = await db.testConnection();
        if (!connected) {
            console.error('Database connection failed, cannot continue.');
            return false;
        }
        
        // Create tables
        await db.initDatabase();
        
        // Initialize controllers
        await playerController.initialize();
        await vehicleController.initialize();
        
        // Schedule database backups (every 12 hours)
        db.scheduleBackups(12 * 60 * 60 * 1000);
        
        console.log('Database initialization complete.');
        return true;
    } catch (error) {
        console.error('Database initialization failed:', error);
        return false;
    }
}

module.exports = { initializeDatabase };