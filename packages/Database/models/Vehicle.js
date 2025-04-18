const db = require('../index');

class Vehicle {
    // Create new vehicle
    static async create(ownerId, model, position, rotation, color1, color2, plate = null) {
        const sql = `
            INSERT INTO vehicles 
            (owner_id, model, position, rotation, color1, color2, plate) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        
        const positionJson = JSON.stringify(position);
        const rotationJson = JSON.stringify(rotation);
        
        // Generate random plate if not provided
        if (!plate) {
            plate = Vehicle.generateRandomPlate();
        }
        
        const result = await db.query(
            sql, 
            [ownerId, model, positionJson, rotationJson, color1, color2, plate]
        );
        
        return result.insertId;
    }
    
    // Generate random license plate
    static generateRandomPlate() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const nums = '0123456789';
        let plate = '';
        
        // Format: 3 letters + 3 numbers
        for (let i = 0; i < 3; i++) {
            plate += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        for (let i = 0; i < 3; i++) {
            plate += nums.charAt(Math.floor(Math.random() * nums.length));
        }
        
        return plate;
    }
    
    // Get vehicle by id
    static async getById(id) {
        const sql = 'SELECT * FROM vehicles WHERE id = ?';
        const vehicles = await db.query(sql, [id]);
        return vehicles[0];
    }
    
    // Get all player vehicles
    static async getByOwner(ownerId) {
        const sql = 'SELECT * FROM vehicles WHERE owner_id = ?';
        return await db.query(sql, [ownerId]);
    }
    
    // Get vehicle by plate
    static async getByPlate(plate) {
        const sql = 'SELECT * FROM vehicles WHERE plate = ?';
        const vehicles = await db.query(sql, [plate]);
        return vehicles[0];
    }
    
    // Update vehicle
    static async update(id, data) {
        // Prevent updating critical fields
        const safeData = { ...data };
        delete safeData.id;
        delete safeData.owner_id;
        delete safeData.created_at;
        
        const fields = Object.keys(safeData).map(key => `${key} = ?`).join(', ');
        if (!fields) return false; // No valid fields to update
        
        const values = Object.values(safeData);
        
        const sql = `UPDATE vehicles SET ${fields} WHERE id = ?`;
        await db.query(sql, [...values, id]);
        return true;
    }
    
    // Save vehicle position and rotation
    static async savePosition(id, position, rotation, dimension = 0) {
        const positionJson = JSON.stringify(position);
        const rotationJson = JSON.stringify(rotation);
        
        const sql = 'UPDATE vehicles SET position = ?, rotation = ?, dimension = ? WHERE id = ?';
        await db.query(sql, [positionJson, rotationJson, dimension, id]);
        return true;
    }
    
    // Update vehicle state (locked, engine)
    static async updateState(id, locked, engine) {
        const sql = 'UPDATE vehicles SET locked = ?, engine = ? WHERE id = ?';
        await db.query(sql, [locked, engine, id]);
        return true;
    }
    
    // Update vehicle health
    static async updateHealth(id, engineHealth, bodyHealth) {
        const sql = 'UPDATE vehicles SET engine_health = ?, body_health = ? WHERE id = ?';
        await db.query(sql, [engineHealth, bodyHealth, id]);
        return true;
    }
    
    // Update vehicle fuel
    static async updateFuel(id, fuel) {
        const sql = 'UPDATE vehicles SET fuel = ? WHERE id = ?';
        await db.query(sql, [fuel, id]);
        return true;
    }
    
    // Update vehicle modifications
    static async updateMods(id, mods) {
        const modsJson = JSON.stringify(mods);
        const sql = 'UPDATE vehicles SET mods = ? WHERE id = ?';
        await db.query(sql, [modsJson, id]);
        return true;
    }
    
    // Transfer vehicle ownership
    static async transferOwnership(vehicleId, newOwnerId) {
        const sql = 'UPDATE vehicles SET owner_id = ? WHERE id = ?';
        await db.query(sql, [newOwnerId, vehicleId]);
        return true;
    }
    
    // Get all vehicles
    static async getAll() {
        return await db.query('SELECT * FROM vehicles');
    }
    
    // Delete vehicle
    static async delete(id) {
        const sql = 'DELETE FROM vehicles WHERE id = ?';
        await db.query(sql, [id]);
        return true;
    }
}

module.exports = Vehicle;