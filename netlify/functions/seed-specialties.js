// File: netlify/functions/seed-specialties.js
// RUN THIS ONCE to populate your Specialty table with common values
// After running, you can delete or disable this function

const { tables, seedSpecialties } = require('./utils/airtable');

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
  const { secretKey } = JSON.parse(event.body || '{}');
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
    console.log('=== STARTING SPECIALTY SEEDING ===');
    
    // Comprehensive list of specialties for speakers
    const specialties = [
      // Business & Finance
      'Mortgage Banking',
      'Banking',
      'Finance',
      'Investment Strategy',
      'Financial Planning',
      'Accounting',
      'Economics',
      'Cryptocurrency',
      'Venture Capital',
      'Private Equity',
      
      // Real Estate
      'Real Estate',
      'Commercial Real Estate',
      'Residential Real Estate',
      'Property Management',
      'Real Estate Investment',
      
      // Technology
      'Technology',
      'Software Development',
      'Cybersecurity',
      'Data Analytics',
      'Artificial Intelligence',
      'Machine Learning',
      'Cloud Computing',
      'Blockchain',
      'Internet of Things',
      'Digital Transformation',
      'IT Strategy',
      'DevOps',
      'User Experience (UX)',
      'Mobile Development',
      'Web Development',
      
      // Business Management
      'Leadership',
      'Management',
      'Executive Leadership',
      'Change Management',
      'Project Management',
      'Agile Methodology',
      'Operations',
      'Supply Chain',
      'Business Strategy',
      'Strategic Planning',
      'Business Development',
      'Entrepreneurship',
      'Innovation',
      'Startup Strategy',
      
      // Marketing & Sales
      'Marketing',
      'Digital Marketing',
      'Content Marketing',
      'Social Media Marketing',
      'Brand Development',
      'Brand Strategy',
      'Sales',
      'Sales Strategy',
      'Customer Experience',
      'Customer Service',
      'Public Relations',
      'Advertising',
      'SEO/SEM',
      'Email Marketing',
      'Growth Marketing',
      
      // Human Resources
      'Human Resources',
      'Talent Management',
      'Recruiting',
      'Employee Engagement',
      'Organizational Development',
      'Compensation & Benefits',
      'HR Technology',
      'Performance Management',
      'Learning & Development',
      'Diversity & Inclusion',
      'Company Culture',
      'Remote Work',
      
      // Healthcare
      'Healthcare',
      'Healthcare Management',
      'Healthcare Technology',
      'Medical Practice',
      'Public Health',
      'Mental Health',
      'Wellness',
      'Nutrition',
      'Fitness',
      'Healthcare Innovation',
      
      // Education
      'Education',
      'Higher Education',
      'K-12 Education',
      'Educational Technology',
      'Curriculum Development',
      'Student Success',
      'Online Learning',
      'Professional Development',
      'Corporate Training',
      
      // Legal & Compliance
      'Legal',
      'Corporate Law',
      'Compliance',
      'Risk Management',
      'Regulatory Affairs',
      'Ethics',
      'Corporate Governance',
      'Intellectual Property',
      'Data Privacy',
      
      // Communications
      'Communications',
      'Public Speaking',
      'Presentation Skills',
      'Media Training',
      'Crisis Communication',
      'Internal Communications',
      'Storytelling',
      'Writing',
      'Journalism',
      
      // Industry Specific
      'Manufacturing',
      'Retail',
      'Hospitality',
      'Transportation',
      'Logistics',
      'Energy',
      'Sustainability',
      'Environmental',
      'Agriculture',
      'Non-Profit',
      'Government',
      'Politics',
      
      // Personal Development
      'Personal Development',
      'Motivation',
      'Life Coaching',
      'Career Development',
      'Work-Life Balance',
      'Mindfulness',
      'Stress Management',
      'Time Management',
      'Productivity',
      'Goal Setting',
      
      // Creative & Arts
      'Creative Arts',
      'Design',
      'Photography',
      'Video Production',
      'Music',
      'Writing',
      'Publishing',
      'Entertainment',
      
      // Science & Research
      'Science',
      'Research',
      'Engineering',
      'Biotechnology',
      'Pharmaceuticals',
      'Environmental Science',
      
      // Social Issues
      'Social Impact',
      'Community Development',
      'Social Justice',
      'Philanthropy',
      'Volunteerism',
      'Youth Development',
      'Elderly Care',
      
      // International
      'International Business',
      'Global Markets',
      'Cross-Cultural Communication',
      'International Relations',
      'Import/Export',
      
      // Specialized Skills
      'Negotiation',
      'Conflict Resolution',
      'Team Building',
      'Facilitation',
      'Coaching',
      'Mentoring',
      'Consulting',
      'Research & Development',
      'Quality Assurance',
      'Process Improvement',
      'Six Sigma',
      'Lean Management'
    ];
    
    const results = {
      created: [],
      skipped: [],
      errors: []
    };
    
    // Process each specialty
    for (const name of specialties) {
      try {
        // Check if already exists
        const existing = await tables.specialty.select({
          filterByFormula: `LOWER({Name}) = LOWER('${name.replace(/'/g, "\\'")}')`
        }).firstPage();
        
        if (existing.length === 0) {
          // Create new specialty
          const record = await tables.specialty.create({ Name: name });
          results.created.push(name);
          console.log(`✅ Created: ${name}`);
        } else {
          // Already exists
          results.skipped.push(name);
          console.log(`⏭️ Skipped (already exists): ${name}`);
        }
      } catch (error) {
        console.error(`❌ Failed to process specialty "${name}":`, error.message);
        results.errors.push({ name, error: error.message });
      }
    }
    
    console.log('=== SEEDING COMPLETE ===');
    console.log(`Created: ${results.created.length}`);
    console.log(`Skipped: ${results.skipped.length}`);
    console.log(`Errors: ${results.errors.length}`);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Specialty seeding complete',
        results: {
          created: results.created.length,
          skipped: results.skipped.length,
          errors: results.errors.length,
          details: {
            created: results.created,
            skipped: results.skipped,
            errors: results.errors
          }
        }
      })
    };
  } catch (error) {
    console.error('=== SEEDING FAILED ===');
    console.error(error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'Failed to seed specialties',
        message: error.message 
      })
    };
  }
};