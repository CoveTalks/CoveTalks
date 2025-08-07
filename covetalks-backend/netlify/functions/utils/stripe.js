const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRICE_IDS = {
  standard_monthly: 'price_standard_monthly', // replace with real Stripe price IDs
  standard_annual: 'price_standard_annual',
  plus_monthly: 'price_plus_monthly',
  plus_annual: 'price_plus_annual',
  premium_monthly: 'price_premium_monthly',
  premium_annual: 'price_premium_annual'
};

module.exports = { stripe, PRICE_IDS };
