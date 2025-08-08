// find-tables.js
// Run with: node find-tables.js
// This will show you all table names in your base

require('dotenv').config();

if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
  console.error('❌ Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID in .env file');
  process.exit(1);
}

const Airtable = require('airtable');
const base = new Airtable({ 
  apiKey: process.env.AIRTABLE_API_KEY 
}).base(process.env.AIRTABLE_BASE_ID);

console.log('🔍 Finding all tables in your Airtable base...\n');
console.log('Base ID:', process.env.AIRTABLE_BASE_ID);
console.log('\n=====================================\n');

// Try common table name variations
const possibleTableNames = [
  'Members',      // What the code expects
  'members',      // lowercase
  'Member',       // singular
  'member',       // singular lowercase
  'MEMBERS',      // all caps
  'Users',        // alternative name
  'users',
  'User',
  'user',
  'Speakers',     // other possibilities
  'speakers',
  'People',
  'people',
  'Contacts',
  'contacts'
];

console.log('Testing possible table names:\n');

let foundTable = null;

async function checkTables() {
  for (const tableName of possibleTableNames) {
    try {
      const table = base(tableName);
      const records = await table.select({ maxRecords: 1 }).firstPage();
      console.log(`✅ FOUND: "${tableName}" - This table exists!`);
      
      if (!foundTable) {
        foundTable = tableName;
        
        // Check fields in this table
        if (records.length > 0) {
          console.log(`   Fields in ${tableName}:`);
          Object.keys(records[0].fields).forEach(field => {
            console.log(`     • ${field}`);
          });
        }
      }
    } catch (error) {
      // Table doesn't exist, that's okay
    }
  }
  
  console.log('\n=====================================\n');
  
  if (foundTable) {
    console.log('📋 SOLUTION:\n');
    console.log(`Your table is named "${foundTable}" not "Members"`);
    console.log('\nYou have two options:\n');
    console.log('OPTION 1 (Easiest): Rename your table in Airtable');
    console.log(`  1. Go to your Airtable base`);
    console.log(`  2. Click on the "${foundTable}" table name`);
    console.log(`  3. Rename it to exactly "Members" (capital M)`);
    console.log('\nOPTION 2: Update the code to use your table name');
    console.log(`  1. Open netlify/functions/utils/airtable.js`);
    console.log(`  2. Change line:  members: base ? base('Members') : null,`);
    console.log(`  3. To:           members: base ? base('${foundTable}') : null,`);
  } else {
    console.log('❌ Could not find any common table names.\n');
    console.log('Please check your Airtable base and see what your table is actually named.');
    console.log('\nTo find your table name:');
    console.log('1. Go to https://airtable.com');
    console.log('2. Open your base');
    console.log('3. Look at the tab names at the top');
    console.log('4. The main user/member table name is what we need');
    console.log('\nOnce you know the name, either:');
    console.log('- Rename it to "Members" in Airtable, OR');
    console.log('- Update the code to use your table name');
  }
}

checkTables().catch(console.error);