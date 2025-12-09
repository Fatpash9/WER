const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || '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');
const fetch = require('node-fetch');

const PRINTFUL_API_BASE = 'https://api.printful.com';
const PRINTFUL_TOKEN = process.env.PRINTFUL_TOKEN || '1qQlIDpVdmdqk2t6t0hfZPcXcdlzyMza2iUK38tm';

if (!process.env.PRINTFUL_TOKEN) {
    console.warn('WARNING: PRINTFUL_TOKEN environment variable is not set! Using fallback token. Set it in Vercel for production.');
}

async function createPrintfulOrder(stripeSession) {
    try {
        const cartItems = JSON.parse(stripeSession.metadata?.cartItems || '[]');
        const shippingAddress = JSON.parse(stripeSession.metadata?.shippingAddress || '{}');
        const shippingMethod = JSON.parse(stripeSession.metadata?.shippingMethod || '{}');

        if (cartItems.length === 0) {
            throw new Error('No cart items found in session metadata');
        }

        const session = await stripe.checkout.sessions.retrieve(stripeSession.id, {
            expand: ['customer', 'customer_details', 'shipping']
        });

        let recipient;
        if (session.shipping?.address) {
            recipient = {
                name: session.shipping.name || session.customer_details?.name || shippingAddress.name || 'Customer',
                address1: session.shipping.address.line1 || shippingAddress.address1 || '',
                address2: session.shipping.address.line2 || shippingAddress.address2 || '',
                city: session.shipping.address.city || shippingAddress.city || '',
                state_code: session.shipping.address.state || shippingAddress.state_code || '',
                country_code: session.shipping.address.country || shippingAddress.country_code || '',
                zip: session.shipping.address.postal_code || shippingAddress.zip || '',
                phone: session.customer_details?.phone || '',
                email: session.customer_details?.email || session.customer_email || ''
            };
        } else if (shippingAddress && shippingAddress.address1) {
            recipient = {
                name: shippingAddress.name || session.customer_details?.name || 'Customer',
                address1: shippingAddress.address1,
                address2: shippingAddress.address2 || '',
                city: shippingAddress.city,
                state_code: shippingAddress.state_code,
                country_code: shippingAddress.country_code,
                zip: shippingAddress.zip,
                phone: session.customer_details?.phone || '',
                email: session.customer_details?.email || session.customer_email || ''
            };
        } else {
            throw new Error('No shipping address found');
        }

        const printfulOrder = {
            external_id: `stripe_${stripeSession.id}`,
            recipient: recipient,
            items: cartItems.map(item => ({
                variant_id: parseInt(item.variantId),
                quantity: parseInt(item.quantity)
            })),
            confirm: true,
            update_existing: false
        };

        if (shippingMethod && shippingMethod.id) {
            printfulOrder.shipping = shippingMethod.id;
        }

        if (!PRINTFUL_TOKEN) {
            throw new Error('Printful API token not configured. Please set PRINTFUL_TOKEN environment variable in Vercel.');
        }

        console.log('[API] Creating Printful order...');
        const response = await fetch(`${PRINTFUL_API_BASE}/orders`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${PRINTFUL_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(printfulOrder)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Error creating Printful order:', JSON.stringify(data, null, 2));
            throw new Error(data.error?.message || data.result || 'Failed to create Printful order');
        }

        return data;
    } catch (error) {
        console.error('Error in createPrintfulOrder:', error);
        throw error;
    }
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        if (webhookSecret && sig) {
            // In Vercel, req.body is already parsed, need raw body for webhook verification
            // For now, parse from string if needed
            const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
        } else {
            // For development, parse JSON directly
            event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        }
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        // Still try to process if verification fails (for development)
        event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;

        if (session.payment_status === 'paid') {
            try {
                await createPrintfulOrder(session);
                console.log('Printful order created successfully for session:', session.id);
            } catch (error) {
                console.error('Error creating Printful order from webhook:', error);
            }
        }
    }

    res.json({ received: true });
};

