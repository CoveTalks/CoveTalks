// File: netlify/functions/stripe-attach-payment-method.js
// Attach a payment method to a customer - Supabase version

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  console.log('=== STRIPE ATTACH PAYMENT METHOD (SUPABASE) ===');
  
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
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  // Enable CORS
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  try {
    const body = JSON.parse(event.body);
    const { paymentMethodId, email, userId } = body;

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

    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'User ID required' 
        })
      };
    }

    console.log('Attaching payment method:', paymentMethodId);
    console.log('For user:', userId);

    // Get user from Supabase
    const { data: user, error: userError } = await supabase
      .from('members')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (userError || !user) {
      console.error('User not found:', userError);
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
    if (user.member_type !== 'Speaker') {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Only speakers can add payment methods' 
        })
      };
    }

    let customerId = user.stripe_customer_id;

    // Create customer if doesn't exist
    if (!customerId) {
      console.log('Creating new Stripe customer...');
      
      const customer = await stripe.customers.create({
        email: email || user.email,
        name: user.name,
        phone: user.phone || undefined,
        metadata: {
          supabase_user_id: userId,
          member_type: user.member_type
        }
      });
      
      customerId = customer.id;
      console.log('Created Stripe customer:', customerId);
      
      // Save customer ID to Supabase
      const { error: updateError } = await supabase
        .from('members')
        .update({ stripe_customer_id: customerId })
        .eq('id', userId);
      
      if (updateError) {
        console.error('Failed to update customer ID in Supabase:', updateError);
      }
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
        console.log('Updated default payment method for subscription:', subscription.id);
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
    
    if (error.type === 'StripeInvalidRequestError') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Invalid payment method or request',
          details: error.message 
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