import express from 'express';
import cors from 'cors';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const DATA_DIR = path.join(__dirname, 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');

// Ensure data directory exists
async function ensureDataDir() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
    } catch (error) {
        console.error('Failed to create data directory:', error);
    }
}

// GET /api/store - Get store data
app.get('/api/store', async (req, res) => {
    try {
        const data = await fs.readFile(STORE_FILE, 'utf-8');
        res.setHeader('Content-Type', 'application/json');
        res.status(200);
        res.end(data);
    } catch (err) {
        // If file doesn't exist, return empty object
        if (err.code === 'ENOENT') {
            res.setHeader('Content-Type', 'application/json');
            res.status(200);
            res.end(JSON.stringify({}));
        } else {
            console.error('Error reading store data:', err);
            res.status(500);
            res.end(JSON.stringify({ error: 'Failed to read store data' }));
        }
    }
});

// POST /api/store - Save store data
app.post('/api/store', async (req, res, next) => {
    if (req.method === 'OPTIONS') {
        res.status(204);
        res.end();
        return;
    }
    if (req.method !== 'POST') return next();

    try {
        const dataToSave = req.body;
        
        // Validate payload
        if (dataToSave === undefined || dataToSave === null) {
            res.status(400);
            res.end(JSON.stringify({ error: 'Invalid payload: body is required' }));
            return;
        }

        await fs.writeFile(STORE_FILE, JSON.stringify(dataToSave, null, 2), 'utf-8');
        res.setHeader('Content-Type', 'application/json');
        res.status(200);
        res.end(JSON.stringify({ status: 'ok', message: 'Store data saved successfully' }));
    } catch (err) {
        console.error('Error writing store data:', err);
        res.status(500);
        res.end(JSON.stringify({ error: 'Failed to write store data' }));
    }
});

// GET /api/products - Get products data
app.get('/api/products', async (req, res) => {
    try {
        const data = await fs.readFile(PRODUCTS_FILE, 'utf-8');
        res.setHeader('Content-Type', 'application/json');
        res.status(200);
        res.end(data);
    } catch (err) {
        // If file doesn't exist, return empty array
        if (err.code === 'ENOENT') {
            res.setHeader('Content-Type', 'application/json');
            res.status(200);
            res.end(JSON.stringify([]));
        } else {
            console.error('Error reading products data:', err);
            res.status(500);
            res.end(JSON.stringify({ error: 'Failed to read products data' }));
        }
    }
});

// POST /api/products - Save products data
app.post('/api/products', async (req, res, next) => {
    if (req.method === 'OPTIONS') {
        res.status(204);
        res.end();
        return;
    }
    if (req.method !== 'POST') return next();

    try {
        const dataToSave = req.body;
        
        // Validate payload - products should be an array
        if (!Array.isArray(dataToSave)) {
            res.status(400);
            res.end(JSON.stringify({ error: 'Invalid payload: products must be an array' }));
            return;
        }

        await fs.writeFile(PRODUCTS_FILE, JSON.stringify(dataToSave, null, 2), 'utf-8');
        res.setHeader('Content-Type', 'application/json');
        res.status(200);
        res.end(JSON.stringify({ status: 'ok', message: 'Products data saved successfully', productsCount: dataToSave.length }));
    } catch (err) {
        console.error('Error writing products data:', err);
        res.status(500);
        res.end(JSON.stringify({ error: 'Failed to write products data' }));
    }
});

// Serve static files from dist directory in production (after API routes)
const DIST_DIR = path.join(__dirname, '..', 'dist');

// Initialize and start server
await ensureDataDir();

// Check if dist directory exists and serve static files
try {
    await fs.access(DIST_DIR);
    app.use(express.static(DIST_DIR));
    // Serve index.html for all non-API routes (SPA routing)
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api')) {
            res.sendFile(path.join(DIST_DIR, 'index.html'));
        }
    });
    console.log('Static files will be served from dist directory');
} catch {
    // dist directory doesn't exist (development mode), ignore
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
    console.log(`API endpoints available at http://localhost:${PORT}/api/store and http://localhost:${PORT}/api/products`);
});
