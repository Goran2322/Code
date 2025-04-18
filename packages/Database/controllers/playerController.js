const Player = require('../models/Player');
const Inventory = require('../models/Inventory');

// Handle player login
async function handleLogin(player) {
    try {
        // Get social club identifier
        const socialClub = player.socialClub;
        
        // Check if player exists in database
        let dbPlayer = await Player.getBySocialClub(socialClub);
        
        if (!dbPlayer) {
            // Create new player record
            const playerId = await Player.create(socialClub, player.name);
            dbPlayer = { id: playerId, social_club: socialClub, name: player.name };
            console.log(`New player created: ${player.name} (${socialClub})`);
        }
        
        // Update last login time
        await Player.update(dbPlayer.id, { 
            last_login: new Date(),
            name: player.name // Update name in case it changed
        });
        
        // Attach database ID to player for future reference
        player.dbId = dbPlayer.id;
        
        // Load player data
        if (dbPlayer.position) {
            const pos = JSON.parse(dbPlayer.position);
            player.position = new mp.Vector3(pos.x, pos.y, pos.z);
        }
        
        player.call('setMoney', [dbPlayer.money || 0]);
        player.call('setBank', [dbPlayer.bank || 0]);
        
        // Load inventory
        const items = await Inventory.getPlayerItems(dbPlayer.id);
        player.call('loadInventory', [JSON.stringify(items)]);
        
        console.log(`Player ${player.name} logged in successfully`);
        return true;
    } catch (error) {
        console.error(`Login error for ${player.name}:`, error);
        return false;
    }
}

// Save player data before disconnect
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
            bank: player.getBank ? player.getBank() : 0
        });
        
        console.log(`Player ${player.name} data saved successfully`);
        return true;
    } catch (error) {
        console.error(`Save error for ${player.name}:`, error);
        return false;
    }
}

module.exports = {
    handleLogin,
    savePlayerData
};