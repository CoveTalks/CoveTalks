// File: netlify/functions/auth-login-smart.js
// Hybrid Smart Login - Loads only what's needed for the destination

const { tables, findByField, updateRecord, getBatchSpecialties } = require('./utils/airtable');
const { verifyPassword, generateToken } = require('./utils/auth');

// Minimal logging in production
const DEBUG = process.env.NODE_ENV === 'development';
const log = DEBUG ? console.log : () => {};

exports.handler = async (event) => {
  log('🚀 Smart Login Started');
  
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
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  try {
    const startTime = Date.now();
    const { email, password, destination = 'auto' } = JSON.parse(event.body);
    
    log(`📧 Login attempt for: ${email}, destination: ${destination}`);

    // Validate input
    if (!email || !password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Email and password required' 
        })
      };
    }

    // STEP 1: Find user (can't optimize this)
    const user = await findByField(tables.members, 'Email', email);
    
    if (!user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Invalid credentials' 
        })
      };
    }

    // STEP 2: Check account status
    if (user.fields.Status !== 'Active') {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Account is not active. Please contact support.' 
        })
      };
    }

    // STEP 3: Verify password
    const isValid = await verifyPassword(password, user.fields.Password_Hash);
    
    if (!isValid) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Invalid credentials' 
        })
      };
    }

    // STEP 4: Update last login (fire and forget - don't await)
    updateRecord(tables.members, user.id, {
      Last_Login: new Date().toISOString().split('T')[0]
    }).catch(err => log('Failed to update last login:', err));

    // STEP 5: Generate JWT token
    const token = generateToken(user.id, email);

    // STEP 6: Determine what data to load based on destination
    const userType = user.fields.Member_Type;
    const smartDestination = destination === 'auto' 
      ? (userType === 'Organization' ? 'org-dashboard' : 'dashboard')
      : destination;

    log(`🎯 Smart loading for destination: ${smartDestination}`);

    // Base user data (always included)
    const baseUserData = {
      id: user.id,
      memberId: user.fields.Member_ID,
      name: user.fields.Name,
      email: user.fields.Email,
      memberType: userType,
      status: user.fields.Status,
      location: user.fields.Location || null,
      bio: user.fields.Bio || null,
      website: user.fields.Website || null,
      profileImage: user.fields.Profile_Image ? user.fields.Profile_Image[0]?.url : null,
      bookingLink: user.fields.Booking_Link || null
    };

    // Determine what additional data to load
    const loadPlan = getLoadPlan(smartDestination, userType);
    log(`📦 Load plan: ${JSON.stringify(loadPlan)}`);

    // Execute parallel data fetching based on load plan
    const additionalData = await loadDataForPlan(user, loadPlan);

    // Merge additional data into user object
    const userData = {
      ...baseUserData,
      ...additionalData.immediate
    };

    const elapsed = Date.now() - startTime;
    log(`✅ Smart login completed in ${elapsed}ms`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        token,
        user: userData,
        destination: smartDestination,
        deferred: additionalData.deferred,
        timing: elapsed,
        message: 'Login successful'
      })
    };
  } catch (error) {
    console.error('❌ Smart login error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'Login failed',
        message: error.message
      })
    };
  }
};

// Determine what data to load based on destination
function getLoadPlan(destination, userType) {
  const plans = {
    'dashboard': {
      immediate: ['subscription'],
      deferred: ['specialties', 'reviews']
    },
    'org-dashboard': {
      immediate: ['organization'],
      deferred: ['opportunities']
    },
    'profile': {
      immediate: ['specialties', 'reviews'],
      deferred: ['subscription']
    },
    'billing': {
      immediate: ['subscription', 'payments'],
      deferred: ['specialties']
    },
    'opportunities': {
      immediate: ['subscription'],
      deferred: ['specialties', 'applications']
    },
    'settings': {
      immediate: ['specialties'],
      deferred: ['subscription']
    },
    'minimal': {
      immediate: [],
      deferred: ['subscription', 'specialties', 'organization']
    }
  };

  // Default plans if destination not found
  const defaultPlan = userType === 'Organization' 
    ? plans['org-dashboard'] 
    : plans['dashboard'];

  return plans[destination] || defaultPlan;
}

