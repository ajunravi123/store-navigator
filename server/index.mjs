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

// In-memory cache for fast reads
let storeCache = null;
let productsCache = null;
let storeCacheTime = 0;
let productsCacheTime = 0;

// Load data from file into cache
async function loadStoreData() {
    try {
        const data = await fs.readFile(STORE_FILE, 'utf-8');
        storeCache = JSON.parse(data);
        storeCacheTime = Date.now();
        return storeCache;
    } catch (error) {
        console.error('Failed to load store data:', error);
        throw error;
    }
}

async function loadProductsData() {
    try {
        const data = await fs.readFile(PRODUCTS_FILE, 'utf-8');
        productsCache = JSON.parse(data);
        productsCacheTime = Date.now();
        return productsCache;
    } catch (error) {
        console.error('Failed to load products data:', error);
        throw error;
    }
}

// Initialize cache on server startup
async function initializeCache() {
    try {
        await Promise.all([loadStoreData(), loadProductsData()]);
        console.log('Data cache initialized successfully');
    } catch (error) {
        console.error('Failed to initialize cache:', error);
        // Continue anyway - endpoints will try to load on first request
    }
}

// GET endpoints - serve from cache (very fast)
app.get('/api/store', async (req, res) => {
    try {
        if (storeCache === null) {
            await loadStoreData();
        }
        res.json(storeCache);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read store data' });
    }
});

app.get('/api/products', async (req, res) => {
    try {
        if (productsCache === null) {
            await loadProductsData();
        }
        res.json(productsCache);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read products data' });
    }
});

// POST endpoints - update cache and file
app.post('/api/store', async (req, res) => {
    try {
        const dataToSave = req.body;
        // Update cache immediately
        storeCache = dataToSave;
        storeCacheTime = Date.now();
        // Write to file asynchronously (don't block response)
        fs.writeFile(STORE_FILE, JSON.stringify(dataToSave, null, 2))
            .catch(err => console.error('Failed to write store data to file:', err));
        res.json({ message: 'Store data saved successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save store data' });
    }
});

app.post('/api/products', async (req, res) => {
    try {
        const dataToSave = req.body;
        // Update cache immediately
        productsCache = dataToSave;
        productsCacheTime = Date.now();
        // Write to file asynchronously (don't block response)
        fs.writeFile(PRODUCTS_FILE, JSON.stringify(dataToSave, null, 2))
            .catch(err => console.error('Failed to write products data to file:', err));
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

// Initialize cache and start server
async function startServer() {
    try {
        await initializeCache();
        app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        // Start server anyway - endpoints will handle errors
        app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT} (cache initialization failed)`);
        });
    }
}

startServer();
