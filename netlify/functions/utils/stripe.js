// netlify/functions/utils/stripe.js
// Updated with your actual Stripe Price IDs

const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Your actual Stripe Price IDs
const PRICE_IDS = {
  // Standard Plan
  standard_monthly: 'price_1RtaID1Fvl67fP5VZRjyTCCw',    // $97/month
  standard_yearly: 'price_1RtaID1Fvl67fP5Vz7U2Rozq',     // $997/year
  
  // Plus Plan  
  plus_monthly: 'price_1RtaIp1Fvl67fP5VdzcA364h',        // $147/month
  plus_yearly: 'price_1RtaIp1Fvl67fP5VTqppZ6fC',         // $1497/year
  
  // Premium Plan
  premium_monthly: 'price_1RtaKG1Fvl67fP5VDXTs1Gjf',     // $197/month
  premium_yearly: 'price_1RtaKG1Fvl67fP5VEexTk25G'       // $1997/year
};

// Log which prices are configured (for debugging)
console.log('Stripe Price IDs configured:');
Object.entries(PRICE_IDS).forEach(([key, value]) => {
  if (value === 'price_xxx') {
    console.log(`  ❌ ${key}: NOT CONFIGURED`);
  } else {
    console.log(`  ✅ ${key}: ${value}`);
  }
});

module.exports = {
  stripe,
  PRICE_IDS
};