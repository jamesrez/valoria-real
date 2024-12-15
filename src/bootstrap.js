const express = require('express');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

// At the top of the file, after the requires:
const SYSTEM_THING_ID = 'system-thing'; // Fixed ID for system Thing
const SYSTEM_VERSION = 2; // Increment this when making significant changes

// Make sure storage directory exists
const storageDir = path.join(__dirname, 'storage');
if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir);
}

// Enhanced Thing class with versioning
class Thing {
    constructor(config = {}) {
        this.id = config.id || uuidv4();
        this.name = config.name || 'Unnamed Thing';
        this.type = config.type || 'generic';
        this.created = config.created || Date.now();
        this.modified = config.modified || Date.now();
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
        // Find the highest version number in history
        const highestVersion = this.history.reduce((max, h) => 
            Math.max(max, h.version), 0);
        
        // Save current state to history with next version number
        this.history.push({
            timestamp: Date.now(),
            version: highestVersion + 1,
            components: JSON.parse(JSON.stringify(this.components))
        });
        
        this.version = highestVersion + 1;
        this.modified = Date.now();
        
        // Save to file
        fs.writeFileSync(
            path.join(storageDir, `${this.id}.json`),
            JSON.stringify(this, null, 2)
        );
    }

    restore(version) {
        const historicalVersion = this.history.find(h => h.version === version);
        if (historicalVersion) {
            this.components = JSON.parse(JSON.stringify(historicalVersion.components));
            // Set the current version to match the restored version
            this.version = historicalVersion.version;
            this.modified = Date.now(); // Update modified time but keep the version number

            // Don't create a new version, just save the file
            fs.writeFileSync(
                path.join(storageDir, `${this.id}.json`),
                JSON.stringify(this, null, 2)
            );
            return true;
        }
        return false;
    }
}

// Add this after the Thing class definition:
const DEFAULT_THING_TEMPLATE = {
    components: {
        html: `
            <div id="app">
                <h1>Hello from New Thing!</h1>
            </div>
        `,
        css: `
            body {
                font-family: system-ui;
                margin: 0;
                padding: 20px;
                background: #f0f0f0;
            }
            
            #app {
                max-width: 800px;
                margin: 0 auto;
                background: white;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
        `,
        clientJs: `
            // Client-side code goes here
            console.log('Thing is running!');
        `,
        serverJs: `
            // Server-side code goes here
            console.log('Thing server-side code running!');
        `
    }
};

// Load all existing things
const things = new Map();
if (fs.existsSync(storageDir)) {
    fs.readdirSync(storageDir).forEach(file => {
        if (file.endsWith('.json')) {
            const thingData = JSON.parse(fs.readFileSync(path.join(storageDir, file)));
            things.set(thingData.id, new Thing(thingData));
        }
    });
}

