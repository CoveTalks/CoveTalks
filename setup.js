#!/usr/bin/env node

// File: setup.js - Initial Project Setup Script
// Run with: node setup.js

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

console.log(`
${colors.bright}${colors.blue}============================================
       CoveTalks Project Setup Script
============================================${colors.reset}
`);

// Check Node version
const nodeVersion = process.version.match(/^v(\d+)/)[1];
if (parseInt(nodeVersion) < 18) {
  console.error(`${colors.red}✗ Node.js version 18 or higher is required. You have ${process.version}${colors.reset}`);
  process.exit(1);
}
console.log(`${colors.green}✓${colors.reset} Node.js version: ${process.version}`);

// Step 1: Check if package.json exists
function checkPackageJson() {
  if (!fs.existsSync('package.json')) {
    console.error(`${colors.red}✗ package.json not found. Please run this script from the project root.${colors.reset}`);
    process.exit(1);
  }
  console.log(`${colors.green}✓${colors.reset} package.json found`);
}

// Step 2: Install dependencies
function installDependencies() {
  console.log(`\n${colors.cyan}Installing dependencies...${colors.reset}`);
  try {
    execSync('npm install', { stdio: 'inherit' });
    console.log(`${colors.green}✓${colors.reset} Dependencies installed`);
  } catch (error) {
    console.error(`${colors.red}✗ Failed to install dependencies${colors.reset}`);
    process.exit(1);
  }
}

// Step 3: Create required directories
function createDirectories() {
  const directories = [
    'public',
    'public/js',
    'public/Images',
    'public/css',
    'netlify',
    'netlify/functions',
    'netlify/functions/utils',
    'scripts',
    'tests'
  ];

  console.log(`\n${colors.cyan}Creating directory structure...${colors.reset}`);
  
  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`  ${colors.green}✓${colors.reset} Created ${dir}/`);
    } else {
      console.log(`  ${colors.blue}○${colors.reset} ${dir}/ already exists`);
    }
  });
}

// Step 4: Create .env file from template
function createEnvFile() {
  console.log(`\n${colors.cyan}Setting up environment variables...${colors.reset}`);
  
  if (fs.existsSync('.env')) {
    console.log(`  ${colors.yellow}⚠${colors.reset} .env file already exists - skipping`);
    return;
  }

  if (!fs.existsSync('.env.example')) {
    console.log(`  ${colors.yellow}⚠${colors.reset} .env.example not found - creating basic .env`);
    
    const envContent = `# Environment Variables - KEEP THIS FILE SECRET!
# Generated: ${new Date().toISOString()}

# Airtable
AIRTABLE_API_KEY=your_airtable_api_key_here
AIRTABLE_BASE_ID=appa7KVa8HcVheTOo

# Stripe (use test keys for development)
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_secret_here

# Authentication
JWT_SECRET=${crypto.randomBytes(32).toString('hex')}

# Site Configuration
SITE_URL=https://covetalks.netlify.app
NODE_ENV=development
`;
    
    fs.writeFileSync('.env', envContent);
    console.log(`  ${colors.green}✓${colors.reset} Created .env file`);
    console.log(`  ${colors.yellow}⚠${colors.reset} Please update .env with your actual API keys`);
  } else {
    // Copy from .env.example
    const exampleContent = fs.readFileSync('.env.example', 'utf8');
    
    // Generate JWT secret
    const jwtSecret = crypto.randomBytes(32).toString('hex');
    const envContent = exampleContent.replace(
      'your_random_jwt_secret_here_make_it_very_long_and_random',
      jwtSecret
    );
    
    fs.writeFileSync('.env', envContent);
    console.log(`  ${colors.green}✓${colors.reset} Created .env from .env.example`);
    console.log(`  ${colors.green}✓${colors.reset} Generated JWT secret`);
    console.log(`  ${colors.yellow}⚠${colors.reset} Please update .env with your Airtable and Stripe keys`);
  }
}

