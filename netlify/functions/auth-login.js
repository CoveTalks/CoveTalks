// File: netlify/functions/auth-login.js
const { tables, findByField, updateRecord } = require('./utils/airtable');
const { verifyPassword, generateToken } = require('./utils/auth');

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
    const { email, password } = JSON.parse(event.body);

    // Validate input
    if (!email || !password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Email and password required' 
        })
      };
    }

    // Find user by email
    const user = await findByField(tables.members, 'Email', email);
    
    if (!user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Invalid credentials' 
        })
      };
    }

    // Check if account is active
    if (user.fields.Status !== 'Active') {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Account is not active. Please contact support.' 
        })
      };
    }

    // Verify password
    const isValid = await verifyPassword(password, user.fields.Password_Hash);
    
    if (!isValid) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Invalid credentials' 
        })
      };
    }

    // Update last login timestamp
    try {
      await updateRecord(tables.members, user.id, {
        Last_Login: new Date().toISOString()
      });
    } catch (updateError) {
      console.error('Failed to update last login:', updateError);
      // Continue anyway - login is successful
    }

    // Generate JWT token
    const token = generateToken(user.id, email);

    // Get subscription status if speaker
    let subscriptionStatus = null;
    if (user.fields.Member_Type === 'Speaker') {
      try {
        const subscriptions = await tables.subscriptions.select({
          filterByFormula: `AND({Member_ID} = '${user.id}', {Status} = 'Active')`,
          maxRecords: 1
        }).firstPage();
        
        if (subscriptions.length > 0) {
          subscriptionStatus = {
            plan: subscriptions[0].fields.Plan_Type,
            status: subscriptions[0].fields.Status,
            nextBilling: subscriptions[0].fields.Next_Billing_Date
          };
        }
      } catch (subError) {
        console.error('Failed to fetch subscription:', subError);
      }
    }

    // Prepare user data for response
    const userData = {
      id: user.id,
      name: user.fields.Name,
      email: user.fields.Email,
      memberType: user.fields.Member_Type,
      status: user.fields.Status,
      location: user.fields.Location,
      profileImage: user.fields.Profile_Image ? user.fields.Profile_Image[0]?.url : null,
      subscription: subscriptionStatus
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        token,
        user: userData,
        message: 'Login successful'
      })
    };
  } catch (error) {
    console.error('Login error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'Login failed',
        message: error.message 
      })
    };
  }
};