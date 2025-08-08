// File: netlify/functions/auth-verify.js
const { verifyToken, getTokenFromHeaders } = require('./utils/auth');

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

  try {
    // Get token from headers
    const token = getTokenFromHeaders(event.headers);
    
    if (!token) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          valid: false,
          error: 'No token provided'
        })
      };
    }

    // Verify the token
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          valid: false,
          error: 'Invalid or expired token'
        })
      };
    }

    // Token is valid
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        valid: true,
        userId: decoded.userId,
        email: decoded.email
      })
    };
  } catch (error) {
    console.error('Token verification error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        valid: false,
        error: 'Token verification failed'
      })
    };
  }
};