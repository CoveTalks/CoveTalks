// File: netlify/functions/stripe-webhook.js
// Updated version for Supabase integration

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with service role key for admin operations
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  console.log('=== STRIPE WEBHOOK RECEIVED (SUPABASE) ===');
  console.log('Method:', event.httpMethod);
  
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  const sig = event.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  console.log('Signature present:', !!sig);
  console.log('Webhook secret configured:', !!webhookSecret);

  // Verify webhook signature
  let stripeEvent;
  
  if (webhookSecret && sig) {
    try {
      stripeEvent = stripe.webhooks.constructEvent(
        event.body,
        sig,
        webhookSecret
      );
      console.log('✅ Webhook signature verified');
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err.message);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: `Webhook Error: ${err.message}` })
      };
    }
  } else {
    // Parse without verification (development only)
    console.log('⚠️ Processing webhook without signature verification');
    try {
      stripeEvent = JSON.parse(event.body);
    } catch (err) {
      console.error('❌ Failed to parse webhook body:', err);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid JSON body' })
      };
    }
  }

  console.log('Event type:', stripeEvent.type);
  console.log('Event ID:', stripeEvent.id);

  // Handle different event types
  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed': {
        const session = stripeEvent.data.object;
        console.log('=== CHECKOUT SESSION COMPLETED ===');
        console.log('Session ID:', session.id);
        console.log('Customer:', session.customer);
        console.log('Subscription:', session.subscription);
        console.log('Metadata:', session.metadata);
        
        const { supabase_user_id, plan_type, billing_period } = session.metadata || {};

        if (!supabase_user_id) {
          console.error('❌ No supabase_user_id in session metadata');
          // Try to find user by customer ID
          const { data: member } = await supabase
            .from('members')
            .select('*')
            .eq('stripe_customer_id', session.customer)
            .single();
          
          if (member) {
            session.metadata.supabase_user_id = member.id;
          } else {
            console.error('Could not find user for customer:', session.customer);
            break;
          }
        }

        // Get the member record
        const { data: member, error: memberError } = await supabase
          .from('members')
          .select('*')
          .eq('id', supabase_user_id || session.metadata.supabase_user_id)
          .single();

        if (memberError || !member) {
          console.error('❌ Member not found:', memberError);
          break;
        }
        console.log('✅ Member found:', member.name);

        // Get subscription details from Stripe
        let subscription;
        try {
          subscription = await stripe.subscriptions.retrieve(session.subscription);
          console.log('✅ Subscription retrieved:', subscription.id);
          console.log('   Status:', subscription.status);
          console.log('   Current period end:', new Date(subscription.current_period_end * 1000));
        } catch (error) {
          console.error('❌ Failed to retrieve subscription:', error);
          break;
        }

        // Extract price information
        const priceId = subscription.items.data[0].price.id;
        const amount = subscription.items.data[0].price.unit_amount / 100;
        const interval = subscription.items.data[0].price.recurring.interval;
        
        // Determine plan type from price ID using environment variables
        let planType = plan_type || 'Standard';
        
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

        console.log('Determined plan:', { planType, billingPeriod });

        // Check if subscription already exists
        const { data: existingSubscription } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('stripe_subscription_id', subscription.id)
          .single();

        let subscriptionRecordId;

        if (!existingSubscription) {
          // Create subscription record in Supabase
          const subscriptionData = {
            member_id: supabase_user_id || session.metadata.supabase_user_id,
            stripe_subscription_id: subscription.id,
            plan_type: planType,
            billing_period: billingPeriod,
            status: 'Active',
            amount: amount,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
          };
          
          console.log('Creating subscription with data:', subscriptionData);
          
          const { data: newSubscription, error: subError } = await supabase
            .from('subscriptions')
            .insert(subscriptionData)
            .select()
            .single();
          
          if (subError) {
            console.error('❌ Failed to create subscription:', subError);
          } else {
            console.log('✅ Subscription created:', newSubscription.id);
            subscriptionRecordId = newSubscription.id;
          }
        } else {
          subscriptionRecordId = existingSubscription.id;
          console.log('⚠️ Subscription already exists:', subscriptionRecordId);
        }

        // Create payment record
        if (subscriptionRecordId && session.payment_intent) {
          const paymentData = {
            member_id: supabase_user_id || session.metadata.supabase_user_id,
            subscription_id: subscriptionRecordId,
            stripe_payment_intent_id: session.payment_intent,
            amount: session.amount_total / 100,
            status: 'Succeeded',
            description: `Initial payment - ${planType} ${billingPeriod}`
          };
          
          console.log('Creating payment with data:', paymentData);
          
          const { error: paymentError } = await supabase
            .from('payments')
            .insert(paymentData);
          
          if (paymentError) {
            console.error('❌ Failed to create payment:', paymentError);
          } else {
            console.log('✅ Payment record created');
          }
        }

        // Update member record
        const { error: updateError } = await supabase
          .from('members')
          .update({
            stripe_customer_id: session.customer
          })
          .eq('id', supabase_user_id || session.metadata.supabase_user_id);

        if (updateError) {
          console.error('❌ Failed to update member:', updateError);
        } else {
          console.log('✅ Member record updated');
        }
        
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = stripeEvent.data.object;
        console.log('=== SUBSCRIPTION UPDATED ===');
        console.log('Subscription ID:', subscription.id);
        console.log('Status:', subscription.status);
        
        // Find subscription in Supabase
        const { data: existingSubscription } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('stripe_subscription_id', subscription.id)
          .single();

        if (existingSubscription) {
          // Map Stripe status to database status
          let dbStatus = 'Active';
          if (subscription.status === 'past_due') dbStatus = 'Past_Due';
          else if (subscription.status === 'canceled') dbStatus = 'Cancelled';
          else if (subscription.status === 'unpaid') dbStatus = 'Past_Due';
          else if (subscription.status === 'incomplete') dbStatus = 'Incomplete';
          
          // Update subscription
          const { error: updateError } = await supabase
            .from('subscriptions')
            .update({
              status: dbStatus,
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
            })
            .eq('id', existingSubscription.id);

          if (updateError) {
            console.error('❌ Failed to update subscription:', updateError);
          } else {
            console.log('✅ Subscription updated');
          }
        } else {
          console.log('⚠️ Subscription not found in database');
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = stripeEvent.data.object;
        console.log('=== SUBSCRIPTION CANCELLED ===');
        console.log('Subscription ID:', subscription.id);
        
        // Find and update subscription in Supabase
        const { data: existingSubscription } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('stripe_subscription_id', subscription.id)
          .single();

        if (existingSubscription) {
          const { error: updateError } = await supabase
            .from('subscriptions')
            .update({
              status: 'Cancelled',
              ended_at: new Date().toISOString()
            })
            .eq('id', existingSubscription.id);

          if (updateError) {
            console.error('❌ Failed to cancel subscription:', updateError);
          } else {
            console.log('✅ Subscription cancelled');
          }
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = stripeEvent.data.object;
        console.log('=== PAYMENT SUCCEEDED ===');
        console.log('Invoice ID:', invoice.id);
        console.log('Amount:', invoice.amount_paid / 100);
        console.log('Billing reason:', invoice.billing_reason);
        
        // Skip if this is the first payment (handled by checkout.session.completed)
        if (invoice.billing_reason === 'subscription_create') {
          console.log('Skipping initial payment (handled by checkout)');
          break;
        }
        
        // Find subscription
        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('stripe_subscription_id', invoice.subscription)
          .single();

        if (subscription) {
          // Create payment record
          const paymentData = {
            member_id: subscription.member_id,
            subscription_id: subscription.id,
            stripe_payment_intent_id: invoice.payment_intent,
            amount: invoice.amount_paid / 100,
            status: 'Succeeded',
            receipt_url: invoice.hosted_invoice_url || null,
            description: `Recurring payment - ${subscription.plan_type}`
          };
          
          const { error: paymentError } = await supabase
            .from('payments')
            .insert(paymentData);
          
          if (paymentError) {
            console.error('❌ Failed to create payment record:', paymentError);
          } else {
            console.log('✅ Payment record created');
          }
          
          // Update subscription
          const { error: updateError } = await supabase
            .from('subscriptions')
            .update({
              status: 'Active',
              current_period_end: new Date(invoice.period_end * 1000).toISOString()
            })
            .eq('id', subscription.id);
          
          if (updateError) {
            console.error('❌ Failed to update subscription:', updateError);
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = stripeEvent.data.object;
        console.log('=== PAYMENT FAILED ===');
        console.log('Invoice ID:', invoice.id);
        console.log('Amount:', invoice.amount_due / 100);
        
        // Find subscription
        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('stripe_subscription_id', invoice.subscription)
          .single();

        if (subscription) {
          // Create failed payment record
          const paymentData = {
            member_id: subscription.member_id,
            subscription_id: subscription.id,
            stripe_payment_intent_id: invoice.payment_intent,
            amount: invoice.amount_due / 100,
            status: 'Failed',
            description: `Failed payment - ${subscription.plan_type}`
          };
          
          const { error: paymentError } = await supabase
            .from('payments')
            .insert(paymentData);
          
          if (paymentError) {
            console.error('❌ Failed to create payment record:', paymentError);
          } else {
            console.log('✅ Failed payment record created');
          }
          
          // Update subscription status
          const { error: updateError } = await supabase
            .from('subscriptions')
            .update({ status: 'Past_Due' })
            .eq('id', subscription.id);
          
          if (updateError) {
            console.error('❌ Failed to update subscription:', updateError);
          }
        }
        break;
      }

      default:
        console.log(`ℹ️ Unhandled event type: ${stripeEvent.type}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true })
    };
  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    return {
      statusCode: 200, // Return 200 to prevent Stripe from retrying
      body: JSON.stringify({ 
        received: true,
        error: error.message 
      })
    };
  }
};