const Player = require('../models/Player');
const Inventory = require('../models/Inventory');
const Vehicle = require('../models/Vehicle');
const ServerSettings = require('../models/ServerSettings');
const db = require('../index');
const fs = require('fs');
const path = require('path');

// Log directory
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Player log file
const playerLogPath = path.join(logsDir, 'player_activity.log');

// Log player activity
function logPlayerActivity(playerId, playerName, action, details = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] Player ${playerName} (ID: ${playerId}) ${action}: ${JSON.stringify(details)}\n`;
    
    fs.appendFile(playerLogPath, logEntry, (err) => {
        if (err) console.error('Failed to write to player log:', err);
    });
    
    // Also save to database if needed
    try {
        db.query(
            'INSERT INTO server_logs (player_id, action, details) VALUES (?, ?, ?)',
            [playerId, action, JSON.stringify(details)]
        );
    } catch (error) {
        console.error('Failed to save log to database:', error);
    }
}

// Handle player login
async function handleLogin(player) {
    try {
        // Get social club identifier
        const socialClub = player.socialClub;
        
        // Check if player exists in database
        let dbPlayer = await Player.getBySocialClub(socialClub);
        
        // Get server settings for new player creation
        const startingMoney = await ServerSettings.get('starting_money', 1000);
        const startingBank = await ServerSettings.get('starting_bank', 5000);
        
        if (!dbPlayer) {
            // Create new player record
            const playerId = await Player.create(socialClub, player.name);
            
            // Set initial values for new player
            await Player.update(playerId, {
                money: startingMoney,
                bank: startingBank
            });
            
            dbPlayer = {
                id: playerId,
                social_club: socialClub,
                name: player.name,
                money: startingMoney,
                bank: startingBank
            };
            
            console.log(`New player created: ${player.name} (${socialClub})`);
            logPlayerActivity(playerId, player.name, 'account_created');
        }
        
        // Update last login time and potentially player name if it changed
        await Player.update(dbPlayer.id, {
            last_login: new Date().toISOString().slice(0, 19).replace('T', ' '),
            name: player.name
        });
        
        // Attach database ID to player for future reference
        player.dbId = dbPlayer.id;
        
        // Set player data
        if (dbPlayer.position) {
            try {
                const pos = JSON.parse(dbPlayer.position);
                player.position = new mp.Vector3(pos.x, pos.y, pos.z);
            } catch (e) {
                console.error(`Error parsing position for player ${player.name}:`, e);
            }
        }
        
        // Set player money and bank balance
        player.call('setMoney', [dbPlayer.money || 0]);
        player.call('setBank', [dbPlayer.bank || 0]);
        
        // Set admin level
        player.adminLevel = dbPlayer.admin_level || 0;
        
        // Load inventory
        const items = await Inventory.getPlayerItems(dbPlayer.id);
        player.call('loadInventory', [JSON.stringify(items)]);
        
        // Log successful login
        console.log(`Player ${player.name} logged in successfully`);
        logPlayerActivity(dbPlayer.id, player.name, 'logged_in');
        
        return true;
    } catch (error) {
        console.error(`Login error for ${player.name}:`, error);
        return false;
    }
}

// Save player data
async function savePlayerData(player) {
    if (!player.dbId) return false;
    
    try {
        const position = {
            x: player.position.x,
            y: player.position.y,
            z: player.position.z
        };
        
        await Player.update(player.dbId, {
            position: JSON.stringify(position),
            health: player.health,
            armor: player.armour,
            money: player.getMoney ? player.getMoney() : 0,
            bank: player.getBank ? player.getBank() : 0,
            dimension: player.dimension
        });
        
        console.log(`Player ${player.name} data saved successfully`);
        logPlayerActivity(player.dbId, player.name, 'data_saved');
        
        return true;
    } catch (error) {
        console.error(`Save error for ${player.name}:`, error);
        return false;
    }
}

// Automatic saving for all online players
function startAutoSave(interval = 5 * 60 * 1000) { // Default: 5 minutes
    setInterval(() => {
        const players = mp.players.toArray();
        console.log(`Auto-saving data for ${players.length} players...`);
        
        players.forEach(player => {
            if (player && player.dbId) {
                savePlayerData(player)
                    .then(success => {
                        if (!success) {
                            console.error(`Failed to auto-save data for ${player.name}`);
                        }
                    })
                    .catch(error => {
                        console.error(`Error during auto-save for ${player.name}:`, error);
                    });
            }
        });
    }, interval);
    
    console.log(`Auto-save initialized with ${interval/1000} second interval`);
}

// Update player playtime
function updatePlayTime() {
    const interval = 1 * 60 * 1000; // 1 minute
    
    setInterval(() => {
        const players = mp.players.toArray();
        
        players.forEach(player => {
            if (player && player.dbId) {
                try {
                    Player.addPlayTime(player.dbId, 1); // Add 1 minute
                } catch (error) {
                    console.error(`Error updating play time for ${player.name}:`, error);
                }
            }
        });
    }, interval);
    
    console.log(`Play time tracking initialized`);
}

// Handle player disconnect
async function handleDisconnect(player, reason) {
    if (!player || !player.dbId) return false;
    
    try {
        await savePlayerData(player);
        logPlayerActivity(player.dbId, player.name, 'disconnected', { reason });
        console.log(`Player ${player.name} disconnected: ${reason}`);
        return true;
    } catch (error) {
        console.error(`Error during disconnect for ${player.name}:`, error);
        return false;
    }
}

// Handle player death
async function handleDeath(player, killer, reason) {
    if (!player || !player.dbId) return false;
    
    try {
        // Log death event
        const details = {
            reason,
            killer: killer ? killer.name : 'Unknown'
        };
        
        logPlayerActivity(player.dbId, player.name, 'died', details);
        
        // Update player health stat
        await Player.update(player.dbId, { health: 0 });
        
        return true;
    } catch (error) {
        console.error(`Error handling death for ${player.name}:`, error);
        return false;
    }
}

// Get player bank balance
async function getPlayerBankBalance(playerId) {
    const player = await Player.getById(playerId);
    return player ? player.bank : 0;
}

// Get player cash
async function getPlayerCash(playerId) {
    const player = await Player.getById(playerId);
    return player ? player.money : 0;
}

// Give player money (cash)
async function givePlayerMoney(playerId, amount) {
    try {
        const newBalance = await Player.updateMoney(playerId, amount);
        const player = mp.players.toArray().find(p => p.dbId === playerId);
        
        if (player) {
            player.call('setMoney', [newBalance]);
        }
        
        return newBalance;
    } catch (error) {
        console.error(`Error giving money to player ${playerId}:`, error);
        throw error;
    }
}

// Give player bank money
async function givePlayerBank(playerId, amount) {
    try {
        const newBalance = await Player.updateBank(playerId, amount);
        const player = mp.players.toArray().find(p => p.dbId === playerId);
        
        if (player) {
            player.call('setBank', [newBalance]);
        }
        
        return newBalance;
    } catch (error) {
        console.error(`Error giving bank money to player ${playerId}:`, error);
        throw error;
    }
}

// Initialize controller
async function initialize() {
    try {
        startAutoSave();
        updatePlayTime();
        console.log('Player controller initialized');
        return true;
    } catch (error) {
        console.error('Failed to initialize player controller:', error);
        return false;
    }
}

module.exports = {
    handleLogin,
    savePlayerData,
    handleDisconnect,
    handleDeath,
    getPlayerBankBalance,
    getPlayerCash,
    givePlayerMoney,
    givePlayerBank,
    startAutoSave,
    updatePlayTime,
    initialize
};