# West End Ritual - E-commerce Store

A minimalist, high-end e-commerce website for Toronto-themed t-shirts, integrated with Printify and Stripe.

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```env
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here
```

### 3. Configure Stripe Keys

1. Add your Stripe secret key to `.env`:
```env
STRIPE_SECRET_KEY=sk_test_your_key_here
```

2. Update `script.js` with your Stripe publishable key:
```javascript
const STRIPE_PUBLISHABLE_KEY = 'pk_test_your_key_here';
```

### 4. Start the Server

```bash
npm start
```

The server will run on `http://localhost:3000`

### 5. Open the Website

Open `index.html` in your browser, or serve it through the Express server.

## Features

- **Printify Integration**: Fetches products and mockups from your Printify store
- **Stripe Checkout**: Secure payment processing
- **Dynamic Product Loading**: Automatically loads up to 6 products from Printify
- **Responsive Design**: Works on all devices
- **Modern UI**: Minimalist design inspired by 437 and SSENSE

## API Endpoints

- `GET /api/shops` - Get all shops
- `GET /api/shops/:shopId/products` - Get products from a shop
- `GET /api/shops/:shopId/products/:productId` - Get single product details
- `POST /api/create-checkout-session` - Create Stripe checkout session

## Notes

- Make sure your Printify API token is valid
- The website will automatically fetch your first shop's products
- Only the first 6 products will be displayed
- Stripe keys should be added to both `.env` and `script.js`

