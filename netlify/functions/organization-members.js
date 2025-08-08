// File: netlify/functions/organization-members.js
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
    // Get organization name from query parameters
    const { orgName, orgId } = event.queryStringParameters || {};
    
    if (!orgName && !orgId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Organization name or ID required'
        })
      };
    }

    console.log('[Organization Members] Looking for members of:', orgName || orgId);

    let filterFormula = '';
    if (orgName) {
      // Find all organization records with the same organization name
      filterFormula = `{Organization_Name} = '${orgName.replace(/'/g, "\\'")}}'`;
    } else if (orgId) {
      // Find organization by ID
      filterFormula = `RECORD_ID() = '${orgId}'`;
    }

    // Get all organization records that match
    const orgRecords = await tables.organizations.select({
      filterByFormula: filterFormula
    }).all();

    console.log('[Organization Members] Found', orgRecords.length, 'organization records');

    if (orgRecords.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Organization not found'
        })
      };
    }

    // Get all member IDs from these organization records
    const memberIds = [];
    orgRecords.forEach(orgRecord => {
      if (orgRecord.fields.Member_ID && orgRecord.fields.Member_ID.length > 0) {
        memberIds.push(...orgRecord.fields.Member_ID);
      }
    });

    console.log('[Organization Members] Found member IDs:', memberIds);

    if (memberIds.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          members: [],
          organization: {
            name: orgRecords[0].fields.Organization_Name,
            type: orgRecords[0].fields.Organization_Type
          }
        })
      };
    }

    // Get member details for each member ID
    const members = [];
    for (const memberId of memberIds) {
      try {
        const member = await tables.members.find(memberId);
        if (member) {
          // Determine role from organization record
          const orgRecord = orgRecords.find(org => 
            org.fields.Member_ID && org.fields.Member_ID.includes(memberId)
          );
          
          const memberData = {
            id: member.id,
            name: member.fields.Name,
            email: isAuthenticated ? member.fields.Email : null,
            phone: isAuthenticated ? member.fields.Phone : null,
            location: member.fields.Location,
            role: orgRecord.fields.Contact_Name === member.fields.Name ? 'Primary Contact' : 'Team Member',
            memberType: member.fields.Member_Type
          };
          
          members.push(memberData);
        }
      } catch (error) {
        console.error('[Organization Members] Error fetching member:', memberId, error);
        // Continue with other members
      }
    }

    console.log('[Organization Members] Returning', members.length, 'members');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        members: members,
        organization: {
          name: orgRecords[0].fields.Organization_Name,
          type: orgRecords[0].fields.Organization_Type,
          contactName: orgRecords[0].fields.Contact_Name
        }
      })
    };

  } catch (error) {
    console.error('[Organization Members] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Failed to fetch organization members',
        message: error.message
      })
    };
  }
};