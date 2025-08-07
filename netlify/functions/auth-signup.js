// File: netlify/functions/auth-signup.js
const { tables, findByField, createRecord } = require('./utils/airtable');
const { hashPassword, generateToken } = require('./utils/auth');

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
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  try {
    const { 
      email, 
      password, 
      name, 
      memberType, 
      phone,
      location,
      bio,
      website,
      specialty,
      // Organization-specific fields
      organizationData
    } = JSON.parse(event.body);

    // Validate required fields
    if (!email || !password || !name || !memberType) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Missing required fields' 
        })
      };
    }

    // Validate member type
    if (!['Speaker', 'Organization'].includes(memberType)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Invalid member type' 
        })
      };
    }

    // Check if user exists
    const existingUser = await findByField(tables.members, 'Email', email);
    
    if (existingUser) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Email already registered' 
        })
      };
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create member record
    const memberFields = {
      Name: name,
      Email: email,
      Phone: phone || '',
      Member_Type: memberType,
      Location: location || '',
      Bio: bio || '',
      Website: website || '',
      Status: 'Active',
      Created_Date: new Date().toISOString(),
      Password_Hash: passwordHash
    };

    // Add specialty for speakers
    if (memberType === 'Speaker' && specialty) {
      memberFields.Specialty = Array.isArray(specialty) ? specialty : [specialty];
    }

    const newUser = await createRecord(tables.members, memberFields);

    // If organization, create organization record
    if (memberType === 'Organization' && organizationData) {
      try {
        await createRecord(tables.organizations, {
          Member_ID: [newUser.id],
          Organization_Name: organizationData.Organization_Name || name,
          Organization_Type: organizationData.Organization_Type || 'Other',
          Contact_Name: organizationData.Contact_Name || name,
          Speaking_Topics: organizationData.Speaking_Topics || [],
          Event_Frequency: organizationData.Event_Frequency || 'Monthly'
        });
      } catch (orgError) {
        console.error('Failed to create organization record:', orgError);
        // Continue anyway - member is created
      }
    }

    // Generate JWT token
    const token = generateToken(newUser.id, email);

    // Prepare user data for response
    const userData = {
      id: newUser.id,
      name: newUser.fields.Name,
      email: newUser.fields.Email,
      memberType: newUser.fields.Member_Type,
      status: newUser.fields.Status
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        token,
        user: userData,
        message: 'Account created successfully'
      })
    };
  } catch (error) {
    console.error('Signup error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'Failed to create account',
        message: error.message 
      })
    };
  }
};