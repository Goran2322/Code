const Vehicle = require('../models/Vehicle');
const Player = require('../models/Player');
const db = require('../index');
const fs = require('fs');
const path = require('path');

// Log directory
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Vehicle log file
const vehicleLogPath = path.join(logsDir, 'vehicle_activity.log');

// Log vehicle activity
function logVehicleActivity(vehicleId, action, details = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] Vehicle ${vehicleId} ${action}: ${JSON.stringify(details)}\n`;
    
    fs.appendFile(vehicleLogPath, logEntry, (err) => {
        if (err) console.error('Failed to write to vehicle log:', err);
    });
    
    // Also save to database if needed
    try {
        db.query(
            'INSERT INTO server_logs (action, details) VALUES (?, ?)',
            [`vehicle_${action}`, JSON.stringify({ vehicleId, ...details })]
        );
    } catch (error) {
        console.error('Failed to save log to database:', error);
    }
}

// Create a vehicle for a player
async function createVehicleForPlayer(playerId, model, position, rotation, color1 = 0, color2 = 0) {
    try {
        // Check if player exists
        const player = await Player.getById(playerId);
        if (!player) {
            throw new Error(`Player with ID ${playerId} not found`);
        }
        
        // Create database entry
        const vehicleId = await Vehicle.create(
            playerId,
            model,
            position,
            rotation,
            color1,
            color2
        );
        
        // Log the creation
        logVehicleActivity(vehicleId, 'created', {
            owner: playerId,
            model,
            position,
            rotation
        });
        
        console.log(`Vehicle created for player ${player.name} (ID: ${playerId}): ${model}, ID: ${vehicleId}`);
        
        return vehicleId;
    } catch (error) {
        console.error(`Error creating vehicle for player ${playerId}:`, error);
        throw error;
    }
}

// Spawn a vehicle from database by ID
async function spawnVehicle(vehicleId) {
    try {
        // Get vehicle data
        const vehicleData = await Vehicle.getById(vehicleId);
        if (!vehicleData) {
            throw new Error(`Vehicle with ID ${vehicleId} not found`);
        }
        
        // Parse position and rotation
        const position = JSON.parse(vehicleData.position);
        const rotation = JSON.parse(vehicleData.rotation);
        
        // Create the vehicle in game
        const vehicle = mp.vehicles.new(
            vehicleData.model,
            new mp.Vector3(position.x, position.y, position.z),
            {
                rotation: new mp.Vector3(rotation.x, rotation.y, rotation.z),
                dimension: vehicleData.dimension || 0,
                color: [vehicleData.color1, vehicleData.color2],
                numberPlate: vehicleData.plate
            }
        );
        
        // Set vehicle properties
        vehicle.dbId = vehicleData.id;
        vehicle.ownerId = vehicleData.owner_id;
        vehicle.engine = vehicleData.engine;
        vehicle.locked = vehicleData.locked;
        
        // Set vehicle health
        vehicle.engineHealth = vehicleData.engine_health;
        vehicle.bodyHealth = vehicleData.body_health;
        
        // Apply vehicle mods if available
        if (vehicleData.mods) {
            const mods = JSON.parse(vehicleData.mods);
            for (const [modType, modIndex] of Object.entries(mods)) {
                vehicle.setMod(parseInt(modType), modIndex);
            }
        }
        
        // Set fuel level variable
        vehicle.fuel = vehicleData.fuel;
        
        // Log the spawn
        logVehicleActivity(vehicleId, 'spawned', {
            position,
            dimension: vehicleData.dimension || 0
        });
        
        console.log(`Vehicle ${vehicleId} (${vehicleData.model}) spawned successfully`);
        
        return vehicle;
    } catch (error) {
        console.error(`Error spawning vehicle ${vehicleId}:`, error);
        throw error;
    }
}

// Spawn all player vehicles
async function spawnPlayerVehicles(playerId) {
    try {
        // Get all player's vehicles
        const vehicles = await Vehicle.getByOwner(playerId);
        
        console.log(`Spawning ${vehicles.length} vehicles for player ${playerId}`);
        
        // Spawn each vehicle
        const spawnedVehicles = [];
        for (const vehicleData of vehicles) {
            try {
                const vehicle = await spawnVehicle(vehicleData.id);
                spawnedVehicles.push(vehicle);
            } catch (error) {
                console.error(`Failed to spawn vehicle ${vehicleData.id}:`, error);
            }
        }
        
        return spawnedVehicles;
    } catch (error) {
        console.error(`Error spawning vehicles for player ${playerId}:`, error);
        throw error;
    }
}

// Save vehicle data
async function saveVehicleData(vehicle) {
    if (!vehicle || !vehicle.dbId) return false;
    
    try {
        const position = {
            x: vehicle.position.x,
            y: vehicle.position.y,
            z: vehicle.position.z
        };
        
        const rotation = {
            x: vehicle.rotation.x,
            y: vehicle.rotation.y,
            z: vehicle.rotation.z
        };
        
        // Collect all mods
        const mods = {};
        for (let i = 0; i < 50; i++) {
            const modValue = vehicle.getMod(i);
            if (modValue !== -1) {
                mods[i] = modValue;
            }
        }
        
        await Vehicle.update(vehicle.dbId, {
            position: JSON.stringify(position),
            rotation: JSON.stringify(rotation),
            engine_health: vehicle.engineHealth,
            body_health: vehicle.bodyHealth,
            fuel: vehicle.fuel || 100,
            locked: vehicle.locked,
            engine: vehicle.engine,
            dimension: vehicle.dimension,
            mods: JSON.stringify(mods)
        });
        
        logVehicleActivity(vehicle.dbId, 'saved', { position });
        
        return true;
    } catch (error) {
        console.error(`Error saving vehicle ${vehicle.dbId}:`, error);
        return false;
    }
}

// Automatic saving for all vehicles
function startAutoSave(interval = 5 * 60 * 1000) { // Default: 5 minutes
    setInterval(() => {
        const vehicles = mp.vehicles.toArray();
        console.log(`Auto-saving data for ${vehicles.length} vehicles...`);
        
        vehicles.forEach(vehicle => {
            if (vehicle && vehicle.dbId) {
                saveVehicleData(vehicle)
                    .catch(error => {
                        console.error(`Error during auto-save for vehicle ${vehicle.dbId}:`, error);
                    });
            }
        });
    }, interval);
    
    console.log(`Vehicle auto-save initialized with ${interval/1000} second interval`);
}

// Despawn and save a vehicle
async function despawnVehicle(vehicle) {
    if (!vehicle || !vehicle.dbId) return false;
    
    try {
        // Save vehicle data before despawning
        await saveVehicleData(vehicle);
        
        // Log the despawn
        logVehicleActivity(vehicle.dbId, 'despawned', {
            position: {
                x: vehicle.position.x,
                y: vehicle.position.y,
                z: vehicle.position.z
            }
        });
        
        // Destroy the vehicle
        vehicle.destroy();
        
        return true;
    } catch (error) {
        console.error(`Error despawning vehicle ${vehicle.dbId}:`, error);
        return false;
    }
}

// Transfer vehicle ownership
async function transferVehicleOwnership(vehicleId, newOwnerId) {
    try {
        // Get the vehicle data
        const vehicleData = await Vehicle.getById(vehicleId);
        if (!vehicleData) {
            throw new Error(`Vehicle with ID ${vehicleId} not found`);
        }
        
        // Check if the new owner exists
        const newOwner = await Player.getById(newOwnerId);
        if (!newOwner) {
            throw new Error(`Player with ID ${newOwnerId} not found`);
        }
        
        // Update ownership in database
        await Vehicle.transferOwnership(vehicleId, newOwnerId);
        
        // Find vehicle in-game and update its properties
        const vehicle = mp.vehicles.toArray().find(v => v.dbId === vehicleId);
        if (vehicle) {
            vehicle.ownerId = newOwnerId;
        }
        
        // Log the ownership transfer
        logVehicleActivity(vehicleId, 'ownership_transferred', {
            previousOwner: vehicleData.owner_id,
            newOwner: newOwnerId
        });
        
        console.log(`Vehicle ${vehicleId} ownership transferred from ${vehicleData.owner_id} to ${newOwnerId}`);
        
        return true;
    } catch (error) {
        console.error(`Error transferring vehicle ${vehicleId} ownership:`, error);
        throw error;
    }
}

// Delete a vehicle
async function deleteVehicle(vehicleId) {
    try {
        // Find vehicle in-game
        const vehicle = mp.vehicles.toArray().find(v => v.dbId === vehicleId);
        if (vehicle) {
            // Destroy the vehicle in-game
            vehicle.destroy();
        }
        
        // Delete from database
        await Vehicle.delete(vehicleId);
        
        // Log the deletion
        logVehicleActivity(vehicleId, 'deleted');
        
        console.log(`Vehicle ${vehicleId} deleted successfully`);
        
        return true;
    } catch (error) {
        console.error(`Error deleting vehicle ${vehicleId}:`, error);
        throw error;
    }
}

// Initialize controller
async function initialize() {
    try {
        startAutoSave();
        console.log('Vehicle controller initialized');
        return true;
    } catch (error) {
        console.error('Failed to initialize vehicle controller:', error);
        return false;
    }
}

module.exports = {
    createVehicleForPlayer,
    spawnVehicle,
    spawnPlayerVehicles,
    saveVehicleData,
    despawnVehicle,
    transferVehicleOwnership,
    deleteVehicle,
    startAutoSave,
    initialize
};