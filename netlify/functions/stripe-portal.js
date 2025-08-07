// File: netlify/functions/stripe-portal.js
const { stripe } = require('./utils/stripe');
const { requireAuth } = require('./utils/auth');
const { tables } = require('./utils/airtable');

exports.handler = async (event) => {
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
    const { returnUrl } = JSON.parse(event.body) || {};
    
    // Get user's Stripe customer ID
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
          error: 'Billing portal is only available for speakers. Organizations use CoveTalks for free.' 
        })
      };
    }

    const customerId = user.fields.Stripe_Customer_ID;

    if (!customerId) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'No billing account found. Please subscribe to a plan first.',
          redirectUrl: `${process.env.SITE_URL}/pricing.html`
        })
      };
    }

    // Check if customer exists in Stripe
    try {
      await stripe.customers.retrieve(customerId);
    } catch (error) {
      if (error.code === 'resource_missing') {
        // Customer doesn't exist in Stripe, clear the invalid ID
        await tables.members.update(auth.userId, {
          Stripe_Customer_ID: null
        });
        
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ 
            success: false,
            error: 'Billing account not found. Please subscribe to a plan.',
            redirectUrl: `${process.env.SITE_URL}/pricing.html`
          })
        };
      }
      throw error;
    }

    // Define return URL
    const finalReturnUrl = returnUrl || `${process.env.SITE_URL}/billing.html`;

    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: finalReturnUrl
    });

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
        
        // Update Airtable subscription status if needed
        const airtableSubscription = await tables.subscriptions.select({
          filterByFormula: `{Stripe_Subscription_ID} = '${sub.id}'`,
          maxRecords: 1
        }).firstPage();
        
        if (airtableSubscription.length > 0 && airtableSubscription[0].fields.Status !== sub.status) {
          await tables.subscriptions.update(airtableSubscription[0].id, {
            Status: sub.status === 'active' ? 'Active' : 
                   sub.status === 'past_due' ? 'Past_Due' : 
                   sub.status === 'canceled' ? 'Cancelled' : 
                   sub.status
          });
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
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'Failed to create billing portal session',
        message: error.message 
      })
    };
  }
};