// File: netlify/functions/members-list.js
// UPDATED VERSION - Fetches specialty names from linked records

const { tables } = require('./utils/airtable');
const { getTokenFromHeaders, verifyToken } = require('./utils/auth');

exports.handler = async (event) => {
  // Only allow GET
  if (event.httpMethod !== 'GET') {
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

  // Check if user is authenticated (optional for basic listing)
  const token = getTokenFromHeaders(event.headers);
  let isAuthenticated = false;
  let userId = null;
  
  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      isAuthenticated = true;
      userId = decoded.userId;
    }
  }

  try {
    // Get query parameters for filtering
    const { 
      search, 
      type, 
      location, 
      specialty,
      limit = 50,
      offset = 0,
      sort = 'desc'
    } = event.queryStringParameters || {};
    
    // Build filter formula for Airtable
    let filterConditions = [];
    
    // Only show active members
    filterConditions.push(`{Status} = 'Active'`);
    
    // Type filter (Speaker or Organization)
    if (type && type !== 'all') {
      filterConditions.push(`{Member_Type} = '${type}'`);
    }
    
    // Location filter (partial match)
    if (location) {
      filterConditions.push(`FIND(LOWER('${location.toLowerCase()}'), LOWER({Location})) > 0`);
    }
    
    // Build the filter formula
    let filterFormula = '';
    if (filterConditions.length > 0) {
      if (filterConditions.length === 1) {
        filterFormula = filterConditions[0];
      } else {
        filterFormula = `AND(${filterConditions.join(', ')})`;
      }
    }
    
    console.log('[Members List] Fetching members with filter:', filterFormula);
    
    // Fetch members from Airtable
    const members = await tables.members.select({
      filterByFormula: filterFormula,
      maxRecords: parseInt(limit),
      sort: [{ field: 'Created_Date', direction: sort }],
      fields: [
        'Name',
        'Email',
        'Phone',
        'Member_Type',
        'Location',
        'Bio',
        'Specialty',
        'Website',
        'Profile_Image',
        'Booking_Link',
        'Status',
        'Created_Date'
      ]
    }).all();
    
    console.log(`[Members List] Found ${members.length} members`);
    
    // Fetch all specialty names in batch for efficiency
    const allSpecialtyIds = new Set();
    members.forEach(member => {
      if (member.fields.Specialty && member.fields.Specialty.length > 0) {
        member.fields.Specialty.forEach(id => allSpecialtyIds.add(id));
      }
    });
    
    console.log(`[Members List] Need to fetch ${allSpecialtyIds.size} unique specialties`);
    
    // Fetch all unique specialties
    const specialtyMap = new Map();
    if (allSpecialtyIds.size > 0) {
      const specialtyPromises = Array.from(allSpecialtyIds).map(specialtyId => 
        tables.specialty.find(specialtyId).then(record => {
          specialtyMap.set(specialtyId, record.fields.Name);
          return record;
        }).catch(err => {
          console.error(`[Members List] Failed to fetch specialty ${specialtyId}:`, err);
          return null;
        })
      );
      
      await Promise.all(specialtyPromises);
      console.log(`[Members List] Fetched ${specialtyMap.size} specialty names`);
    }
    
    // Format the response based on authentication status
    const formattedMembers = await Promise.all(members.map(async (member) => {
      const fields = member.fields;
      
      // Get specialty names from the map
      let specialtyNames = [];
      if (fields.Specialty && fields.Specialty.length > 0) {
        specialtyNames = fields.Specialty
          .map(id => specialtyMap.get(id))
          .filter(name => name); // Filter out any undefined names
      }
      
      // Basic information available to all
      const basicInfo = {
        id: member.id,
        name: fields.Name || '',
        memberType: fields.Member_Type || '',
        location: fields.Location || '',
        bio: fields.Bio || '',
        specialty: specialtyNames, // Now contains names instead of IDs
        profileImage: fields.Profile_Image ? fields.Profile_Image[0]?.url : null,
        createdDate: fields.Created_Date
      };
      
      // Get additional details based on member type
      let additionalInfo = {};
      
      // For organizations, get organization details
      if (fields.Member_Type === 'Organization') {
        try {
          const orgRecords = await tables.organizations.select({
            filterByFormula: `{Member_ID} = '${member.id}'`,
            maxRecords: 1
          }).firstPage();
          
          if (orgRecords.length > 0) {
            additionalInfo.organizationName = orgRecords[0].fields.Organization_Name;
            additionalInfo.organizationType = orgRecords[0].fields.Organization_Type;
            additionalInfo.speakingTopics = orgRecords[0].fields.Speaking_Topics || [];
          }
        } catch (e) {
          console.error('[Members List] Failed to fetch organization details:', e);
        }
      }
      
      // For speakers, get rating information
      if (fields.Member_Type === 'Speaker') {
        try {
          const reviews = await tables.reviews.select({
            filterByFormula: `{Speaker_ID} = '${member.id}'`,
            fields: ['Rating']
          }).all();
          
          if (reviews.length > 0) {
            const totalRating = reviews.reduce((sum, r) => sum + (r.fields.Rating || 0), 0);
            additionalInfo.averageRating = (totalRating / reviews.length).toFixed(1);
            additionalInfo.totalReviews = reviews.length;
          }
        } catch (e) {
          console.error('[Members List] Failed to fetch reviews:', e);
        }
      }
      
      // Full information only for authenticated users
      if (isAuthenticated) {
        return {
          ...basicInfo,
          ...additionalInfo,
          email: fields.Email || '',
          phone: fields.Phone || '',
          website: fields.Website || '',
          bookingLink: fields.Booking_Link || ''
        };
      } else {
        // Limited information for non-authenticated users
        return {
          ...basicInfo,
          ...additionalInfo,
          email: '••••••@email.com',
          phone: '•••-•••-••••',
          website: 'Login to view',
          bookingLink: 'Login to view',
          contactProtected: true
        };
      }
    }));
    
    // Apply search filter on formatted results if provided
    let filteredResults = formattedMembers;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredResults = formattedMembers.filter(member => {
        return (
          member.name.toLowerCase().includes(searchLower) ||
          member.bio.toLowerCase().includes(searchLower) ||
          (member.organizationName && member.organizationName.toLowerCase().includes(searchLower)) ||
          (Array.isArray(member.specialty) && 
           member.specialty.some(s => s.toLowerCase().includes(searchLower)))
        );
      });
      console.log(`[Members List] Search filter applied, ${filteredResults.length} results match "${search}"`);
    }
    
    // Apply specialty filter if provided
    if (specialty) {
      const specialtyLower = specialty.toLowerCase();
      filteredResults = filteredResults.filter(member => {
        return Array.isArray(member.specialty) && 
               member.specialty.some(s => s.toLowerCase().includes(specialtyLower));
      });
      console.log(`[Members List] Specialty filter applied, ${filteredResults.length} results match "${specialty}"`);
    }
    
    // Calculate statistics
    const stats = {
      total: filteredResults.length,
      speakers: filteredResults.filter(m => m.memberType === 'Speaker').length,
      organizations: filteredResults.filter(m => m.memberType === 'Organization').length
    };
    
    console.log('[Members List] Returning results:', stats);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        isAuthenticated,
        members: filteredResults,
        stats,
        hasMore: filteredResults.length === parseInt(limit)
      })
    };
  } catch (error) {
    console.error('[Members List] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'Failed to fetch members',
        message: error.message 
      })
    };
  }
};