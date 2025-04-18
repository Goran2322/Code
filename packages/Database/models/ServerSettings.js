const db = require('../index');

class ServerSettings {
    // Get a setting by name
    static async get(settingName, defaultValue = null) {
        const sql = 'SELECT setting_value FROM server_settings WHERE setting_name = ?';
        const settings = await db.query(sql, [settingName]);
        
        if (settings.length === 0) {
            return defaultValue;
        }
        
        const value = settings[0].setting_value;
        
        // Try to parse as JSON if it looks like it
        if (value.startsWith('{') || value.startsWith('[')) {
            try {
                return JSON.parse(value);
            } catch (e) {
                return value;
            }
        }
        
        // Try to parse as number
        if (!isNaN(value)) {
            if (value.includes('.')) {
                return parseFloat(value);
            }
            return parseInt(value, 10);
        }
        
        // Parse boolean strings
        if (value.toLowerCase() === 'true') return true;
        if (value.toLowerCase() === 'false') return false;
        
        // Return as string
        return value;
    }
    
    // Set a setting
    static async set(settingName, settingValue) {
        // Convert objects and arrays to JSON strings
        if (typeof settingValue === 'object') {
            settingValue = JSON.stringify(settingValue);
        }
        
        // Convert to string
        settingValue = String(settingValue);
        
        const sql = `
            INSERT INTO server_settings (setting_name, setting_value)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE setting_value = ?, updated_at = CURRENT_TIMESTAMP
        `;
        
        await db.query(sql, [settingName, settingValue, settingValue]);
        return true;
    }
    
    // Get all settings
    static async getAll() {
        const settings = await db.query('SELECT setting_name, setting_value FROM server_settings');
        
        // Convert to key-value object
        const result = {};
        for (const setting of settings) {
            const value = setting.setting_value;
            
            // Try to parse as JSON if it looks like it
            if (value.startsWith('{') || value.startsWith('[')) {
                try {
                    result[setting.setting_name] = JSON.parse(value);
                    continue;
                } catch (e) {
                    // Fall through to other conversions
                }
            }
            
            // Try to parse as number
            if (!isNaN(value)) {
                if (value.includes('.')) {
                    result[setting.setting_name] = parseFloat(value);
                } else {
                    result[setting.setting_name] = parseInt(value, 10);
                }
                continue;
            }
            
            // Parse boolean strings
            if (value.toLowerCase() === 'true') {
                result[setting.setting_name] = true;
                continue;
            }
            if (value.toLowerCase() === 'false') {
                result[setting.setting_name] = false;
                continue;
            }
            
            // Default to string
            result[setting.setting_name] = value;
        }
        
        return result;
    }
    
    // Delete a setting
    static async delete(settingName) {
        const sql = 'DELETE FROM server_settings WHERE setting_name = ?';
        await db.query(sql, [settingName]);
        return true;
    }
}

module.exports = ServerSettings;