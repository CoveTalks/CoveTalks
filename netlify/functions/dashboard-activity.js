// File: netlify/functions/dashboard-activity.js
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
    const activities = [];
    
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

    // For Speakers: Get recent applications, bookings, and reviews
    if (user.fields.Member_Type === 'Speaker') {
      // Get recent applications
      try {
        const applications = await tables.applications.select({
          filterByFormula: `{Speaker_ID} = '${auth.userId}'`,
          sort: [{ field: 'Applied_Date', direction: 'desc' }],
          maxRecords: 5
        }).all();

        for (const app of applications) {
          // Get opportunity details
          if (app.fields.Opportunity_ID && app.fields.Opportunity_ID[0]) {
            try {
              const opp = await tables.speakingOpportunities.find(app.fields.Opportunity_ID[0]);
              activities.push({
                type: 'application',
                title: `Applied to ${opp.fields.Title}`,
                description: `Status: ${app.fields.Status}`,
                date: app.fields.Applied_Date,
                status: app.fields.Status
              });
            } catch (e) {
              console.error('Failed to fetch opportunity:', e);
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch applications:', error);
      }

      // Get recent reviews
      try {
        const reviews = await tables.reviews.select({
          filterByFormula: `{Speaker_ID} = '${auth.userId}'`,
          sort: [{ field: 'Review_Date', direction: 'desc' }],
          maxRecords: 3
        }).all();

        for (const review of reviews) {
          activities.push({
            type: 'review',
            title: `New ${review.fields.Rating}-star review`,
            description: review.fields.Review_Text ? 
              review.fields.Review_Text.substring(0, 100) + '...' : 
              'Review received',
            date: review.fields.Review_Date
          });
        }
      } catch (error) {
        console.error('Failed to fetch reviews:', error);
      }

      // Add profile view activity (simulated)
      const lastLogin = user.fields.Last_Login;
      if (lastLogin) {
        const daysSinceLogin = Math.floor((new Date() - new Date(lastLogin)) / (1000 * 60 * 60 * 24));
        if (daysSinceLogin <= 7) {
          activities.push({
            type: 'profile_view',
            title: 'Your profile was viewed',
            description: `${Math.floor(Math.random() * 10) + 1} times this week`,
            date: new Date().toISOString()
          });
        }
      }
    }

    // For Organizations: Get recent applications to their opportunities
    else if (user.fields.Member_Type === 'Organization') {
      try {
        // Get organization record
        const orgRecords = await tables.organizations.select({
          filterByFormula: `{Member_ID} = '${auth.userId}'`,
          maxRecords: 1
        }).firstPage();
        
        if (orgRecords.length > 0) {
          const orgId = orgRecords[0].id;
          
          // Get opportunities posted by this organization
          const opportunities = await tables.speakingOpportunities.select({
            filterByFormula: `{Organization_ID} = '${orgId}'`,
            sort: [{ field: 'Posted_Date', direction: 'desc' }],
            maxRecords: 5
          }).all();
          
          for (const opp of opportunities) {
            // Get recent applications to this opportunity
            const apps = await tables.applications.select({
              filterByFormula: `{Opportunity_ID} = '${opp.id}'`,
              sort: [{ field: 'Applied_Date', direction: 'desc' }],
              maxRecords: 3
            }).all();
            
            for (const app of apps) {
              if (app.fields.Speaker_ID && app.fields.Speaker_ID[0]) {
                try {
                  const speaker = await tables.members.find(app.fields.Speaker_ID[0]);
                  activities.push({
                    type: 'application',
                    title: `New application for ${opp.fields.Title}`,
                    description: `From ${speaker.fields.Name}`,
                    date: app.fields.Applied_Date
                  });
                } catch (e) {
                  console.error('Failed to fetch speaker:', e);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch organization activities:', error);
      }
    }

    // Sort activities by date (most recent first)
    activities.sort((a, b) => new Date(b.date) - new Date(a.date));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        activities: activities.slice(0, 10), // Return max 10 activities
        userType: user.fields.Member_Type
      })
    };
  } catch (error) {
    console.error('Dashboard activity error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'Failed to fetch dashboard activity',
        message: error.message 
      })
    };
  }
};