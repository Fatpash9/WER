module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const printfulToken = process.env.PRINTFUL_TOKEN || '1qQlIDpVdmdqk2t6t0hfZPcXcdlzyMza2iUK38tm';
    
    const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: {
            hasPrintfulToken: !!process.env.PRINTFUL_TOKEN,
            printfulTokenLength: printfulToken ? printfulToken.length : 0,
            printfulTokenPreview: printfulToken ? `${printfulToken.substring(0, 10)}...` : 'NONE',
            hasStripeSecret: !!process.env.STRIPE_SECRET_KEY,
            hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
            nodeEnv: process.env.NODE_ENV || 'development',
            vercel: process.env.VERCEL ? 'true' : 'false',
            vercelEnv: process.env.VERCEL_ENV || 'unknown'
        },
        message: process.env.PRINTFUL_TOKEN 
            ? 'PRINTFUL_TOKEN is set from environment variable ✓' 
            : 'WARNING: PRINTFUL_TOKEN not set, using fallback token'
    };

    res.json(health);
};

