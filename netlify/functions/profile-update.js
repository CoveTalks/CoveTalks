// File: netlify/functions/profile-update.js
const { tables, updateRecord } = require('./utils/airtable');
const { requireAuth } = require('./utils/auth');

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'PUT, PATCH, OPTIONS'
      },
      body: ''
    };
  }

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
    
    console.log('[Profile Update] Received update request for user:', auth.userId);
    console.log('[Profile Update] Fields to update:', Object.keys(updates));
    
    // Define allowed fields for update
    const allowedFields = {};
    
    // Map frontend field names to Airtable field names
    if (updates.name !== undefined) allowedFields.Name = updates.name;
    if (updates.phone !== undefined) allowedFields.Phone = updates.phone;
    if (updates.location !== undefined) allowedFields.Location = updates.location;
    if (updates.bio !== undefined) allowedFields.Bio = updates.bio;
    if (updates.website !== undefined) allowedFields.Website = updates.website;
    if (updates.bookingLink !== undefined) allowedFields.Booking_Link = updates.bookingLink;

    // Handle specialty array
    if (updates.specialty !== undefined) {
      if (Array.isArray(updates.specialty)) {
        allowedFields.Specialty = updates.specialty;
      } else if (typeof updates.specialty === 'string') {
        allowedFields.Specialty = updates.specialty.split(',').map(s => s.trim()).filter(s => s);
      }
    }

    // Handle profile image
    if (updates.profileImage) {
      console.log('[Profile Update] Processing profile image...');
      
      // If it's a base64 image, we need to upload it somewhere first
      // For now, we'll try to store it as a URL in Airtable
      if (updates.profileImage.startsWith('data:image')) {
        // Note: Airtable attachments don't directly accept base64
        // You would typically upload to a service like Cloudinary here
        // For MVP, we'll skip the image if it's base64
        console.log('[Profile Update] Base64 image detected - skipping for now (needs cloud storage integration)');
        
        // TODO: Integrate with Cloudinary or similar service
        // const uploadedUrl = await uploadToCloudinary(updates.profileImage);
        // allowedFields.Profile_Image = [{ url: uploadedUrl }];
      } else if (updates.profileImage.startsWith('http')) {
        // If it's already a URL, we can use it
        allowedFields.Profile_Image = [{ url: updates.profileImage }];
      }
    }

    // Log the fields we're about to update
    console.log('[Profile Update] Fields being sent to Airtable:', allowedFields);

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

    // Update user profile in Airtable
    const updatedUser = await updateRecord(
      tables.members, 
      auth.userId, 
      allowedFields
    );

    console.log('[Profile Update] Successfully updated user profile');

    // Update organization details if organization member
    if (updates.organizationData && updatedUser.fields.Member_Type === 'Organization') {
      try {
        const orgRecords = await tables.organizations.select({
          filterByFormula: `{Member_ID} = '${auth.userId}'`,
          maxRecords: 1
        }).firstPage();
        
        if (orgRecords.length > 0) {
          const orgFields = {};
          
          if (updates.organizationData.organizationName !== undefined) {
            orgFields.Organization_Name = updates.organizationData.organizationName;
          }
          if (updates.organizationData.organizationType !== undefined) {
            orgFields.Organization_Type = updates.organizationData.organizationType;
          }
          if (updates.organizationData.contactName !== undefined) {
            orgFields.Contact_Name = updates.organizationData.contactName;
          }
          if (updates.organizationData.speakingTopics !== undefined) {
            orgFields.Speaking_Topics = updates.organizationData.speakingTopics;
          }
          if (updates.organizationData.eventFrequency !== undefined) {
            orgFields.Event_Frequency = updates.organizationData.eventFrequency;
          }

          if (Object.keys(orgFields).length > 0) {
            await updateRecord(
              tables.organizations,
              orgRecords[0].id,
              orgFields
            );
            console.log('[Profile Update] Organization details updated');
          }
        }
      } catch (orgError) {
        console.error('[Profile Update] Failed to update organization details:', orgError);
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

    console.log('[Profile Update] Returning updated profile to client');

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
    console.error('[Profile Update] Error:', error);
    console.error('[Profile Update] Error stack:', error.stack);
    
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