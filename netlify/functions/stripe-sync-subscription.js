// File: netlify/functions/stripe-sync-subscription.js
// Manual sync function to ensure subscription data is in Supabase

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  console.log('=== STRIPE SYNC SUBSCRIPTION (SUPABASE) ===');
  
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
    const { userId } = body;
    
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
    
    console.log('Syncing subscriptions for user:', userId);
    
    // Get user from Supabase
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

    const customerId = member.stripe_customer_id;
    if (!customerId) {
      console.log('No Stripe customer ID found for user');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true,
          message: 'No Stripe customer found',
          hasSubscription: false
        })
      };
    }

    console.log('Stripe Customer ID:', customerId);

    // Get all subscriptions for this customer from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 10
    });

    console.log(`Found ${subscriptions.data.length} subscriptions in Stripe`);

    const results = {
      synced: [],
      created: [],
      updated: [],
      errors: []
    };

    // Process each subscription
    for (const subscription of subscriptions.data) {
      console.log(`Processing subscription: ${subscription.id} (${subscription.status})`);
      
      try {
        // Check if subscription exists in Supabase
        const { data: existingSubscription, error: fetchError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('stripe_subscription_id', subscription.id)
          .single();

        // Extract plan details
        const priceId = subscription.items.data[0].price.id;
        const amount = subscription.items.data[0].price.unit_amount / 100;
        const interval = subscription.items.data[0].price.recurring.interval;
        
        // Determine plan type from price ID using environment variables
        let planType = 'Standard';
        
        // Check against actual price IDs from environment
        if (priceId === process.env.STRIPE_PRICE_STANDARD_MONTHLY || 
            priceId === process.env.STRIPE_PRICE_STANDARD_YEARLY) {
          planType = 'Standard';
        } else if (priceId === process.env.STRIPE_PRICE_PLUS_MONTHLY || 
                   priceId === process.env.STRIPE_PRICE_PLUS_YEARLY) {
          planType = 'Plus';
        } else if (priceId === process.env.STRIPE_PRICE_PREMIUM_MONTHLY || 
                   priceId === process.env.STRIPE_PRICE_PREMIUM_YEARLY) {
          planType = 'Premium';
        }
        
        const billingPeriod = interval === 'year' ? 'Yearly' : 'Monthly';
        
        // Map Stripe status to database status
        let dbStatus = 'Active';
        if (subscription.status === 'past_due') dbStatus = 'Past_Due';
        else if (subscription.status === 'canceled') dbStatus = 'Cancelled';
        else if (subscription.status === 'unpaid') dbStatus = 'Past_Due';
        else if (subscription.status === 'incomplete') dbStatus = 'Incomplete';
        else if (subscription.status === 'trialing') dbStatus = 'Trialing';

        if (!existingSubscription) {
          // Create new subscription record
          console.log('Creating new subscription record');
          
          const subscriptionData = {
            member_id: userId,
            stripe_subscription_id: subscription.id,
            plan_type: planType,
            billing_period: billingPeriod,
            status: dbStatus,
            amount: amount,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            created_at: new Date(subscription.created * 1000).toISOString()
          };

          if (subscription.canceled_at) {
            subscriptionData.ended_at = new Date(subscription.canceled_at * 1000).toISOString();
          }

          const { data: newRecord, error: createError } = await supabase
            .from('subscriptions')
            .insert(subscriptionData)
            .select()
            .single();
            
          if (createError) {
            console.error('Failed to create subscription:', createError);
            results.errors.push({
              stripe_id: subscription.id,
              error: createError.message
            });
          } else {
            results.created.push({
              id: newRecord.id,
              stripe_id: subscription.id,
              status: subscription.status
            });

            // If this is the active subscription, also check for initial payment
            if (subscription.status === 'active' && subscription.latest_invoice) {
              await syncInvoicePayment(subscription.latest_invoice, newRecord.id, userId);
            }
          }
        } else {
          // Update existing subscription record
          console.log('Updating existing subscription record');
          
          const updates = {
            status: dbStatus,
            plan_type: planType,
            billing_period: billingPeriod,
            amount: amount,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
          };

          if (subscription.canceled_at && !existingSubscription.ended_at) {
            updates.ended_at = new Date(subscription.canceled_at * 1000).toISOString();
          }

          const { error: updateError } = await supabase
            .from('subscriptions')
            .update(updates)
            .eq('id', existingSubscription.id);
            
          if (updateError) {
            console.error('Failed to update subscription:', updateError);
            results.errors.push({
              id: existingSubscription.id,
              stripe_id: subscription.id,
              error: updateError.message
            });
          } else {
            results.updated.push({
              id: existingSubscription.id,
              stripe_id: subscription.id,
              status: subscription.status
            });
          }
        }
      } catch (error) {
        console.error(`Error processing subscription ${subscription.id}:`, error);
        results.errors.push({
          stripe_id: subscription.id,
          error: error.message
        });
      }
    }

    // Check if user has any active subscriptions
    const hasActiveSubscription = subscriptions.data.some(s => s.status === 'active');
    
    // Sync recent payments
    if (customerId) {
      await syncRecentPayments(customerId, userId);
    }

    console.log('Sync complete:', results);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Subscription data synced successfully',
        results,
        hasActiveSubscription
      })
    };
  } catch (error) {
    console.error('Sync error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'Failed to sync subscription data',
        message: error.message 
      })
    };
  }
};

