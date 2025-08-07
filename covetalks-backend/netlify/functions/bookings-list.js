// File: netlify/functions/bookings-list.js
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
    // Get query parameters for filtering
    const { 
      status, 
      dateFrom, 
      dateTo, 
      sort = 'desc',
      limit = 50 
    } = event.queryStringParameters || {};
    
    // Get user to determine their type
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

    let bookings = [];
    
    // For Speakers: Get their applications
    if (user.fields.Member_Type === 'Speaker') {
      // Build filter formula
      let filterFormula = `{Speaker_ID} = '${auth.userId}'`;
      
      if (status && status !== 'all') {
        filterFormula = `AND(${filterFormula}, {Status} = '${status}')`;
      }

      // Fetch applications
      const applications = await tables.applications.select({
        filterByFormula: filterFormula,
        sort: [{ field: 'Applied_Date', direction: sort }],
        maxRecords: parseInt(limit)
      }).all();

      // Get opportunity details for each application
      bookings = await Promise.all(applications.map(async (app) => {
        let opportunity = null;
        let organization = null;
        
        // Get opportunity details
        if (app.fields.Opportunity_ID && app.fields.Opportunity_ID[0]) {
          try {
            const opp = await tables.speakingOpportunities.find(app.fields.Opportunity_ID[0]);
            opportunity = {
              id: opp.id,
              title: opp.fields.Title,
              description: opp.fields.Description,
              eventDate: opp.fields.Event_Date,
              location: opp.fields.Location,
              topics: opp.fields.Topics || [],
              audienceSize: opp.fields.Audience_Size
            };

            // Get organization details
            if (opp.fields.Organization_ID && opp.fields.Organization_ID[0]) {
              const org = await tables.organizations.find(opp.fields.Organization_ID[0]);
              organization = {
                id: org.id,
                name: org.fields.Organization_Name,
                type: org.fields.Organization_Type
              };
            }
          } catch (e) {
            console.error('Failed to fetch opportunity details:', e);
          }
        }

        return {
          id: app.id,
          type: 'application',
          status: app.fields.Status,
          appliedDate: app.fields.Applied_Date,
          coverLetter: app.fields.Cover_Letter,
          opportunity: opportunity,
          organization: organization
        };
      }));
    }
    
    // For Organizations: Get opportunities they posted and applications received
    else if (user.fields.Member_Type === 'Organization') {
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
          sort: [{ field: 'Posted_Date', direction: 'desc' }]
        }).all();
        
        // For each opportunity, get applications
        bookings = await Promise.all(opportunities.map(async (opp) => {
          let applications = [];
          
          try {
            const apps = await tables.applications.select({
              filterByFormula: `{Opportunity_ID} = '${opp.id}'`,
              sort: [{ field: 'Applied_Date', direction: 'desc' }]
            }).all();
            
            // Get speaker details for each application
            applications = await Promise.all(apps.map(async (app) => {
              let speaker = null;
              if (app.fields.Speaker_ID && app.fields.Speaker_ID[0]) {
                try {
                  const spk = await tables.members.find(app.fields.Speaker_ID[0]);
                  speaker = {
                    id: spk.id,
                    name: spk.fields.Name,
                    email: spk.fields.Email,
                    location: spk.fields.Location,
                    specialty: spk.fields.Specialty || []
                  };
                } catch (e) {
                  console.error('Failed to fetch speaker details:', e);
                }
              }
              
              return {
                id: app.id,
                status: app.fields.Status,
                appliedDate: app.fields.Applied_Date,
                coverLetter: app.fields.Cover_Letter,
                speaker: speaker
              };
            }));
          } catch (e) {
            console.error('Failed to fetch applications:', e);
          }
          
          return {
            id: opp.id,
            type: 'opportunity',
            title: opp.fields.Title,
            description: opp.fields.Description,
            eventDate: opp.fields.Event_Date,
            location: opp.fields.Location,
            topics: opp.fields.Topics || [],
            audienceSize: opp.fields.Audience_Size,
            status: opp.fields.Status,
            postedDate: opp.fields.Posted_Date,
            applications: applications,
            applicationCount: applications.length
          };
        }));
      }
    }

    // Apply date filters if provided
    if (dateFrom || dateTo) {
      bookings = bookings.filter(booking => {
        const bookingDate = booking.opportunity?.eventDate || booking.eventDate;
        if (!bookingDate) return true;
        
        if (dateFrom && new Date(bookingDate) < new Date(dateFrom)) return false;
        if (dateTo && new Date(bookingDate) > new Date(dateTo)) return false;
        return true;
      });
    }

    // Calculate statistics
    const stats = {
      total: bookings.length,
      pending: bookings.filter(b => b.status === 'Pending').length,
      accepted: bookings.filter(b => b.status === 'Accepted').length,
      rejected: bookings.filter(b => b.status === 'Rejected').length
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        bookings,
        stats,
        userType: user.fields.Member_Type
      })
    };
  } catch (error) {
    console.error('Bookings fetch error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'Failed to fetch bookings',
        message: error.message 
      })
    };
  }
};