// Main server file that shows how to use the database
const db = require('./Database');
const { initializeDatabase } = require('./Database/init');
const playerController = require('./Database/controllers/playerController');
const vehicleController = require('./Database/controllers/vehicleController');

// Initialize database when server starts
initializeDatabase()
    .then(success => {
        if (!success) {
            console.error('Server could not start due to database initialization failure');
            process.exit(1);
        }
    })
    .catch(error => {
        console.error('Critical error during database initialization:', error);
        process.exit(1);
    });

// Player connection event
mp.events.add('playerJoin', player => {
    console.log(`${player.name} joined the server`);
    
    // You can do pre-login checks here (bans, etc.)
});

// Player login - triggered after player joins and any authentication is complete
mp.events.add('playerLogin', player => {
    playerController.handleLogin(player)
        .then(success => {
            if (success) {
                player.notify('~g~Login successful!');
                
                // Spawn player vehicles if needed
                vehicleController.spawnPlayerVehicles(player.dbId)
                    .then(vehicles => {
                        player.notify(`~b~${vehicles.length} vehicles spawned.`);
                    })
                    .catch(error => {
                        console.error(`Error spawning vehicles for ${player.name}:`, error);
                    });
            } else {
                player.notify('~r~Login failed!');
            }
        })
        .catch(error => {
            console.error(`Error during login for ${player.name}:`, error);
            player.notify('~r~Login error occurred!');
        });
});

// Player disconnect
mp.events.add('playerQuit', (player, exitType, reason) => {
    playerController.handleDisconnect(player, reason)
        .catch(error => {
            console.error(`Error during disconnect for ${player.name}:`, error);
        });
});

// Player death
mp.events.add('playerDeath', (player, reason, killer) => {
    playerController.handleDeath(player, killer, reason)
        .catch(error => {
            console.error(`Error handling death for ${player.name}:`, error);
        });
});

// Vehicle entry event - example of using the vehicle database
mp.events.add('playerEnterVehicle', (player, vehicle, seat) => {
    // If it's a database vehicle, you can check ownership
    if (vehicle.dbId && vehicle.ownerId) {
        if (vehicle.ownerId === player.dbId) {
            player.notify