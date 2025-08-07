// netlify/functions/utils/airtable.js
const Airtable = require('airtable');

const base = new Airtable({ 
  apiKey: process.env.AIRTABLE_API_KEY 
}).base(process.env.AIRTABLE_BASE_ID);

const tables = {
  members: base('Members'),
  organizations: base('Organizations'),
  subscriptions: base('Subscriptions'),
  payments: base('Payments'),
  contactSubmissions: base('Contact_Submissions'),
  speakingOpportunities: base('Speaking_Opportunities'),
  applications: base('Applications'),
  reviews: base('Reviews')
};

async function findByField(table, fieldName, value) {
  try {
    const records = await table.select({
      filterByFormula: `{${fieldName}} = '${value}'`,
      maxRecords: 1
    }).firstPage();
    
    return records.length > 0 ? records[0] : null;
  } catch (error) {
    console.error('Airtable find error:', error);
    throw error;
  }
}

async function createRecord(table, fields) {
  try {
    const record = await table.create(fields);
    return record;
  } catch (error) {
    console.error('Airtable create error:', error);
    throw error;
  }
}

async function updateRecord(table, recordId, fields) {
  try {
    const record = await table.update(recordId, fields);
    return record;
  } catch (error) {
    console.error('Airtable update error:', error);
    throw error;
  }
}

module.exports = {
  tables,
  findByField,
  createRecord,
  updateRecord,
  base
};