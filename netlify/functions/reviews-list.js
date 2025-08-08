// File: netlify/functions/reviews-list.js
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

  // Verify authentication (optional for public reviews)
  const auth = await requireAuth(event);
  const isAuthenticated = !auth.statusCode;

  try {
    // Get query parameters
    const { speakerId, limit = 10 } = event.queryStringParameters || {};

    console.log('[Reviews List] Fetching reviews for speaker:', speakerId);

    // Build filter
    let filterFormula = '';
    if (speakerId) {
      filterFormula = `{Speaker_ID} = '${speakerId}'`;
    }

    // Fetch reviews
    const reviews = await tables.reviews.select({
      filterByFormula: filterFormula,
      sort: [{ field: 'Review_Date', direction: 'desc' }],
      maxRecords: parseInt(limit)
    }).all();

    console.log('[Reviews List] Found', reviews.length, 'reviews');

    // Format reviews for response
    const formattedReviews = await Promise.all(reviews.map(async (review) => {
      let organizationName = 'Anonymous';
      
      // Try to get organization name if Organization_ID exists
      if (review.fields.Organization_ID) {
        try {
          // Get the organization record
          const orgRecords = await tables.organizations.select({
            filterByFormula: `RECORD_ID() = '${review.fields.Organization_ID}'`,
            maxRecords: 1
          }).firstPage();
          
          if (orgRecords.length > 0) {
            organizationName = orgRecords[0].fields.Organization_Name || 'Anonymous';
          }
        } catch (error) {
          console.error('[Reviews List] Error fetching organization:', error);
        }
      }

      return {
        id: review.id,
        speakerId: review.fields.Speaker_ID,
        organizationId: review.fields.Organization_ID,
        organizationName: organizationName,
        rating: review.fields.Rating || 5,
        reviewText: review.fields.Review_Text || '',
        eventDate: review.fields.Event_Date,
        reviewDate: review.fields.Review_Date,
        verified: review.fields.Verified || false
      };
    }));

    // Calculate statistics
    let averageRating = 0;
    if (formattedReviews.length > 0) {
      const totalRating = formattedReviews.reduce((sum, r) => sum + (r.rating || 0), 0);
      averageRating = (totalRating / formattedReviews.length).toFixed(1);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        reviews: formattedReviews,
        stats: {
          total: formattedReviews.length,
          averageRating: parseFloat(averageRating)
        }
      })
    };
  } catch (error) {
    console.error('[Reviews List] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Failed to fetch reviews',
        message: error.message
      })
    };
  }
};