// Step 5: Check for required files
function checkRequiredFiles() {
  console.log(`\n${colors.cyan}Checking required files...${colors.reset}`);
  
  const requiredFiles = [
    { path: 'netlify.toml', critical: true },
    { path: '.gitignore', critical: false },
    { path: '.netlifyignore', critical: false },
    { path: 'public/index.html', critical: true }
  ];
  
  let missingCritical = false;
  
  requiredFiles.forEach(file => {
    if (fs.existsSync(file.path)) {
      console.log(`  ${colors.green}✓${colors.reset} ${file.path}`);
    } else {
      if (file.critical) {
        console.log(`  ${colors.red}✗${colors.reset} ${file.path} - MISSING (critical)`);
        missingCritical = true;
      } else {
        console.log(`  ${colors.yellow}⚠${colors.reset} ${file.path} - missing (optional)`);
      }
    }
  });
  
  if (missingCritical) {
    console.error(`\n${colors.red}Critical files are missing. Please ensure all files are in place.${colors.reset}`);
    process.exit(1);
  }
}

// Step 6: Verify Netlify CLI
function checkNetlifyCLI() {
  console.log(`\n${colors.cyan}Checking Netlify CLI...${colors.reset}`);
  
  try {
    const version = execSync('netlify --version', { encoding: 'utf8' });
    console.log(`  ${colors.green}✓${colors.reset} Netlify CLI installed: ${version.trim()}`);
  } catch (error) {
    console.log(`  ${colors.yellow}⚠${colors.reset} Netlify CLI not found globally`);
    console.log(`  ${colors.blue}ℹ${colors.reset} You can run it locally with: npx netlify`);
  }
}

// Step 7: Display next steps
function displayNextSteps() {
  console.log(`
${colors.bright}${colors.green}============================================
         Setup Completed Successfully!
============================================${colors.reset}

${colors.bright}Next Steps:${colors.reset}

1. ${colors.cyan}Update Environment Variables:${colors.reset}
   - Edit ${colors.yellow}.env${colors.reset} file with your actual API keys:
     • Airtable API key and Base ID
     • Stripe secret and publishable keys
     • Stripe webhook secret

2. ${colors.cyan}Set up Airtable:${colors.reset}
   - Create tables as defined in airtable-schema.md
   - Get your API key from: https://airtable.com/account
   - Find your base ID in the Airtable URL

3. ${colors.cyan}Set up Stripe:${colors.reset}
   - Create products and prices in Stripe Dashboard
   - Set up webhook endpoint for your deployed site
   - Use test keys for development

4. ${colors.cyan}Test Locally:${colors.reset}
   ${colors.yellow}npm run dev${colors.reset}              # Start development server
   ${colors.yellow}npm test${colors.reset}                 # Run integration tests
   
5. ${colors.cyan}Deploy to Netlify:${colors.reset}
   ${colors.yellow}netlify init${colors.reset}             # Connect to Netlify
   ${colors.yellow}netlify env:import .env${colors.reset}  # Import environment variables
   ${colors.yellow}npm run deploy:prod${colors.reset}      # Deploy to production

6. ${colors.cyan}After Deployment:${colors.reset}
   - Set up Stripe webhook URL: https://covetalks.netlify.app/.netlify/functions/stripe-webhook
   - Test all functions using /test.html (development only)
   - Verify environment variables in Netlify dashboard

${colors.bright}${colors.blue}============================================${colors.reset}

${colors.cyan}Useful Commands:${colors.reset}
  ${colors.yellow}npm run dev${colors.reset}          - Start local development
  ${colors.yellow}npm test${colors.reset}             - Run tests
  ${colors.yellow}npm run deploy${colors.reset}       - Deploy to Netlify
  ${colors.yellow}npm run logs${colors.reset}         - View function logs
  
${colors.green}Happy coding! 🚀${colors.reset}
`);
}

// Main setup flow
async function runSetup() {
  try {
    checkPackageJson();
    installDependencies();
    createDirectories();
    createEnvFile();
    checkRequiredFiles();
    checkNetlifyCLI();
    displayNextSteps();
  } catch (error) {
    console.error(`\n${colors.red}Setup failed:${colors.reset}`, error.message);
    process.exit(1);
  }
}

// Run the setup
runSetup();