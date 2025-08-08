// File: netlify/functions/stripe-sync-subscription.js
// Manual sync function to ensure subscription data is in Airtable

const { stripe } = require('./utils/stripe');
const { tables, createRecord, updateRecord } = require('./utils/airtable');
const { requireAuth } = require('./utils/auth');

exports.handler = async (event) => {
  console.log('=== STRIPE SYNC SUBSCRIPTION ===');
  
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
    console.log('User ID:', auth.userId);
    
    // Get user from Airtable
    const member = await tables.members.find(auth.userId);
    if (!member) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'User not found' 
        })
      };
    }

    const customerId = member.fields.Stripe_Customer_ID;
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
        // Check if subscription exists in Airtable
        const existingSubs = await tables.subscriptions.select({
          filterByFormula: `{Stripe_Subscription_ID} = '${subscription.id}'`,
          maxRecords: 1
        }).firstPage();

        // Extract plan details
        const priceId = subscription.items.data[0].price.id;
        const amount = subscription.items.data[0].price.unit_amount / 100;
        const interval = subscription.items.data[0].price.recurring.interval;
        
        // Determine plan type from price ID
        let planType = 'Standard';
        if (priceId.includes('price_1RtaID')) planType = 'Standard';
        else if (priceId.includes('price_1RtaIp')) planType = 'Plus';
        else if (priceId.includes('price_1RtaKG')) planType = 'Premium';
        
        const billingPeriod = interval === 'year' ? 'Yearly' : 'Monthly';

        if (existingSubs.length === 0) {
          // Create new subscription record
          console.log('Creating new subscription record');
          
          const subscriptionData = {
            Member_ID: [auth.userId],
            Stripe_Subscription_ID: subscription.id,
            Plan_Type: planType,
            Billing_Period: billingPeriod,
            Status: subscription.status === 'active' ? 'Active' : 
                   subscription.status === 'past_due' ? 'Past_Due' : 
                   subscription.status === 'canceled' ? 'Cancelled' : 
                   'Other',
            Start_Date: new Date(subscription.created * 1000).toISOString().split('T')[0],
            Amount: amount,
            Next_Billing_Date: subscription.current_period_end ? 
              new Date(subscription.current_period_end * 1000).toISOString().split('T')[0] : null,
            Payment_Method: subscription.default_payment_method || 'card'
          };

          if (subscription.canceled_at) {
            subscriptionData.End_Date = new Date(subscription.canceled_at * 1000).toISOString().split('T')[0];
          }

          const newRecord = await createRecord(tables.subscriptions, subscriptionData);
          results.created.push({
            id: newRecord.id,
            stripe_id: subscription.id,
            status: subscription.status
          });

          // If this is the active subscription, also check for initial payment
          if (subscription.status === 'active' && subscription.latest_invoice) {
            await syncInvoicePayment(subscription.latest_invoice, newRecord.id, auth.userId);
          }
        } else {
          // Update existing subscription record
          console.log('Updating existing subscription record');
          const existingRecord = existingSubs[0];
          
          const updates = {
            Status: subscription.status === 'active' ? 'Active' : 
                   subscription.status === 'past_due' ? 'Past_Due' : 
                   subscription.status === 'canceled' ? 'Cancelled' : 
                   'Other',
            Plan_Type: planType,
            Billing_Period: billingPeriod,
            Amount: amount
          };

          if (subscription.current_period_end) {
            updates.Next_Billing_Date = new Date(subscription.current_period_end * 1000).toISOString().split('T')[0];
          }

          if (subscription.canceled_at && !existingRecord.fields.End_Date) {
            updates.End_Date = new Date(subscription.canceled_at * 1000).toISOString().split('T')[0];
          }

          await updateRecord(tables.subscriptions, existingRecord.id, updates);
          results.updated.push({
            id: existingRecord.id,
            stripe_id: subscription.id,
            status: subscription.status
          });
        }

        // Update member status based on active subscription
        if (subscription.status === 'active') {
          await updateRecord(tables.members, auth.userId, {
            Subscription_Status: 'Active',
            Current_Plan: planType
          });
        }
      } catch (error) {
        console.error(`Error processing subscription ${subscription.id}:`, error);
        results.errors.push({
          stripe_id: subscription.id,
          error: error.message
        });
      }
    }

    // If no active subscriptions found, update member status
    const hasActiveSubscription = subscriptions.data.some(s => s.status === 'active');
    if (!hasActiveSubscription) {
      await updateRecord(tables.members, auth.userId, {
        Subscription_Status: 'Inactive',
        Current_Plan: null
      });
    }

    // Sync recent payments
    if (customerId) {
      await syncRecentPayments(customerId, auth.userId);
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
    const existingPayments = await tables.payments.select({
      filterByFormula: `{Stripe_Payment_Intent} = '${invoice.payment_intent}'`,
      maxRecords: 1
    }).firstPage();

    if (existingPayments.length === 0 && invoice.status === 'paid') {
      // Create payment record
      const paymentData = {
        Subscription_ID: [subscriptionRecordId],
        Member_ID: [memberId],
        Stripe_Payment_Intent: invoice.payment_intent,
        Amount: invoice.amount_paid / 100,
        Status: 'Succeeded',
        Payment_Date: new Date(invoice.created * 1000).toISOString().split('T')[0],
        Invoice_URL: invoice.hosted_invoice_url || '',
        Invoice_Number: invoice.number || '',
        Description: `Payment for invoice ${invoice.number || invoiceId}`
      };

      await createRecord(tables.payments, paymentData);
      console.log('Payment record created for invoice:', invoiceId);
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
        const existingPayments = await tables.payments.select({
          filterByFormula: `OR({Stripe_Payment_Intent} = '${charge.payment_intent}', {Invoice_Number} = '${charge.invoice}')`,
          maxRecords: 1
        }).firstPage();

        if (existingPayments.length === 0) {
          // Find the subscription record
          const subscriptions = await tables.subscriptions.select({
            filterByFormula: `{Member_ID} = '${memberId}'`,
            sort: [{ field: 'Start_Date', direction: 'desc' }],
            maxRecords: 1
          }).firstPage();

          if (subscriptions.length > 0) {
            const paymentData = {
              Subscription_ID: [subscriptions[0].id],
              Member_ID: [memberId],
              Stripe_Payment_Intent: charge.payment_intent,
              Amount: charge.amount / 100,
              Status: 'Succeeded',
              Payment_Date: new Date(charge.created * 1000).toISOString().split('T')[0],
              Description: charge.description || 'Subscription payment'
            };

            await createRecord(tables.payments, paymentData);
            console.log('Payment record created for charge:', charge.id);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error syncing recent payments:', error);
  }
}