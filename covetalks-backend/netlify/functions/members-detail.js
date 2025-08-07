// File: netlify/functions/member-detail.js
const { tables } = require('./utils/airtable');
const { getTokenFromHeaders, verifyToken } = require('./utils/auth');

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

  // Get member ID from path parameters
  const { id } = event.queryStringParameters || {};
  
  if (!id) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'Member ID required' 
      })
    };
  }

  // Check authentication
  const token = getTokenFromHeaders(event.headers);
  let isAuthenticated = false;
  let currentUserId = null;
  
  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      isAuthenticated = true;
      currentUserId = decoded.userId;
    }
  }

  try {
    // Fetch member details
    const member = await tables.members.find(id);
    
    if (!member) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Member not found' 
        })
      };
    }
    
    const fields = member.fields;
    
    // Check if member is active
    if (fields.Status !== 'Active' && currentUserId !== id) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'This member profile is not available' 
        })
      };
    }
    
    // Basic information for all users
    const memberData = {
      id: member.id,
      name: fields.Name || '',
      memberType: fields.Member_Type || '',
      location: fields.Location || '',
      bio: fields.Bio || '',
      specialty: fields.Specialty || [],
      profileImage: fields.Profile_Image ? fields.Profile_Image[0]?.url : null,
      website: fields.Website || '',
      status: fields.Status,
      createdDate: fields.Created_Date,
      isOwner: currentUserId === id
    };
    
    // Add contact information only for authenticated users
    if (isAuthenticated) {
      memberData.email = fields.Email || '';
      memberData.phone = fields.Phone || '';
      memberData.bookingLink = fields.Booking_Link || '';
    } else {
      memberData.contactProtected = true;
      memberData.message = 'Login to view contact information';
    }
    
    // If member is an organization, fetch organization details
    if (fields.Member_Type === 'Organization') {
      try {
        const orgRecords = await tables.organizations.select({
          filterByFormula: `{Member_ID} = '${id}'`,
          maxRecords: 1
        }).firstPage();
        
        if (orgRecords.length > 0) {
          const org = orgRecords[0];
          memberData.organizationDetails = {
            id: org.id,
            organizationName: org.fields.Organization_Name,
            organizationType: org.fields.Organization_Type,
            contactName: org.fields.Contact_Name,
            speakingTopics: org.fields.Speaking_Topics || [],
            eventFrequency: org.fields.Event_Frequency
          };
          
          // Get recent opportunities posted by this organization
          try {
            const opportunities = await tables.speakingOpportunities.select({
              filterByFormula: `AND({Organization_ID} = '${org.id}', {Status} = 'Open')`,
              sort: [{ field: 'Posted_Date', direction: 'desc' }],
              maxRecords: 5
            }).all();
            
            memberData.recentOpportunities = opportunities.map(opp => ({
              id: opp.id,
              title: opp.fields.Title,
              eventDate: opp.fields.Event_Date,
              location: opp.fields.Location,
              topics: opp.fields.Topics || [],
              postedDate: opp.fields.Posted_Date
            }));
          } catch (oppError) {
            console.error('Failed to fetch opportunities:', oppError);
          }
        }
      } catch (orgError) {
        console.error('Failed to fetch organization details:', orgError);
      }
    }
    
    // If member is a speaker, fetch additional speaker details
    if (fields.Member_Type === 'Speaker') {
      // Fetch reviews
      try {
        const reviews = await tables.reviews.select({
          filterByFormula: `{Speaker_ID} = '${id}'`,
          sort: [{ field: 'Review_Date', direction: 'desc' }],
          maxRecords: 10
        }).all();
        
        memberData.reviews = await Promise.all(reviews.map(async (review) => {
          let organizationName = 'Anonymous';
          
          // Get organization name if available
          if (review.fields.Organization_ID && review.fields.Organization_ID[0]) {
            try {
              const org = await tables.organizations.find(review.fields.Organization_ID[0]);
              organizationName = org.fields.Organization_Name;
            } catch (e) {
              console.error('Failed to fetch organization for review:', e);
            }
          }
          
          return {
            id: review.id,
            rating: review.fields.Rating,
            reviewText: review.fields.Review_Text,
            reviewDate: review.fields.Review_Date,
            eventDate: review.fields.Event_Date,
            verified: review.fields.Verified,
            organizationName: organizationName
          };
        }));
        
        // Calculate average rating
        if (memberData.reviews.length > 0) {
          const totalRating = memberData.reviews.reduce((sum, r) => sum + (r.rating || 0), 0);
          memberData.averageRating = (totalRating / memberData.reviews.length).toFixed(1);
          memberData.totalReviews = memberData.reviews.length;
        }
      } catch (reviewError) {
        console.error('Failed to fetch reviews:', reviewError);
      }
      
      // Get upcoming speaking engagements (accepted applications)
      if (isAuthenticated) {
        try {
          const applications = await tables.applications.select({
            filterByFormula: `AND({Speaker_ID} = '${id}', {Status} = 'Accepted')`,
            sort: [{ field: 'Applied_Date', direction: 'desc' }],
            maxRecords: 5
          }).all();
          
          memberData.upcomingEngagements = await Promise.all(applications.map(async (app) => {
            let opportunity = null;
            if (app.fields.Opportunity_ID && app.fields.Opportunity_ID[0]) {
              try {
                const opp = await tables.speakingOpportunities.find(app.fields.Opportunity_ID[0]);
                opportunity = {
                  title: opp.fields.Title,
                  eventDate: opp.fields.Event_Date,
                  location: opp.fields.Location
                };
              } catch (e) {
                console.error('Failed to fetch opportunity:', e);
              }
            }
            return opportunity;
          })).then(engagements => engagements.filter(e => e !== null));
        } catch (appError) {
          console.error('Failed to fetch engagements:', appError);
        }
      }
    }
    
    // Track profile view (if not viewing own profile)
    if (currentUserId && currentUserId !== id) {
      // This could be implemented with a separate ProfileViews table
      // For now, we'll just log it
      console.log(`Profile view: ${currentUserId} viewed ${id}`);
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        isAuthenticated,
        member: memberData
      })
    };
  } catch (error) {
    console.error('Member detail fetch error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'Failed to fetch member details',
        message: error.message 
      })
    };
  }
};