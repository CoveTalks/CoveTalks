// File: netlify/functions/stripe-portal.js
// Stripe Customer Portal for subscription management - Supabase version

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  console.log('=== STRIPE PORTAL (SUPABASE) ===');
  
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
    const { userId, returnUrl } = body;
    
    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'User ID is required' 
        })
      };
    }
    
    console.log('Creating portal session for user:', userId);
    
    // Get user's Stripe customer ID from Supabase
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
          error: 'Billing portal is only available for speakers. Organizations use CoveTalks for free.' 
        })
      };
    }

    const customerId = user.stripe_customer_id;

    if (!customerId) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'No billing account found. Please subscribe to a plan first.',
          redirectUrl: `${process.env.SITE_URL || 'http://localhost:8888'}/pricing.html`
        })
      };
    }

    // Check if customer exists in Stripe
    try {
      await stripe.customers.retrieve(customerId);
    } catch (error) {
      if (error.code === 'resource_missing') {
        // Customer doesn't exist in Stripe, clear the invalid ID
        await supabase
          .from('members')
          .update({ stripe_customer_id: null })
          .eq('id', userId);
        
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ 
            success: false,
            error: 'Billing account not found. Please subscribe to a plan.',
            redirectUrl: `${process.env.SITE_URL || 'http://localhost:8888'}/pricing.html`
          })
        };
      }
      throw error;
    }

    // Define return URL
    const finalReturnUrl = returnUrl || `${process.env.SITE_URL || 'http://localhost:8888'}/billing.html`;

    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: finalReturnUrl
    });

    console.log('Portal session created:', session.id);

    // Get current subscription status
    let subscriptionInfo = null;
    try {
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 1
      });
      
      if (subscriptions.data.length > 0) {
        const sub = subscriptions.data[0];
        subscriptionInfo = {
          status: sub.status,
          currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null
        };
        
        // Update Supabase subscription status if needed
        const { data: existingSubscription } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('stripe_subscription_id', sub.id)
          .single();
        
        if (existingSubscription) {
          // Map Stripe status to database status
          let dbStatus = 'Active';
          if (sub.status === 'past_due') dbStatus = 'Past_Due';
          else if (sub.status === 'canceled') dbStatus = 'Cancelled';
          else if (sub.status === 'unpaid') dbStatus = 'Past_Due';
          
          if (existingSubscription.status !== dbStatus) {
            await supabase
              .from('subscriptions')
              .update({ status: dbStatus })
              .eq('id', existingSubscription.id);
          }
        }
      }
    } catch (subError) {
      console.error('Error fetching subscription info:', subError);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        url: session.url,
        subscription: subscriptionInfo,
        message: 'Billing portal session created successfully'
      })
    };
  } catch (error) {
    console.error('Portal session error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        success: false,
        error: 'Failed to create billing portal session',
        message: error.message 
      })
    };
  }
};