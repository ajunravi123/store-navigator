import express from 'express';
import cors from 'cors';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from "@google/genai";

// Environment variables are loaded natively by Node.js via --env-file flag
// or via process.env if passed manually.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8003;
const AUTH_TOKEN = process.env.AUTH_TOKEN;

// Initialize Google GenAI
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.warn('GEMINI_API_KEY not found in environment variables. AI features will not work.');
}
const genAI = apiKey ? new GoogleGenAI({ apiKey }) : null;

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

// Authentication Middleware
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!AUTH_TOKEN) {
        return next();
    }
    if (!authHeader || authHeader !== AUTH_TOKEN) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// Helper to get products for AI context
async function getProductsForAI() {
    try {
        const data = await fs.readFile(PRODUCTS_FILE, 'utf-8');
        const products = JSON.parse(data);
        return products.map(p => ({
            id: p.id,
            name: p.name,
            category: p.category,
            price: p.price,
            description: p.description,
            stockCount: p.stockCount,
            sku: p.sku,
            image: p.image
        }));
    } catch (err) {
        console.error('Error reading products for AI:', err);
        return [];
    }
}

// Create a router for store_navigator
const storeNavigatorRouter = express.Router();

// Apply auth middleware to all store_navigator routes
storeNavigatorRouter.use(authMiddleware);

// GET /api/store_navigator/store - Get store data
storeNavigatorRouter.get('/store', async (req, res) => {
    try {
        const data = await fs.readFile(STORE_FILE, 'utf-8');
        res.setHeader('Content-Type', 'application/json');
        res.status(200).send(data);
    } catch (err) {
        if (err.code === 'ENOENT') {
            res.status(200).json({});
        } else {
            console.error('Error reading store data:', err);
            res.status(500).json({ error: 'Failed to read store data' });
        }
    }
});

// POST /api/store_navigator/store - Save store data
storeNavigatorRouter.post('/store', async (req, res) => {
    try {
        const dataToSave = req.body;
        if (dataToSave === undefined || dataToSave === null) {
            return res.status(400).json({ error: 'Invalid payload: body is required' });
        }
        await fs.writeFile(STORE_FILE, JSON.stringify(dataToSave, null, 2), 'utf-8');
        res.status(200).json({ status: 'ok', message: 'Store data saved successfully' });
    } catch (err) {
        console.error('Error writing store data:', err);
        res.status(500).json({ error: 'Failed to write store data' });
    }
});

// GET /api/store_navigator/products - Get products data
storeNavigatorRouter.get('/products', async (req, res) => {
    try {
        const data = await fs.readFile(PRODUCTS_FILE, 'utf-8');
        res.setHeader('Content-Type', 'application/json');
        res.status(200).send(data);
    } catch (err) {
        if (err.code === 'ENOENT') {
            res.status(200).send(JSON.stringify([]));
        } else {
            console.error('Error reading products data:', err);
            res.status(500).json({ error: 'Failed to read products data' });
        }
    }
});

// POST /api/store_navigator/products - Save products data
storeNavigatorRouter.post('/products', async (req, res) => {
    try {
        const dataToSave = req.body;
        if (!Array.isArray(dataToSave)) {
            return res.status(400).json({ error: 'Invalid payload: products must be an array' });
        }
        await fs.writeFile(PRODUCTS_FILE, JSON.stringify(dataToSave, null, 2), 'utf-8');
        res.status(200).json({ status: 'ok', message: 'Products data saved successfully', productsCount: dataToSave.length });
    } catch (err) {
        console.error('Error writing products data:', err);
        res.status(500).json({ error: 'Failed to write products data' });
    }
});

