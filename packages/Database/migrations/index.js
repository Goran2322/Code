// Migration handler - sets up all database tables
async function run(pool) {
    try {
        await createPlayersTable(pool);
        await createVehiclesTable(pool);
        await createInventoryTable(pool);
        await createPropertiesTable(pool);
        await createFactionTable(pool);
        await createBansTable(pool);
        await createLogsTable(pool);
        await createServerSettingsTable(pool);
        console.log('All migrations completed successfully');
    } catch (error) {
        console.error('Migration error:', error);
        throw error;
    }
}

// Create players table
async function createPlayersTable(pool) {
    const sql = `
        CREATE TABLE IF NOT EXISTS players (
            id INT AUTO_INCREMENT PRIMARY KEY,
            social_club VARCHAR(255) NOT NULL UNIQUE,
            name VARCHAR(255) NOT NULL,
            money DECIMAL(15,2) DEFAULT 0,
            bank DECIMAL(15,2) DEFAULT 0,
            health INT DEFAULT 100,
            armor INT DEFAULT 0,
            position JSON,
            hunger FLOAT DEFAULT 100,
            thirst FLOAT DEFAULT 100,
            admin_level INT DEFAULT 0,
            faction_id INT DEFAULT 0,
            faction_rank INT DEFAULT 0,
            job_id INT DEFAULT 0,
            job_rank INT DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME DEFAULT CURRENT_TIMESTAMP,
            play_time INT DEFAULT 0
        )
    `;
    
    await pool.execute(sql);
    console.log('Players table created or already exists');
}

// Create vehicles table
async function createVehiclesTable(pool) {
    const sql = `
        CREATE TABLE IF NOT EXISTS vehicles (
            id INT AUTO_INCREMENT PRIMARY KEY,
            owner_id INT,
            model VARCHAR(50) NOT NULL,
            position JSON,
            rotation JSON,
            color1 VARCHAR(20),
            color2 VARCHAR(20),
            fuel FLOAT DEFAULT 100,
            engine_health FLOAT DEFAULT 1000,
            body_health FLOAT DEFAULT 1000,
            locked BOOLEAN DEFAULT TRUE,
            engine BOOLEAN DEFAULT FALSE,
            mods JSON,
            plate VARCHAR(8),
            dimension INT DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (owner_id) REFERENCES players(id) ON DELETE CASCADE
        )
    `;
    
    await pool.execute(sql);
    console.log('Vehicles table created or already exists');
}

// Create inventory table
async function createInventoryTable(pool) {
    const sql = `
        CREATE TABLE IF NOT EXISTS inventory (
            id INT AUTO_INCREMENT PRIMARY KEY,
            player_id INT,
            item_name VARCHAR(100) NOT NULL,
            quantity INT DEFAULT 1,
            metadata JSON,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
        )
    `;
    
    await pool.execute(sql);
    console.log('Inventory table created or already exists');
}

// Create properties table
async function createPropertiesTable(pool) {
    const sql = `
        CREATE TABLE IF NOT EXISTS properties (
            id INT AUTO_INCREMENT PRIMARY KEY,
            owner_id INT,
            type VARCHAR(50) NOT NULL,
            position JSON,
            interior JSON,
            price DECIMAL(15,2),
            locked BOOLEAN DEFAULT TRUE,
            dimension INT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (owner_id) REFERENCES players(id) ON DELETE SET NULL
        )
    `;
    
    await pool.execute(sql);
    console.log('Properties table created or already exists');
}

// Create faction table
async function createFactionTable(pool) {
    const sql = `
        CREATE TABLE IF NOT EXISTS factions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            type VARCHAR(50) NOT NULL,
            funds DECIMAL(15,2) DEFAULT 0,
            headquarters JSON,
            color VARCHAR(7),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `;
    
    await pool.execute(sql);
    console.log('Factions table created or already exists');
}

// Create bans table
async function createBansTable(pool) {
    const sql = `
        CREATE TABLE IF NOT EXISTS bans (
            id INT AUTO_INCREMENT PRIMARY KEY,
            player_id INT,
            admin_id INT,
            reason TEXT,
            expires DATETIME,
            ip VARCHAR(45),
            hwid VARCHAR(255),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL,
            FOREIGN KEY (admin_id) REFERENCES players(id) ON DELETE SET NULL
        )
    `;
    
    await pool.execute(sql);
    console.log('Bans table created or already exists');
}

// Create logs table
async function createLogsTable(pool) {
    const sql = `
        CREATE TABLE IF NOT EXISTS server_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            player_id INT,
            action VARCHAR(100) NOT NULL,
            details TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL
        )
    `;
    
    await pool.execute(sql);
    console.log('Logs table created or already exists');
}

// Create server settings table
async function createServerSettingsTable(pool) {
    const sql = `
        CREATE TABLE IF NOT EXISTS server_settings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            setting_name VARCHAR(100) NOT NULL UNIQUE,
            setting_value TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `;
    
    await pool.execute(sql);
    console.log('Server settings table created or already exists');
    
    // Insert default server settings if not exists
    const defaultSettings = [
        ['starting_money', '1000'],
        ['starting_bank', '5000'],
        ['paycheck_amount', '500'],
        ['paycheck_interval', '60'], // minutes
        ['tax_rate', '0.05'],
        ['weather_sync', 'true'],
        ['time_sync', 'true']
    ];
    
    for (const [name, value] of defaultSettings) {
        await pool.execute(
            'INSERT IGNORE INTO server_settings (setting_name, setting_value) VALUES (?, ?)',
            [name, value]
        );
    }
}

module.exports = { run };