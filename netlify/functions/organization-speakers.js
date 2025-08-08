// File: netlify/functions/organization-speakers.js
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
    // Get organization ID from query parameters
    const { orgId } = event.queryStringParameters || {};
    
    if (!orgId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Organization ID required'
        })
      };
    }

    console.log('[Organization Speakers] Looking for speakers associated with organization:', orgId);

    // Find all Members where Member_Type = "Speaker" AND Organizations field equals this org ID
    // Note: Field name is "Organizations" (plural) based on CSV data
    const filterFormula = `AND({Member_Type} = 'Speaker', {Organizations} = '${orgId}')`;
    
    console.log('[Organization Speakers] Using filter formula:', filterFormula);
    
    const speakerRecords = await tables.members.select({
      filterByFormula: filterFormula,
      sort: [{ field: 'Name', direction: 'asc' }]
    }).all();

    console.log('[Organization Speakers] Found', speakerRecords.length, 'speaker records');

    // Format speakers for response
    const speakers = speakerRecords.map(speaker => ({
      id: speaker.id,
      name: speaker.fields.Name,
      email: isAuthenticated ? speaker.fields.Email : null,
      phone: isAuthenticated ? speaker.fields.Phone : null,
      location: speaker.fields.Location,
      bio: speaker.fields.Bio,
      specialty: speaker.fields.Specialty || [],
      website: speaker.fields.Website,
      profileImage: speaker.fields.Profile_Image ? speaker.fields.Profile_Image[0]?.url : null
    }));

    console.log('[Organization Speakers] Returning', speakers.length, 'speakers');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        speakers: speakers,
        organizationId: orgId
      })
    };

  } catch (error) {
    console.error('[Organization Speakers] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Failed to fetch organization speakers',
        message: error.message
      })
    };
  }
};