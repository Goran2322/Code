const db = require('../index');

class Player {
    // Create new player
    static async create(socialClub, name) {
        const sql = 'INSERT INTO players (social_club, name) VALUES (?, ?)';
        const result = await db.query(sql, [socialClub, name]);
        return result.insertId;
    }
    
    // Get player by ID
    static async getById(id) {
        const sql = 'SELECT * FROM players WHERE id = ?';
        const players = await db.query(sql, [id]);
        return players[0]; // Return the first match or undefined
    }
    
    // Get player by social club
    static async getBySocialClub(socialClub) {
        const sql = 'SELECT * FROM players WHERE social_club = ?';
        const players = await db.query(sql, [socialClub]);
        return players[0]; // Return the first match or undefined
    }
    
    // Get player by name (exact match)
    static async getByName(name) {
        const sql = 'SELECT * FROM players WHERE name = ?';
        const players = await db.query(sql, [name]);
        return players[0]; // Return the first match or undefined
    }
    
    // Search players by name (partial match)
    static async searchByName(partialName) {
        const sql = 'SELECT * FROM players WHERE name LIKE ?';
        return await db.query(sql, [`%${partialName}%`]);
    }
    
    // Update player data
    static async update(id, data) {
        const fields = Object.keys(data)
            .filter(key => key !== 'id' && key !== 'social_club') // Prevent updating critical fields
            .map(key => `${key} = ?`).join(', ');
        
        if (!fields) return false; // No valid fields to update
        
        const values = Object.entries(data)
            .filter(([key]) => key !== 'id' && key !== 'social_club')
            .map(([_, value]) => value);
        
        const sql = `UPDATE players SET ${fields} WHERE id = ?`;
        await db.query(sql, [...values, id]);
        return true;
    }
    
    // Save player position
    static async savePosition(id, x, y, z, dimension = 0) {
        const position = JSON.stringify({ x, y, z });
        const sql = 'UPDATE players SET position = ?, dimension = ? WHERE id = ?';
        await db.query(sql, [position, dimension, id]);
        return true;
    }
    
    // Update money
    static async updateMoney(id, amount) {
        return await db.transaction(async (connection) => {
            // Get current money
            const [player] = await connection.execute('SELECT money FROM players WHERE id = ? FOR UPDATE', [id]);
            if (!player || !player[0]) throw new Error('Player not found');
            
            const newAmount = parseFloat(player[0].money) + parseFloat(amount);
            if (newAmount < 0) throw new Error('Insufficient funds');
            
            // Update money
            await connection.execute('UPDATE players SET money = ? WHERE id = ?', [newAmount, id]);
            return newAmount;
        });
    }
    
    // Update bank balance
    static async updateBank(id, amount) {
        return await db.transaction(async (connection) => {
            // Get current bank balance
            const [player] = await connection.execute('SELECT bank FROM players WHERE id = ? FOR UPDATE', [id]);
            if (!player || !player[0]) throw new Error('Player not found');
            
            const newAmount = parseFloat(player[0].bank) + parseFloat(amount);
            if (newAmount < 0) throw new Error('Insufficient funds');
            
            // Update bank
            await connection.execute('UPDATE players SET bank = ? WHERE id = ?', [newAmount, id]);
            return newAmount;
        });
    }
    
    // Transfer money from bank to cash
    static async transferBankToCash(id, amount) {
        return await db.transaction(async (connection) => {
            // Get current bank and cash
            const [player] = await connection.execute(
                'SELECT money, bank FROM players WHERE id = ? FOR UPDATE',
                [id]
            );
            
            if (!player || !player[0]) throw new Error('Player not found');
            
            const { money, bank } = player[0];
            amount = parseFloat(amount);
            
            if (bank < amount) throw new Error('Insufficient funds in bank');
            
            const newBank = parseFloat(bank) - amount;
            const newMoney = parseFloat(money) + amount;
            
            await connection.execute(
                'UPDATE players SET money = ?, bank = ? WHERE id = ?',
                [newMoney, newBank, id]
            );
            
            return { money: newMoney, bank: newBank };
        });
    }
    
    // Transfer money from cash to bank
    static async transferCashToBank(id, amount) {
        return await db.transaction(async (connection) => {
            // Get current bank and cash
            const [player] = await connection.execute(
                'SELECT money, bank FROM players WHERE id = ? FOR UPDATE', 
                [id]
            );
            
            if (!player || !player[0]) throw new Error('Player not found');
            
            const { money, bank } = player[0];
            amount = parseFloat(amount);
            
            if (money < amount) throw new Error('Insufficient cash');
            
            const newMoney = parseFloat(money) - amount;
            const newBank = parseFloat(bank) + amount;
            
            await connection.execute(
                'UPDATE players SET money = ?, bank = ? WHERE id = ?',
                [newMoney, newBank, id]
            );
            
            return { money: newMoney, bank: newBank };
        });
    }
    
    // Update player stats (health, armor, hunger, thirst)
    static async updateStats(id, stats) {
        const { health, armor, hunger, thirst } = stats;
        const sql = 'UPDATE players SET health = ?, armor = ?, hunger = ?, thirst = ? WHERE id = ?';
        await db.query(sql, [health, armor, hunger, thirst, id]);
        return true;
    }
    
    // Add play time (in minutes)
    static async addPlayTime(id, minutes) {
        const sql = 'UPDATE players SET play_time = play_time + ? WHERE id = ?';
        await db.query(sql, [minutes, id]);
        return true;
    }
    
    // Get all players
    static async getAll() {
        return await db.query('SELECT * FROM players');
    }
    
    // Get top players by play time
    static async getTopByPlayTime(limit = 10) {
        return await db.query(
            'SELECT id, name, play_time FROM players ORDER BY play_time DESC LIMIT ?',
            [limit]
        );
    }
    
    // Get top players by wealth (money + bank)
    static async getTopByWealth(limit = 10) {
        return await db.query(
            'SELECT id, name, money, bank, (money + bank) AS total_wealth FROM players ORDER BY total_wealth DESC LIMIT ?',
            [limit]
        );
    }
    
    // Mark player as online (update last login)
    static async markOnline(id) {
        const sql = 'UPDATE players SET last_login = CURRENT_TIMESTAMP WHERE id = ?';
        await db.query(sql, [id]);
        return true;
    }
    
    // Delete player (use with caution)
    static async delete(id) {
        const sql = 'DELETE FROM players WHERE id = ?';
        await db.query(sql, [id]);
        return true;
    }
}

module.exports = Player;