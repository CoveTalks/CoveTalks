// File: netlify/functions/utils/auth-supabase.js
// Authentication utilities for Supabase

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Verify JWT token and return user info
 * @param {string} token - JWT token from Authorization header
 * @returns {Object} User object or error
 */
async function verifyToken(token) {
  try {
    // Verify the JWT token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error) {
      console.error('Token verification error:', error);
      return { error: 'Invalid or expired token' };
    }
    
    if (!user) {
      return { error: 'User not found' };
    }
    
    return { user };
  } catch (error) {
    console.error('Auth verification error:', error);
    return { error: 'Authentication failed' };
  }
}

/**
 * Extract and verify auth from request headers
 * @param {Object} event - Netlify function event
 * @returns {Object} Auth result with user or error response
 */
async function requireAuth(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization;
  
  if (!authHeader) {
    return {
      statusCode: 401,
      body: JSON.stringify({ 
        success: false,
        error: 'Authorization header required' 
      })
    };
  }
  
  // Extract token from "Bearer TOKEN" format
  const token = authHeader.replace('Bearer ', '');
  
  if (!token) {
    return {
      statusCode: 401,
      body: JSON.stringify({ 
        success: false,
        error: 'Invalid authorization format' 
      })
    };
  }
  
  // Verify token
  const { user, error } = await verifyToken(token);
  
  if (error) {
    return {
      statusCode: 401,
      body: JSON.stringify({ 
        success: false,
        error: error 
      })
    };
  }
  
  // Return user info for use in function
  return {
    userId: user.id,
    email: user.email,
    user: user
  };
}

/**
 * Get user from Supabase by ID
 * @param {string} userId - User ID
 * @returns {Object} User object from members table
 */
async function getUser(userId) {
  try {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error('Error fetching user:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Get user error:', error);
    return null;
  }
}

module.exports = {
  supabase,
  verifyToken,
  requireAuth,
  getUser
};