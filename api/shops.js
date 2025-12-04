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
        const response = await fetch(`${PRINTFUL_API_BASE}/stores`, {
            headers: {
                'Authorization': `Bearer ${PRINTFUL_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            return res.status(response.status).json({
                ...errorData,
                message: 'Please verify your Printful API token is correct.'
            });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error fetching stores:', error);
        res.status(500).json({ error: error.message });
    }
};

