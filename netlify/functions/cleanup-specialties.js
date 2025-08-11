// File: netlify/functions/cleanup-specialties.js
// Utility function to clean up duplicate specialties
// Run this occasionally to merge duplicates and maintain data integrity

const { tables } = require('./utils/airtable');

exports.handler = async (event) => {
  // Only allow POST for security
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

  // Optional: Add a secret key check for security
  const { secretKey, dryRun = true } = JSON.parse(event.body || '{}');
  if (secretKey !== process.env.SEED_SECRET_KEY && process.env.SEED_SECRET_KEY) {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'Unauthorized' 
      })
    };
  }

  try {
    console.log('=== CLEANING UP DUPLICATE SPECIALTIES ===');
    console.log('Mode:', dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (changes will be made)');
    
    // Get all specialties
    const allSpecialties = await tables.specialty.select({
      sort: [{ field: 'Name', direction: 'asc' }]
    }).all();
    
    console.log(`Total specialties found: ${allSpecialties.length}`);
    
    // Group by normalized name
    const specialtyMap = new Map();
    
    for (const specialty of allSpecialties) {
      const normalizedName = specialty.fields.Name.toLowerCase().trim();
      
      if (!specialtyMap.has(normalizedName)) {
        specialtyMap.set(normalizedName, []);
      }
      
      specialtyMap.get(normalizedName).push(specialty);
    }
    
    // Find duplicates
    const duplicates = [];
    const mergeActions = [];
    
    for (const [name, records] of specialtyMap) {
      if (records.length > 1) {
        console.log(`Found ${records.length} duplicates for "${name}":`);
        records.forEach(r => {
          console.log(`  - ID: ${r.id}, Name: "${r.fields.Name}"`);
        });
        
        // Keep the first one (or the one with the proper capitalization)
        const keeper = records.reduce((best, current) => {
          // Prefer the one with the "best" capitalization
          // (e.g., "Real Estate" over "real estate" or "REAL ESTATE")
          const currentScore = scoreCapitalization(current.fields.Name);
          const bestScore = scoreCapitalization(best.fields.Name);
          return currentScore > bestScore ? current : best;
        });
        
        const toDelete = records.filter(r => r.id !== keeper.id);
        
        duplicates.push({
          name: name,
          keeper: {
            id: keeper.id,
            name: keeper.fields.Name
          },
          duplicates: toDelete.map(r => ({
            id: r.id,
            name: r.fields.Name
          }))
        });
        
        if (!dryRun) {
          // Find all Members that reference the duplicates
          for (const duplicate of toDelete) {
            try {
              // Find members with this specialty
              const members = await tables.members.select({
                filterByFormula: `FIND('${duplicate.id}', ARRAYJOIN({Specialty}))`
              }).all();
              
              console.log(`  Found ${members.length} members with duplicate specialty ${duplicate.id}`);
              
              // Update each member to use the keeper instead
              for (const member of members) {
                const currentSpecialties = member.fields.Specialty || [];
                const updatedSpecialties = currentSpecialties
                  .filter(id => id !== duplicate.id) // Remove duplicate
                  .concat(currentSpecialties.includes(keeper.id) ? [] : [keeper.id]); // Add keeper if not already there
                
                if (JSON.stringify(currentSpecialties) !== JSON.stringify(updatedSpecialties)) {
                  await tables.members.update(member.id, {
                    Specialty: updatedSpecialties
                  });
                  console.log(`    Updated member ${member.id} specialties`);
                  
                  mergeActions.push({
                    type: 'member_update',
                    memberId: member.id,
                    memberName: member.fields.Name,
                    oldSpecialtyId: duplicate.id,
                    newSpecialtyId: keeper.id
                  });
                }
              }
              
              // Delete the duplicate specialty
              await tables.specialty.destroy(duplicate.id);
              console.log(`  Deleted duplicate specialty ${duplicate.id}`);
              
              mergeActions.push({
                type: 'specialty_delete',
                deletedId: duplicate.id,
                deletedName: duplicate.fields.Name,
                keptId: keeper.id,
                keptName: keeper.fields.Name
              });
            } catch (error) {
              console.error(`  Error processing duplicate ${duplicate.id}:`, error.message);
            }
          }
        }
      }
    }
    
    console.log('=== CLEANUP COMPLETE ===');
    console.log(`Found ${duplicates.length} sets of duplicates`);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: dryRun ? 'Dry run complete - no changes made' : 'Cleanup complete',
        dryRun: dryRun,
        results: {
          totalSpecialties: allSpecialties.length,
          duplicateSets: duplicates.length,
          duplicates: duplicates,
          actions: mergeActions
        }
      })
    };
  } catch (error) {
    console.error('=== CLEANUP FAILED ===');
    console.error(error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'Failed to cleanup specialties',
        message: error.message 
      })
    };
  }
};

// Helper function to score capitalization quality
function scoreCapitalization(str) {
  let score = 0;
  
  // Prefer title case (Each Word Capitalized)
  if (str.split(' ').every(word => word[0] === word[0].toUpperCase() && word.slice(1) === word.slice(1).toLowerCase())) {
    score += 10;
  }
  
  // Penalize all caps
  if (str === str.toUpperCase()) {
    score -= 5;
  }
  
  // Penalize all lowercase
  if (str === str.toLowerCase()) {
    score -= 3;
  }
  
  // Prefer proper nouns and acronyms
  if (str.includes('&') || str.includes('/')) {
    score += 2;
  }
  
  return score;
}