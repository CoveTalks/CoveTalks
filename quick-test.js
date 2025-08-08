// quick-test.js
// Run with: node quick-test.js
// This specifically tests the Email field lookup

require('dotenv').config();

console.log('🔍 Quick Email Field Test\n');

// Check env vars first
if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
  console.error('❌ Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID in .env file');
  process.exit(1);
}

const Airtable = require('airtable');
const base = new Airtable({ 
  apiKey: process.env.AIRTABLE_API_KEY 
}).base(process.env.AIRTABLE_BASE_ID);

async function testEmailField() {
  console.log('1️⃣ Testing Members table access...');
  
  try {
    const membersTable = base('Members');
    
    // First, just try to access the table
    const records = await membersTable.select({
      maxRecords: 1
    }).firstPage();
    
    console.log('✅ Members table accessible');
    
    if (records.length > 0) {
      console.log('\n2️⃣ Fields in your Members table:');
      const fields = Object.keys(records[0].fields);
      fields.forEach(f => console.log(`   • ${f}`));
      
      // Check if Email field exists
      if (fields.includes('Email')) {
        console.log('\n✅ Email field exists!');
      } else {
        console.log('\n❌ Email field NOT FOUND!');
        console.log('   Possible issues:');
        console.log('   - Field might be named differently (email, EMAIL, Email Address, etc.)');
        console.log('   - Field might not exist');
        console.log('\n   📝 Please add a field named exactly "Email" (capital E) of type "Email"');
      }
    } else {
      console.log('ℹ️  Table is empty, trying to check fields anyway...');
    }
    
    // Now test the exact lookup that's failing
    console.log('\n3️⃣ Testing email lookup (same as signup uses)...');
    const testEmail = 'nonexistent@example.com';
    
    try {
      const filterFormula = `{Email} = '${testEmail}'`;
      console.log('   Using formula:', filterFormula);
      
      const results = await membersTable.select({
        filterByFormula: filterFormula,
        maxRecords: 1
      }).firstPage();
      
      console.log('✅ Email lookup works!');
      console.log(`   Found ${results.length} records (expected: 0)`);
      
    } catch (lookupError) {
      console.error('❌ Email lookup failed!');
      console.error('   Error:', lookupError.message);
      
      if (lookupError.message.includes('INVALID_REQUEST_UNKNOWN')) {
        console.log('\n🔧 FIX: The Email field doesn\'t exist or is named differently');
        console.log('   Go to Airtable and check the exact field name');
      }
    }
    
  } catch (error) {
    console.error('❌ Failed to access Members table:', error.message);
    
    if (error.statusCode === 404) {
      console.log('\n🔧 FIX: Table must be named exactly "Members" (capital M)');
    } else if (error.statusCode === 401) {
      console.log('\n🔧 FIX: Invalid API key - check your .env file');
    }
  }
}

// Also test the actual function that's failing
console.log('\n4️⃣ Testing findByField function (exact same as your code)...');

async function findByField(table, fieldName, value) {
  console.log(`   Looking up ${fieldName} = ${value}`);
  
  try {
    const escapedValue = value.replace(/'/g, "\\'");
    const filterFormula = `{${fieldName}} = '${escapedValue}'`;
    console.log('   Filter formula:', filterFormula);
    
    const records = await table.select({
      filterByFormula: filterFormula,
      maxRecords: 1
    }).firstPage();
    
    console.log(`   ✅ Found ${records.length} records`);
    return records.length > 0 ? records[0] : null;
  } catch (error) {
    console.error('   ❌ Error:', error.message);
    console.error('   Status:', error.statusCode);
    console.error('   Error type:', error.error);
    throw error;
  }
}

async function testFindByField() {
  try {
    const membersTable = base('Members');
    const result = await findByField(membersTable, 'Email', 'test@example.com');
    console.log('✅ findByField works!');
  } catch (error) {
    console.error('❌ findByField failed:', error.message);
  }
}

// Run all tests
testEmailField().then(() => {
  return testFindByField();
}).then(() => {
  console.log('\n📋 Test complete! Check the results above.');
}).catch(console.error);