// POST /api/store_navigator/ai/chat - General AI chat for product assistance
storeNavigatorRouter.post('/ai/chat', async (req, res) => {
    if (!genAI) {
        return res.status(500).json({ error: 'AI service not configured' });
    }

    const { query } = req.body;
    if (!query) {
        return res.status(400).json({ error: 'Query is required' });
    }

    try {
        const products = await getProductsForAI();
        const response = await genAI.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Based on the following store products, help the user with their request: "${query}". 
            Products: ${JSON.stringify(products)}`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        explanation: {
                            type: Type.STRING,
                            description: "A brief friendly explanation of the suggestions. If the user asks about price, include the price in your explanation. If they ask about stock, include stock information. Be helpful and informative."
                        },
                        productIds: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                            description: "List of product IDs that match the user's intent most directly."
                        },
                        suggestedProductIds: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                            description: "List of 4-5 additional products that are relevant, complementary, or might be of interest based on the request."
                        }
                    },
                    required: ["explanation", "productIds", "suggestedProductIds"]
                },
                systemInstruction: "You are a helpful in-store shopping assistant. Your goal is to map user intents (like recipes, occasions, problems, or specific product questions) to specific product IDs from the provided catalog. Use 'productIds' for exact matches and 'suggestedProductIds' for relevant but not explicitly requested items. Always include relevant product details (price, description, stock) in your explanations when available. Keep your explanation concise and helpful."
            }
        });

        res.json(JSON.parse(response.text || '{}'));
    } catch (error) {
        console.error("AI Chat Error:", error);
        res.status(500).json({ error: 'Failed to generate AI response' });
    }
});

// POST /api/store_navigator/ai/recommend - Get AI-powered product recommendations
storeNavigatorRouter.post('/ai/recommend', async (req, res) => {
    if (!genAI) {
        return res.status(500).json({ error: 'AI service not configured' });
    }

    const { productIds, excludedProductIds } = req.body;
    const targetIds = Array.isArray(productIds) ? productIds : (req.body.productId ? [req.body.productId] : []);

    if (targetIds.length === 0) {
        return res.status(400).json({ error: 'Product ID(s) required' });
    }

    try {
        const allProducts = await getProductsForAI();
        const targetProducts = allProducts.filter(p => targetIds.includes(p.id));

        if (targetProducts.length === 0) {
            return res.status(404).json({ error: 'None of the specified product IDs were found' });
        }

        const excludedIds = new Set(excludedProductIds || []);
        targetIds.forEach(id => excludedIds.add(id));

        const otherProducts = allProducts.filter(p => !excludedIds.has(p.id));

        if (otherProducts.length === 0) {
            return res.json({ explanation: "No other products available for recommendation.", productIds: [] });
        }

        const contextString = targetProducts.map(p =>
            `Product: ${p.name}${p.description ? `. Description: ${p.description}` : ''}. Category: ${p.category}`
        ).join('\n');

        const prompt = `Find 3-5 products that are similar, complementary, or commonly purchased together with:
        ${contextString}

        Exclude the target products and already excluded IDs.
        Products available: ${JSON.stringify(otherProducts.map(p => ({
            id: p.id,
            name: p.name,
            category: p.category,
            description: p.description || ''
        })))}`;

        const response = await genAI.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        explanation: {
                            type: Type.STRING,
                            description: "A brief explanation of why these products are recommended."
                        },
                        productIds: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                            description: "List of 2-3 product IDs that are similar or complementary."
                        }
                    },
                    required: ["explanation", "productIds"]
                },
                systemInstruction: "You are a smart shopping assistant. Recommend 2-3 products that are similar, complementary, or commonly bought together. Keep recommendations relevant and useful."
            }
        });

        res.json(JSON.parse(response.text || '{}'));
    } catch (error) {
        console.error("AI Recommendation Error:", error);
        res.status(500).json({ error: 'Failed to generate recommendations' });
    }
});

// Mount the router with the /api/store_navigator prefix
app.use('/api/store_navigator', storeNavigatorRouter);

// Serve static files from dist directory in production (after API routes)
const DIST_DIR = path.join(__dirname, '..', 'dist');

// Initialize data directory
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
    console.log(`API endpoints available at http://localhost:${PORT}/api/store_navigator/*`);
});
