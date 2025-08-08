// File: netlify/functions/organization-by-member.js
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

  // Verify authentication (optional for public profiles)
  const auth = await requireAuth(event);
  const isAuthenticated = !auth.statusCode;

  try {
    // Get member ID from query parameters
    const { memberId } = event.queryStringParameters || {};
    
    if (!memberId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Member ID required'
        })
      };
    }

    console.log('[Organization By Member] Looking for organization linked to member:', memberId);

    // Find organization record that links to this member
    // The Member_ID field in Organizations table is a link field, so we search for the member ID
    const filterFormula = `SEARCH('${memberId}', ARRAYJOIN({Member_ID}))`;
    
    const orgRecords = await tables.organizations.select({
      filterByFormula: filterFormula,
      maxRecords: 1
    }).firstPage();

    console.log('[Organization By Member] Found', orgRecords.length, 'organization records');

    if (orgRecords.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'No organization found for this member'
        })
      };
    }

    const orgRecord = orgRecords[0];
    console.log('[Organization By Member] Organization record:', orgRecord.fields);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        organization: {
          id: orgRecord.id,
          organizationName: orgRecord.fields.Organization_Name,
          organizationType: orgRecord.fields.Organization_Type,
          contactName: orgRecord.fields.Contact_Name,
          eventFrequency: orgRecord.fields.Event_Frequency,
          speakingTopics: orgRecord.fields.Speaking_Topics || []
        }
      })
    };

  } catch (error) {
    console.error('[Organization By Member] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Failed to fetch organization',
        message: error.message
      })
    };
  }
};