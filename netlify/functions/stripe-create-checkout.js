// File: netlify/functions/stripe-create-checkout.js
const { stripe, PRICE_IDS } = require('./utils/stripe');
const { requireAuth } = require('./utils/auth');
const { tables, updateRecord } = require('./utils/airtable');

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
    const { 
      priceId, 
      planType, 
      billingPeriod,
      successUrl,
      cancelUrl 
    } = JSON.parse(event.body);

    // Validate inputs
    if (!priceId || !planType || !billingPeriod) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Missing required fields: priceId, planType, and billingPeriod' 
        })
      };
    }

    // Validate plan type
    if (!['Standard', 'Plus', 'Premium'].includes(planType)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Invalid plan type. Must be Standard, Plus, or Premium' 
        })
      };
    }

    // Validate billing period
    if (!['Monthly', 'Yearly'].includes(billingPeriod)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Invalid billing period. Must be Monthly or Yearly' 
        })
      };
    }

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
      // Create new Stripe customer
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
      
      // Save Stripe customer ID to Airtable
      await updateRecord(tables.members, auth.userId, {
        Stripe_Customer_ID: customerId
      });
    } else {
      // Update existing customer metadata
      await stripe.customers.update(customerId, {
        metadata: {
          airtable_id: auth.userId,
          member_type: user.fields.Member_Type
        }
      });
    }

    // Check for existing active subscription
    const existingSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1
    });

    if (existingSubscriptions.data.length > 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'You already have an active subscription. Please manage it from the billing portal.',
          portalUrl: `${process.env.SITE_URL}/billing.html`
        })
      };
    }

    // Define success and cancel URLs
    const finalSuccessUrl = successUrl || `${process.env.SITE_URL}/billing-success?session_id={CHECKOUT_SESSION_ID}`;
    const finalCancelUrl = cancelUrl || `${process.env.SITE_URL}/billing-cancel`;

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1
      }],
      mode: 'subscription',
      success_url: finalSuccessUrl,
      cancel_url: finalCancelUrl,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      subscription_data: {
        metadata: {
          airtable_id: auth.userId,
          plan_type: planType,
          billing_period: billingPeriod
        },
        trial_period_days: planType === 'Standard' ? 7 : 14 // 7 days for Standard, 14 for Plus/Premium
      },
      metadata: {
        airtable_id: auth.userId,
        plan_type: planType,
        billing_period: billingPeriod
      }
    });

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
  } catch (error) {
    console.error('Checkout session error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'Failed to create checkout session',
        message: error.message 
      })
    };
  }
};