// File: netlify/functions/profile-get.js
const { tables } = require('./utils/airtable');
const { requireAuth } = require('./utils/auth');

exports.handler = async (event) => {
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
    // Get profile ID from query params or use authenticated user's ID
    const { id } = event.queryStringParameters || {};
    const profileId = id || auth.userId;

    // Get user profile
    const user = await tables.members.find(profileId);
    
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

    // Build profile response
    const profile = {
      id: user.id,
      name: user.fields.Name,
      email: user.fields.Email,
      phone: user.fields.Phone,
      memberType: user.fields.Member_Type,
      location: user.fields.Location,
      bio: user.fields.Bio,
      specialty: user.fields.Specialty || [],
      website: user.fields.Website,
      profileImage: user.fields.Profile_Image ? user.fields.Profile_Image[0]?.url : null,
      bookingLink: user.fields.Booking_Link,
      status: user.fields.Status,
      createdDate: user.fields.Created_Date,
      lastLogin: user.fields.Last_Login
    };

    // If viewing own profile, include subscription info for speakers
    if (profileId === auth.userId && user.fields.Member_Type === 'Speaker') {
      try {
        const subscriptions = await tables.subscriptions.select({
          filterByFormula: `AND({Member_ID} = '${user.id}', {Status} = 'Active')`,
          maxRecords: 1
        }).firstPage();
        
        if (subscriptions.length > 0) {
          profile.subscription = {
            id: subscriptions[0].id,
            plan: subscriptions[0].fields.Plan_Type,
            status: subscriptions[0].fields.Status,
            billingPeriod: subscriptions[0].fields.Billing_Period,
            amount: subscriptions[0].fields.Amount,
            nextBillingDate: subscriptions[0].fields.Next_Billing_Date,
            startDate: subscriptions[0].fields.Start_Date
          };
        }
      } catch (subError) {
        console.error('Failed to fetch subscription:', subError);
      }
    }

    // If organization, get organization details
    if (user.fields.Member_Type === 'Organization') {
      try {
        const orgRecords = await tables.organizations.select({
          filterByFormula: `{Member_ID} = '${user.id}'`,
          maxRecords: 1
        }).firstPage();
        
        if (orgRecords.length > 0) {
          profile.organizationDetails = {
            id: orgRecords[0].id,
            organizationName: orgRecords[0].fields.Organization_Name,
            organizationType: orgRecords[0].fields.Organization_Type,
            contactName: orgRecords[0].fields.Contact_Name,
            speakingTopics: orgRecords[0].fields.Speaking_Topics || [],
            eventFrequency: orgRecords[0].fields.Event_Frequency,
            taxId: profileId === auth.userId ? orgRecords[0].fields.Tax_ID : undefined // Only show to owner
          };
        }
      } catch (orgError) {
        console.error('Failed to fetch organization details:', orgError);
      }
    }

    // Get reviews if speaker (limit to recent 5)
    if (user.fields.Member_Type === 'Speaker') {
      try {
        const reviews = await tables.reviews.select({
          filterByFormula: `{Speaker_ID} = '${user.id}'`,
          sort: [{ field: 'Review_Date', direction: 'desc' }],
          maxRecords: 5
        }).all();
        
        profile.reviews = reviews.map(review => ({
          id: review.id,
          rating: review.fields.Rating,
          reviewText: review.fields.Review_Text,
          reviewDate: review.fields.Review_Date,
          verified: review.fields.Verified
        }));
        
        // Calculate average rating
        if (profile.reviews.length > 0) {
          const totalRating = profile.reviews.reduce((sum, r) => sum + (r.rating || 0), 0);
          profile.averageRating = (totalRating / profile.reviews.length).toFixed(1);
          profile.totalReviews = profile.reviews.length;
        }
      } catch (reviewError) {
        console.error('Failed to fetch reviews:', reviewError);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        profile
      })
    };
  } catch (error) {
    console.error('Profile fetch error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'Failed to fetch profile',
        message: error.message 
      })
    };
  }
};