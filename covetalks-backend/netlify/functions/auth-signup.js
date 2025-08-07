const { tables, findByField, createRecord } = require('./utils/airtable');
const { hashPassword, generateToken } = require('./utils/auth');

exports.handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed'
    };
  }

  try {
    const { email, password, name, memberType, phone } = JSON.parse(event.body);

    // Validate required fields
    if (!email || !password || !name || !memberType) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Check if user already exists
    const existingUser = await findByField(tables.members, 'Email', email);
    if (existingUser) {
      return {
        statusCode: 409,
        body: JSON.stringify({ error: 'Email already registered' })
      };
    }

    // Hash the password
    const passwordHash = await hashPassword(password);

    // Create user in Airtable
    const newUser = await createRecord(tables.members, {
      Name: name,
      Email: email,
      Phone: phone || '',
      Member_Type: memberType,
      Password_Hash: passwordHash,
      Status: 'Active',
      Created_Date: new Date().toISOString()
    });

    // Generate JWT token
    const token = generateToken(newUser.id, email);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        token,
        user: {
          id: newUser.id,
          name: newUser.fields.Name,
          email: newUser.fields.Email,
          memberType: newUser.fields.Member_Type
        }
      })
    };
  } catch (error) {
    console.error('Signup error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to create account' })
    };
  }
};
