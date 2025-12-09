# Vercel Environment Variables Setup

## CRITICAL: Printful API Token

The Printful API is currently only working on your local device because the `PRINTFUL_TOKEN` environment variable is not set in Vercel.

### To Fix Printful API on Production:

1. Go to your Vercel dashboard: https://vercel.com/dashboard
2. Select your project (West End Ritual)
3. Go to **Settings** → **Environment Variables**
4. Add the following environment variable:
   - **Name**: `PRINTFUL_TOKEN`
   - **Value**: Your Printful API token (get it from https://www.printful.com/dashboard/api)
   - **Environment**: Production, Preview, and Development (select all)
5. Click **Save**
6. **Redeploy** your application (Vercel will automatically redeploy, or you can trigger a manual redeploy)

### Current Printful Token:
The code has been updated with your Printful token: `1qQlIDpVdmdqk2t6t0hfZPcXcdlzyMza2iUK38tm`

**CRITICAL**: You MUST also set this as an environment variable in Vercel:
- **Name**: `PRINTFUL_TOKEN`
- **Value**: `1qQlIDpVdmdqk2t6t0hfZPcXcdlzyMza2iUK38tm`
- **Environment**: Production, Preview, and Development (select all)

This ensures the token is used securely in production and the API works on all devices.

### Other Required Environment Variables:

**CRITICAL - Set these in Vercel:**

1. **`STRIPE_SECRET_KEY`** (Required for payments)
   - Your Stripe secret key (starts with `sk_live_` or `sk_test_`)
   - Current fallback in code: `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`
   - **Note**: The fallback key starts with `rk_live_` which is a restricted key. You need a full secret key starting with `sk_live_` for production.
   - Get it from: https://dashboard.stripe.com/apikeys

2. **`STRIPE_WEBHOOK_SECRET`** (Required for order fulfillment)
   - Your Stripe webhook secret (for verifying webhook events)
   - Get it from: https://dashboard.stripe.com/webhooks
   - After creating a webhook endpoint, copy the "Signing secret"

### Optional (Already in Code):

- **Google Places API Key**: Already hardcoded in `index.html` (`AIzaSyCXUl1ALMadTgG50eu0cM-A7wMbaEj2Uc0`)
  - This is a client-side key, so it's fine to be in the HTML
  - Make sure it's restricted in Google Cloud Console to your domain only

- **Stripe Publishable Key**: Already hardcoded in `script.js` (`pk_live_51SVFspEW8cQp4AXRTjATqHrKgnARWpwsk8U4kG8AbQZqvpFtRlzvcqzY8n5atepd54Vw61fBAvuNl7wNCZ4l7Oox00MjKUbFUn`)
  - Publishable keys are meant to be public, so this is fine

### After Setting Environment Variables:

1. The Printful API will work on all devices (not just your local machine)
2. Products will load correctly
3. Shipping calculations will work
4. Order creation will work

---

## Checkout Button Fix

The checkout button visibility has been fixed with:
- Aggressive CSS rules with `!important` flags
- Inline styles in HTML
- JavaScript that runs immediately on page load
- Multiple layers of hiding to ensure it's completely invisible until needed

The button will only appear after:
1. User clicks "PROCEED TO SHIPPING"
2. User fills in all shipping information
3. Shipping cost is calculated
4. All fields are validated

---

## Testing After Deployment

1. Open the live website
2. Open browser console (F12)
3. Check for any errors
4. Test the cart flow:
   - Add item to cart
   - Open cart - should ONLY see "PROCEED TO SHIPPING" button
   - Click "PROCEED TO SHIPPING"
   - Fill in shipping form
   - Should see "PROCEED TO CHECKOUT" button appear
   - Click checkout and complete payment

