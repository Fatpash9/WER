# West End Ritual - E-commerce Store

A minimalist, high-end e-commerce website for Toronto-themed t-shirts, integrated with Printful and Stripe.

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```env
PRINTFUL_TOKEN=your_printful_token_here
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key_here
EMAIL_USER=your_email@example.com
EMAIL_PASS=your_app_specific_password
```

### 3. Configure Stripe Keys

1. Add your Stripe secret key to `.env`:
```env
STRIPE_SECRET_KEY=sk_live_your_key_here
```

2. Update `script.js` with your Stripe publishable key:
```javascript
const STRIPE_PUBLISHABLE_KEY = 'pk_live_your_key_here';
```

### 4. Configure Formspree

Update the contact form in `index.html` with your Formspree form ID:
```html
<form id="contactForm" action="https://formspree.io/f/YOUR_FORM_ID" method="POST">
```

### 5. Start the Server

```bash
npm run dev
```

The server will run on `http://westendritual.com`

### 6. Open the Website

Open `index.html` in your browser, or serve it through the Express server.

## Features

- **Printful Integration**: Fetches products and creates orders through Printful
- **Stripe Checkout**: Secure payment processing
- **Dynamic Product Loading**: Automatically loads products from Printful store
- **Shipping Calculator**: Real-time shipping rates from Printful
- **Contact Form**: Integrated with Formspree
- **Policy Pages**: Terms & Conditions, Privacy Policy, and Return Policy
- **Responsive Design**: Works on all devices
- **Modern UI**: Minimalist design inspired by high-end fashion sites

## API Endpoints

- `GET /api/shops` - Get all stores
- `GET /api/shops/:shopId/products` - Get products from a store
- `GET /api/shops/:shopId/products/:productId` - Get single product details
- `POST /api/create-checkout-session` - Create Stripe checkout session
- `POST /api/calculate-shipping` - Calculate shipping rates
- `POST /api/create-printful-order` - Create Printful order (fallback)
- `POST /api/stripe-webhook` - Stripe webhook handler

## Notes

- Make sure your Printful API token is valid
- The website will automatically fetch your first store's products
- Orders are automatically created in Printful after successful payment
- Stripe keys should be added to both `.env` and `script.js`
- Formspree form ID should be configured in `index.html`
