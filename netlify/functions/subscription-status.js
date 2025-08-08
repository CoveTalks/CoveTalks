// File: netlify/functions/subscription-status.js
const { tables } = require('./utils/airtable');
const { requireAuth } = require('./utils/auth');

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      },
      body: ''
    };
  }

  // Only allow GET
  if (event.httpMethod !== 'GET') {
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
    // Get user info
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

    // Initialize default subscription (Free plan)
    let subscription = {
      Plan_Type: 'Free',
      Status: 'Active',
      Amount: 0,
      Billing_Period: null,
      Next_Billing_Date: null,
      Start_Date: user.fields.Created_Date,
      End_Date: null
    };

    // Try to get active subscription from Subscriptions table
    try {
      const subscriptions = await tables.subscriptions.select({
        filterByFormula: `AND({Member_ID} = '${auth.userId}', {Status} = 'Active')`,
        sort: [{ field: 'Start_Date', direction: 'desc' }],
        maxRecords: 1
      }).all();

      if (subscriptions.length > 0) {
        const sub = subscriptions[0].fields;
        subscription = {
          Plan_Type: sub.Plan_Type || 'Free',
          Status: sub.Status || 'Active',
          Amount: sub.Amount || 0,
          Billing_Period: sub.Billing_Period || 'Monthly',
          Next_Billing_Date: sub.Next_Billing_Date,
          Start_Date: sub.Start_Date,
          End_Date: sub.End_Date,
          Stripe_Subscription_ID: sub.Stripe_Subscription_ID,
          Payment_Method: sub.Payment_Method
        };
      } else {
        // Check for cancelled or past_due subscriptions
        const inactiveSubscriptions = await tables.subscriptions.select({
          filterByFormula: `{Member_ID} = '${auth.userId}'`,
          sort: [{ field: 'End_Date', direction: 'desc' }],
          maxRecords: 1
        }).all();

        if (inactiveSubscriptions.length > 0) {
          const sub = inactiveSubscriptions[0].fields;
          if (sub.Status === 'Cancelled' || sub.Status === 'Past_Due') {
            // User had a subscription but it's no longer active
            subscription.Previous_Plan = sub.Plan_Type;
            subscription.Cancelled_Date = sub.End_Date;
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch subscription:', error);
      // Continue with default free subscription
    }

    // Calculate features based on plan
    const features = getPlanFeatures(subscription.Plan_Type);

    // Get payment history
    let paymentHistory = [];
    try {
      const payments = await tables.payments.select({
        filterByFormula: `{Member_ID} = '${auth.userId}'`,
        sort: [{ field: 'Payment_Date', direction: 'desc' }],
        maxRecords: 10
      }).all();

      paymentHistory = payments.map(payment => ({
        id: payment.id,
        amount: payment.fields.Amount,
        status: payment.fields.Status,
        date: payment.fields.Payment_Date,
        invoiceUrl: payment.fields.Invoice_URL
      }));
    } catch (error) {
      console.error('Failed to fetch payment history:', error);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        subscription,
        features,
        paymentHistory,
        userType: user.fields.Member_Type
      })
    };
  } catch (error) {
    console.error('Subscription status error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'Failed to fetch subscription status',
        message: error.message 
      })
    };
  }
};

// Helper function to get plan features
function getPlanFeatures(planType) {
  const features = {
    Free: {
      profileListing: true,
      opportunityApplications: 3, // per month
      profileHighlight: false,
      customBranding: false,
      analytics: 'Basic',
      support: 'Email'
    },
    Standard: {
      profileListing: true,
      opportunityApplications: 10,
      profileHighlight: false,
      customBranding: false,
      analytics: 'Enhanced',
      support: 'Priority Email'
    },
    Plus: {
      profileListing: true,
      opportunityApplications: 25,
      profileHighlight: true,
      customBranding: false,
      analytics: 'Advanced',
      support: 'Email & Chat'
    },
    Premium: {
      profileListing: true,
      opportunityApplications: 'Unlimited',
      profileHighlight: true,
      customBranding: true,
      analytics: 'Full',
      support: 'Priority Phone, Email & Chat'
    },
    Organization: {
      postOpportunities: 'Unlimited',
      searchSpeakers: true,
      directContact: true,
      teamMembers: 5,
      analytics: 'Full',
      support: 'Priority Email & Chat'
    }
  };

  return features[planType] || features.Free;
}