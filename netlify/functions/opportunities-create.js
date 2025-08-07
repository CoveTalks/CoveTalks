// File: netlify/functions/opportunities-create.js
const { tables, createRecord } = require('./utils/airtable');
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
    const {
      title,
      description,
      eventDate,
      location,
      topics,
      audienceSize,
      requirements,
      compensation,
      format, // In-person, Virtual, Hybrid
      duration // in minutes
    } = JSON.parse(event.body);

    // Validate required fields
    if (!title || !description || !eventDate || !location) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Missing required fields: title, description, eventDate, and location are required' 
        })
      };
    }

    // Validate event date is in the future
    if (new Date(eventDate) <= new Date()) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Event date must be in the future' 
        })
      };
    }

    // Get user's organization
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

    // Verify user is an organization
    if (user.fields.Member_Type !== 'Organization') {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Only organizations can post opportunities' 
        })
      };
    }

    // Find organization record
    const orgRecords = await tables.organizations.select({
      filterByFormula: `{Member_ID} = '${auth.userId}'`,
      maxRecords: 1
    }).firstPage();

    if (!orgRecords.length) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Organization profile not found. Please complete your organization profile first.' 
        })
      };
    }

    const organizationId = orgRecords[0].id;

    // Prepare opportunity data
    const opportunityData = {
      Organization_ID: [organizationId],
      Title: title,
      Description: description,
      Event_Date: eventDate,
      Location: location,
      Status: 'Open',
      Posted_Date: new Date().toISOString()
    };

    // Add optional fields
    if (topics) {
      opportunityData.Topics = Array.isArray(topics) ? topics : [topics];
    }
    if (audienceSize) {
      opportunityData.Audience_Size = parseInt(audienceSize);
    }
    if (requirements) {
      opportunityData.Requirements = requirements;
    }
    if (compensation) {
      opportunityData.Compensation = compensation;
    }
    if (format) {
      opportunityData.Format = format;
    }
    if (duration) {
      opportunityData.Duration = parseInt(duration);
    }

    // Create opportunity
    const opportunity = await createRecord(tables.speakingOpportunities, opportunityData);

    // Prepare response
    const response = {
      id: opportunity.id,
      title: opportunity.fields.Title,
      description: opportunity.fields.Description,
      eventDate: opportunity.fields.Event_Date,
      location: opportunity.fields.Location,
      topics: opportunity.fields.Topics || [],
      audienceSize: opportunity.fields.Audience_Size,
      status: opportunity.fields.Status,
      postedDate: opportunity.fields.Posted_Date,
      organization: {
        id: organizationId,
        name: orgRecords[0].fields.Organization_Name,
        type: orgRecords[0].fields.Organization_Type
      }
    };

    // TODO: Send notification emails to matching speakers
    // This could be done via Airtable automations or a separate function

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        success: true,
        opportunity: response,
        message: 'Opportunity posted successfully'
      })
    };
  } catch (error) {
    console.error('Opportunity creation error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'Failed to create opportunity',
        message: error.message 
      })
    };
  }
};