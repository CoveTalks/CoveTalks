// File: netlify/functions/stripe-create-checkout.js
// Updated version for Supabase integration

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role key for admin operations
);

// Price IDs from environment variables (stored in Netlify)
const PRICE_IDS = {
  // Monthly prices
  'standard_monthly': process.env.STRIPE_PRICE_STANDARD_MONTHLY,
  'plus_monthly': process.env.STRIPE_PRICE_PLUS_MONTHLY,
  'premium_monthly': process.env.STRIPE_PRICE_PREMIUM_MONTHLY,
  // Yearly prices
  'standard_yearly': process.env.STRIPE_PRICE_STANDARD_YEARLY,
  'plus_yearly': process.env.STRIPE_PRICE_PLUS_YEARLY,
  'premium_yearly': process.env.STRIPE_PRICE_PREMIUM_YEARLY
};

exports.handler = async (event) => {
  console.log('=== STRIPE CREATE CHECKOUT (SUPABASE) ===');
  
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
    // Parse request body
    const body = JSON.parse(event.body);
    console.log('Request body:', body);
    
    const { 
      userId, 
      userEmail, 
      priceId, 
      planType, 
      billingPeriod, 
      successUrl, 
      cancelUrl 
    } = body;

    // Validate required fields
    if (!userId || !userEmail || !priceId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Missing required fields: userId, userEmail, and priceId are required'
        })
      };
    }

    // Map the priceId string to actual Stripe price ID
    const actualPriceId = PRICE_IDS[priceId];
    
    console.log('Price mapping:', {
      requested: priceId,
      actual: actualPriceId
    });

    if (!actualPriceId) {
      console.error('Invalid price ID:', priceId);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Invalid subscription plan selected'
        })
      };
    }

    // Get user from Supabase
    console.log('Fetching user from Supabase...');
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (memberError || !member) {
      console.error('User not found:', memberError);
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
      name: member.name,
      email: member.email,
      type: member.member_type
    });

    // Only speakers can subscribe
    if (member.member_type !== 'Speaker') {
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
    let customerId = member.stripe_customer_id;
    
    if (!customerId) {
      console.log('Creating new Stripe customer...');
      try {
        const customer = await stripe.customers.create({
          email: member.email,
          name: member.name,
          phone: member.phone || undefined,
          metadata: {
            supabase_user_id: userId,
            member_type: member.member_type
          }
        });
        
        customerId = customer.id;
        console.log('Stripe customer created:', customerId);
        
        // Save Stripe customer ID to Supabase
        const { error: updateError } = await supabase
          .from('members')
          .update({ stripe_customer_id: customerId })
          .eq('id', userId);
        
        if (updateError) {
          console.error('Failed to update customer ID:', updateError);
        }
      } catch (stripeError) {
        console.error('Failed to create Stripe customer:', stripeError);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            success: false,
            error: 'Failed to create customer account'
          })
        };
      }
    } else {
      console.log('Using existing Stripe customer:', customerId);
    }

    // Check for existing active subscription
    console.log('Checking for existing subscriptions...');
    const { data: existingSubscriptions } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('member_id', userId)
      .eq('status', 'Active');

    if (existingSubscriptions && existingSubscriptions.length > 0) {
      console.log('User already has active subscription');
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

    // Create checkout session
    console.log('Creating Stripe checkout session...');
    const finalSuccessUrl = successUrl || `${process.env.SITE_URL || 'http://localhost:8888'}/dashboard.html?subscription=success`;
    const finalCancelUrl = cancelUrl || `${process.env.SITE_URL || 'http://localhost:8888'}/pricing.html`;

    try {
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{
          price: actualPriceId,
          quantity: 1
        }],
        mode: 'subscription',
        success_url: finalSuccessUrl,
        cancel_url: finalCancelUrl,
        allow_promotion_codes: true,
        billing_address_collection: 'auto',
        metadata: {
          supabase_user_id: userId,
          plan_type: planType,
          billing_period: billingPeriod
        }
      });

      console.log('Checkout session created!');
      console.log('Session ID:', session.id);
      console.log('Checkout URL:', session.url);

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
      console.error('Failed to create checkout session:', sessionError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Failed to create checkout session'
        })
      };
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        success: false,
        error: 'An unexpected error occurred',
        message: error.message 
      })
    };
  }
};