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

// Basic routes
app.get('/', (req, res) => {
    let html = systemThing.components.html;
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
                console.log('System Thing restored to version ' + version + ', triggering restart...');
                res.json(thing);
                triggerRestart();
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

// Start server
const server = app.listen(config.port, config.host, () => {
    console.log(`Thing System running at http://${config.host}:${config.port}`);
    console.log('Loaded Things:', Array.from(things.keys()));
    console.log("NICe we nice again!!!")
}); 