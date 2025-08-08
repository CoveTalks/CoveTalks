// File: netlify/functions/contact-submit.js
// Handles contact form submissions securely

const { tables, createRecord } = require('./utils/airtable');

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
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
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  try {
    const data = JSON.parse(event.body);
    
    // Validate required fields
    if (!data.Name || !data.Email || !data.Subject || !data.Message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Missing required fields' 
        })
      };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.Email)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Invalid email address' 
        })
      };
    }

    // Create the contact submission record
    const contactData = {
      Name: data.Name.substring(0, 100), // Limit length
      Email: data.Email.substring(0, 100),
      Phone: data.Phone ? data.Phone.substring(0, 20) : '',
      Subject: data.Subject.substring(0, 200),
      Message: data.Message.substring(0, 5000), // Limit to 5000 chars
      Type: data.Type || data.Subject || 'General',
      Status: 'New',
      Response_Sent: false
      // Submitted_Date is automatically set by Airtable (Created time field)
    };

    // If user is logged in, link to their member record
    if (data.Member_ID) {
      contactData.Member_ID = [data.Member_ID];
    }

    console.log('Creating contact submission:', contactData.Subject);
    
    const record = await createRecord(tables.contactSubmissions, contactData);
    
    console.log('Contact submission created:', record.id);

    // Optional: Send notification email to admin
    // You could add email notification here using SendGrid or similar

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Your message has been received. We will respond within 24 hours.',
        id: record.id
      })
    };
  } catch (error) {
    console.error('Contact submission error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'Failed to submit message. Please try again or email us directly.',
        message: error.message 
      })
    };
  }
};