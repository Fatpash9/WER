const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || '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');

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const { items, shippingAddress, cartItems, shippingMethod, successUrl, cancelUrl } = req.body;

        const sessionConfig = {
            payment_method_types: ['card'],
            line_items: items.map(item => ({
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: item.name,
                        images: item.images || []
                    },
                    unit_amount: item.price * 100
                },
                quantity: item.quantity
            })),
            mode: 'payment',
            success_url: successUrl || `${req.headers.origin || req.headers.referer || 'https://westendritual.com'}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: cancelUrl || `${req.headers.origin || req.headers.referer || 'https://westendritual.com'}/`,
            metadata: {
                cartItems: JSON.stringify(cartItems || []),
                shippingAddress: JSON.stringify(shippingAddress || {}),
                shippingMethod: JSON.stringify(shippingMethod || {})
            }
        };

        if (shippingAddress) {
            sessionConfig.shipping_address_collection = {
                allowed_countries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'SE', 'DK', 'NO', 'FI', 'PL', 'IE', 'PT', 'CH', 'NZ', 'JP', 'MX']
            };
        }

        const session = await stripe.checkout.sessions.create(sessionConfig);

        res.json({ sessionId: session.id, url: session.url });
    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({ error: error.message });
    }
};

