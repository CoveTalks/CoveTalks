// File: netlify/functions/stripe-create-checkout.js
// Working version with your Price IDs

const { stripe, PRICE_IDS } = require('./utils/stripe');
const { requireAuth } = require('./utils/auth');
const { tables, updateRecord } = require('./utils/airtable');

exports.handler = async (event) => {
  console.log('=== STRIPE CREATE CHECKOUT ===');
  
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

  try {
    // Check Stripe configuration
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('❌ STRIPE_SECRET_KEY not configured');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Payment system not configured',
          debug: 'Missing STRIPE_SECRET_KEY in .env file'
        })
      };
    }

    // Verify authentication
    const auth = await requireAuth(event);
    if (auth.statusCode) {
      console.log('❌ Authentication failed');
      return { ...auth, headers };
    }

    console.log('✅ User authenticated:', auth.userId);

    const body = JSON.parse(event.body);
    console.log('Request body:', body);
    
    const { priceId, planType, billingPeriod } = body;

    // Map the priceId string to actual Stripe price ID
    const actualPriceId = PRICE_IDS[priceId];
    
    console.log('Price mapping:', {
      requested: priceId,
      actual: actualPriceId
    });

    // Check if we have a valid price ID
    if (!actualPriceId) {
      console.error('❌ Invalid price ID:', priceId);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Invalid subscription plan selected',
          debug: `Invalid price ID: ${priceId}`
        })
      };
    }

    // Get user from Airtable
    console.log('Fetching user from Airtable...');
    const user = await tables.members.find(auth.userId);
    
    if (!user) {
      console.error('❌ User not found in Airtable');
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'User not found' 
        })
      };
    }

    console.log('User found:', {
      name: user.fields.Name,
      email: user.fields.Email,
      type: user.fields.Member_Type
    });

    // Only speakers can subscribe
    if (user.fields.Member_Type !== 'Speaker') {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Only speakers can subscribe to plans. Organizations use CoveTalks for free.' 
        })
      };
    }

    // Create or get Stripe customer
    let customerId = user.fields.Stripe_Customer_ID;
    
    if (!customerId) {
      console.log('Creating new Stripe customer...');
      try {
        const customer = await stripe.customers.create({
          email: user.fields.Email,
          name: user.fields.Name,
          phone: user.fields.Phone || undefined,
          metadata: {
            airtable_id: auth.userId,
            member_type: user.fields.Member_Type
          }
        });
        
        customerId = customer.id;
        console.log('✅ Stripe customer created:', customerId);
        
        // Save Stripe customer ID to Airtable
        await updateRecord(tables.members, auth.userId, {
          Stripe_Customer_ID: customerId
        });
      } catch (stripeError) {
        console.error('❌ Failed to create Stripe customer:', stripeError);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            success: false,
            error: 'Failed to create customer account',
            debug: stripeError.message
          })
        };
      }
    } else {
      console.log('Using existing Stripe customer:', customerId);
    }

    // Check for existing active subscription
    console.log('Checking for existing subscriptions...');
    try {
      const existingSubscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: 'active',
        limit: 1
      });

      if (existingSubscriptions.data.length > 0) {
        console.log('⚠️ User already has active subscription');
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            success: false,
            error: 'You already have an active subscription. Please manage it from your billing page.',
            hasSubscription: true
          })
        };
      }
    } catch (subCheckError) {
      console.log('Could not check existing subscriptions:', subCheckError.message);
      // Continue anyway - let Stripe handle it
    }

    // Create checkout session
    console.log('Creating Stripe checkout session...');
    const successUrl = body.successUrl || `${process.env.SITE_URL || 'http://localhost:8888'}/dashboard.html?subscription=success`;
    const cancelUrl = body.cancelUrl || `${process.env.SITE_URL || 'http://localhost:8888'}/pricing.html`;

    try {
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{
          price: actualPriceId,
          quantity: 1
        }],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        allow_promotion_codes: true,
        billing_address_collection: 'auto',
        metadata: {
          airtable_id: auth.userId,
          plan_type: planType,
          billing_period: billingPeriod
        }
      });

      console.log('✅ Checkout session created!');
      console.log('   Session ID:', session.id);
      console.log('   Checkout URL:', session.url);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          sessionId: session.id,
          url: session.url,
          message: 'Checkout session created successfully'
        })
      };
    } catch (sessionError) {
      console.error('❌ Failed to create checkout session:', sessionError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Failed to create checkout session',
          debug: sessionError.message
        })
      };
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'An unexpected error occurred',
        message: error.message 
      })
    };
  }
};