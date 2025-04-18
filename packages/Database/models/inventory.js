const db = require('../index');

class Inventory {
    // Add item to player's inventory
    static async addItem(playerId, itemName, quantity = 1, metadata = {}) {
        const metadataJson = JSON.stringify(metadata);
        
        // Check if item exists with same metadata
        const existingItems = await db.query(
            'SELECT id, quantity FROM inventory WHERE player_id = ? AND item_name = ? AND metadata = ?',
            [playerId, itemName, metadataJson]
        );
        
        if (existingItems.length > 0) {
            // Update quantity of existing item
            const newQuantity = existingItems[0].quantity + quantity;
            await db.query(
                'UPDATE inventory SET quantity = ? WHERE id = ?',
                [newQuantity, existingItems[0].id]
            );
            return existingItems[0].id;
        } else {
            // Create new item
            const sql = 'INSERT INTO inventory (player_id, item_name, quantity, metadata) VALUES (?, ?, ?, ?)';
            const result = await db.query(sql, [playerId, itemName, quantity, metadataJson]);
            return result.insertId;
        }
    }
    
    // Remove item from player's inventory
    static async removeItem(playerId, itemName, quantity = 1, metadata = {}) {
        const metadataJson = JSON.stringify(metadata);
        
        return await db.transaction(async (connection) => {
            // Find the item
            const [items] = await connection.execute(
                'SELECT id, quantity FROM inventory WHERE player_id = ? AND item_name = ? AND metadata = ? FOR UPDATE',
                [playerId, itemName, metadataJson]
            );
            
            if (items.length === 0) {
                throw new Error('Item not found');
            }
            
            const item = items[0];
            
            if (item.quantity < quantity) {
                throw new Error('Not enough items');
            }
            
            if (item.quantity === quantity) {
                // Remove the item entirely
                await connection.execute('DELETE FROM inventory WHERE id = ?', [item.id]);
            } else {
                // Reduce the quantity
                await connection.execute(
                    'UPDATE inventory SET quantity = ? WHERE id = ?',
                    [item.quantity - quantity, item.id]
                );
            }
            
            return true;
        });
    }
    
    // Get all player's inventory items
    static async getPlayerItems(playerId) {
        return await db.query('SELECT * FROM inventory WHERE player_id = ?', [playerId]);
    }
    
    // Get specific item from player's inventory
    static async getPlayerItem(playerId, itemName, metadata = {}) {
        const metadataJson = JSON.stringify(metadata);
        const items = await db.query(
            'SELECT * FROM inventory WHERE player_id = ? AND item_name = ? AND metadata = ?',
            [playerId, itemName, metadataJson]
        );
        return items[0];
    }
    
    // Check if player has specific item and quantity
    static async hasItem(playerId, itemName, quantity = 1, metadata = {}) {
        const metadataJson = JSON.stringify(metadata);
        const items = await db.query(
            'SELECT quantity FROM inventory WHERE player_id = ? AND item_name = ? AND metadata = ?',
            [playerId, itemName, metadataJson]
        );
        
        if (items.length === 0) return false;
        return items[0].quantity >= quantity;
    }
    
    // Count how many of a specific item a player has
    static async countItem(playerId, itemName) {
        const result = await db.query(
            'SELECT SUM(quantity) as total FROM inventory WHERE player_id = ? AND item_name = ?',
            [playerId, itemName]
        );
        
        return result[0]?.total || 0;
    }
    
    // Update item metadata
    static async updateItemMetadata(inventoryId, metadata) {
        const metadataJson = JSON.stringify(metadata);
        await db.query(
            'UPDATE inventory SET metadata = ? WHERE id = ?',
            [metadataJson, inventoryId]
        );
        return true;
    }
    
    // Transfer item between players
    static async transferItem(fromPlayerId, toPlayerId, itemName, quantity = 1, metadata = {}) {
        return await db.transaction(async (connection) => {
            // Remove from first player
            const metadataJson = JSON.stringify(metadata);
            
            const [items] = await connection.execute(
                'SELECT id, quantity FROM inventory WHERE player_id = ? AND item_name = ? AND metadata = ? FOR UPDATE',
                [fromPlayerId, itemName, metadataJson]
            );
            
            if (items.length === 0) {
                throw new Error('Item not found');
            }
            
            const item = items[0];
            
            if (item.quantity < quantity) {
                throw new Error('Not enough items');
            }
            
            if (item.quantity === quantity) {
                // Remove the item entirely
                await connection.execute('DELETE FROM inventory WHERE id = ?', [item.id]);
            } else {
                // Reduce the quantity
                await connection.execute(
                    'UPDATE inventory SET quantity = ? WHERE id = ?',
                    [item.quantity - quantity, item.id]
                );
            }
            
            // Add to second player
            const [existingItems] = await connection.execute(
                'SELECT id, quantity FROM inventory WHERE player_id = ? AND item_name = ? AND metadata = ? FOR UPDATE',
                [toPlayerId, itemName, metadataJson]
            );
            
            if (existingItems.length > 0) {
                // Update quantity of existing item
                const newQuantity = existingItems[0].quantity + quantity;
                await connection.execute(
                    'UPDATE inventory SET quantity = ? WHERE id = ?',
                    [newQuantity, existingItems[0].id]
                );
            } else {
                // Create new item
                await connection.execute(
                    'INSERT INTO inventory (player_id, item_name, quantity, metadata) VALUES (?, ?, ?, ?)',
                    [toPlayerId, itemName, quantity, metadataJson]
                );
            }
            
            return true;
        });
    }
    
    // Clear player's inventory
    static async clearInventory(playerId) {
        await db.query('DELETE FROM inventory WHERE player_id = ?', [playerId]);
        return true;
    }
}

module.exports = Inventory;