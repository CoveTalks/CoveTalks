// netlify/functions/utils/stripe.js
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Replace these with your actual Stripe price IDs
const PRICE_IDS = {
  standard_monthly: 'price_xxx', // $9.99/month
  standard_annual: 'price_xxx',  // $99/year
  plus_monthly: 'price_xxx',     // $19.99/month
  plus_annual: 'price_xxx',      // $199/year
  premium_monthly: 'price_xxx',  // $39.99/month
  premium_annual: 'price_xxx'    // $399/year
};

module.exports = {
  stripe,
  PRICE_IDS
};