// netlify/functions/utils/airtable.js
// UPDATED VERSION with Specialty table support

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
  reviews: base ? base('Reviews') : null,
  specialty: base ? base('Specialty') : null  // NEW: Added Specialty table
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

/**
 * Find or create specialty records and return their IDs
 * @param {Array<string>} specialtyNames - Array of specialty names
 * @returns {Promise<Array<string>>} Array of Airtable record IDs
 */
async function resolveSpecialties(specialtyNames) {
  if (!specialtyNames || specialtyNames.length === 0) {
    return [];
  }

  const specialtyIds = [];
  
  for (const specialtyName of specialtyNames) {
    const trimmedName = specialtyName.trim();
    if (!trimmedName) continue;
    
    try {
      // First, check if this specialty already exists
      console.log(`   Checking for specialty: "${trimmedName}"`);
      
      const existingSpecialties = await tables.specialty.select({
        filterByFormula: `LOWER({Name}) = LOWER('${trimmedName.replace(/'/g, "\\'")}')`
      }).firstPage();
      
      if (existingSpecialties.length > 0) {
        // Specialty exists, use its ID
        const specialtyId = existingSpecialties[0].id;
        specialtyIds.push(specialtyId);
        console.log(`   ✅ Found existing specialty: ${trimmedName} (ID: ${specialtyId})`);
      } else {
        // Specialty doesn't exist, create it
        console.log(`   Creating new specialty: ${trimmedName}`);
        
        const newSpecialty = await createRecord(tables.specialty, {
          Name: trimmedName
        });
        
        specialtyIds.push(newSpecialty.id);
        console.log(`   ✅ Created new specialty: ${trimmedName} (ID: ${newSpecialty.id})`);
      }
    } catch (error) {
      console.error(`   ❌ Failed to process specialty "${trimmedName}":`, error.message);
      // Continue with other specialties even if one fails
    }
  }
  
  return specialtyIds;
}

// Seed function to populate common specialties (run once)
async function seedSpecialties() {
  console.log('=== SEEDING SPECIALTY TABLE ===');
  
  const commonSpecialties = [
    'Mortgage Banking',
    'Banking',
    'Finance',
    'Real Estate',
    'Technology',
    'Healthcare',
    'Education',
    'Marketing',
    'Sales',
    'Leadership',
    'Management',
    'Entrepreneurship',
    'Innovation',
    'Digital Transformation',
    'Cybersecurity',
    'Data Analytics',
    'Artificial Intelligence',
    'Sustainability',
    'Diversity & Inclusion',
    'Human Resources',
    'Project Management',
    'Agile Methodology',
    'Customer Service',
    'Public Speaking',
    'Communications',
    'Social Media',
    'Content Strategy',
    'Brand Development',
    'Business Strategy',
    'Change Management'
  ];
  
  for (const name of commonSpecialties) {
    try {
      // Check if already exists
      const existing = await tables.specialty.select({
        filterByFormula: `{Name} = '${name.replace(/'/g, "\\'")}'`
      }).firstPage();
      
      if (existing.length === 0) {
        await tables.specialty.create({ Name: name });
        console.log(`✅ Created: ${name}`);
      } else {
        console.log(`⏭️ Skipped (already exists): ${name}`);
      }
    } catch (error) {
      console.error(`❌ Failed to seed specialty "${name}":`, error.message);
    }
  }
  
  console.log('=== SEEDING COMPLETE ===');
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
  resolveSpecialties,  // Export the new function
  seedSpecialties,      // Export seed function
  base,
  testConnection
};