const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
require('dotenv').config();

const app = express();

const PORT = process.env.PORT || 3000;
const PRINTFUL_API_BASE = 'https://api.printful.com';
// IMPORTANT: Replace this with your actual Printiful API token from https://www.printful.com/dashboard/api
const PRINTFUL_TOKEN = process.env.PRINTFUL_TOKEN || 'UvNCDm5MoW5YZDFjdafAEf7s3Qs1aCcPAcIbFPhA';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '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';

console.log('Printiful Token (first 10 chars):', PRINTFUL_TOKEN.substring(0, 10) + '...');
console.log('To update token, set PRINTFUL_TOKEN in .env file or update server.js');

app.use(cors());

// Create Printful order after successful payment (define before webhook)
async function createPrintfulOrder(stripeSession) {
    try {
        const cartItems = JSON.parse(stripeSession.metadata?.cartItems || '[]');
        const shippingAddress = JSON.parse(stripeSession.metadata?.shippingAddress || '{}');
        const shippingMethod = JSON.parse(stripeSession.metadata?.shippingMethod || '{}');
        
        if (cartItems.length === 0) {
            throw new Error('No cart items found in session metadata');
        }
        
        // Get full session details from Stripe
        const stripe = require('stripe')(STRIPE_SECRET_KEY);
        const session = await stripe.checkout.sessions.retrieve(stripeSession.id, {
            expand: ['customer', 'customer_details', 'shipping']
        });
        
        // Use shipping address from Stripe checkout (most accurate), fallback to form data
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
        
        // Build Printful order
        // Printful automatically sends order confirmation emails when order is confirmed
        // Stripe also sends payment receipts automatically
        const printfulOrder = {
            external_id: `stripe_${stripeSession.id}`, // Link to Stripe session for tracking
            recipient: recipient,
            items: cartItems.map(item => ({
                variant_id: parseInt(item.variantId),
                quantity: parseInt(item.quantity)
            })),
            confirm: true, // Automatically confirm and fulfill the order
            update_existing: false
        };
        
        // Add shipping method if available
        if (shippingMethod && shippingMethod.id) {
            printfulOrder.shipping = shippingMethod.id;
        }
        
        console.log('Creating Printful order for Stripe session:', stripeSession.id);
        console.log('Order details:', JSON.stringify(printfulOrder, null, 2));
        
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
        
        console.log('Printful order created successfully:', data.result?.id);
        console.log('Order status:', data.result?.status);
        return data;
    } catch (error) {
        console.error('Error in createPrintfulOrder:', error);
        throw error;
    }
}

// Webhook endpoint must be before express.json() to receive raw body
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const stripe = require('stripe')(STRIPE_SECRET_KEY);
    const sig = req.headers['stripe-signature'];
    
    let event;
    
    try {
        // In production, verify webhook signature with your webhook secret
        // For development, parse directly
        event = JSON.parse(req.body.toString());
    } catch (err) {
        console.error('Webhook parsing failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    // Handle the checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        try {
            await createPrintfulOrder(session);
        } catch (error) {
            console.error('Error creating Printful order from webhook:', error);
        }
    }
    
    res.json({ received: true });
});

app.use(express.json());

// Serve static files FIRST (CSS, JS, images, etc.)
// In Vercel, static files are handled by Vercel's routing, but we still need this for local dev
// Only use static middleware if not in Vercel (Vercel handles static files automatically)
if (process.env.VERCEL !== '1') {
    app.use(express.static(__dirname, {
        setHeaders: (res, path) => {
            // Set proper MIME types
            if (path.endsWith('.css')) {
                res.setHeader('Content-Type', 'text/css');
            } else if (path.endsWith('.js')) {
                res.setHeader('Content-Type', 'application/javascript');
            } else if (path.endsWith('.svg')) {
                res.setHeader('Content-Type', 'image/svg+xml');
            } else if (path.endsWith('.png')) {
                res.setHeader('Content-Type', 'image/png');
            }
        },
        // Don't serve index.html as static - let the route handle it
        index: false
    }));
}

