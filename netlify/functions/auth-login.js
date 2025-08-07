// File: netlify/functions/auth-login.js
// ENHANCED DEBUG VERSION with schema corrections

const { tables, findByField, updateRecord } = require('./utils/airtable');
const { verifyPassword, generateToken } = require('./utils/auth');

exports.handler = async (event) => {
  console.log('=====================================');
  console.log('🔐 Auth-login function called');
  console.log('Method:', event.httpMethod);
  console.log('=====================================\n');
  
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
    console.log('📝 Parsing login request...');
    const { email, password } = JSON.parse(event.body);
    console.log('   Email:', email);
    console.log('   Has Password:', !!password);

    // Validate input
    if (!email || !password) {
      console.error('❌ Missing credentials');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Email and password required' 
        })
      };
    }

    // Find user by email
    console.log('\n🔍 STEP 1: Looking up user by email...');
    console.log('   Searching for:', email);
    
    let user;
    try {
      user = await findByField(tables.members, 'Email', email);
      if (user) {
        console.log('   ✅ User found');
        console.log('   Record ID:', user.id);
        console.log('   Member_ID:', user.fields.Member_ID);
        console.log('   Member Type:', user.fields.Member_Type);
        console.log('   Status:', user.fields.Status);
      } else {
        console.log('   ❌ No user found with this email');
      }
    } catch (lookupError) {
      console.error('❌ Database lookup failed:', lookupError.message);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Database lookup failed',
          details: lookupError.message,
          debug: true
        })
      };
    }
    
    if (!user) {
      console.log('❌ Invalid credentials - user not found');
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Invalid credentials' 
        })
      };
    }

    // Check if account is active
    console.log('\n📋 STEP 2: Checking account status...');
    if (user.fields.Status !== 'Active') {
      console.log('   ❌ Account is not active:', user.fields.Status);
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Account is not active. Please contact support.' 
        })
      };
    }
    console.log('   ✅ Account is active');

    // Verify password
    console.log('\n🔐 STEP 3: Verifying password...');
    console.log('   Password hash exists:', !!user.fields.Password_Hash);
    console.log('   Hash length:', user.fields.Password_Hash ? user.fields.Password_Hash.length : 0);
    
    let isValid;
    try {
      isValid = await verifyPassword(password, user.fields.Password_Hash);
      console.log('   Password verification result:', isValid ? '✅ Valid' : '❌ Invalid');
    } catch (verifyError) {
      console.error('❌ Password verification error:', verifyError.message);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Password verification failed',
          debug: true
        })
      };
    }
    
    if (!isValid) {
      console.log('❌ Invalid credentials - wrong password');
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Invalid credentials' 
        })
      };
    }

    // Update last login timestamp
    console.log('\n📅 STEP 4: Updating last login...');
    try {
      const loginDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      await updateRecord(tables.members, user.id, {
        Last_Login: loginDate
      });
      console.log('   ✅ Last login updated to:', loginDate);
    } catch (updateError) {
      console.error('   ⚠️ Failed to update last login:', updateError.message);
      console.log('   Continuing anyway - login is still successful');
    }

    // Generate JWT token
    console.log('\n🔑 STEP 5: Generating JWT token...');
    let token;
    try {
      token = generateToken(user.id, email);
      console.log('   ✅ Token generated successfully');
      console.log('   Token length:', token.length);
    } catch (tokenError) {
      console.error('❌ Token generation failed:', tokenError.message);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Failed to generate token',
          debug: true
        })
      };
    }

    // Get subscription status if speaker
    console.log('\n📊 STEP 6: Fetching additional data...');
    let subscriptionStatus = null;
    if (user.fields.Member_Type === 'Speaker') {
      console.log('   Looking up subscription for speaker...');
      try {
        const subscriptions = await tables.subscriptions.select({
          filterByFormula: `AND({Member_ID} = '${user.id}', {Status} = 'Active')`,
          maxRecords: 1
        }).firstPage();
        
        if (subscriptions.length > 0) {
          const sub = subscriptions[0].fields;
          subscriptionStatus = {
            plan: sub.Plan_Type,
            status: sub.Status,
            billingPeriod: sub.Billing_Period,
            nextBilling: sub.Next_Billing_Date,
            amount: sub.Amount
          };
          console.log('   ✅ Subscription found:', subscriptionStatus.plan);
        } else {
          console.log('   ℹ️ No active subscription found');
        }
      } catch (subError) {
        console.error('   ⚠️ Failed to fetch subscription:', subError.message);
      }
    }

    // Get organization info if organization member
    let organizationInfo = null;
    if (user.fields.Member_Type === 'Organization') {
      console.log('   Looking up organization details...');
      try {
        const orgs = await tables.organizations.select({
          filterByFormula: `SEARCH('${user.id}', ARRAYJOIN({Member_ID}))`,
          maxRecords: 1
        }).firstPage();
        
        if (orgs.length > 0) {
          const org = orgs[0].fields;
          organizationInfo = {
            orgId: orgs[0].id,
            organizationName: org.Organization_Name,
            organizationType: org.Organization_Type,
            contactName: org.Contact_Name
          };
          console.log('   ✅ Organization found:', organizationInfo.organizationName);
        } else {
          console.log('   ℹ️ No organization record found');
        }
      } catch (orgError) {
        console.error('   ⚠️ Failed to fetch organization:', orgError.message);
      }
    }

    // Prepare user data for response - matching YOUR schema field names
    const userData = {
      id: user.id,  // Airtable record ID
      memberId: user.fields.Member_ID,  // Your autonumber field
      name: user.fields.Name,
      email: user.fields.Email,
      memberType: user.fields.Member_Type,
      status: user.fields.Status,
      location: user.fields.Location || null,
      bio: user.fields.Bio || null,
      website: user.fields.Website || null,
      specialty: user.fields.Specialty || [],
      profileImage: user.fields.Profile_Image ? user.fields.Profile_Image[0]?.url : null,
      bookingLink: user.fields.Booking_Link || null,
      subscription: subscriptionStatus,
      organization: organizationInfo
    };

    console.log('\n✅ LOGIN SUCCESSFUL!');
    console.log('   User:', userData.email);
    console.log('   Type:', userData.memberType);
    console.log('   Has Subscription:', !!subscriptionStatus);
    console.log('   Has Organization:', !!organizationInfo);
    console.log('=====================================\n');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        token,
        user: userData,
        message: 'Login successful'
      })
    };
  } catch (error) {
    console.error('\n❌ UNEXPECTED ERROR IN LOGIN:');
    console.error('   Error type:', error.constructor.name);
    console.error('   Error message:', error.message);
    console.error('   Stack trace:', error.stack);
    console.error('=====================================\n');
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'Login failed',
        message: error.message,
        debug: true
      })
    };
  }
};