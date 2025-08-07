// netlify/functions/utils/auth.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET;

function generateToken(userId, email) {
  return jwt.sign(
    { userId, email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

function getTokenFromHeaders(headers) {
  const authorization = headers.authorization || '';
  const token = authorization.replace('Bearer ', '');
  return token;
}

async function requireAuth(event) {
  const token = getTokenFromHeaders(event.headers);
  
  if (!token) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'No token provided' })
    };
  }
  
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Invalid token' })
    };
  }
  
  return decoded;
}

module.exports = {
  generateToken,
  verifyToken,
  hashPassword,
  verifyPassword,
  getTokenFromHeaders,
  requireAuth
};