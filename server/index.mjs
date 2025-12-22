import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const DATA_DIR = path.join(__dirname, 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');

app.get('/api/store', async (req, res) => {
    try {
        const data = await fs.readFile(STORE_FILE, 'utf-8');
        res.json(JSON.parse(data));
    } catch (error) {
        res.status(500).json({ error: 'Failed to read store data' });
    }
});

app.post('/api/store', async (req, res) => {
    try {
        await fs.writeFile(STORE_FILE, JSON.stringify(req.body, null, 2));
        res.json({ message: 'Store data saved successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save store data' });
    }
});

app.get('/api/products', async (req, res) => {
    try {
        const data = await fs.readFile(PRODUCTS_FILE, 'utf-8');
        res.json(JSON.parse(data));
    } catch (error) {
        res.status(500).json({ error: 'Failed to read products data' });
    }
});

app.post('/api/products', async (req, res) => {
    try {
        await fs.writeFile(PRODUCTS_FILE, JSON.stringify(req.body, null, 2));
        res.json({ message: 'Products data saved successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save products data' });
    }
});

// Serve static files from dist directory in production (after API routes)
const DIST_DIR = path.join(__dirname, '..', 'dist');
fs.access(DIST_DIR)
    .then(() => {
        app.use(express.static(DIST_DIR));
        // Serve index.html for all non-API routes (SPA routing)
        app.get('*', (req, res) => {
            if (!req.path.startsWith('/api')) {
                res.sendFile(path.join(DIST_DIR, 'index.html'));
            }
        });
        console.log('Static files will be served from dist directory');
    })
    .catch(() => {
        // dist directory doesn't exist (development mode), ignore
    });

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
