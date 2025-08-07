// ============================================
// FRONTEND INTEGRATION
// ============================================

// File: public/js/app.js
class CoveTalksAPI {
    constructor() {
      this.baseURL = '/.netlify/functions';
      this.token = localStorage.getItem('authToken');
    }
  
    // Set authorization header
    getHeaders() {
      const headers = {
        'Content-Type': 'application/json'
      };
      
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }
      
      return headers;
    }
  
    // Handle API responses
    async handleResponse(response) {
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Request failed');
      }
      
      return data;
    }
  
    // Authentication methods
    async signup(userData) {
      const response = await fetch(`${this.baseURL}/auth-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      
      const data = await this.handleResponse(response);
      
      if (data.token) {
        this.token = data.token;
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
      }
      
      return data;
    }
  
    async login(email, password) {
      const response = await fetch(`${this.baseURL}/auth-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await this.handleResponse(response);
      
      if (data.token) {
        this.token = data.token;
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
      }
      
      return data;
    }
  
    logout() {
      this.token = null;
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      window.location.href = '/login.html';
    }
  
    // Check if user is authenticated
    isAuthenticated() {
      return !!this.token;
    }
  
    // Get current user
    getCurrentUser() {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    }
  
    // Profile methods
    async getProfile() {
      const response = await fetch(`${this.baseURL}/profile-get`, {
        headers: this.getHeaders()
      });
      
      return this.handleResponse(response);
    }
  
    async updateProfile(profileData) {
      const response = await fetch(`${this.baseURL}/profile-update`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(profileData)
      });
      
      return this.handleResponse(response);
    }
  
    // Bookings methods
    async getBookings(filters = {}) {
      const params = new URLSearchParams(filters);
      const response = await fetch(`${this.baseURL}/bookings-list?${params}`, {
        headers: this.getHeaders()
      });
      
      return this.handleResponse(response);
    }
  
    // Opportunities methods
    async getOpportunities(filters = {}) {
      const params = new URLSearchParams(filters);
      const response = await fetch(`${this.baseURL}/opportunities-list?${params}`, {
        headers: this.getHeaders()
      });
      
      return this.handleResponse(response);
    }
  
    async createOpportunity(opportunityData) {
      const response = await fetch(`${this.baseURL}/opportunities-create`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(opportunityData)
      });
      
      return this.handleResponse(response);
    }
  
    // Stripe methods
    async createCheckoutSession(priceId, planType, billingPeriod) {
      const response = await fetch(`${this.baseURL}/stripe-create-checkout`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ priceId, planType, billingPeriod })
      });
      
      const data = await this.handleResponse(response);
      
      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      }
      
      return data;
    }
  
    async openBillingPortal() {
      const response = await fetch(`${this.baseURL}/stripe-portal`, {
        method: 'POST',
        headers: this.getHeaders()
      });
      
      const data = await this.handleResponse(response);
      
      // Redirect to Stripe Portal
      if (data.url) {
        window.location.href = data.url;
      }
      
      return data;
    }
  }
  
  // Initialize API client
  const api = new CoveTalksAPI();
  
  // ============================================
  // LOGIN PAGE INTEGRATION
  // ============================================
  
  // File: public/login.html (add to existing page)
  // Add this script before closing </body> tag:
  /*
  <script src="/js/app.js"></script>
  <script>
  // Handle login form submission
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    try {
      // Show loading state
      submitBtn.disabled = true;
      submitBtn.textContent = 'Signing in...';
      
      // Attempt login
      const result = await api.login(email, password);
      
      // Redirect to dashboard
      window.location.href = '/dashboard.html';
    } catch (error) {
      // Show error message
      alert('Login failed: ' + error.message);
      
      // Reset button
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
    }
  });
  
  // Handle signup form submission
  document.getElementById('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
      name: document.getElementById('name').value,
      email: document.getElementById('email').value,
      password: document.getElementById('password').value,
      memberType: document.getElementById('memberType').value,
      phone: document.getElementById('phone').value
    };
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating account...';
      
      const result = await api.signup(formData);
      
      // Redirect to dashboard
      window.location.href = '/dashboard.html';
    } catch (error) {
      alert('Signup failed: ' + error.message);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign Up';
    }
  });
  </script>
  */
  
  
  // ============================================
  // AUTHENTICATION GUARD
  // ============================================
  
  // Add to all protected pages (dashboard, bookings, settings, etc.):
  /*
  <script src="/js/app.js"></script>
  <script>
  // Redirect to login if not authenticated
  if (!api.isAuthenticated()) {
    window.location.href = '/login.html';
  }
  </script>
  */
  
  // ============================================
  // SETUP INSTRUCTIONS
  // ============================================
  
  /*
  COMPLETE SETUP GUIDE FOR COVETALKS MVP
  
  1. INITIAL SETUP
  ----------------
  # Clone or create your project
  mkdir covetalks
  cd covetalks
  
  # Initialize npm
  npm init -y
  
  # Install dependencies
  npm install airtable stripe jsonwebtoken bcryptjs node-fetch
  npm install -D netlify-cli
  
  2. CREATE PROJECT STRUCTURE
  ---------------------------
  Create all the folders and files as shown in the project structure above.
  Copy all the function code from the backend-setup artifact.
  Copy the app.js file to public/js/
  
  3. ENVIRONMENT VARIABLES
  ------------------------
  Create a .env file in root directory:
  
  AIRTABLE_API_KEY=YOUR_NEW_KEY_HERE
  AIRTABLE_BASE_ID=appa7KVa8HcVheTOo
  STRIPE_SECRET_KEY=YOUR_NEW_SECRET_KEY
  STRIPE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
  STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET
  JWT_SECRET=generate_a_random_64_character_string_here
  SITE_URL=https://covetalks.netlify.app
  
  To generate JWT_SECRET:
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  
  4. AIRTABLE SETUP
  -----------------
  ⚠️ FIRST: Regenerate your API key at https://airtable.com/account
  - Ensure all tables match the schema exactly
  - Table names must be: Members, Organizations, Subscriptions, etc.
  - Field names must match exactly (case-sensitive)
  
  5. STRIPE SETUP
  ---------------
  ⚠️ FIRST: Rotate your secret key at https://dashboard.stripe.com/apikeys
  
  a. Create Products and Prices:
     - Go to Stripe Dashboard > Products
     - Create 6 products (Standard/Plus/Premium × Monthly/Annual)
     - Note the price IDs (starting with price_)
     
  b. Update price IDs in stripe.js:
     const PRICE_IDS = {
       standard_monthly: 'price_xxx',  // Replace with actual
       standard_annual: 'price_xxx',
       // etc.
     };
  
  c. Setup Webhook:
     - Go to Stripe Dashboard > Webhooks
     - Add endpoint: https://covetalks.netlify.app/.netlify/functions/stripe-webhook
     - Select events:
       * checkout.session.completed
       * invoice.payment_succeeded
       * customer.subscription.deleted
     - Copy the webhook secret to .env
  
  6. NETLIFY DEPLOYMENT
  ---------------------
  a. Install Netlify CLI:
     npm install -g netlify-cli
  
  b. Login to Netlify:
     netlify login
  
  c. Initialize site:
     netlify init
  
  d. Set environment variables in Netlify:
     - Go to Site settings > Environment variables
     - Add all variables from .env file
     - DO NOT commit .env to git!
  
  e. Deploy:
     netlify deploy --prod
  
  7. LOCAL DEVELOPMENT
  --------------------
  # Start local dev server with functions
  netlify dev
  
  # This will run on http://localhost:8888
  # Functions available at http://localhost:8888/.netlify/functions/
  
  8. TESTING THE SETUP
  --------------------
  a. Test signup:
     curl -X POST http://localhost:8888/.netlify/functions/auth-signup \
       -H "Content-Type: application/json" \
       -d '{"email":"test@example.com","password":"Test123!","name":"Test User","memberType":"Speaker"}'
  
  b. Test login:
     curl -X POST http://localhost:8888/.netlify/functions/auth-login \
       -H "Content-Type: application/json" \
       -d '{"email":"test@example.com","password":"Test123!"}'
  
  c. Test Stripe (use test mode first):
     - Switch to test mode in Stripe Dashboard
     - Use test card: 4242 4242 4242 4242
     - Any future date, any CVC
  
  9. SECURITY CHECKLIST
  ---------------------
  ✅ Rotate all API keys immediately
  ✅ Add .env to .gitignore
  ✅ Never commit sensitive data
  ✅ Use environment variables in Netlify
  ✅ Enable 2FA on Airtable and Stripe accounts
  ✅ Use HTTPS only (Netlify provides this)
  ✅ Implement rate limiting (Netlify has built-in protection)
  
  10. ADD HTML PAGES
  ------------------
  Copy your existing HTML pages to the public/ folder:
  - index.html
  - login.html
  - dashboard.html
  - bookings.html
  - billing.html
  - settings.html
  - etc.
  
  Add the JavaScript integration code to each page as shown above.
  
  11. MONITORING & LOGS
  --------------------
  - Netlify Functions logs: https://app.netlify.com/sites/YOUR_SITE/functions
  - Stripe logs: https://dashboard.stripe.com/logs
  - Airtable API usage: https://airtable.com/account
  
  12. GOING LIVE CHECKLIST
  ------------------------
  □ All API keys rotated and secured
  □ Stripe in live mode (not test)
  □ Email notifications working
  □ SSL certificate active (automatic with Netlify)
  □ Error handling tested
  □ Mobile responsive tested
  □ Cross-browser tested
  □ Backup of Airtable data
  □ Terms of Service and Privacy Policy pages added
  □ GDPR compliance if serving EU users
  
  TROUBLESHOOTING
  ---------------
  1. "Invalid token" errors:
     - Check JWT_SECRET is set in environment
     - Verify token is being sent in Authorization header
  
  2. Airtable "NOT_FOUND" errors:
     - Verify table and field names match exactly
     - Check API key has full access
  
  3. Stripe webhook failures:
     - Verify webhook secret is correct
     - Check endpoint URL is accessible
     - Review Stripe webhook logs
  
  4. Function timeouts:
     - Netlify Functions have 10-second timeout
     - Optimize database queries
     - Consider pagination for large datasets
  
  SUPPORT
  -------
  - Netlify: https://docs.netlify.com
  - Airtable API: https://airtable.com/api
  - Stripe: https://stripe.com/docs
  - Community: https://community.netlify.com
  
  */