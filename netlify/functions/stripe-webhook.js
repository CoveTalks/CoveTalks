// File: netlify/functions/stripe-webhook.js
const { stripe } = require('./utils/stripe');
const { tables, createRecord, updateRecord, findByField } = require('./utils/airtable');

exports.handler = async (event) => {
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

  if (!sig || !webhookSecret) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing stripe signature or webhook secret' })
    };
  }

  try {
    // Verify webhook signature and extract event
    const stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      webhookSecret
    );

    // Handle different event types
    switch (stripeEvent.type) {
      case 'checkout.session.completed': {
        const session = stripeEvent.data.object;
        console.log('Checkout session completed:', session.id);
        
        const { airtable_id, plan_type, billing_period } = session.metadata;

        if (!airtable_id) {
          console.error('No airtable_id in session metadata');
          break;
        }

        // Create subscription record in Airtable
        try {
          // Get subscription details from Stripe
          const subscription = await stripe.subscriptions.retrieve(session.subscription);
          
          // Calculate next billing date
          const nextBillingDate = new Date(subscription.current_period_end * 1000);
          
          // Create subscription record
          const subscriptionRecord = await createRecord(tables.subscriptions, {
            Member_ID: [airtable_id],
            Stripe_Subscription_ID: session.subscription,
            Plan_Type: plan_type || 'Standard',
            Billing_Period: billing_period || 'Monthly',
            Status: 'Active',
            Start_Date: new Date().toISOString(),
            Amount: session.amount_total ? session.amount_total / 100 : 0,
            Next_Billing_Date: nextBillingDate.toISOString(),
            Payment_Method: session.payment_method_types ? session.payment_method_types[0] : 'card'
          });
          
          console.log('Subscription created:', subscriptionRecord.id);

          // Update member status to Premium/Active
          await updateRecord(tables.members, airtable_id, {
            Subscription_Status: 'Active',
            Current_Plan: plan_type
          });
        } catch (error) {
          console.error('Error creating subscription record:', error);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = stripeEvent.data.object;
        console.log('Subscription updated:', subscription.id);
        
        // Find subscription in Airtable
        const airtableSubscription = await findByField(
          tables.subscriptions,
          'Stripe_Subscription_ID',
          subscription.id
        );

        if (airtableSubscription) {
          // Update subscription details
          const updates = {
            Status: subscription.status === 'active' ? 'Active' : 
                   subscription.status === 'past_due' ? 'Past_Due' : 
                   subscription.status === 'canceled' ? 'Cancelled' : 
                   subscription.status,
            Next_Billing_Date: new Date(subscription.current_period_end * 1000).toISOString()
          };

          // Update plan if changed
          if (subscription.items && subscription.items.data[0]) {
            const priceId = subscription.items.data[0].price.id;
            // Map price ID to plan type (you'll need to maintain this mapping)
            // updates.Plan_Type = mapPriceIdToPlanType(priceId);
          }

          await updateRecord(tables.subscriptions, airtableSubscription.id, updates);
          
          // Update member subscription status
          if (airtableSubscription.fields.Member_ID && airtableSubscription.fields.Member_ID[0]) {
            await updateRecord(tables.members, airtableSubscription.fields.Member_ID[0], {
              Subscription_Status: updates.Status === 'Active' ? 'Active' : 'Inactive'
            });
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = stripeEvent.data.object;
        console.log('Subscription cancelled:', subscription.id);
        
        // Find and update subscription in Airtable
        const airtableSubscription = await findByField(
          tables.subscriptions,
          'Stripe_Subscription_ID',
          subscription.id
        );

        if (airtableSubscription) {
          await updateRecord(tables.subscriptions, airtableSubscription.id, {
            Status: 'Cancelled',
            End_Date: new Date().toISOString()
          });
          
          // Update member subscription status
          if (airtableSubscription.fields.Member_ID && airtableSubscription.fields.Member_ID[0]) {
            await updateRecord(tables.members, airtableSubscription.fields.Member_ID[0], {
              Subscription_Status: 'Cancelled',
              Current_Plan: null
            });
          }
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = stripeEvent.data.object;
        console.log('Payment succeeded:', invoice.id);
        
        // Skip if this is the first payment (handled by checkout.session.completed)
        if (invoice.billing_reason === 'subscription_create') {
          break;
        }
        
        // Find subscription
        const subscription = await findByField(
          tables.subscriptions,
          'Stripe_Subscription_ID',
          invoice.subscription
        );

        if (subscription) {
          // Create payment record
          try {
            await createRecord(tables.payments, {
              Subscription_ID: [subscription.id],
              Member_ID: subscription.fields.Member_ID,
              Stripe_Payment_Intent: invoice.payment_intent,
              Amount: invoice.amount_paid / 100,
              Status: 'Succeeded',
              Payment_Date: new Date().toISOString(),
              Invoice_URL: invoice.hosted_invoice_url,
              Invoice_Number: invoice.number,
              Description: `${subscription.fields.Plan_Type} - ${subscription.fields.Billing_Period}`
            });
            
            // Update subscription next billing date
            await updateRecord(tables.subscriptions, subscription.id, {
              Next_Billing_Date: new Date(invoice.period_end * 1000).toISOString(),
              Status: 'Active'
            });
            
            // Ensure member status is active
            if (subscription.fields.Member_ID && subscription.fields.Member_ID[0]) {
              await updateRecord(tables.members, subscription.fields.Member_ID[0], {
                Subscription_Status: 'Active'
              });
            }
          } catch (error) {
            console.error('Error creating payment record:', error);
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = stripeEvent.data.object;
        console.log('Payment failed:', invoice.id);
        
        // Find subscription
        const subscription = await findByField(
          tables.subscriptions,
          'Stripe_Subscription_ID',
          invoice.subscription
        );

        if (subscription) {
          // Create failed payment record
          try {
            await createRecord(tables.payments, {
              Subscription_ID: [subscription.id],
              Member_ID: subscription.fields.Member_ID,
              Stripe_Payment_Intent: invoice.payment_intent,
              Amount: invoice.amount_due / 100,
              Status: 'Failed',
              Payment_Date: new Date().toISOString(),
              Description: `Failed payment - ${subscription.fields.Plan_Type}`
            });
            
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
          } catch (error) {
            console.error('Error creating failed payment record:', error);
          }
        }
        break;
      }

      case 'customer.subscription.trial_will_end': {
        const subscription = stripeEvent.data.object;
        console.log('Trial ending soon:', subscription.id);
        
        // TODO: Send email notification to user about trial ending
        // This could trigger an Airtable automation or send email directly
        break;
      }

      default:
        console.log(`Unhandled event type: ${stripeEvent.type}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true })
    };
  } catch (error) {
    console.error('Webhook error:', error);
    return {
      statusCode: 400,
      body: JSON.stringify({ 
        error: 'Webhook processing failed',
        message: error.message 
      })
    };
  }
};