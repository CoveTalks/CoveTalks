// File: netlify/functions/subscription-status.js
// FIXED VERSION - Correctly handles Member_ID lookup
const { tables } = require('./utils/airtable');
const { requireAuth } = require('./utils/auth');
exports.handler = async (event) => {
console.log('[Subscription Status] Function called');
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
// Verify authentication
const auth = await requireAuth(event);
if (auth.statusCode) {
return {
statusCode: 200,
headers,
body: JSON.stringify({
success: true,
subscription: {
Plan_Type: 'Free',
Status: 'Active',
Amount: 0
},
features: getPlanFeatures('Free'),
paymentHistory: []
})
};
}
console.log('[Subscription Status] Auth successful, userId:', auth.userId);

// Get user info
let user = null;
try {
  user = await tables.members.find(auth.userId);
  console.log('[Subscription Status] User found:', !!user);
  if (user) {
    console.log('[Subscription Status] User Member_ID (autonumber):', user.fields.Member_ID);
  }
} catch (error) {
  console.error('[Subscription Status] Error finding user:', error);
}

if (!user) {
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      subscription: {
        Plan_Type: 'Free',
        Status: 'Active',
        Amount: 0
      },
      features: getPlanFeatures('Free'),
      paymentHistory: [],
      userType: 'Unknown'
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
  Start_Date: user.fields.Created_Date
};

// FIXED: Search for subscription using the Member_ID autonumber
try {
  console.log('[Subscription Status] Checking for active subscription...');
  
  // Get the Member_ID autonumber from the user record
  const memberIdNumber = user.fields.Member_ID;
  console.log('[Subscription Status] Searching for subscription with Member_ID:', memberIdNumber);
  
  // Two search approaches to handle both linked field and text field scenarios
  let subscriptions = [];
  
  // First try: If Member_ID is stored as a linked record field
  try {
    subscriptions = await tables.subscriptions.select({
      filterByFormula: `AND(SEARCH('${auth.userId}', ARRAYJOIN({Member_ID})), {Status} = 'Active')`,
      sort: [{ field: 'Start_Date', direction: 'desc' }],
      maxRecords: 1
    }).all();
    console.log('[Subscription Status] Linked field search found:', subscriptions.length);
  } catch (e) {
    console.log('[Subscription Status] Linked field search failed, trying number field search');
  }
  
  // Second try: If Member_ID is stored as the autonumber
  if (subscriptions.length === 0 && memberIdNumber) {
    subscriptions = await tables.subscriptions.select({
      filterByFormula: `AND({Member_ID} = ${memberIdNumber}, {Status} = 'Active')`,
      sort: [{ field: 'Start_Date', direction: 'desc' }],
      maxRecords: 1
    }).all();
    console.log('[Subscription Status] Number field search found:', subscriptions.length);
  }

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
      Stripe_Subscription_ID: sub.Stripe_Subscription_ID
    };
    console.log('[Subscription Status] Active subscription found:', subscription.Plan_Type, subscription.Billing_Period);
  } else {
    console.log('[Subscription Status] No active subscription found');
  }
} catch (error) {
  console.error('[Subscription Status] Error fetching subscription:', error);
  // Continue with default free subscription
}

// Calculate features based on plan
const features = getPlanFeatures(subscription.Plan_Type);

// Get payment history - using same fix for Member_ID
let paymentHistory = [];
try {
  const memberIdNumber = user.fields.Member_ID;
  
  // Try with Member_ID number first
  if (memberIdNumber) {
    const payments = await tables.payments.select({
      filterByFormula: `{Member_ID} = ${memberIdNumber}`,
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
    
    console.log('[Subscription Status] Found payments:', paymentHistory.length);
  }
} catch (error) {
  console.error('[Subscription Status] Error fetching payment history:', error);
}

console.log('[Subscription Status] Returning subscription data');

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
console.error('[Subscription Status] Unexpected error:', error);
// Return free plan as fallback
return {
  statusCode: 200,
  headers,
  body: JSON.stringify({
    success: true,
    subscription: {
      Plan_Type: 'Free',
      Status: 'Active',
      Amount: 0
    },
    features: getPlanFeatures('Free'),
    paymentHistory: [],
    error: 'Service temporarily unavailable'
  })
};
}
};
// Helper function to get plan features
function getPlanFeatures(planType) {
const features = {
Free: {
profileListing: true,
opportunityApplications: 3,
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
}
};
return features[planType] || features.Free;
}