// Helper function to sync invoice payment
async function syncInvoicePayment(invoiceId, subscriptionRecordId, memberId) {
  try {
    console.log('Syncing invoice payment:', invoiceId);
    
    // Get invoice details
    const invoice = typeof invoiceId === 'string' ? 
      await stripe.invoices.retrieve(invoiceId) : invoiceId;
    
    // Check if payment already exists
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('*')
      .eq('stripe_payment_intent_id', invoice.payment_intent)
      .single();

    if (!existingPayment && invoice.status === 'paid') {
      // Create payment record
      const paymentData = {
        subscription_id: subscriptionRecordId,
        member_id: memberId,
        stripe_payment_intent_id: invoice.payment_intent,
        amount: invoice.amount_paid / 100,
        status: 'Succeeded',
        receipt_url: invoice.hosted_invoice_url || null,
        description: `Payment for invoice ${invoice.number || invoiceId}`,
        created_at: new Date(invoice.created * 1000).toISOString()
      };

      const { error: paymentError } = await supabase
        .from('payments')
        .insert(paymentData);
        
      if (paymentError) {
        console.error('Failed to create payment record:', paymentError);
      } else {
        console.log('Payment record created for invoice:', invoiceId);
      }
    }
  } catch (error) {
    console.error('Error syncing invoice payment:', error);
  }
}

// Helper function to sync recent payments
async function syncRecentPayments(customerId, memberId) {
  try {
    console.log('Syncing recent payments for customer:', customerId);
    
    // Get recent charges
    const charges = await stripe.charges.list({
      customer: customerId,
      limit: 10
    });

    for (const charge of charges.data) {
      if (charge.status === 'succeeded' && charge.invoice) {
        // Check if payment exists
        const { data: existingPayment } = await supabase
          .from('payments')
          .select('*')
          .eq('stripe_payment_intent_id', charge.payment_intent)
          .single();

        if (!existingPayment) {
          // Find the subscription record
          const { data: subscriptions } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('member_id', memberId)
            .order('created_at', { ascending: false })
            .limit(1);

          if (subscriptions && subscriptions.length > 0) {
            const paymentData = {
              subscription_id: subscriptions[0].id,
              member_id: memberId,
              stripe_payment_intent_id: charge.payment_intent,
              amount: charge.amount / 100,
              status: 'Succeeded',
              description: charge.description || 'Subscription payment',
              created_at: new Date(charge.created * 1000).toISOString()
            };

            const { error: paymentError } = await supabase
              .from('payments')
              .insert(paymentData);
              
            if (!paymentError) {
              console.log('Payment record created for charge:', charge.id);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error syncing recent payments:', error);
  }
}