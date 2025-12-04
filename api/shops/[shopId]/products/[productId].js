const fetch = require('node-fetch');

const PRINTFUL_API_BASE = 'https://api.printful.com';
const PRINTFUL_TOKEN = process.env.PRINTFUL_TOKEN || 'UvNCDm5MoW5YZDFjdafAEf7s3Qs1aCcPAcIbFPhA';

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // In Vercel, dynamic routes use req.query for path parameters
        const productId = req.query.productId || req.query['[productId]'] || req.url.split('/').pop();
        
        const response = await fetch(`${PRINTFUL_API_BASE}/store/products/${productId}`, {
            headers: {
                'Authorization': `Bearer ${PRINTFUL_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            return res.status(response.status).json(errorData);
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ error: error.message });
    }
};