// Load data based on the plan
async function loadDataForPlan(user, loadPlan) {
  const immediate = {};
  const deferred = [];
  const promises = [];

  // Load immediate data in parallel
  if (loadPlan.immediate.includes('subscription') && user.fields.Member_Type === 'Speaker') {
    promises.push(
      loadSubscription(user.id).then(data => {
        immediate.subscription = data;
      })
    );
  }

  if (loadPlan.immediate.includes('organization') && user.fields.Member_Type === 'Organization') {
    promises.push(
      loadOrganization(user.id).then(data => {
        immediate.organization = data.organization;
        immediate.organizationDetails = data.organizationDetails;
      })
    );
  }

  if (loadPlan.immediate.includes('specialties') && user.fields.Specialty?.length > 0) {
    promises.push(
      loadSpecialties(user.fields.Specialty).then(data => {
        immediate.specialty = data;
      })
    );
  }

  if (loadPlan.immediate.includes('reviews') && user.fields.Member_Type === 'Speaker') {
    promises.push(
      loadReviews(user.id).then(data => {
        immediate.reviews = data.reviews;
        immediate.averageRating = data.averageRating;
        immediate.totalReviews = data.totalReviews;
      })
    );
  }

  if (loadPlan.immediate.includes('payments') && user.fields.Member_Type === 'Speaker') {
    promises.push(
      loadPayments(user.id).then(data => {
        immediate.payments = data;
      })
    );
  }

  // Wait for all immediate data to load
  await Promise.all(promises);

  // Mark deferred items for background loading
  for (const item of loadPlan.deferred) {
    // Only add to deferred if not already loaded
    if (!immediate[item]) {
      deferred.push(item);
    }
  }

  return { immediate, deferred };
}

// Individual data loaders
async function loadSubscription(userId) {
  try {
    const subscriptions = await tables.subscriptions.select({
      filterByFormula: `AND({Member_ID} = '${userId}', {Status} = 'Active')`,
      maxRecords: 1
    }).firstPage();
    
    if (subscriptions.length > 0) {
      const sub = subscriptions[0].fields;
      return {
        plan: sub.Plan_Type,
        status: sub.Status,
        billingPeriod: sub.Billing_Period,
        nextBilling: sub.Next_Billing_Date,
        amount: sub.Amount
      };
    }
    return null;
  } catch (error) {
    log('Failed to load subscription:', error);
    return null;
  }
}

async function loadOrganization(userId) {
  try {
    const orgRecords = await tables.organizations.select({
      filterByFormula: `SEARCH('${userId}', ARRAYJOIN({Member_ID}))`,
      maxRecords: 1
    }).firstPage();
    
    if (orgRecords.length > 0) {
      const org = orgRecords[0].fields;
      return {
        organization: {
          orgId: orgRecords[0].id,
          organizationName: org.Organization_Name,
          organizationType: org.Organization_Type,
          contactName: org.Contact_Name
        },
        organizationDetails: {
          id: orgRecords[0].id,
          organizationName: org.Organization_Name,
          organizationType: org.Organization_Type,
          contactName: org.Contact_Name,
          speakingTopics: org.Speaking_Topics || [],
          eventFrequency: org.Event_Frequency
        }
      };
    }
    return { organization: null, organizationDetails: null };
  } catch (error) {
    log('Failed to load organization:', error);
    return { organization: null, organizationDetails: null };
  }
}

async function loadSpecialties(specialtyIds) {
  try {
    if (!specialtyIds || specialtyIds.length === 0) return [];
    
    // Use batch fetch from utils
    const specialtyMap = await getBatchSpecialties(specialtyIds);
    return specialtyIds
      .map(id => specialtyMap.get(id))
      .filter(name => name);
  } catch (error) {
    log('Failed to load specialties:', error);
    return [];
  }
}

async function loadReviews(userId) {
  try {
    const reviews = await tables.reviews.select({
      filterByFormula: `{Speaker_ID} = '${userId}'`,
      sort: [{ field: 'Review_Date', direction: 'desc' }],
      maxRecords: 5
    }).all();
    
    const formattedReviews = reviews.map(review => ({
      id: review.id,
      rating: review.fields.Rating,
      reviewText: review.fields.Review_Text,
      reviewDate: review.fields.Review_Date,
      verified: review.fields.Verified
    }));
    
    const totalRating = formattedReviews.reduce((sum, r) => sum + (r.rating || 0), 0);
    const averageRating = formattedReviews.length > 0 
      ? (totalRating / formattedReviews.length).toFixed(1)
      : '0.0';
    
    return {
      reviews: formattedReviews,
      averageRating,
      totalReviews: formattedReviews.length
    };
  } catch (error) {
    log('Failed to load reviews:', error);
    return { reviews: [], averageRating: '0.0', totalReviews: 0 };
  }
}

async function loadPayments(userId) {
  try {
    const payments = await tables.payments.select({
      filterByFormula: `{Member_ID} = '${userId}'`,
      sort: [{ field: 'Payment_Date', direction: 'desc' }],
      maxRecords: 10
    }).all();
    
    return payments.map(payment => ({
      id: payment.id,
      amount: payment.fields.Amount,
      status: payment.fields.Status,
      date: payment.fields.Payment_Date,
      invoiceUrl: payment.fields.Invoice_URL
    }));
  } catch (error) {
    log('Failed to load payments:', error);
    return [];
  }
}