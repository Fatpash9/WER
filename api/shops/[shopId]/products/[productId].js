const fetch = require('node-fetch');

const PRINTFUL_API_BASE = 'https://api.printful.com';
const PRINTFUL_TOKEN = process.env.PRINTFUL_TOKEN || '1qQlIDpVdmdqk2t6t0hfZPcXcdlzyMza2iUK38tm';

if (!process.env.PRINTFUL_TOKEN) {
    console.warn('WARNING: PRINTFUL_TOKEN environment variable is not set! Using fallback token. Set it in Vercel for production.');
}

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        console.log('[API] Environment check - PRINTFUL_TOKEN exists:', !!process.env.PRINTFUL_TOKEN);
        console.log('[API] Query params:', req.query);
        
        if (!PRINTFUL_TOKEN) {
            return res.status(500).json({ 
                error: 'Printful API token not configured. Please set PRINTFUL_TOKEN environment variable in Vercel.',
                message: 'Server configuration error: PRINTFUL_TOKEN is missing.',
                debug: {
                    hasEnvVar: !!process.env.PRINTFUL_TOKEN,
                    hasFallback: !!'1qQlIDpVdmdqk2t6t0hfZPcXcdlzyMza2iUK38tm'
                }
            });
        }

        // In Vercel, dynamic routes use req.query for path parameters
        const productId = req.query.productId || req.query['[productId]'] || req.url.split('/').pop();
        const shopId = req.query.shopId || req.query['[shopId]'] || req.url.split('/')[3];
        
        console.log('[API] Fetching product from Printful - ProductId:', productId, 'ShopId:', shopId);
        const response = await fetch(`${PRINTFUL_API_BASE}/store/products/${productId}`, {
            headers: {
                'Authorization': `Bearer ${PRINTFUL_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch {
                errorData = { message: errorText };
            }
            console.error('[API] Printful API error:', errorData);
            return res.status(response.status).json({
                ...errorData,
                debug: {
                    status: response.status,
                    statusText: response.statusText
                }
            });
        }

        const data = await response.json();
        console.log('[API] Successfully fetched product:', productId);
        res.json(data);
    } catch (error) {
        console.error('[API] Error fetching product:', error);
        res.status(500).json({ 
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

