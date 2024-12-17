const express = require('express');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const chokidar = require('chokidar');

// Make sure storage directory exists
const storageDir = path.join(__dirname, 'storage');
if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir);
}

// Setup lockfile
const lockfile = path.join(storageDir, 'server.lock');
// Clean up any stale lock file
if (fs.existsSync(lockfile)) {
    fs.unlinkSync(lockfile);
}

// Helper function to load templates
const loadTemplate = (filepath) => fs.readFileSync(path.join(__dirname, filepath), 'utf8');

// Function to calculate file hash
function getFileHash(filepath) {
    try {
        const fullPath = path.join(__dirname, filepath);
        const content = fs.readFileSync(fullPath, 'utf8');
        const hash = crypto.createHash('md5').update(content).digest('hex');
        console.log(`Hash for ${filepath}:`, {
            path: fullPath,
            contentLength: content.length,
            hash: hash
        });
        return hash;
    } catch (error) {
        console.error(`Error calculating hash for ${filepath}:`, error);
        return null;
    }
}

// Function to get template hashes
function getTemplateHashes() {
    console.log('Checking template hashes...');
    const hashes = {
        html: getFileHash('templates/system/index.html'),
        css: getFileHash('templates/system/styles.css'),
        clientJs: getFileHash('templates/system/client.js'),
        serverJs: getFileHash('templates/system/server.js')
    };
    console.log('Current template hashes:', hashes);
    return hashes;
}

// Get initial template hashes
const templateHashes = getTemplateHashes();

// Basic Thing class
class Thing {
    constructor(config = {}) {
        this.id = config.id || uuidv4();
        this.name = config.name || 'Unnamed Thing';
        this.type = config.type || 'generic';
        this.version = config.version || 0;
        this.history = config.history || [];
        this.components = {
            html: config.components?.html || '',
            css: config.components?.css || '',
            clientJs: config.components?.clientJs || '',
            serverJs: config.components?.serverJs || ''
        };
    }

    save() {
        // Save version history only if content changed
        const lastVersion = this.history[this.history.length - 1];
        const currentContent = JSON.stringify(this.components);
        
        if (!lastVersion || JSON.stringify(lastVersion.components) !== currentContent) {
            this.history.push({
                timestamp: Date.now(),
                version: this.version + 1,
                components: JSON.parse(JSON.stringify(this.components))
            });
            this.version++;
        }
        
        // Save to file
        fs.writeFileSync(
            path.join(storageDir, `${this.id}.json`),
            JSON.stringify(this, null, 2)
        );
    }
}

// Load or create system Thing
const SYSTEM_THING_ID = 'system-thing';
let systemThing;

const systemPath = path.join(storageDir, `${SYSTEM_THING_ID}.json`);

// Add after requires
const SYSTEM_VERSION = 1; // Increment this when making breaking changes

// Function to check if system needs update
function needsSystemUpdate(currentSystem) {
    // Skip update check if we're restarting from nodemon
    if (process.env.NODEMON_RESTART) return false;

    // Check system version
    if (!currentSystem.systemVersion || currentSystem.systemVersion < SYSTEM_VERSION) {
        console.log('System version update needed');
        return true;
    }

    // Check template hashes
    const currentHashes = getTemplateHashes();
    if (!currentSystem.templateHashes) {
        console.log('No template hashes found, update needed');
        return true;
    }

    // Compare each hash individually and log differences
    const changes = Object.entries(currentHashes).filter(([key, hash]) => {
        const changed = currentSystem.templateHashes[key] !== hash;
        if (changed) {
            console.log(`Template ${key} changed:`, {
                old: currentSystem.templateHashes[key],
                new: hash
            });
        }
        return changed;
    });

    if (changes.length > 0) {
        console.log('Template changes detected:', changes.map(([key]) => key).join(', '));
        return true;
    }

    console.log('No system updates needed');
    return false;
}

// Update the system Thing loading logic
if (fs.existsSync(systemPath)) {
    // Load existing system
    const data = JSON.parse(fs.readFileSync(systemPath));
    systemThing = new Thing(data);
    
    // Check if system needs update
    if (needsSystemUpdate(systemThing)) {
        console.log('System update needed, updating system Thing...');
        const newSystem = new Thing({
            id: SYSTEM_THING_ID,
            name: 'Thing System',
            type: 'system',
            systemVersion: SYSTEM_VERSION,
            templateHashes: getTemplateHashes(),
            components: {
                html: loadTemplate('templates/system/index.html'),
                css: loadTemplate('templates/system/styles.css'),
                clientJs: loadTemplate('templates/system/client.js'),
                serverJs: loadTemplate('templates/system/server.js')
            }
        });
        
        // Add this update to history
        newSystem.history = [...systemThing.history, {
            timestamp: Date.now(),
            version: systemThing.version + 1,
            components: JSON.parse(JSON.stringify(newSystem.components))
        }];
        newSystem.version = systemThing.version + 1;
        
        // Save and use new system
        systemThing = newSystem;
        systemThing.save();
        console.log('System updated successfully to version', systemThing.version);
    }
} else {
    // Create new system
    systemThing = new Thing({
        id: SYSTEM_THING_ID,
        name: 'Thing System',
        type: 'system',
        systemVersion: SYSTEM_VERSION,
        templateHashes: getTemplateHashes(),
        components: {
            html: loadTemplate('templates/system/index.html'),
            css: loadTemplate('templates/system/styles.css'),
            clientJs: loadTemplate('templates/system/client.js'),
            serverJs: loadTemplate('templates/system/server.js')
        }
    });
    systemThing.save();
}

// Create default Thing template
const DEFAULT_THING_TEMPLATE = {
    components: {
        html: loadTemplate('templates/default-thing.html'),
        css: loadTemplate('templates/default-thing.css'),
        clientJs: loadTemplate('templates/default-thing.js'),
        serverJs: loadTemplate('templates/default-thing.server.js')
    }
};

// Start the system using its own server code
const context = {
    express, Thing, systemThing, fs, path, storageDir, require, DEFAULT_THING_TEMPLATE,
    __dirname: path.join(__dirname, 'templates/system')
};
const serverCode = systemThing.components.serverJs;
const startServer = new Function(...Object.keys(context), serverCode);
startServer(...Object.values(context));

// Watch system templates for changes
const watcher = chokidar.watch(path.join(__dirname, 'templates/system'), {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true
});

watcher.on('change', (filepath) => {
    console.log(`File ${filepath} has been changed`);
    
    // Update system Thing with new content
    const newSystem = new Thing({
        id: SYSTEM_THING_ID,
        name: 'Thing System',
        type: 'system',
        systemVersion: SYSTEM_VERSION,
        templateHashes: getTemplateHashes(),
        components: {
            html: loadTemplate('templates/system/index.html'),
            css: loadTemplate('templates/system/styles.css'),
            clientJs: loadTemplate('templates/system/client.js'),
            serverJs: loadTemplate('templates/system/server.js')
        }
    });
    
    // Add this update to history
    newSystem.history = [...systemThing.history, {
        timestamp: Date.now(),
        version: systemThing.version + 1,
        components: JSON.parse(JSON.stringify(newSystem.components))
    }];
    newSystem.version = systemThing.version + 1;
    
    // Save and use new system
    systemThing = newSystem;
    systemThing.save();
    console.log('System updated from file change to version', systemThing.version);
    
    // Restart the process
    process.exit(0);
}); 