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
        return crypto.createHash('md5').update(content).digest('hex');
    } catch (error) {
        console.error(`Error calculating hash for ${filepath}`);
        return null;
    }
}

// Function to get template hashes
function getTemplateHashes() {
    return {
        html: getFileHash('templates/system/index.html'),
        css: getFileHash('templates/system/styles.css'),
        clientJs: getFileHash('templates/system/client.js'),
        serverJs: getFileHash('templates/system/server.js')
    };
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
        // Add children support
        this.children = config.children || [];
        this.parentId = config.parentId || null;
        this.order = config.order || 0;
    }

    // Add child Thing
    addChild(childThing, order = null) {
        if (order === null) {
            order = this.children.length;
        }
        childThing.parentId = this.id;
        childThing.order = order;
        this.children.push(childThing.id);
        childThing.save();
        this.save();
    }

    // Remove child Thing
    removeChild(childThing) {
        const index = this.children.indexOf(childThing.id);
        if (index > -1) {
            this.children.splice(index, 1);
            childThing.parentId = null;
            childThing.order = 0;
            childThing.save();
            this.save();
        }
    }

    // Get rendered HTML with children
    renderHtml(thingStore) {
        // Create a unique ID for this instance
        const instanceId = `thing-${this.id}-${Math.random().toString(36).substr(2, 9)}`;
        
        let html = `
            <style>
                #${instanceId} {
                    ${this.components.css}
                }
            </style>
            <div id="${instanceId}" class="thing" data-thing-id="${this.id}">
                ${this.components.html}
            </div>
            <script>
                (function() {
                    try {
                        ${this.components.clientJs}
                    } catch (e) {
                        console.error("Thing JS Error:", e);
                    }
                })();
            </script>
        `;
        
        // If HTML contains children placeholder
        if (html.includes('<div class="children"></div>')) {
            // Get sorted children
            const childrenHtml = this.children
                .map(id => {
                    const child = thingStore.get(id);
                    if (!child) {
                        console.warn(`Child ${id} not found in store`);
                        return '';
                    }
                    return child.renderHtml(thingStore);
                })
                .filter(html => html)
                .sort((a, b) => a.order - b.order)
                .join('\n');
            
            // Replace placeholder with children's HTML
            html = html.replace(
                '<div class="children"></div>',
                `<div class="children">${childrenHtml}</div>`
            );
        }
        
        return html;
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

    // Compare each hash
    for (const [key, hash] of Object.entries(currentHashes)) {
        if (currentSystem.templateHashes[key] !== hash) {
            console.log(`Template ${key} changed, update needed`);
            return true;
        }
    }

    return false;
}

// Update the system Thing loading logic
if (fs.existsSync(systemPath)) {
    const data = JSON.parse(fs.readFileSync(systemPath));
    systemThing = new Thing(data);
    
    if (needsSystemUpdate(systemThing)) {
        console.log('Updating system Thing...');
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
            },
            children: systemThing.children // Preserve children
        });
        
        // Add this update to history
        newSystem.history = [...systemThing.history, {
            timestamp: Date.now(),
            version: systemThing.version + 1,
            components: JSON.parse(JSON.stringify(newSystem.components))
        }];
        newSystem.version = systemThing.version + 1;
        
        systemThing = newSystem;
        systemThing.save();
        console.log('System updated to version', systemThing.version);
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
    ignored: /(^|[\/\\])\../,
    persistent: true,
    ignoreInitial: true
});

watcher.on('change', (filepath) => {
    // Get the relative path for comparison
    const relativePath = path.relative(__dirname, filepath);
    
    // Only proceed if it's a template file change
    if (!relativePath.startsWith('templates/system/')) {
        return;
    }
    
    if (needsSystemUpdate(systemThing)) {
        console.log(`Template ${filepath} changed, updating system Thing...`);
        
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
            },
            children: systemThing.children // Preserve children
        });
        
        // Add this update to history
        newSystem.history = [...systemThing.history, {
            timestamp: Date.now(),
            version: systemThing.version + 1,
            components: JSON.parse(JSON.stringify(newSystem.components))
        }];
        newSystem.version = systemThing.version + 1;
        
        systemThing = newSystem;
        systemThing.save();
        console.log('System updated from file change to version', systemThing.version);
        
        // Restart the process
        process.exit(0);
    }
}); 