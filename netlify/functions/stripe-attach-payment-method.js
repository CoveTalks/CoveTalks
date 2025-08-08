// File: netlify/functions/stripe-attach-payment-method.js
// Attach a payment method to a customer

const { stripe } = require('./utils/stripe');
const { requireAuth } = require('./utils/auth');
const { tables, updateRecord } = require('./utils/airtable');

exports.handler = async (event) => {
  console.log('=== STRIPE ATTACH PAYMENT METHOD ===');
  
  // Handle CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  // Enable CORS
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  // Verify authentication
  const auth = await requireAuth(event);
  if (auth.statusCode) {
    return { ...auth, headers };
  }

  try {
    const { paymentMethodId, email } = JSON.parse(event.body);

    if (!paymentMethodId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Payment method ID required' 
        })
      };
    }

    console.log('Attaching payment method:', paymentMethodId);

    // Get user from Airtable
    const user = await tables.members.find(auth.userId);
    
    if (!user) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'User not found' 
        })
      };
    }

    // Check if user is a speaker (only speakers have billing)
    if (user.fields.Member_Type !== 'Speaker') {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Only speakers can add payment methods' 
        })
      };
    }

    let customerId = user.fields.Stripe_Customer_ID;

    // Create customer if doesn't exist
    if (!customerId) {
      console.log('Creating new Stripe customer...');
      
      const customer = await stripe.customers.create({
        email: email || user.fields.Email,
        name: user.fields.Name,
        phone: user.fields.Phone || undefined,
        metadata: {
          airtable_id: auth.userId,
          member_type: user.fields.Member_Type
        }
      });
      
      customerId = customer.id;
      console.log('Created Stripe customer:', customerId);
      
      // Save customer ID to Airtable
      await updateRecord(tables.members, auth.userId, {
        Stripe_Customer_ID: customerId
      });
    }

    // Attach payment method to customer
    console.log('Attaching payment method to customer:', customerId);
    
    const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId
    });

    console.log('Payment method attached successfully');

    // Check if this is the first payment method or should be default
    const existingPaymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card'
    });

    // If this is the only payment method, make it default
    if (existingPaymentMethods.data.length === 1) {
      console.log('Setting as default payment method');
      
      await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId
        }
      });

      // Also update any active subscriptions
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: 'active'
      });

      for (const subscription of subscriptions.data) {
        await stripe.subscriptions.update(subscription.id, {
          default_payment_method: paymentMethodId
        });
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Payment method added successfully',
        paymentMethod: {
          id: paymentMethod.id,
          card: {
            brand: paymentMethod.card.brand,
            last4: paymentMethod.card.last4,
            exp_month: paymentMethod.card.exp_month,
            exp_year: paymentMethod.card.exp_year
          }
        }
      })
    };
  } catch (error) {
    console.error('Error attaching payment method:', error);
    
    // Handle specific Stripe errors
    if (error.type === 'StripeCardError') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: error.message 
        })
      };
    }
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'Failed to add payment method',
        message: error.message 
      })
    };
  }
};