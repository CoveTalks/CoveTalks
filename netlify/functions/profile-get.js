// File: netlify/functions/profile-get.js
// COMPLETE VERSION - Includes all functionality from both versions

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

  // Verify authentication - but allow public profile viewing
  const auth = await requireAuth(event);
  const isAuthenticated = !auth.statusCode;
  const authenticatedUserId = isAuthenticated ? auth.userId : null;

  try {
    // Get profile ID from query params or use authenticated user's ID
    const { id } = event.queryStringParameters || {};
    const profileId = id || authenticatedUserId;

    if (!profileId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Profile ID required' 
        })
      };
    }

    console.log('[Profile Get] Fetching profile for user:', profileId);

    // Get user profile
    const user = await tables.members.find(profileId);
    
    if (!user) {
      console.log('[Profile Get] User not found:', profileId);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'User not found' 
        })
      };
    }

    console.log('[Profile Get] User found:', user.fields.Name, 'Type:', user.fields.Member_Type);

    // Build profile response - ensure all fields are included
    const profile = {
      id: user.id,
      name: user.fields.Name || '',
      email: user.fields.Email || '',
      phone: user.fields.Phone || '',
      memberType: user.fields.Member_Type || '',
      location: user.fields.Location || '',
      bio: user.fields.Bio || '',
      specialty: user.fields.Specialty || [],
      website: user.fields.Website || '',
      profileImage: user.fields.Profile_Image ? 
        (user.fields.Profile_Image[0]?.url || user.fields.Profile_Image[0]?.thumbnails?.large?.url || null) : 
        null,
      bookingLink: user.fields.Booking_Link || '',
      status: user.fields.Status || 'Active',
      createdDate: user.fields.Created_Date,
      lastLogin: user.fields.Last_Login,
      profileViews: user.fields.Profile_Views || 0 // Add profile views for dashboard
    };

    // Check if user has testimonials/reviews (for profile completion)
    let hasTestimonials = false;
    try {
      const reviewCheck = await tables.reviews.select({
        filterByFormula: `{Speaker_ID} = '${profileId}'`,
        maxRecords: 1
      }).firstPage();
      
      hasTestimonials = reviewCheck.length > 0;
      profile.hasTestimonials = hasTestimonials;
    } catch (error) {
      console.error('[Profile Get] Failed to check for testimonials:', error);
      profile.hasTestimonials = false;
    }

    // If viewing own profile, include subscription info for speakers
    if (isAuthenticated && profileId === authenticatedUserId && user.fields.Member_Type === 'Speaker') {
      try {
        const subscriptions = await tables.subscriptions.select({
          filterByFormula: `AND({Member_ID} = '${user.id}', {Status} = 'Active')`,
          maxRecords: 1
        }).firstPage();
        
        if (subscriptions.length > 0) {
          profile.subscription = {
            id: subscriptions[0].id,
            plan: subscriptions[0].fields.Plan_Type,
            planType: subscriptions[0].fields.Plan_Type, // Include both naming conventions
            status: subscriptions[0].fields.Status,
            billingPeriod: subscriptions[0].fields.Billing_Period,
            amount: subscriptions[0].fields.Amount,
            nextBillingDate: subscriptions[0].fields.Next_Billing_Date,
            startDate: subscriptions[0].fields.Start_Date
          };
          console.log('[Profile Get] Subscription found:', profile.subscription.plan);
        } else {
          // Default to free plan if no active subscription
          profile.subscription = {
            plan: 'Free',
            planType: 'Free',
            status: 'Active',
            amount: 0,
            billingPeriod: null
          };
        }
      } catch (subError) {
        console.error('[Profile Get] Failed to fetch subscription:', subError);
        // Default to free plan on error
        profile.subscription = {
          plan: 'Free',
          planType: 'Free',
          status: 'Active',
          amount: 0,
          billingPeriod: null
        };
      }
    }

    // If organization, get organization details AND merge into main profile
    if (user.fields.Member_Type === 'Organization') {
      try {
        // Use the Member_ID autonumber (not the record ID) to find organization
        const memberIdNumber = user.fields.Member_ID;
        console.log('[Profile Get] Looking for organization with Member_ID:', memberIdNumber);
        
        const orgRecords = await tables.organizations.select({
          filterByFormula: `SEARCH('${memberIdNumber}', {Member_ID})`,
          maxRecords: 1
        }).firstPage();
        
        if (orgRecords.length > 0) {
          const org = orgRecords[0];
          console.log('[Profile Get] Organization found:', org.fields.Organization_Name);
          
          // Keep existing organizationDetails for backward compatibility
          profile.organizationDetails = {
            id: org.id,
            organizationName: org.fields.Organization_Name,
            organizationType: org.fields.Organization_Type,
            contactName: org.fields.Contact_Name,
            speakingTopics: org.fields.Speaking_Topics || [],
            eventFrequency: org.fields.Event_Frequency,
            taxId: isAuthenticated && profileId === authenticatedUserId ? org.fields.Tax_ID : undefined
          };
          
          // NEW: Merge organization data into main profile for frontend compatibility
          profile.organizationId = org.id;
          profile.organizationName = org.fields.Organization_Name;
          profile.organizationType = org.fields.Organization_Type;
          profile.contactName = org.fields.Contact_Name;
          profile.eventFrequency = org.fields.Event_Frequency;
          profile.speakingTopics = org.fields.Speaking_Topics || [];
          
          // Override contact info with organization data if available
          profile.orgEmail = org.fields.Email || profile.email;
          profile.orgPhone = org.fields.Phone || profile.phone;
          profile.orgBio = org.fields.Bio || profile.bio;
          profile.orgWebsite = org.fields.Website || profile.website;
          profile.address = org.fields.Address;
          
          console.log('[Profile Get] Organization details found and merged');
        } else {
          console.log('[Profile Get] No organization record found for Member_ID:', memberIdNumber);
        }
      } catch (orgError) {
        console.error('[Profile Get] Failed to fetch organization details:', orgError);
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
        
        // Format reviews with organization names
        profile.reviews = await Promise.all(reviews.map(async (review) => {
          let organizationName = 'Anonymous';
          
          // Try to get organization name
          if (review.fields.Organization_ID) {
            try {
              const orgRecords = await tables.organizations.select({
                filterByFormula: `RECORD_ID() = '${review.fields.Organization_ID}'`,
                maxRecords: 1
              }).firstPage();
              
              if (orgRecords.length > 0) {
                organizationName = orgRecords[0].fields.Organization_Name || 'Anonymous';
              }
            } catch (error) {
              console.error('[Profile Get] Error fetching organization for review:', error);
            }
          }
          
          return {
            id: review.id,
            rating: review.fields.Rating || 5,
            reviewText: review.fields.Review_Text || '',
            reviewDate: review.fields.Review_Date,
            verified: review.fields.Verified || false,
            organizationName: organizationName
          };
        }));
        
        // Calculate average rating
        if (profile.reviews.length > 0) {
          const totalRating = profile.reviews.reduce((sum, r) => sum + (r.rating || 0), 0);
          profile.averageRating = (totalRating / profile.reviews.length).toFixed(1);
          profile.totalReviews = profile.reviews.length;
          // Update hasTestimonials to true if we have reviews
          profile.hasTestimonials = true;
        } else {
          profile.averageRating = '0.0';
          profile.totalReviews = 0;
          // Keep the hasTestimonials value from earlier check
        }
        
        console.log('[Profile Get] Reviews found:', profile.reviews.length);
      } catch (reviewError) {
        console.error('[Profile Get] Failed to fetch reviews:', reviewError);
        profile.reviews = [];
        profile.averageRating = '0.0';
        profile.totalReviews = 0;
        // Keep the hasTestimonials value from earlier check
      }
    } else {
      // Not a speaker, no reviews
      profile.reviews = [];
      profile.averageRating = '0.0';
      profile.totalReviews = 0;
      profile.hasTestimonials = false;
    }

    // Only include sensitive data if viewing own profile
    if (!isAuthenticated || (profileId !== authenticatedUserId)) {
      // Remove sensitive information for other users' profiles or unauthenticated viewing
      delete profile.email;
      delete profile.phone;
      delete profile.lastLogin;
      delete profile.subscription;
    }

    console.log('[Profile Get] Sending profile response to client');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        profile
      })
    };
  } catch (error) {
    console.error('[Profile Get] Error:', error);
    console.error('[Profile Get] Error stack:', error.stack);
    
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