const { stripe } = require('./utils/stripe');
const { tables, createRecord, updateRecord, findByField } = require('./utils/airtable');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed'
    };
  }

  const sig = event.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return {
      statusCode: 400,
      body: `Webhook Error: ${err.message}`
    };
  }

  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed': {
        const session = stripeEvent.data.object;
        const { airtable_id, plan_type, billing_period } = session.metadata;

        await createRecord(tables.subscriptions, {
          Member_ID: [airtable_id],
          Stripe_Subscription_ID: session.subscription,
          Plan_Type: plan_type,
          Billing_Period: billing_period,
          Status: 'Active',
          Start_Date: new Date().toISOString(),
          Amount: session.amount_total / 100,
          Next_Billing_Date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        });

        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = stripeEvent.data.object;

        const subscription = await findByField(
          tables.subscriptions,
          'Stripe_Subscription_ID',
          invoice.subscription
        );

        if (subscription) {
          await createRecord(tables.payments, {
            Subscription_ID: [subscription.id],
            Member_ID: subscription.fields.Member_ID,
            Stripe_Payment_Intent: invoice.payment_intent,
            Amount: invoice.amount_paid / 100,
            Status: 'Succeeded',
            Payment_Date: new Date().toISOString(),
            Invoice_URL: invoice.hosted_invoice_url
          });
        }

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = stripeEvent.data.object;

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
        }

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
    console.error('Webhook processing error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' })
    };
  }
};
