// File: netlify/functions/auth-load-deferred.js
// Loads deferred user data after initial login

const { tables, getBatchSpecialties } = require('./utils/airtable');
const { requireAuth } = require('./utils/auth');

exports.handler = async (event) => {
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
    const { items = [] } = JSON.parse(event.body);
    
    console.log(`Loading deferred data for user ${auth.userId}: ${items.join(', ')}`);
    
    // Get user record
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

    // Load requested data in parallel
    const promises = [];
    const results = {};

    if (items.includes('subscription') && user.fields.Member_Type === 'Speaker') {
      promises.push(
        loadSubscription(auth.userId).then(data => {
          results.subscription = data;
        })
      );
    }

    if (items.includes('specialties') && user.fields.Specialty?.length > 0) {
      promises.push(
        loadSpecialties(user.fields.Specialty).then(data => {
          results.specialty = data;
        })
      );
    }

    if (items.includes('organization') && user.fields.Member_Type === 'Organization') {
      promises.push(
        loadOrganization(auth.userId).then(data => {
          results.organization = data.organization;
          results.organizationDetails = data.organizationDetails;
        })
      );
    }

    if (items.includes('reviews') && user.fields.Member_Type === 'Speaker') {
      promises.push(
        loadReviews(auth.userId).then(data => {
          results.reviews = data.reviews;
          results.averageRating = data.averageRating;
          results.totalReviews = data.totalReviews;
        })
      );
    }

    if (items.includes('applications')) {
      promises.push(
        loadApplications(auth.userId, user.fields.Member_Type).then(data => {
          results.applications = data;
        })
      );
    }

    if (items.includes('opportunities') && user.fields.Member_Type === 'Organization') {
      promises.push(
        loadOpportunities(auth.userId).then(data => {
          results.opportunities = data;
        })
      );
    }

    // Wait for all data to load
    await Promise.all(promises);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: results,
        loaded: Object.keys(results)
      })
    };
  } catch (error) {
    console.error('Deferred loading error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'Failed to load deferred data',
        message: error.message 
      })
    };
  }
};

// Data loading functions (reused from auth-login-smart.js)
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
    console.error('Failed to load subscription:', error);
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
    console.error('Failed to load organization:', error);
    return { organization: null, organizationDetails: null };
  }
}

async function loadSpecialties(specialtyIds) {
  try {
    if (!specialtyIds || specialtyIds.length === 0) return [];
    
    const specialtyMap = await getBatchSpecialties(specialtyIds);
    return specialtyIds
      .map(id => specialtyMap.get(id))
      .filter(name => name);
  } catch (error) {
    console.error('Failed to load specialties:', error);
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
    console.error('Failed to load reviews:', error);
    return { reviews: [], averageRating: '0.0', totalReviews: 0 };
  }
}

async function loadApplications(userId, memberType) {
  try {
    let applications = [];
    
    if (memberType === 'Speaker') {
      // Get speaker's applications
      applications = await tables.applications.select({
        filterByFormula: `{Speaker_ID} = '${userId}'`,
        sort: [{ field: 'Applied_Date', direction: 'desc' }],
        maxRecords: 10
      }).all();
    }
    
    return applications.map(app => ({
      id: app.id,
      status: app.fields.Status,
      appliedDate: app.fields.Applied_Date,
      opportunityId: app.fields.Opportunity_ID?.[0]
    }));
  } catch (error) {
    console.error('Failed to load applications:', error);
    return [];
  }
}

async function loadOpportunities(userId) {
  try {
    // Get organization record first
    const orgRecords = await tables.organizations.select({
      filterByFormula: `SEARCH('${userId}', ARRAYJOIN({Member_ID}))`,
      maxRecords: 1
    }).firstPage();
    
    if (orgRecords.length === 0) return [];
    
    const orgId = orgRecords[0].id;
    
    // Get opportunities for this organization
    const opportunities = await tables.speakingOpportunities.select({
      filterByFormula: `{Organization_ID} = '${orgId}'`,
      sort: [{ field: 'Posted_Date', direction: 'desc' }],
      maxRecords: 10
    }).all();
    
    return opportunities.map(opp => ({
      id: opp.id,
      title: opp.fields.Title,
      eventDate: opp.fields.Event_Date,
      status: opp.fields.Status,
      applicationCount: opp.fields.Application_Count || 0
    }));
  } catch (error) {
    console.error('Failed to load opportunities:', error);
    return [];
  }
}