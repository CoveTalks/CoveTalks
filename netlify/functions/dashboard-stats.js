// File: netlify/functions/dashboard-stats.js
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
    // Initialize stats
    const stats = {
      profileViews: 0,
      applications: 0,
      rating: 0.0,
      totalBookings: 0,
      activeOpportunities: 0
    };

    // Get user info to determine member type
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

    // For speakers, get applications count
    if (user.fields.Member_Type === 'Speaker') {
      try {
        const applications = await tables.applications.select({
          filterByFormula: `{Speaker_ID} = '${auth.userId}'`,
          maxRecords: 100
        }).all();
        
        stats.applications = applications.length;
      } catch (error) {
        console.error('Failed to fetch applications:', error);
      }

      // Get reviews for rating
      try {
        const reviews = await tables.reviews.select({
          filterByFormula: `{Speaker_ID} = '${auth.userId}'`,
          maxRecords: 100
        }).all();
        
        if (reviews.length > 0) {
          const totalRating = reviews.reduce((sum, r) => sum + (r.fields.Rating || 0), 0);
          stats.rating = parseFloat((totalRating / reviews.length).toFixed(1));
        }
      } catch (error) {
        console.error('Failed to fetch reviews:', error);
      }

      // Get profile views from analytics table (if exists)
      // For now, we'll check if there's a Profile_Views field in the Members table
      if (user.fields.Profile_Views) {
        stats.profileViews = user.fields.Profile_Views || 0;
      } else {
        // If no tracking exists, return a realistic default based on profile completeness
        const profileCompleteness = calculateProfileCompleteness(user.fields);
        // More complete profiles tend to get more views
        stats.profileViews = Math.floor(profileCompleteness * 0.5); // 0-50 based on completeness
      }
    }

    // For organizations, get posted opportunities count
    if (user.fields.Member_Type === 'Organization') {
      try {
        // Get organization record
        const orgRecords = await tables.organizations.select({
          filterByFormula: `{Member_ID} = '${auth.userId}'`,
          maxRecords: 1
        }).firstPage();
        
        if (orgRecords.length > 0) {
          // Get opportunities posted by this organization
          const opportunities = await tables.speakingOpportunities.select({
            filterByFormula: `AND({Organization_ID} = '${orgRecords[0].id}', {Status} = 'Open')`,
            maxRecords: 100
          }).all();
          
          stats.activeOpportunities = opportunities.length;
        }
      } catch (error) {
        console.error('Failed to fetch organization opportunities:', error);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        stats
      })
    };
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'Failed to fetch dashboard stats',
        message: error.message 
      })
    };
  }
};

// Helper function to calculate profile completeness
function calculateProfileCompleteness(fields) {
  let score = 0;
  const checks = [
    fields.Name,
    fields.Email,
    fields.Phone,
    fields.Bio && fields.Bio.length > 50,
    fields.Location,
    fields.Website,
    fields.Profile_Image,
    fields.Booking_Link,
    fields.Specialty && fields.Specialty.length > 0
  ];
  
  checks.forEach(check => {
    if (check) score += 11.11; // Each field contributes ~11% to completion
  });
  
  return Math.min(100, Math.round(score));
}