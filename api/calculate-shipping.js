const fetch = require('node-fetch');

const PRINTFUL_API_BASE = 'https://api.printful.com';
const PRINTFUL_TOKEN = process.env.PRINTFUL_TOKEN || 'UvNCDm5MoW5YZDFjdafAEf7s3Qs1aCcPAcIbFPhA';

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const { recipient, items } = req.body;

        const shippingRequest = {
            recipient: recipient,
            items: items.map(item => ({
                variant_id: item.variantId,
                quantity: item.quantity
            }))
        };

        const response = await fetch(`${PRINTFUL_API_BASE}/shipping/rates`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${PRINTFUL_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(shippingRequest)
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        res.json(data);
    } catch (error) {
        console.error('Error calculating shipping:', error);
        res.status(500).json({ error: error.message });
    }
};

