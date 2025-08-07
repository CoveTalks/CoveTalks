// netlify/functions/utils/airtable.js
// FIXED VERSION with better error handling and debugging

const Airtable = require('airtable');

// Check for required environment variables
if (!process.env.AIRTABLE_API_KEY) {
  console.error('ERROR: AIRTABLE_API_KEY is not set in environment variables');
}

if (!process.env.AIRTABLE_BASE_ID) {
  console.error('ERROR: AIRTABLE_BASE_ID is not set in environment variables');
}

// Initialize Airtable with error handling
let base;
try {
  base = new Airtable({ 
    apiKey: process.env.AIRTABLE_API_KEY,
    endpointUrl: 'https://api.airtable.com' // Explicitly set endpoint
  }).base(process.env.AIRTABLE_BASE_ID);
  console.log('Airtable base initialized successfully');
} catch (error) {
  console.error('Failed to initialize Airtable:', error);
}

const tables = {
  members: base ? base('Members') : null,
  organizations: base ? base('Organizations') : null,
  subscriptions: base ? base('Subscriptions') : null,
  payments: base ? base('Payments') : null,
  contactSubmissions: base ? base('Contact_Submissions') : null,
  speakingOpportunities: base ? base('Speaking_Opportunities') : null,
  applications: base ? base('Applications') : null,
  reviews: base ? base('Reviews') : null
};

async function findByField(table, fieldName, value) {
  console.log(`Looking up ${fieldName} = ${value} in table`);
  
  if (!table) {
    console.error('Table is null - Airtable not initialized properly');
    throw new Error('Database not initialized');
  }
  
  try {
    // Escape single quotes in the value to prevent formula errors
    const escapedValue = value.replace(/'/g, "\\'");
    
    // Build the filter formula
    const filterFormula = `{${fieldName}} = '${escapedValue}'`;
    console.log('Using filter formula:', filterFormula);
    
    const records = await table.select({
      filterByFormula: filterFormula,
      maxRecords: 1
    }).firstPage();
    
    console.log(`Found ${records.length} records`);
    return records.length > 0 ? records[0] : null;
  } catch (error) {
    console.error('Airtable find error:', error);
    console.error('Error type:', error.error || error.message);
    console.error('Status code:', error.statusCode);
    
    // Provide more specific error messages
    if (error.error === 'INVALID_REQUEST_UNKNOWN') {
      throw new Error(`Field "${fieldName}" may not exist in the table. Check your Airtable schema.`);
    } else if (error.statusCode === 401) {
      throw new Error('Invalid Airtable API key. Check your AIRTABLE_API_KEY environment variable.');
    } else if (error.statusCode === 403) {
      throw new Error('Access denied. Check that your API key has access to this base.');
    } else if (error.statusCode === 404) {
      throw new Error('Table not found. Check that the table name is correct (case-sensitive).');
    } else if (error.statusCode === 422) {
      throw new Error(`Invalid filter formula for field "${fieldName}". Check that the field exists and is spelled correctly.`);
    } else {
      throw new Error(`Database query failed: ${error.message || error.error || 'Unknown error'}`);
    }
  }
}

async function createRecord(table, fields) {
  console.log('Creating record with fields:', Object.keys(fields));
  
  if (!table) {
    console.error('Table is null - Airtable not initialized properly');
    throw new Error('Database not initialized');
  }
  
  try {
    // Clean up fields - remove any undefined values
    const cleanFields = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined && value !== null) {
        cleanFields[key] = value;
      }
    }
    
    console.log('Cleaned fields:', Object.keys(cleanFields));
    const record = await table.create(cleanFields);
    console.log('Record created successfully with ID:', record.id);
    return record;
  } catch (error) {
    console.error('Airtable create error:', error);
    console.error('Error details:', error.error || error.message);
    console.error('Status code:', error.statusCode);
    
    // Provide more specific error messages
    if (error.error === 'INVALID_REQUEST_UNKNOWN') {
      console.error('Field validation error. Check that all field names match your Airtable schema exactly.');
      console.error('Attempted fields:', Object.keys(fields));
      throw new Error('Invalid field names. Check that all fields exist in your Airtable table.');
    } else if (error.statusCode === 401) {
      throw new Error('Invalid Airtable API key');
    } else if (error.statusCode === 403) {
      throw new Error('No permission to create records in this table');
    } else if (error.statusCode === 404) {
      throw new Error('Table not found');
    } else if (error.statusCode === 422) {
      throw new Error(`Invalid field data: ${error.message}`);
    } else {
      throw new Error(`Failed to create record: ${error.message || error.error || 'Unknown error'}`);
    }
  }
}

async function updateRecord(table, recordId, fields) {
  if (!table) {
    console.error('Table is null - Airtable not initialized properly');
    throw new Error('Database not initialized');
  }
  
  try {
    const record = await table.update(recordId, fields);
    return record;
  } catch (error) {
    console.error('Airtable update error:', error);
    throw error;
  }
}

// Test function to verify connection
async function testConnection() {
  console.log('Testing Airtable connection...');
  
  if (!base) {
    console.error('Airtable base not initialized');
    return false;
  }
  
  try {
    // Try to query the Members table
    const records = await tables.members.select({
      maxRecords: 1
    }).firstPage();
    
    console.log('✅ Successfully connected to Airtable');
    console.log(`   Found ${records.length} record(s) in Members table`);
    return true;
  } catch (error) {
    console.error('❌ Failed to connect to Airtable:', error.message);
    return false;
  }
}

module.exports = {
  tables,
  findByField,
  createRecord,
  updateRecord,
  base,
  testConnection
};