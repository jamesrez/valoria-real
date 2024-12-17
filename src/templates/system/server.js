// Load config
const config = require('./config.js');

// Create express app
const app = express();
app.use(express.json());

// Store all things in memory
const things = new Map();

// Load all existing things from storage
fs.readdirSync(storageDir).forEach(file => { 
    if (file.endsWith('.json')) {
        const thingData = JSON.parse(fs.readFileSync(path.join(storageDir, file)));
        const thing = new Thing(thingData);
        things.set(thing.id, thing);
    }
});

// Make sure system Thing is in the map
things.set(systemThing.id, systemThing);

// After loading all things from storage
console.log('Loading example Things...');
try {
    // Create context for examples
    const exampleContext = { Thing, things, systemThing };
    
    // Load example Things with context
    const exampleCode = fs.readFileSync(path.join(__dirname, '../example/nested-menu.js'), 'utf8');
    const loadExample = new Function(...Object.keys(exampleContext), exampleCode);
    loadExample(...Object.values(exampleContext));
    
    // Log the things we have after loading examples
    console.log('All Things:', Array.from(things.values()).map(t => ({
        id: t.id,
        name: t.name,
        children: t.children
    })));
} catch (error) {
    console.error('Failed to load example Things:', error);
}

// After loading example Things
console.log('System Thing children:', systemThing.children);
console.log('All Things:', Array.from(things.values()).map(t => ({
    id: t.id,
    name: t.name,
    children: t.children
})));

// Basic routes
app.get('/', (req, res) => {
    console.log('Rendering root page');
    console.log('System Thing:', {
        id: systemThing.id,
        name: systemThing.name,
        children: systemThing.children
    });
    
    let html = systemThing.renderHtml(things);
    console.log('Generated HTML:', html);
    
    html = html.replace('<style></style>', `<style>${systemThing.components.css}</style>`);
    html = html.replace('${SYSTEM_THING_ID}', systemThing.id);
    res.send(html);
});

app.get('/thing-system.js', (req, res) => {
    res.type('application/javascript');
    res.send(systemThing.components.clientJs);
});

// API routes
app.get('/api/things', (req, res) => {
    res.json(Array.from(things.values()));
});

app.get('/api/things/:id', (req, res) => {
    const thing = things.get(req.params.id);
    if (thing) {
        res.json(thing);
    } else {
        res.status(404).json({ error: 'Thing not found' });
    }
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

// Update the PUT route
app.put('/api/things/:id', (req, res) => {
    const thing = things.get(req.params.id);
    if (thing) {
        Object.assign(thing.components, req.body.components);
        thing.save();

        // If it's the system Thing, save and restart
        if (thing.id === systemThing.id) {
            console.log('System Thing updated, restarting...');
            res.json(thing);
            // Exit after response is sent
            res.on('finish', () => {
                console.log('Restarting server...');
                process.exit();
            });
            return;
        }

        res.json(thing);
    } else {
        res.status(404).json({ error: 'Thing not found' });
    }
});

// Update restore endpoint
app.post('/api/things/:id/restore/:version', (req, res) => {
    const thing = things.get(req.params.id);
    if (thing) {
        const version = parseInt(req.params.version);
        const historyItem = thing.history.find(h => h.version === version);
        
        if (historyItem) {
            Object.assign(thing.components, historyItem.components);
            thing.save();

            if (thing.id === systemThing.id) {
                console.log('System Thing restored to version ' + version + ', restarting...');
                res.json(thing);
                // Exit after response is sent
                res.on('finish', () => {
                    console.log('Restarting server...');
                    process.exit();
                });
                return;
            }

            res.json(thing);
        } else {
            res.status(400).json({ error: 'Version not found' });
        }
    } else {
        res.status(404).json({ error: 'Thing not found' });
    }
});

// Add routes for managing Thing relationships
app.post('/api/things/:id/children', (req, res) => {
    const parentThing = things.get(req.params.id);
    const childThing = things.get(req.body.childId);
    const order = req.body.order;
    
    if (parentThing && childThing) {
        parentThing.addChild(childThing, order);
        res.json(parentThing);
    } else {
        res.status(404).json({ error: 'Thing not found' });
    }
});

app.delete('/api/things/:id/children/:childId', (req, res) => {
    const parentThing = things.get(req.params.id);
    const childThing = things.get(req.params.childId);
    
    if (parentThing && childThing) {
        parentThing.removeChild(childThing);
        res.json(parentThing);
    } else {
        res.status(404).json({ error: 'Thing not found' });
    }
});

// Start server
const server = app.listen(config.port, config.host, () => {
    console.log(`Thing System running at http://${config.host}:${config.port}`);
    console.log('Loaded Things:', Array.from(things.keys()));
}); 