// Create or load the system Thing
let systemThing;
if (things.has(SYSTEM_THING_ID)) {
    // Load existing system Thing
    systemThing = things.get(SYSTEM_THING_ID);
    
    // Check if we need to update the system Thing
    const systemData = JSON.parse(fs.readFileSync(path.join(storageDir, `${SYSTEM_THING_ID}.json`)));
    if (!systemData.systemVersion || systemData.systemVersion < SYSTEM_VERSION) {
        console.log('Updating system Thing to new version...');
        // Create new system Thing with current template
        const newSystemThing = new Thing({
            id: SYSTEM_THING_ID,
            name: 'Thing System',
            type: 'system',
            systemVersion: SYSTEM_VERSION,
            // Keep existing history
            history: systemThing.history,
            version: systemThing.version,
            components: {
                // Your latest HTML, CSS, and JS here
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Thing System</title>
                        <style></style>
                    </head>
                    <body>
                        <div id="app">
                            <h1>Thing System</h1>
                            <div class="controls">
                                <select id="thing-selector">
                                    <option value="">Select a Thing</option>
                                    <option value="new">+ Create New Thing</option>
                                </select>
                                <div class="version-controls">
                                    <span id="current-version"></span>
                                    <select id="version-selector" style="display: none">
                                        <option value="">Restore Version</option>
                                    </select>
                                </div>
                            </div>
                            <div class="workspace">
                                <div class="editor-panel">
                                    <div id="editor"></div>
                                </div>
                                <div class="preview-panel">
                                    <div class="preview-header">
                                        <h3>Live Preview</h3>
                                    </div>
                                    <div id="preview-container"></div>
                                </div>
                            </div>
                        </div>
                        <script>
                            window.SYSTEM_THING_ID = '${SYSTEM_THING_ID}';
                        </script>
                        <script src="/thing-system.js"></script>
                    </body>
                    </html>
                `,
                css: `
                    body { 
                        font-family: system-ui;
                        margin: 0;
                        padding: 20px;
                        background: #f0f0f0;
                    }
                    
                    #app {
                        max-width: 1400px;
                        margin: 0 auto;
                    }
                    
                    .controls {
                        margin-bottom: 20px;
                        display: flex;
                        gap: 10px;
                    }

                    select {
                        padding: 8px;
                        border-radius: 4px;
                        border: 1px solid #ddd;
                    }
                    
                    .workspace {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 20px;
                    }

                    .editor-panel, .preview-panel {
                        background: white;
                        padding: 20px;
                        border-radius: 8px;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    }

                    .preview-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 10px;
                    }

                    #preview-container {
                        width: 100%;
                        height: 500px;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                        background: white;
                        overflow: auto;
                        padding: 20px;
                    }
                    
                    .editor {
                        display: grid;
                        gap: 20px;
                    }
                    
                    textarea {
                        width: 100%;
                        min-height: 150px;
                        font-family: monospace;
                        padding: 10px;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                    }

                    button {
                        padding: 10px 20px;
                        background: #0066ff;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                    }

                    button:hover {
                        background: #0052cc;
                    }

                    /* Add a class to scope preview styles */
                    .preview-content {
                        height: 100%;
                    }
                `,
                clientJs: `
                    class ThingEditor {
                        constructor(containerId) {
                            this.container = document.getElementById(containerId);
                            this.currentThing = null;
                            this.setupEventListeners();
                            this.render();
                            this.loadThingList();
                        }

                        setupEventListeners() {
                            const thingSelector = document.getElementById('thing-selector');
                            const versionSelector = document.getElementById('version-selector');

                            thingSelector.addEventListener('change', (e) => {
                                if (e.target.value === 'new') {
                                    this.createNewThing();
                                } else if (e.target.value) {
                                    this.loadThing(e.target.value);
                                }
                            });

                            versionSelector.addEventListener('change', (e) => {
                                if (e.target.value) {
                                    this.restoreVersion(parseInt(e.target.value));
                                }
                            });
                        }

                        render() {
                            this.container.innerHTML = \`
                                <div class="editor">
                                    <div>
                                        <h3>HTML</h3>
                                        <textarea id="html-editor" oninput="editor.updatePreview()"></textarea>
                                    </div>
                                    <div>
                                        <h3>CSS</h3>
                                        <textarea id="css-editor" oninput="editor.updatePreview()"></textarea>
                                    </div>
                                    <div>
                                        <h3>Client JS</h3>
                                        <textarea id="js-editor" oninput="editor.updatePreview()"></textarea>
                                    </div>
                                    <div>
                                        <h3>Server JS</h3>
                                        <textarea id="server-js-editor"></textarea>
                                    </div>
                                    <div class="actions">
                                        <button onclick="editor.saveThing()">Save</button>
                                    </div>
                                </div>
                            \`;
                        }

                        async loadThingList() {
                            const response = await fetch('/api/things');
                            const things = await response.json();
                            
                            const selector = document.getElementById('thing-selector');
                            const currentOptions = Array.from(selector.options);
                            
                            // Keep only the default and "new" options
                            selector.options.length = 2;
                            
                            things.forEach(thing => {
                                const option = new Option(thing.name, thing.id);
                                selector.add(option);
                            });
                        }

                        async loadThing(id) {
                            const response = await fetch(\`/api/things/\${id}\`);
                            this.currentThing = await response.json();
                            
                            document.getElementById('html-editor').value = this.currentThing.components.html;
                            document.getElementById('css-editor').value = this.currentThing.components.css;
                            document.getElementById('js-editor').value = this.currentThing.components.clientJs;
                            document.getElementById('server-js-editor').value = 
                                this.currentThing.components.serverJs;

                            // Update the page title
                            document.title = \`Thing System - Editing: \${this.currentThing.name}\`;

                            // Update version display
                            document.getElementById('current-version').textContent = 
                                \`Current: v\${this.currentThing.version}\`;

                            // Update version selector
                            this.updateVersionSelector(this.currentThing);

                            // Initialize preview
                            this.updatePreview();
                        }

                        async createNewThing() {
                            const name = prompt('Enter name for new Thing:');
                            if (!name) return;
                            
                            const response = await fetch('/api/things', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ name })
                            });
                            
                            const newThing = await response.json();
                            await this.loadThingList();
                            document.getElementById('thing-selector').value = newThing.id;
                            this.loadThing(newThing.id);
                        }

                        async saveThing() {
                            if (!this.currentThing) return;

                            const updates = {
                                components: {
                                    html: document.getElementById('html-editor').value,
                                    css: document.getElementById('css-editor').value,
                                    clientJs: document.getElementById('js-editor').value,
                                    serverJs: document.getElementById('server-js-editor').value
                                }
                            };
                            
                            const response = await fetch(\`/api/things/\${this.currentThing.id}\`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(updates)
                            });

                            const updatedThing = await response.json();
                            
                            // Update version display immediately
                            document.getElementById('current-version').textContent = 
                                \`Current: v\${updatedThing.version}\`;
                            
                            // Refresh the version selector
                            this.updateVersionSelector(updatedThing);

                            alert('Thing saved!');
                            
                            // If we're editing the system Thing, reload the page
                            if (this.currentThing.id === window.SYSTEM_THING_ID) {
                                location.reload();
                            } else {
                                this.currentThing = updatedThing;
                            }
                        }

                        async restoreVersion(version) {
                            if (!this.currentThing) return;

                            if (!confirm(\`Are you sure you want to restore version \${version}?\`)) {
                                return;
                            }

                            await fetch(\`/api/things/\${this.currentThing.id}/restore/\${version}\`, {
                                method: 'POST'
                            });

                            alert('Version restored!');

                            // If we're restoring the system thing, reload the page
                            if (this.currentThing.id === window.SYSTEM_THING_ID) {
                                location.reload();
                            } else {
                                this.loadThing(this.currentThing.id);
                            }
                        }

                        updateVersionSelector(thing) {
                            const versionSelector = document.getElementById('version-selector');
                            versionSelector.style.display = 'block';
                            versionSelector.options.length = 1; // Keep only the default option
                            
                            // Sort versions in reverse order (newest first)
                            const sortedHistory = [...thing.history].sort((a, b) => b.version - a.version);
                            
                            sortedHistory.forEach(hist => {
                                versionSelector.add(new Option(
                                    \`Version \${hist.version} (\${new Date(hist.timestamp).toLocaleString()})\`,
                                    hist.version
                                ));
                            });
                        }

                        updatePreview() {
                            if (!this.currentThing) return;
                            
                            const previewContainer = document.getElementById('preview-container');
                            if (!previewContainer) return;

                            // Get current editor contents
                            const html = document.getElementById('html-editor').value;
                            const css = document.getElementById('css-editor').value;
                            const js = document.getElementById('js-editor').value;

                            // Create a scoped container for the preview
                            previewContainer.innerHTML = \`
                                <style>
                                    #preview-container {
                                        padding: 0;
                                        overflow: auto;
                                        height: 500px;
                                        border: 1px solid #ddd;
                                        border-radius: 4px;
                                        background: white;
                                    }
                                    
                                    /* Scope all styles to preview container */
                                    #preview-container .preview-content {
                                        min-height: 100%;
                                        display: block;
                                    }

                                    /* Replace body with .preview-content */
                                    \${css.replace(/body/g, '#preview-container .preview-content')}
                                </style>
                                <div class="preview-content">
                                    \${html}
                                </div>
                                <script>
                                    (function() {
                                        try {
                                            \${js}
                                        } catch (e) {
                                            console.error('Preview JS Error:', e);
                                        }
                                    })();
                                </script>
                            \`;
                        }

                        refreshPreview() {
                            this.updatePreview();
                        }
                    }

                    // Initialize the editor
                    const editor = new ThingEditor('editor');
                `
            }
        });
        
        // Save the updated system Thing
        things.set(SYSTEM_THING_ID, newSystemThing);
        newSystemThing.save();
        systemThing = newSystemThing;
    }
} else {
    // Create new system Thing
    systemThing = new Thing({
        id: SYSTEM_THING_ID,
        name: 'Thing System',
        type: 'system',
        systemVersion: SYSTEM_VERSION,
        components: {
            // ... (rest of the components)
        }
    });
    things.set(systemThing.id, systemThing);
    systemThing.save();
}

