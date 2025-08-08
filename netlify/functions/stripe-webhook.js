// File: netlify/functions/stripe-webhook.js
// FIXED VERSION with better logging and Airtable integration

const { stripe } = require('./utils/stripe');
const { tables, createRecord, updateRecord, findByField } = require('./utils/airtable');

exports.handler = async (event) => {
  console.log('=== STRIPE WEBHOOK RECEIVED ===');
  console.log('Method:', event.httpMethod);
  console.log('Headers:', Object.keys(event.headers));
  
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

  // If no webhook secret, process without signature verification (for testing)
  let stripeEvent;
  
  if (webhookSecret && sig) {
    try {
      // Verify webhook signature
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
    // Parse without verification (development/testing only)
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
        console.log('Amount:', session.amount_total);
        console.log('Metadata:', session.metadata);
        
        const { airtable_id, plan_type, billing_period } = session.metadata || {};

        if (!airtable_id) {
          console.error('❌ No airtable_id in session metadata');
          // Try to find user by customer ID
          const customer = await stripe.customers.retrieve(session.customer);
          if (customer.metadata.airtable_id) {
            console.log('Found airtable_id in customer metadata:', customer.metadata.airtable_id);
            session.metadata.airtable_id = customer.metadata.airtable_id;
          } else {
            console.error('Could not find airtable_id');
            break;
          }
        }

        // Get the member record to verify it exists
        let member;
        try {
          member = await tables.members.find(airtable_id || session.metadata.airtable_id);
          if (!member) {
            console.error('❌ Member not found:', airtable_id);
            break;
          }
          console.log('✅ Member found:', member.fields.Name);
        } catch (error) {
          console.error('❌ Error finding member:', error);
          break;
        }

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
        
        console.log('Price details:', { priceId, amount, interval });

        // Determine plan type from price
        let planType = plan_type || 'Standard';
        let billingPeriod = billing_period || 'Monthly';
        
        if (priceId.includes('price_1RtaID')) planType = 'Standard';
        else if (priceId.includes('price_1RtaIp')) planType = 'Plus';
        else if (priceId.includes('price_1RtaKG')) planType = 'Premium';
        
        billingPeriod = interval === 'year' ? 'Yearly' : 'Monthly';

        console.log('Determined plan:', { planType, billingPeriod });

        // Check if subscription already exists
        let existingSubscription;
        try {
          const existingSubs = await tables.subscriptions.select({
            filterByFormula: `{Stripe_Subscription_ID} = '${subscription.id}'`,
            maxRecords: 1
          }).firstPage();
          
          if (existingSubs.length > 0) {
            existingSubscription = existingSubs[0];
            console.log('⚠️ Subscription already exists:', existingSubscription.id);
          }
        } catch (error) {
          console.error('Error checking existing subscription:', error);
        }

        // Create or update subscription record in Airtable
        if (!existingSubscription) {
          try {
            const subscriptionData = {
              Member_ID: [airtable_id || session.metadata.airtable_id],
              Stripe_Subscription_ID: subscription.id,
              Plan_Type: planType,
              Billing_Period: billingPeriod,
              Status: 'Active',
              Start_Date: new Date().toISOString().split('T')[0], // Format as YYYY-MM-DD
              Amount: amount,
              Next_Billing_Date: new Date(subscription.current_period_end * 1000).toISOString().split('T')[0],
              Payment_Method: subscription.default_payment_method || 'card'
            };
            
            console.log('Creating subscription with data:', subscriptionData);
            
            const subscriptionRecord = await createRecord(tables.subscriptions, subscriptionData);
            console.log('✅ Subscription record created:', subscriptionRecord.id);
            
            // Create initial payment record
            try {
              const paymentData = {
                Subscription_ID: [subscriptionRecord.id],
                Member_ID: [airtable_id || session.metadata.airtable_id],
                Stripe_Payment_Intent: session.payment_intent,
                Amount: session.amount_total / 100,
                Status: 'Succeeded',
                Payment_Date: new Date().toISOString().split('T')[0],
                Invoice_URL: subscription.latest_invoice ? 
                  (typeof subscription.latest_invoice === 'string' ? 
                    subscription.latest_invoice : 
                    subscription.latest_invoice.hosted_invoice_url) : '',
                Description: `Initial payment - ${planType} ${billingPeriod}`
              };
              
              console.log('Creating payment with data:', paymentData);
              
              const paymentRecord = await createRecord(tables.payments, paymentData);
              console.log('✅ Payment record created:', paymentRecord.id);
            } catch (paymentError) {
              console.error('❌ Failed to create payment record:', paymentError);
              console.error('Payment error details:', paymentError.message);
            }
          } catch (subError) {
            console.error('❌ Failed to create subscription record:', subError);
            console.error('Subscription error details:', subError.message);
          }
        }

        // Update member record with subscription status
        try {
          const memberUpdate = {
            Subscription_Status: 'Active',
            Current_Plan: planType
          };
          
          // Only update Stripe_Customer_ID if it's not already set
          if (!member.fields.Stripe_Customer_ID) {
            memberUpdate.Stripe_Customer_ID = session.customer;
          }
          
          await updateRecord(tables.members, airtable_id || session.metadata.airtable_id, memberUpdate);
          console.log('✅ Member record updated');
        } catch (updateError) {
          console.error('❌ Failed to update member:', updateError);
        }
        
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = stripeEvent.data.object;
        console.log('=== SUBSCRIPTION UPDATED ===');
        console.log('Subscription ID:', subscription.id);
        console.log('Status:', subscription.status);
        
        try {
          // Find subscription in Airtable
          const airtableSubs = await tables.subscriptions.select({
            filterByFormula: `{Stripe_Subscription_ID} = '${subscription.id}'`,
            maxRecords: 1
          }).firstPage();

          if (airtableSubs.length > 0) {
            const airtableSubscription = airtableSubs[0];
            
            // Update subscription details
            const updates = {
              Status: subscription.status === 'active' ? 'Active' : 
                     subscription.status === 'past_due' ? 'Past_Due' : 
                     subscription.status === 'canceled' ? 'Cancelled' : 
                     'Other',
              Next_Billing_Date: new Date(subscription.current_period_end * 1000).toISOString().split('T')[0]
            };

            await updateRecord(tables.subscriptions, airtableSubscription.id, updates);
            console.log('✅ Subscription updated in Airtable');
            
            // Update member subscription status
            if (airtableSubscription.fields.Member_ID && airtableSubscription.fields.Member_ID[0]) {
              await updateRecord(tables.members, airtableSubscription.fields.Member_ID[0], {
                Subscription_Status: updates.Status
              });
              console.log('✅ Member status updated');
            }
          } else {
            console.log('⚠️ Subscription not found in Airtable');
          }
        } catch (error) {
          console.error('❌ Error updating subscription:', error);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = stripeEvent.data.object;
        console.log('=== SUBSCRIPTION CANCELLED ===');
        console.log('Subscription ID:', subscription.id);
        
        try {
          // Find and update subscription in Airtable
          const airtableSubs = await tables.subscriptions.select({
            filterByFormula: `{Stripe_Subscription_ID} = '${subscription.id}'`,
            maxRecords: 1
          }).firstPage();

          if (airtableSubs.length > 0) {
            const airtableSubscription = airtableSubs[0];
            
            await updateRecord(tables.subscriptions, airtableSubscription.id, {
              Status: 'Cancelled',
              End_Date: new Date().toISOString().split('T')[0]
            });
            console.log('✅ Subscription cancelled in Airtable');
            
            // Update member subscription status
            if (airtableSubscription.fields.Member_ID && airtableSubscription.fields.Member_ID[0]) {
              await updateRecord(tables.members, airtableSubscription.fields.Member_ID[0], {
                Subscription_Status: 'Cancelled',
                Current_Plan: null
              });
              console.log('✅ Member status updated to cancelled');
            }
          }
        } catch (error) {
          console.error('❌ Error cancelling subscription:', error);
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
        
        try {
          // Find subscription
          const airtableSubs = await tables.subscriptions.select({
            filterByFormula: `{Stripe_Subscription_ID} = '${invoice.subscription}'`,
            maxRecords: 1
          }).firstPage();

          if (airtableSubs.length > 0) {
            const subscription = airtableSubs[0];
            
            // Create payment record
            const paymentData = {
              Subscription_ID: [subscription.id],
              Member_ID: subscription.fields.Member_ID,
              Stripe_Payment_Intent: invoice.payment_intent,
              Amount: invoice.amount_paid / 100,
              Status: 'Succeeded',
              Payment_Date: new Date().toISOString().split('T')[0],
              Invoice_URL: invoice.hosted_invoice_url || '',
              Invoice_Number: invoice.number || '',
              Description: `Recurring payment - ${subscription.fields.Plan_Type} ${subscription.fields.Billing_Period}`
            };
            
            await createRecord(tables.payments, paymentData);
            console.log('✅ Payment record created');
            
            // Update subscription next billing date
            await updateRecord(tables.subscriptions, subscription.id, {
              Next_Billing_Date: new Date(invoice.period_end * 1000).toISOString().split('T')[0],
              Status: 'Active'
            });
            
            // Ensure member status is active
            if (subscription.fields.Member_ID && subscription.fields.Member_ID[0]) {
              await updateRecord(tables.members, subscription.fields.Member_ID[0], {
                Subscription_Status: 'Active'
              });
            }
          }
        } catch (error) {
          console.error('❌ Error creating payment record:', error);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = stripeEvent.data.object;
        console.log('=== PAYMENT FAILED ===');
        console.log('Invoice ID:', invoice.id);
        console.log('Amount:', invoice.amount_due / 100);
        
        try {
          // Find subscription
          const airtableSubs = await tables.subscriptions.select({
            filterByFormula: `{Stripe_Subscription_ID} = '${invoice.subscription}'`,
            maxRecords: 1
          }).firstPage();

          if (airtableSubs.length > 0) {
            const subscription = airtableSubs[0];
            
            // Create failed payment record
            const paymentData = {
              Subscription_ID: [subscription.id],
              Member_ID: subscription.fields.Member_ID,
              Stripe_Payment_Intent: invoice.payment_intent,
              Amount: invoice.amount_due / 100,
              Status: 'Failed',
              Payment_Date: new Date().toISOString().split('T')[0],
              Description: `Failed payment - ${subscription.fields.Plan_Type}`
            };
            
            await createRecord(tables.payments, paymentData);
            console.log('✅ Failed payment record created');
            
            // Update subscription status
            await updateRecord(tables.subscriptions, subscription.id, {
              Status: 'Past_Due'
            });
            
            // Update member status
            if (subscription.fields.Member_ID && subscription.fields.Member_ID[0]) {
              await updateRecord(tables.members, subscription.fields.Member_ID[0], {
                Subscription_Status: 'Past_Due'
              });
            }
          }
        } catch (error) {
          console.error('❌ Error recording failed payment:', error);
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
    console.error('Error stack:', error.stack);
    return {
      statusCode: 200, // Return 200 to prevent Stripe from retrying
      body: JSON.stringify({ 
        received: true,
        error: error.message 
      })
    };
  }
};