// Get store info (Printiful doesn't have "shops", it uses store info)
app.get('/api/shops', async (req, res) => {
    try {
        console.log('Fetching Printiful store info...');
        
        const response = await fetch(`${PRINTFUL_API_BASE}/stores`, {
            headers: {
                'Authorization': `Bearer ${PRINTFUL_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Printiful API Error:', errorData);
            return res.status(response.status).json({
                ...errorData,
                message: 'Please verify your Printiful API token is correct. Get it from: https://www.printful.com/dashboard/api'
            });
        }
        
        const data = await response.json();
        console.log('Successfully fetched stores:', data.result?.length || 0, 'stores found');
        res.json(data);
    } catch (error) {
        console.error('Error fetching stores:', error);
        res.status(500).json({ error: error.message });
    }
});

// Helper function: listStoreProducts()
// GET https://api.printful.com/store/products
async function listStoreProducts() {
    const response = await fetch(`${PRINTFUL_API_BASE}/store/products`, {
        headers: {
            'Authorization': `Bearer ${PRINTFUL_TOKEN}`,
            'Content-Type': 'application/json'
        }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Failed to fetch products');
    return data;
}

// Helper function: getStoreProduct(productId)
// GET https://api.printful.com/store/products/{productId}
async function getStoreProduct(productId) {
    const response = await fetch(`${PRINTFUL_API_BASE}/store/products/${productId}`, {
        headers: {
            'Authorization': `Bearer ${PRINTFUL_TOKEN}`,
            'Content-Type': 'application/json'
        }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Failed to fetch product');
    return data;
}

// Helper function: createStoreProduct(productData)
// POST https://api.printful.com/store/products
async function createStoreProduct(productData) {
    const response = await fetch(`${PRINTFUL_API_BASE}/store/products`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${PRINTFUL_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(productData)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Failed to create product');
    return data;
}

// Helper function: updateStoreProduct(productId, productData)
// PUT https://api.printful.com/store/products/{productId}
async function updateStoreProduct(productId, productData) {
    const response = await fetch(`${PRINTFUL_API_BASE}/store/products/${productId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${PRINTFUL_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(productData)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Failed to update product');
    return data;
}

// List store products
// GET https://api.printful.com/store/products
app.get('/api/shops/:shopId/products', async (req, res) => {
    try {
        console.log('Fetching store products...');
        
        const data = await listStoreProducts();
        console.log('Successfully fetched', data.result?.length || 0, 'store products');
        res.json(data);
    } catch (error) {
        console.error('Error fetching store products:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get single store product details
// GET https://api.printful.com/store/products/{productId}
app.get('/api/shops/:shopId/products/:productId', async (req, res) => {
    try {
        const { productId } = req.params;
        console.log('Fetching product:', productId);
        
        const data = await getStoreProduct(productId);
        res.json(data);
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create store product
// POST https://api.printful.com/store/products
app.post('/api/shops/:shopId/products', async (req, res) => {
    try {
        console.log('Creating product...');
        
        const data = await createStoreProduct(req.body);
        console.log('Product created successfully');
        res.json(data);
    } catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update store product
// PUT https://api.printful.com/store/products/{productId}
app.put('/api/shops/:shopId/products/:productId', async (req, res) => {
    try {
        const { productId } = req.params;
        console.log('Updating product:', productId);
        
        const data = await updateStoreProduct(productId, req.body);
        console.log('Product updated successfully');
        res.json(data);
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create order (for Printiful)
app.post('/api/shops/:shopId/orders', async (req, res) => {
    try {
        const { shopId } = req.params;
        console.log('Creating order for store:', shopId);
        
        const response = await fetch(`${PRINTFUL_API_BASE}/orders`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${PRINTFUL_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ...req.body,
                store_id: shopId
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Error creating order:', errorData);
            return res.status(response.status).json(errorData);
        }
        
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ error: error.message });
    }
});

// Calculate shipping rates from Printful
app.post('/api/calculate-shipping', async (req, res) => {
    try {
        const { recipient, items } = req.body;
        
        // Build Printful shipping request
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
});

// Stripe checkout session creation
app.post('/api/create-checkout-session', async (req, res) => {
    try {
        const stripe = require('stripe')(STRIPE_SECRET_KEY);
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
                    unit_amount: item.price * 100 // Convert to cents
                },
                quantity: item.quantity
            })),
            mode: 'payment',
            success_url: successUrl || `${req.headers.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: cancelUrl || `${req.headers.origin}/`,
            // Store order data in metadata for webhook/order creation
            metadata: {
                cartItems: JSON.stringify(cartItems || []),
                shippingAddress: JSON.stringify(shippingAddress || {}),
                shippingMethod: JSON.stringify(shippingMethod || {})
            }
        };
        
        // Add shipping address collection if provided
        if (shippingAddress) {
            sessionConfig.shipping_address_collection = {
                allowed_countries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'SE', 'DK', 'NO', 'FI', 'PL', 'IE', 'PT', 'CH', 'NZ', 'JP', 'MX']
            };
        }
        
        const session = await stripe.checkout.sessions.create(sessionConfig);
        
        res.json({ sessionId: session.id, url: session.url });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to create Printful order from success page (fallback if webhook fails)
app.post('/api/create-printful-order', async (req, res) => {
    try {
        const { sessionId } = req.body;
        
        if (!sessionId) {
            return res.status(400).json({ error: 'Session ID required' });
        }
        
        const stripe = require('stripe')(STRIPE_SECRET_KEY);
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        
        if (session.payment_status !== 'paid') {
            return res.status(400).json({ error: 'Payment not completed' });
        }
        
        const order = await createPrintfulOrder(session);
        res.json({ success: true, order: order.result });
    } catch (error) {
        console.error('Error creating Printful order:', error);
        res.status(500).json({ error: error.message });
    }
});

// Contact form endpoint
app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, message } = req.body;
        
        if (!name || !email || !message) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        
        // Use nodemailer to send email
        const nodemailer = require('nodemailer');
        
        // Configure transporter - for production, use environment variables
        // This example uses Gmail, but you can configure for any SMTP service
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER || 'xinyunstudios@gmail.com',
                pass: process.env.EMAIL_PASS || '' // App-specific password for Gmail
            }
        });
        
        // If no email password is configured, use a simple console log
        // In production, you MUST set EMAIL_PASS in .env file
        if (!process.env.EMAIL_PASS) {
            console.log('=== CONTACT FORM SUBMISSION ===');
            console.log('Name:', name);
            console.log('Email:', email);
            console.log('Message:', message);
            console.log('================================');
            
            // Return success even without email configured (for development)
            return res.json({ 
                success: true, 
                message: 'Contact form received. Email not configured - check server logs.' 
            });
        }
        
        // Email content
        const mailOptions = {
            from: process.env.EMAIL_USER || 'xinyunstudios@gmail.com',
            to: 'xinyunstudios@gmail.com',
            subject: `Contact Form Submission from ${name}`,
            text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
            html: `
                <h2>Contact Form Submission</h2>
                <p><strong>Name:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Message:</strong></p>
                <p>${message.replace(/\n/g, '<br>')}</p>
            `
        };
        
        await transporter.sendMail(mailOptions);
        
        res.json({ success: true, message: 'Email sent successfully' });
    } catch (error) {
        console.error('Error sending contact email:', error);
        res.status(500).json({ error: 'Failed to send email. Please try again later.' });
    }
});

// Serve index.html for all non-API, non-file routes (SPA fallback)
// This must be LAST, after all API routes and static file serving
// Only match routes that don't have file extensions
app.get('*', (req, res, next) => {
    // Skip if it's an API route
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'Not found' });
    }
    
    // Skip if it looks like a file request (has extension)
    // In Vercel, these should be handled by Vercel's routing, but double-check
    const path = require('path');
    const ext = path.extname(req.path);
    
    // List of static file extensions that should NOT be served as HTML
    const staticExtensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.json', '.xml', '.map'];
    
    if (ext && staticExtensions.includes(ext.toLowerCase())) {
        // This should have been handled by Vercel routing or static middleware
        // If we get here, the file doesn't exist - return 404
        return res.status(404).type('text/plain').send('File not found');
    }
    
    // Serve index.html for all other routes (SPA routing)
    // Use absolute path for Vercel compatibility
    const indexPath = path.join(__dirname, 'index.html');
    res.sendFile(indexPath);
});

// Export for Vercel serverless function
// Only listen on port if not in Vercel environment
if (process.env.VERCEL !== '1') {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

// Export the app for Vercel
module.exports = app;