// Create express app
const app = express();
app.use(express.json());

// Routes
app.get('/', (req, res) => {
    const html = systemThing.components.html.replace(
        '<style>',
        `<style>${systemThing.components.css}`
    );
    res.send(html);
});

app.get('/thing-system.js', (req, res) => {
    res.type('application/javascript');
    res.send(systemThing.components.clientJs);
});

// API Routes
app.get('/api/things', (req, res) => {
    res.json(Array.from(things.values()));
});

app.get('/api/things/:id', (req, res) => {
    const thing = things.get(req.params.id);
    if (thing) res.json(thing);
    else res.status(404).json({ error: 'Thing not found' });
});

app.post('/api/things', (req, res) => {
    const newThing = new Thing({ 
        name: req.body.name,
        components: DEFAULT_THING_TEMPLATE.components 
    });
    things.set(newThing.id, newThing);
    newThing.save();
    res.json(newThing);
});

app.put('/api/things/:id', (req, res) => {
    const thing = things.get(req.params.id);
    if (thing) {
        Object.assign(thing.components, req.body.components);
        thing.save();
        res.json(thing);
    } else {
        res.status(404).json({ error: 'Thing not found' });
    }
});

app.post('/api/things/:id/restore/:version', (req, res) => {
    const thing = things.get(req.params.id);
    if (thing) {
        const success = thing.restore(parseInt(req.params.version));
        if (success) {
            // If it's the system thing, we need to reload it
            if (thing.id === SYSTEM_THING_ID) {
                Object.assign(systemThing.components, thing.components);
            }
            res.json(thing);
        } else {
            res.status(400).json({ error: 'Version not found' });
        }
    } else {
        res.status(404).json({ error: 'Thing not found' });
    }
});

// Add a preview route:
app.get('/preview/:id', (req, res) => {
    const thing = things.get(req.params.id);
    if (thing) {
        const html = thing.components.html.replace(
            '<style>',
            `<style>${thing.components.css}`
        ).replace(
            '</body>',
            `<script>${thing.components.clientJs}</script></body>`
        );
        res.send(html);
    } else {
        res.status(404).send('Thing not found');
    }
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Thing System running at http://localhost:3000`);
}); 