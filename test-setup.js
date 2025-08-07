// File: test-setup.js
// Run this with: node test-setup.js
// This will verify your environment is set up correctly

require('dotenv').config();

console.log('🔍 Checking environment setup...\n');

// 1. Check required environment variables
console.log('1. Environment Variables:');
const requiredVars = {
  'AIRTABLE_API_KEY': process.env.AIRTABLE_API_KEY,
  'AIRTABLE_BASE_ID': process.env.AIRTABLE_BASE_ID,
  'JWT_SECRET': process.env.JWT_SECRET
};

let hasAllVars = true;
for (const [name, value] of Object.entries(requiredVars)) {
  if (!value) {
    console.log(`   ❌ ${name}: MISSING`);
    hasAllVars = false;
  } else {
    const masked = value.substring(0, 4) + '...' + value.substring(value.length - 4);
    console.log(`   ✅ ${name}: ${masked}`);
  }
}

// 2. Check Airtable connection
console.log('\n2. Testing Airtable Connection:');
if (hasAllVars) {
  const Airtable = require('airtable');
  try {
    const base = new Airtable({ 
      apiKey: process.env.AIRTABLE_API_KEY 
    }).base(process.env.AIRTABLE_BASE_ID);
    
    // Try to access the Members table
    const table = base('Members');
    console.log('   ✅ Airtable client created successfully');
    
    // Try a simple query
    table.select({
      maxRecords: 1
    }).firstPage((err, records) => {
      if (err) {
        console.log('   ❌ Failed to query Members table:', err.message);
        console.log('      Make sure your table is named "Members" (case-sensitive)');
      } else {
        console.log('   ✅ Successfully connected to Members table');
      }
    });
  } catch (error) {
    console.log('   ❌ Failed to create Airtable client:', error.message);
  }
} else {
  console.log('   ⚠️  Cannot test - missing environment variables');
}

// 3. Check required npm packages
console.log('\n3. Required NPM Packages:');
const requiredPackages = [
  'airtable',
  'bcryptjs',
  'jsonwebtoken',
  'stripe',
  'dotenv'
];

for (const pkg of requiredPackages) {
  try {
    require.resolve(pkg);
    const version = require(`${pkg}/package.json`).version;
    console.log(`   ✅ ${pkg} (v${version})`);
  } catch (e) {
    console.log(`   ❌ ${pkg} - NOT INSTALLED`);
    console.log(`      Run: npm install ${pkg}`);
  }
}

// 4. Check Airtable table structure
console.log('\n4. Airtable Table Requirements:');
console.log('   Make sure your Airtable base has these tables:');
console.log('   - Members (with fields: Name, Email, Password_Hash, Member_Type, Status, etc.)');
console.log('   - Organizations');
console.log('   - Subscriptions');
console.log('   - Payments');
console.log('   - Contact_Submissions');
console.log('   - Speaking_Opportunities');
console.log('   - Applications');
console.log('   - Reviews');

// 5. Test password hashing
console.log('\n5. Testing Password Hashing:');
try {
  const bcrypt = require('bcryptjs');
  const testPassword = 'TestPassword123';
  const hash = bcrypt.hashSync(testPassword, 10);
  const isValid = bcrypt.compareSync(testPassword, hash);
  if (isValid) {
    console.log('   ✅ Password hashing works correctly');
  } else {
    console.log('   ❌ Password hashing verification failed');
  }
} catch (error) {
  console.log('   ❌ Password hashing error:', error.message);
}

// 6. Test JWT generation
console.log('\n6. Testing JWT Token Generation:');
if (process.env.JWT_SECRET) {
  try {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { userId: 'test123', email: 'test@example.com' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.userId === 'test123') {
      console.log('   ✅ JWT generation and verification works');
    } else {
      console.log('   ❌ JWT verification failed');
    }
  } catch (error) {
    console.log('   ❌ JWT error:', error.message);
  }
} else {
  console.log('   ⚠️  Cannot test - JWT_SECRET not set');
}

console.log('\n📋 Summary:');
if (hasAllVars) {
  console.log('   Environment variables are configured.');
  console.log('   Run "netlify dev" to start your local server on port 8888');
} else {
  console.log('   ⚠️  Some environment variables are missing!');
  console.log('   Create a .env file in your project root with the required variables.');
}

console.log('\n💡 Next Steps:');
console.log('1. Make sure all environment variables are set in .env file');
console.log('2. Ensure your Airtable base has all required tables');
console.log('3. Install any missing npm packages');
console.log('4. Run "netlify dev" to start the local server');
console.log('5. Test the registration at http://localhost:8888');