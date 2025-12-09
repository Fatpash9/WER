module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: {
            hasPrintfulToken: !!process.env.PRINTFUL_TOKEN,
            hasStripeSecret: !!process.env.STRIPE_SECRET_KEY,
            hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
            nodeEnv: process.env.NODE_ENV || 'development'
        }
    };

    res.json(health);
};

