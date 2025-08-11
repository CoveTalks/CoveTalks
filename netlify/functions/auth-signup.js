// File: netlify/functions/auth-signup.js
// UPDATED VERSION with Specialty table linking

// Check for required environment variables at startup
const requiredEnvVars = ['AIRTABLE_API_KEY', 'AIRTABLE_BASE_ID', 'JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('🔴 Missing required environment variables:', missingEnvVars);
}

const { tables, findByField, createRecord, resolveSpecialties } = require('./utils/airtable');
const { hashPassword, generateToken } = require('./utils/auth');

exports.handler = async (event) => {
  console.log('=====================================');
  console.log('🚀 Auth-signup function called');
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
    // Check environment variables
    if (missingEnvVars.length > 0) {
      console.error('❌ Environment variables missing:', missingEnvVars);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Server configuration error',
          details: `Missing environment variables: ${missingEnvVars.join(', ')}`,
          debug: true
        })
      };
    }

    console.log('📝 Parsing request body...');
    const requestData = JSON.parse(event.body);
    console.log('Request data keys received:', Object.keys(requestData));
    
    const { 
      email, 
      password, 
      name, 
      memberType, 
      phone,
      location,
      bio,
      website,
      specialty,
      // Organization-specific fields
      organizationData
    } = requestData;

    // Log what we received (without password)
    console.log('📋 Signup attempt details:');
    console.log('   Email:', email);
    console.log('   Name:', name);
    console.log('   Member Type:', memberType);
    console.log('   Has Password:', !!password);
    console.log('   Has Phone:', !!phone);
    console.log('   Has Location:', !!location);
    console.log('   Has Bio:', !!bio);
    console.log('   Has Specialty:', !!specialty);
    console.log('   Has Organization Data:', !!organizationData);

    // Validate required fields
    if (!email || !password || !name || !memberType) {
      console.error('❌ Missing required fields:', { 
        hasEmail: !!email, 
        hasPassword: !!password, 
        hasName: !!name, 
        hasMemberType: !!memberType 
      });
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Missing required fields',
          details: {
            email: !email ? 'Email is required' : null,
            password: !password ? 'Password is required' : null,
            name: !name ? 'Name is required' : null,
            memberType: !memberType ? 'Member type is required' : null
          }
        })
      };
    }

    // Validate member type
    if (!['Speaker', 'Organization'].includes(memberType)) {
      console.error('❌ Invalid member type:', memberType);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: `Invalid member type: ${memberType}. Must be 'Speaker' or 'Organization'` 
        })
      };
    }

    // Check if user exists
    console.log('\n🔍 STEP 1: Checking if email already exists...');
    console.log('   Looking up:', email);
    
    let existingUser;
    try {
      existingUser = await findByField(tables.members, 'Email', email);
      console.log('   Lookup complete:', existingUser ? '⚠️ User exists' : '✅ Email available');
    } catch (lookupError) {
      console.error('❌ Database lookup failed:', lookupError.message);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Database lookup failed',
          details: lookupError.message,
          debug: true,
          tip: 'Check that the Email field exists in your Members table'
        })
      };
    }
    
    if (existingUser) {
      console.log('❌ Email already registered, returning 409');
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Email already registered' 
        })
      };
    }

    // Hash password
    console.log('\n🔐 STEP 2: Hashing password...');
    let passwordHash;
    try {
      passwordHash = await hashPassword(password);
      console.log('   ✅ Password hashed successfully');
      console.log('   Hash length:', passwordHash.length);
    } catch (hashError) {
      console.error('❌ Password hashing failed:', hashError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Password processing failed',
          details: hashError.message,
          debug: true
        })
      };
    }

    // Resolve specialties if this is a speaker
    let specialtyIds = [];
    if (memberType === 'Speaker' && specialty) {
      console.log('\n🔍 STEP 2.5: Resolving specialties...');
      
      // Convert specialty to array if it's a string
      const specialtyArray = Array.isArray(specialty) 
        ? specialty 
        : specialty.split(',').map(s => s.trim()).filter(s => s);
      
      // Get or create specialty records
      specialtyIds = await resolveSpecialties(specialtyArray);
      console.log(`   Resolved ${specialtyIds.length} specialties`);
    }

    // Create member record
    console.log('\n📝 STEP 3: Creating member record...');
    const memberFields = {
      Name: name,
      Email: email,
      Phone: phone || '',
      Member_Type: memberType,
      Location: location || '',
      Bio: bio || '',
      Website: website || '',
      Status: 'Active',
      Password_Hash: passwordHash
      // NOTE: Created_Date is automatically set by Airtable (Created time field)
      // NOTE: Member_ID is automatically set by Airtable (Autonumber field)
    };

    // Add specialty IDs for speakers (as linked records)
    if (memberType === 'Speaker' && specialtyIds.length > 0) {
      memberFields.Specialty = specialtyIds; // Array of record IDs for the linked field
      console.log('   Adding Specialty links:', specialtyIds);
    }

    console.log('   Fields to create:', Object.keys(memberFields));
    console.log('   Field values:');
    Object.entries(memberFields).forEach(([key, value]) => {
      if (key === 'Password_Hash') {
        console.log(`      ${key}: [HIDDEN - ${value.length} chars]`);
      } else if (key === 'Specialty') {
        console.log(`      ${key}: [${value.length} linked records]`);
      } else {
        console.log(`      ${key}:`, value);
      }
    });
    
    let newUser;
    try {
      newUser = await createRecord(tables.members, memberFields);
      console.log('   ✅ Member created successfully!');
      console.log('   Record ID:', newUser.id);
      console.log('   Member_ID (auto):', newUser.fields.Member_ID);
      console.log('   Created_Date (auto):', newUser.fields.Created_Date);
    } catch (createError) {
      console.error('❌ Failed to create member record:', createError);
      console.error('   Error type:', createError.constructor.name);
      console.error('   Error message:', createError.message);
      if (createError.error) {
        console.error('   Airtable error:', createError.error);
      }
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Failed to create member record',
          details: createError.message,
          airtableError: createError.error,
          debug: true,
          tip: 'Check that all field names match your Airtable schema exactly (case-sensitive)'
        })
      };
    }

    // If organization, create organization record
    if (memberType === 'Organization' && organizationData) {
      console.log('\n🏢 STEP 4: Creating organization record...');
      try {
        // Organization fields matching YOUR schema
        const orgFields = {
          Member_ID: [newUser.id], // Link to Members table - must be array
          Organization_Name: organizationData.Organization_Name || name,
          Organization_Type: organizationData.Organization_Type || 'Other',
          Contact_Name: organizationData.Contact_Name || name
        };
        
        // Add Speaking_Topics if provided (Multiple select field)
        if (organizationData.Speaking_Topics) {
          orgFields.Speaking_Topics = Array.isArray(organizationData.Speaking_Topics) 
            ? organizationData.Speaking_Topics 
            : [organizationData.Speaking_Topics];
        }
        
        // Add Event_Frequency if provided
        if (organizationData.Event_Frequency) {
          orgFields.Event_Frequency = organizationData.Event_Frequency;
        }
        
        console.log('   Organization fields:', Object.keys(orgFields));
        console.log('   Field values:', orgFields);
        
        const orgRecord = await createRecord(tables.organizations, orgFields);
        console.log('   ✅ Organization record created successfully');
        console.log('   Org Record ID:', orgRecord.id);
      } catch (orgError) {
        console.error('   ⚠️ Failed to create organization record:', orgError);
        console.error('   Will continue anyway - member was created');
        // Continue anyway - member is created
      }
    }

    // Generate JWT token
    console.log('\n🔑 STEP 5: Generating JWT token...');
    let token;
    try {
      token = generateToken(newUser.id, email);
      console.log('   ✅ Token generated successfully');
      console.log('   Token length:', token.length);
    } catch (tokenError) {
      console.error('❌ Token generation failed:', tokenError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Failed to generate authentication token',
          details: tokenError.message,
          debug: true
        })
      };
    }

    // For the response, we need to fetch the specialty names if they exist
    let specialtyNames = [];
    if (specialtyIds.length > 0) {
      try {
        const specialtyPromises = specialtyIds.map(id => 
          tables.specialty.find(id).catch(err => {
            console.error(`Failed to fetch specialty ${id}:`, err);
            return null;
          })
        );
        
        const specialtyRecords = await Promise.all(specialtyPromises);
        specialtyNames = specialtyRecords
          .filter(record => record !== null)
          .map(record => record.fields.Name)
          .filter(name => name);
      } catch (error) {
        console.error('Failed to fetch specialty names:', error);
      }
    }

    // Prepare user data for response
    const userData = {
      id: newUser.id,  // Airtable record ID
      memberId: newUser.fields.Member_ID,  // Your autonumber field
      name: newUser.fields.Name,
      email: newUser.fields.Email,
      memberType: newUser.fields.Member_Type,
      status: newUser.fields.Status,
      location: newUser.fields.Location || null,
      bio: newUser.fields.Bio || null,
      website: newUser.fields.Website || null,
      specialty: specialtyNames  // Return the names, not the IDs
    };

    console.log('\n✅ SIGNUP SUCCESSFUL!');
    console.log('   User:', userData.email);
    console.log('   Type:', userData.memberType);
    console.log('   Record ID:', userData.id);
    console.log('   Member ID:', userData.memberId);
    console.log('   Specialties:', userData.specialty);
    console.log('=====================================\n');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        token,
        user: userData,
        message: 'Account created successfully'
      })
    };
  } catch (error) {
    console.error('\n❌ UNEXPECTED ERROR IN SIGNUP:');
    console.error('   Error type:', error.constructor.name);
    console.error('   Error message:', error.message);
    console.error('   Stack trace:', error.stack);
    console.error('=====================================\n');
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'Failed to create account',
        message: error.message,
        type: error.constructor.name,
        debug: true
      })
    };
  }
};