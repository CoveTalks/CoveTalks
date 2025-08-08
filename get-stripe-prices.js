// get-stripe-prices.js
// Run: node get-stripe-prices.js
// This will list all your Stripe products and prices

require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function getPrices() {
  console.log('\n=== FETCHING YOUR STRIPE PRICES ===\n');
  
  try {
    // Get all products
    const products = await stripe.products.list({ limit: 100 });
    
    // Get all prices
    const prices = await stripe.prices.list({ limit: 100 });
    
    console.log('YOUR PRODUCTS AND PRICES:\n');
    
    products.data.forEach(product => {
      console.log(`📦 ${product.name}`);
      console.log(`   ID: ${product.id}`);
      
      // Find prices for this product
      const productPrices = prices.data.filter(p => p.product === product.id);
      
      productPrices.forEach(price => {
        const interval = price.recurring ? price.recurring.interval : 'one-time';
        const amount = price.unit_amount / 100;
        console.log(`   💰 $${amount} ${interval}`);
        console.log(`      Price ID: ${price.id}`);
      });
      
      console.log('');
    });
    
    // Generate the code for stripe.js
    console.log('\n=== COPY THIS TO YOUR stripe.js ===\n');
    console.log('const PRICE_IDS = {');
    
    // Try to match prices to plans
    products.data.forEach(product => {
      const productPrices = prices.data.filter(p => p.product === product.id);
      const name = product.name.toLowerCase();
      
      productPrices.forEach(price => {
        const interval = price.recurring ? price.recurring.interval : 'one-time';
        const planName = name.includes('standard') ? 'standard' :
                        name.includes('plus') ? 'plus' :
                        name.includes('premium') ? 'premium' : 'unknown';
        const period = interval === 'month' ? 'monthly' : 
                      interval === 'year' ? 'yearly' : interval;
        
        if (planName !== 'unknown') {
          console.log(`  ${planName}_${period}: '${price.id}',`);
        }
      });
    });
    
    console.log('};\n');
    
  } catch (error) {
    console.error('Error fetching prices:', error.message);
    console.log('\nMake sure your STRIPE_SECRET_KEY is valid in .env file');
  }
}

getPrices();