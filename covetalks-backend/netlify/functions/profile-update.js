// File: netlify/functions/profile-update.js
const { tables, updateRecord } = require('./utils/airtable');
const { requireAuth } = require('./utils/auth');

exports.handler = async (event) => {
  // Only allow PUT or PATCH
  if (!['PUT', 'PATCH'].includes(event.httpMethod)) {
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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  // Verify authentication
  const auth = await requireAuth(event);
  if (auth.statusCode) {
    return { ...auth, headers };
  }

  try {
    const updates = JSON.parse(event.body);
    
    // Define allowed fields for update based on member type
    const allowedFields = {
      Name: updates.name,
      Phone: updates.phone,
      Location: updates.location,
      Bio: updates.bio,
      Website: updates.website,
      Booking_Link: updates.bookingLink
    };

    // Add specialty for speakers
    if (updates.specialty !== undefined) {
      allowedFields.Specialty = Array.isArray(updates.specialty) 
        ? updates.specialty 
        : updates.specialty.split(',').map(s => s.trim());
    }

    // Remove undefined fields
    Object.keys(allowedFields).forEach(key => 
      allowedFields[key] === undefined && delete allowedFields[key]
    );

    // Handle profile image upload if present
    if (updates.profileImage) {
      // For base64 image
      if (updates.profileImage.startsWith('data:image')) {
        allowedFields.Profile_Image = [{
          url: updates.profileImage
        }];
      }
      // For URL
      else if (updates.profileImage.startsWith('http')) {
        allowedFields.Profile_Image = [{
          url: updates.profileImage
        }];
      }
    }

    // Validate at least one field to update
    if (Object.keys(allowedFields).length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'No valid fields to update'
        })
      };
    }

    // Update user profile
    const updatedUser = await updateRecord(
      tables.members, 
      auth.userId, 
      allowedFields
    );

    // Update organization details if organization member
    if (updates.organizationData && updatedUser.fields.Member_Type === 'Organization') {
      try {
        const orgRecords = await tables.organizations.select({
          filterByFormula: `{Member_ID} = '${auth.userId}'`,
          maxRecords: 1
        }).firstPage();
        
        if (orgRecords.length > 0) {
          const orgFields = {
            Organization_Name: updates.organizationData.organizationName,
            Organization_Type: updates.organizationData.organizationType,
            Contact_Name: updates.organizationData.contactName,
            Speaking_Topics: updates.organizationData.speakingTopics,
            Event_Frequency: updates.organizationData.eventFrequency
          };

          // Remove undefined fields
          Object.keys(orgFields).forEach(key => 
            orgFields[key] === undefined && delete orgFields[key]
          );

          if (Object.keys(orgFields).length > 0) {
            await updateRecord(
              tables.organizations,
              orgRecords[0].id,
              orgFields
            );
          }
        }
      } catch (orgError) {
        console.error('Failed to update organization details:', orgError);
        // Continue anyway - main profile is updated
      }
    }

    // Prepare updated profile data for response
    const profile = {
      id: updatedUser.id,
      name: updatedUser.fields.Name,
      email: updatedUser.fields.Email,
      phone: updatedUser.fields.Phone,
      memberType: updatedUser.fields.Member_Type,
      location: updatedUser.fields.Location,
      bio: updatedUser.fields.Bio,
      specialty: updatedUser.fields.Specialty || [],
      website: updatedUser.fields.Website,
      profileImage: updatedUser.fields.Profile_Image ? updatedUser.fields.Profile_Image[0]?.url : null,
      bookingLink: updatedUser.fields.Booking_Link,
      status: updatedUser.fields.Status
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        profile,
        message: 'Profile updated successfully'
      })
    };
  } catch (error) {
    console.error('Profile update error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'Failed to update profile',
        message: error.message 
      })
    };
  }
};