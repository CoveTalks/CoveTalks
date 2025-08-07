// File: netlify/functions/opportunities-list.js
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

  // Auth is optional for viewing opportunities
  let userId = null;
  let isAuthenticated = false;
  const token = getTokenFromHeaders(event.headers);
  
  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      userId = decoded.userId;
      isAuthenticated = true;
    }
  }

  try {
    // Get filter parameters
    const { 
      topics, 
      location, 
      status = 'Open',
      dateFrom,
      dateTo,
      audienceSize,
      sort = 'desc',
      limit = 50,
      offset = 0
    } = event.queryStringParameters || {};
    
    // Build filter formula
    let filterConditions = [];
    
    // Status filter
    if (status && status !== 'all') {
      filterConditions.push(`{Status} = '${status}'`);
    }
    
    // Location filter (partial match)
    if (location) {
      filterConditions.push(`FIND(LOWER('${location.toLowerCase()}'), LOWER({Location})) > 0`);
    }
    
    // Date range filters
    if (dateFrom) {
      filterConditions.push(`{Event_Date} >= '${dateFrom}'`);
    }
    if (dateTo) {
      filterConditions.push(`{Event_Date} <= '${dateTo}'`);
    }
    
    // Audience size filter
    if (audienceSize) {
      const size = parseInt(audienceSize);
      if (size > 0) {
        filterConditions.push(`{Audience_Size} >= ${size}`);
      }
    }
    
    // Build the filter formula
    let filterFormula = '';
    if (filterConditions.length > 0) {
      if (filterConditions.length === 1) {
        filterFormula = filterConditions[0];
      } else {
        filterFormula = `AND(${filterConditions.join(', ')})`;
      }
    }
    
    // Fetch opportunities
    const opportunities = await tables.speakingOpportunities.select({
      filterByFormula: filterFormula,
      sort: [{ field: 'Posted_Date', direction: sort }],
      maxRecords: parseInt(limit)
    }).all();

    // Format opportunities with organization details
    const formattedOpportunities = await Promise.all(opportunities.map(async (opp) => {
      // Get organization details
      let organization = null;
      if (opp.fields.Organization_ID && opp.fields.Organization_ID[0]) {
        try {
          const orgRecord = await tables.organizations.find(opp.fields.Organization_ID[0]);
          if (orgRecord) {
            // Get member details for contact info
            let memberInfo = null;
            if (orgRecord.fields.Member_ID && orgRecord.fields.Member_ID[0]) {
              const member = await tables.members.find(orgRecord.fields.Member_ID[0]);
              memberInfo = {
                email: isAuthenticated ? member.fields.Email : 'Login to view',
                phone: isAuthenticated ? member.fields.Phone : 'Login to view'
              };
            }
            
            organization = {
              id: orgRecord.id,
              name: orgRecord.fields.Organization_Name,
              type: orgRecord.fields.Organization_Type,
              contactName: orgRecord.fields.Contact_Name,
              contact: memberInfo
            };
          }
        } catch (e) {
          console.error('Failed to fetch organization:', e);
        }
      }

      // Check if user has already applied (if authenticated)
      let hasApplied = false;
      let applicationStatus = null;
      
      if (isAuthenticated && userId) {
        try {
          const applications = await tables.applications.select({
            filterByFormula: `AND({Opportunity_ID} = '${opp.id}', {Speaker_ID} = '${userId}')`,
            maxRecords: 1
          }).firstPage();
          
          if (applications.length > 0) {
            hasApplied = true;
            applicationStatus = applications[0].fields.Status;
          }
        } catch (e) {
          console.error('Failed to check application status:', e);
        }
      }

      // Get application count
      let applicationCount = 0;
      try {
        const applications = await tables.applications.select({
          filterByFormula: `{Opportunity_ID} = '${opp.id}'`
        }).all();
        applicationCount = applications.length;
      } catch (e) {
        console.error('Failed to count applications:', e);
      }

      return {
        id: opp.id,
        title: opp.fields.Title,
        description: opp.fields.Description,
        eventDate: opp.fields.Event_Date,
        location: opp.fields.Location,
        topics: opp.fields.Topics || [],
        audienceSize: opp.fields.Audience_Size,
        status: opp.fields.Status,
        postedDate: opp.fields.Posted_Date,
        organization: organization,
        hasApplied: hasApplied,
        applicationStatus: applicationStatus,
        applicationCount: applicationCount
      };
    }));

    // Apply topics filter if provided (after fetching, as it's a multiple select field)
    let filteredOpportunities = formattedOpportunities;
    if (topics) {
      const topicsArray = topics.split(',').map(t => t.trim().toLowerCase());
      filteredOpportunities = formattedOpportunities.filter(opp => {
        if (!opp.topics || opp.topics.length === 0) return false;
        const oppTopics = opp.topics.map(t => t.toLowerCase());
        return topicsArray.some(topic => oppTopics.includes(topic));
      });
    }

    // Calculate statistics
    const stats = {
      total: filteredOpportunities.length,
      open: filteredOpportunities.filter(o => o.status === 'Open').length,
      filled: filteredOpportunities.filter(o => o.status === 'Filled').length,
      upcoming: filteredOpportunities.filter(o => 
        o.eventDate && new Date(o.eventDate) > new Date()
      ).length
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        opportunities: filteredOpportunities,
        stats,
        isAuthenticated,
        hasMore: filteredOpportunities.length === parseInt(limit)
      })
    };
  } catch (error) {
    console.error('Opportunities fetch error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'Failed to fetch opportunities',
        message: error.message 
      })
    };
  }
};