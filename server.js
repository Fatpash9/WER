// Local development server
// This is only for local testing - production uses Vercel serverless functions
const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Parse JSON and raw body (for webhooks)
app.use(express.json());
app.use(express.raw({ type: 'application/json' }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve HTML files from root
app.get('*.html', (req, res) => {
    res.sendFile(path.join(__dirname, req.path));
});

// API routes - proxy to serverless functions
app.get('/api/shops', async (req, res) => {
    const handler = require('./api/shops');
    return handler(req, res);
});

app.get('/api/shops/:shopId/products', async (req, res) => {
    // Convert Express params to Vercel query format
    req.query.shopId = req.params.shopId;
    const handler = require('./api/shops/[shopId]/products');
    return handler(req, res);
});

app.get('/api/shops/:shopId/products/:productId', async (req, res) => {
    // Convert Express params to Vercel query format
    req.query.shopId = req.params.shopId;
    req.query.productId = req.params.productId;
    const handler = require('./api/shops/[shopId]/products/[productId]');
    return handler(req, res);
});

app.post('/api/calculate-shipping', async (req, res) => {
    const handler = require('./api/calculate-shipping');
    return handler(req, res);
});

app.post('/api/create-checkout-session', async (req, res) => {
    const handler = require('./api/create-checkout-session');
    return handler(req, res);
});

app.post('/api/create-printful-order', async (req, res) => {
    const handler = require('./api/create-printful-order');
    return handler(req, res);
});

app.post('/api/webhook', async (req, res) => {
    const handler = require('./api/webhook');
    return handler(req, res);
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Local development server running on http://localhost:${PORT}`);
    console.log('Note: This is for local testing only. Production uses Vercel serverless functions.');
});

