// File: netlify/functions/stripe-payment-methods.js
// Fetch and manage payment methods from Stripe

const { stripe } = require('./utils/stripe');
const { requireAuth } = require('./utils/auth');
const { tables } = require('./utils/airtable');

exports.handler = async (event) => {
  console.log('=== STRIPE PAYMENT METHODS ===');
  console.log('Method:', event.httpMethod);
  
  // Handle CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
      },
      body: ''
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
    // Get user to find their Stripe customer ID
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
          error: 'Payment methods are only available for speakers',
          message: 'Organizations use CoveTalks for free.'
        })
      };
    }

    const customerId = user.fields.Stripe_Customer_ID;

    // Handle different HTTP methods
    switch (event.httpMethod) {
      case 'GET':
        return await getPaymentMethods(customerId, headers);
      
      case 'POST':
        return await setDefaultPaymentMethod(event, customerId, headers);
      
      case 'DELETE':
        return await removePaymentMethod(event, customerId, headers);
      
      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
  } catch (error) {
    console.error('Payment methods error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'Failed to process payment methods',
        message: error.message 
      })
    };
  }
};

// Get all payment methods for a customer
async function getPaymentMethods(customerId, headers) {
  try {
    if (!customerId) {
      console.log('No Stripe customer ID found');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true,
          paymentMethods: [],
          message: 'No payment methods on file. Add one through the billing portal.'
        })
      };
    }

    console.log('Fetching payment methods for customer:', customerId);

    // Get payment methods from Stripe
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card'
    });

    console.log(`Found ${paymentMethods.data.length} payment methods`);

    // Get customer's default payment method
    let defaultPaymentMethodId = null;
    try {
      const customer = await stripe.customers.retrieve(customerId);
      defaultPaymentMethodId = customer.invoice_settings?.default_payment_method;
      
      // Also check subscriptions for default payment method
      if (!defaultPaymentMethodId) {
        const subscriptions = await stripe.subscriptions.list({
          customer: customerId,
          limit: 1
        });
        
        if (subscriptions.data.length > 0) {
          defaultPaymentMethodId = subscriptions.data[0].default_payment_method;
        }
      }
    } catch (error) {
      console.error('Error fetching customer default payment method:', error);
    }

    // Format payment methods for response
    const formattedMethods = paymentMethods.data.map(pm => ({
      id: pm.id,
      type: pm.type,
      card: {
        brand: pm.card.brand,
        last4: pm.card.last4,
        expMonth: pm.card.exp_month,
        expYear: pm.card.exp_year,
        funding: pm.card.funding
      },
      isDefault: pm.id === defaultPaymentMethodId,
      created: pm.created
    }));

    // Sort so default is first
    formattedMethods.sort((a, b) => {
      if (a.isDefault) return -1;
      if (b.isDefault) return 1;
      return b.created - a.created;
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        paymentMethods: formattedMethods,
        customerId: customerId
      })
    };
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    throw error;
  }
}

// Set a payment method as default
async function setDefaultPaymentMethod(event, customerId, headers) {
  try {
    const { paymentMethodId } = JSON.parse(event.body);

    if (!paymentMethodId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Payment method ID required' 
        })
      };
    }

    if (!customerId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'No Stripe customer found. Please add a payment method first.' 
        })
      };
    }

    console.log('Setting default payment method:', paymentMethodId);

    // Update customer's default payment method
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId
      }
    });

    // Also update any active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active'
    });

    for (const subscription of subscriptions.data) {
      await stripe.subscriptions.update(subscription.id, {
        default_payment_method: paymentMethodId
      });
    }

    console.log('Default payment method updated successfully');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Default payment method updated successfully'
      })
    };
  } catch (error) {
    console.error('Error setting default payment method:', error);
    throw error;
  }
}

// Remove a payment method
async function removePaymentMethod(event, customerId, headers) {
  try {
    const { paymentMethodId } = JSON.parse(event.body);

    if (!paymentMethodId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Payment method ID required' 
        })
      };
    }

    console.log('Removing payment method:', paymentMethodId);

    // Check if this is the only payment method
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card'
    });

    if (paymentMethods.data.length === 1) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Cannot remove the only payment method. Add another one first.' 
        })
      };
    }

    // Check if this is the default payment method
    const customer = await stripe.customers.retrieve(customerId);
    const isDefault = customer.invoice_settings?.default_payment_method === paymentMethodId;

    if (isDefault) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Cannot remove the default payment method. Set another as default first.' 
        })
      };
    }

    // Detach the payment method
    await stripe.paymentMethods.detach(paymentMethodId);

    console.log('Payment method removed successfully');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Payment method removed successfully'
      })
    };
  } catch (error) {
    console.error('Error removing payment method:', error);
    throw error;
  }
}