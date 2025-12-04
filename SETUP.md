# Setup Instructions

## Printify API Token Issue

**Current Status:** The Printify API token is not authenticating.

### How to Fix:

1. **Get a new Printify API token:**
   - Go to: https://printify.com/app/account/api
   - Click "Generate new token" or copy your existing Private API token
   - Make sure it's a **Private API token** (not Public)

2. **Update the token:**
   
   **Option A: Using .env file (Recommended)**
   - Create a `.env` file in the root directory
   - Add: `PRINTIFY_TOKEN=your_new_token_here`
   - Restart the server
   
   **Option B: Direct in code**
   - Edit `server.js` line 10
   - Replace the token value
   - Restart the server

3. **Restart the server:**
   ```bash
   # Stop the server (Ctrl+C)
   npm start
   ```

## Stripe Keys

1. **Get your Stripe keys from:** https://dashboard.stripe.com/apikeys
   - You need TWO keys:
     - **Secret key** (starts with `sk_live_` or `sk_test_`) - for server
     - **Publishable key** (starts with `pk_live_` or `pk_test_`) - for frontend

2. **Update server:**
   - Add to `.env`: `STRIPE_SECRET_KEY=sk_live_your_key_here`

3. **Update frontend:**
   - Edit `script.js` line 4
   - Replace with: `const STRIPE_PUBLISHABLE_KEY = 'pk_live_your_key_here';`

## Testing

Once you've updated the Printify token:
1. Restart the server
2. Open http://localhost:3000
3. Check browser console (F12) for any errors
4. Products should load from your Printify store

