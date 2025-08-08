// ============================================
// FRONTEND INTEGRATION - FIXED VERSION
// ============================================

// File: public/js/app.js
class CoveTalksAPI {
    constructor() {
        // Use consistent base URL configuration
        this.baseURL = window.location.hostname === 'localhost' 
            ? 'http://localhost:8888/.netlify/functions'
            : '/.netlify/functions';
        
        // Consistent storage keys
        this.STORAGE_KEYS = {
            TOKEN: 'authToken',
            USER: 'user'
        };
        
        // Initialize token from storage
        this.token = this.getToken();
        
        // Debug logging
        this.debug = true; // Set to false in production
        this.log('API initialized', { token: !!this.token, user: !!this.getCurrentUser() });
    }
    
    // Debug logging helper
    log(message, data = null) {
        if (this.debug) {
            console.log(`[CoveTalks API] ${message}`, data || '');
        }
    }
    
    // Get stored authentication token
    getToken() {
        try {
            const localToken = localStorage.getItem(this.STORAGE_KEYS.TOKEN);
            const sessionToken = sessionStorage.getItem(this.STORAGE_KEYS.TOKEN);
            const token = localToken || sessionToken;
            
            this.log('Getting token', { local: !!localToken, session: !!sessionToken, final: !!token });
            return token;
        } catch (e) {
            this.log('Error getting token', e);
            return null;
        }
    }
    
    // Set authorization header
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // Always get fresh token
        const currentToken = this.getToken();
        if (currentToken) {
            headers['Authorization'] = `Bearer ${currentToken}`;
            this.token = currentToken; // Update instance token
        }
        
        return headers;
    }
    
    // Handle API responses
    async handleResponse(response) {
        let data;
        try {
            data = await response.json();
        } catch (e) {
            this.log('Failed to parse response JSON', e);
            throw new Error('Invalid response from server');
        }
        
        this.log('API Response', { status: response.status, data });
        
        if (!response.ok) {
            // If unauthorized, clear auth data
            if (response.status === 401) {
                this.log('Unauthorized response, clearing auth');
                this.clearAuth();
            }
            throw new Error(data.error || `Request failed with status ${response.status}`);
        }
        
        return data;
    }
    
    // Save authentication data
    saveAuth(token, user, remember = true) {
        this.log('Saving auth', { remember, userType: user?.memberType || user?.Member_Type });
        
        // Clear any existing auth data first
        this.clearAuth();
        
        const storage = remember ? localStorage : sessionStorage;
        storage.setItem(this.STORAGE_KEYS.TOKEN, token);
        storage.setItem(this.STORAGE_KEYS.USER, JSON.stringify(user));
        this.token = token; // Update instance token
        
        // Verify the data was saved correctly
        const savedToken = this.getToken();
        const savedUser = this.getCurrentUser();
        this.log('Auth saved and verified', { 
            tokenSaved: !!savedToken, 
            userSaved: !!savedUser,
            userType: savedUser?.memberType || savedUser?.Member_Type 
        });
    }
    
    // Clear authentication data
    clearAuth() {
        this.log('Clearing auth data');
        try {
            localStorage.removeItem(this.STORAGE_KEYS.TOKEN);
            localStorage.removeItem(this.STORAGE_KEYS.USER);
            sessionStorage.removeItem(this.STORAGE_KEYS.TOKEN);
            sessionStorage.removeItem(this.STORAGE_KEYS.USER);
            this.token = null;
        } catch (e) {
            this.log('Error clearing auth', e);
        }
    }
    
    // Authentication methods
    async signup(userData) {
        this.log('Attempting signup', { email: userData.email, type: userData.memberType });
        
        const response = await fetch(`${this.baseURL}/auth-signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        
        const data = await this.handleResponse(response);
        
        if (data.token && data.user) {
            this.saveAuth(data.token, data.user, true);
        }
        
        return data;
    }
    
    async login(email, password, remember = true) {
        this.log('Attempting login', { email, remember });
        
        try {
            const response = await fetch(`${this.baseURL}/auth-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            
            const data = await this.handleResponse(response);
            this.log('Login response received', { success: data.success, hasToken: !!data.token, hasUser: !!data.user });
            
            if (data.success && data.token && data.user) {
                this.saveAuth(data.token, data.user, remember);
                
                // Verify authentication worked
                const isNowAuth = this.isAuthenticated();
                this.log('Post-login auth check', { isAuthenticated: isNowAuth });
                
                if (!isNowAuth) {
                    throw new Error('Authentication failed to persist');
                }
            }
            
            return data;
        } catch (error) {
            this.log('Login error', error);
            throw error;
        }
    }
    
    logout() {
        this.log('Logging out');
        this.clearAuth();
        // Prevent redirect loops - just go to login
        window.location.href = '/login.html';
    }
    
    // Check if user is authenticated
    isAuthenticated() {
        try {
            const token = this.getToken();
            const user = this.getCurrentUser();
            const authenticated = !!(token && user);
            
            this.log('Auth check', { hasToken: !!token, hasUser: !!user, authenticated });
            return authenticated;
        } catch (e) {
            this.log('Error checking authentication', e);
            return false;
        }
    }
    
    // Get current user - FIXED to not clear auth on parse error
    getCurrentUser() {
        try {
            const localUserStr = localStorage.getItem(this.STORAGE_KEYS.USER);
            const sessionUserStr = sessionStorage.getItem(this.STORAGE_KEYS.USER);
            const userStr = localUserStr || sessionUserStr;
            
            if (!userStr) {
                this.log('No user data found in storage');
                return null;
            }
            
            try {
                const user = JSON.parse(userStr);
                this.log('User retrieved', { name: user?.name, type: user?.memberType || user?.Member_Type });
                return user;
            } catch (parseError) {
                this.log('Failed to parse user data', parseError);
                // DON'T clear auth here - just return null
                // This prevents losing auth on temporary parse errors
                return null;
            }
        } catch (e) {
            this.log('Error getting current user', e);
            return null;
        }
    }
    
    // Verify token validity
    async verifyToken() {
        if (!this.getToken()) {
            this.log('No token to verify');
            return false;
        }
        
        try {
            this.log('Verifying token with server');
            const response = await fetch(`${this.baseURL}/auth-verify`, {
                headers: this.getHeaders()
            });
            
            const data = await this.handleResponse(response);
            
            if (!data.valid) {
                this.log('Token invalid according to server');
                this.clearAuth();
                return false;
            }
            
            this.log('Token verified successfully');
            return true;
        } catch (error) {
            this.log('Token verification failed', error);
            // Don't clear auth on network errors - let user retry
            return false;
        }
    }
    
    // Profile methods
    async getProfile(userId = null) {
        const params = userId ? `?id=${userId}` : '';
        const response = await fetch(`${this.baseURL}/profile-get${params}`, {
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
    
    async createBooking(bookingData) {
        const response = await fetch(`${this.baseURL}/bookings-create`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(bookingData)
        });
        
        return this.handleResponse(response);
    }
    
    async updateBookingStatus(bookingId, status) {
        const response = await fetch(`${this.baseURL}/bookings-update`, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify({ bookingId, status })
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
    
    async applyToOpportunity(opportunityId, applicationData) {
        const response = await fetch(`${this.baseURL}/opportunities-apply`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ opportunityId, ...applicationData })
        });
        
        return this.handleResponse(response);
    }
    
    // Members/Speakers methods
    async getMembers(filters = {}) {
        const params = new URLSearchParams(filters);
        const response = await fetch(`${this.baseURL}/members-list?${params}`, {
            headers: this.getHeaders()
        });
        
        return this.handleResponse(response);
    }
    
    async getMemberDetails(memberId) {
        const response = await fetch(`${this.baseURL}/members-get?id=${memberId}`, {
            headers: this.getHeaders()
        });
        
        return this.handleResponse(response);
    }
    
    // Contact/Support methods
    async submitContact(contactData) {
        const response = await fetch(`${this.baseURL}/contact-submit`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(contactData)
        });
        
        return this.handleResponse(response);
    }
    
    // Reviews methods
    async getReviews(speakerId = null) {
        const params = speakerId ? `?speakerId=${speakerId}` : '';
        const response = await fetch(`${this.baseURL}/reviews-list${params}`, {
            headers: this.getHeaders()
        });
        
        return this.handleResponse(response);
    }
    
    async submitReview(reviewData) {
        const response = await fetch(`${this.baseURL}/reviews-create`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(reviewData)
        });
        
        return this.handleResponse(response);
    }
    
    // Subscription methods
    async getSubscriptionStatus() {
        const response = await fetch(`${this.baseURL}/subscription-status`, {
            headers: this.getHeaders()
        });
        
        return this.handleResponse(response);
    }
    
    async updateSubscription(planData) {
        const response = await fetch(`${this.baseURL}/subscription-update`, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify(planData)
        });
        
        return this.handleResponse(response);
    }
    
    // Dashboard methods
    async getDashboardStats() {
        const response = await fetch(`${this.baseURL}/dashboard-stats`, {
            headers: this.getHeaders()
        });
        
        return this.handleResponse(response);
    }
    
    async getDashboardActivity() {
        const response = await fetch(`${this.baseURL}/dashboard-activity`, {
            headers: this.getHeaders()
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
    
    // Payment Methods - NEW METHODS ADDED HERE
    async getPaymentMethods() {
        const response = await fetch(`${this.baseURL}/stripe-payment-methods`, {
            headers: this.getHeaders()
        });
        
        return this.handleResponse(response);
    }
    
    async setDefaultPaymentMethod(paymentMethodId) {
        const response = await fetch(`${this.baseURL}/stripe-payment-methods`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ paymentMethodId })
        });
        
        return this.handleResponse(response);
    }
    
    async removePaymentMethod(paymentMethodId) {
        const response = await fetch(`${this.baseURL}/stripe-payment-methods`, {
            method: 'DELETE',
            headers: this.getHeaders(),
            body: JSON.stringify({ paymentMethodId })
        });
        
        return this.handleResponse(response);
    }
    
    async attachPaymentMethod(paymentMethodId, email) {
        const response = await fetch(`${this.baseURL}/stripe-attach-payment-method`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ paymentMethodId, email })
        });
        
        return this.handleResponse(response);
    }
  }
  
  // Initialize API client
  const api = new CoveTalksAPI();
  
  // Make it globally available
  window.api = api;
  
  // ============================================
  // AUTHENTICATION GUARD (for protected pages)
  // ============================================
  
  // Helper function to check auth without redirect loops
  function requireAuth(redirectTo = '/login.html') {
    // Prevent running on login/register pages
    const currentPath = window.location.pathname;
    if (currentPath.includes('login.html') || currentPath.includes('register.html')) {
        return false;
    }
    
    console.log('[Auth Guard] Checking authentication for:', currentPath);
    
    // Check authentication state
    if (!api.isAuthenticated()) {
        console.log('[Auth Guard] Not authenticated, redirecting to login');
        // Store the current URL for redirect after login
        sessionStorage.setItem('redirectUrl', window.location.href);
        window.location.href = redirectTo;
        return false;
    }
    
    // Get user data
    const user = api.getCurrentUser();
    if (!user) {
        console.log('[Auth Guard] No user data found');
        // Try to re-check after a small delay (in case of timing issues)
        setTimeout(() => {
            const retryUser = api.getCurrentUser();
            if (!retryUser) {
                console.log('[Auth Guard] Still no user data, clearing auth and redirecting');
                api.clearAuth();
                window.location.href = redirectTo;
            }
        }, 100);
        return false;
    }
    
    // Organization-only pages
    const orgOnlyPages = ['organization-dashboard.html', 'post-opportunity.html', 'my-opportunities.html'];
    // Speaker-only pages  
    const speakerOnlyPages = ['dashboard.html'];
    
    const currentFile = currentPath.split('/').pop();
    const userType = user.memberType || user.Member_Type;
    
    console.log('[Auth Guard] User type check:', { userType, currentFile });
    
    // Check user type access
    if (userType === 'Organization' && speakerOnlyPages.includes(currentFile)) {
        console.log('[Auth Guard] Organization user on speaker page, redirecting');
        window.location.href = '/organization-dashboard.html';
        return false;
    }
    
    if (userType !== 'Organization' && orgOnlyPages.includes(currentFile)) {
        console.log('[Auth Guard] Speaker user on organization page, redirecting');
        window.location.href = '/dashboard.html';
        return false;
    }
    
    console.log('[Auth Guard] Authentication check passed');
    return true;
  }
  
  // Make requireAuth globally available
  window.requireAuth = requireAuth;
  
  // ============================================
  // REDIRECT AFTER LOGIN
  // ============================================
  
  // Helper function to handle post-login redirect
  function handlePostLoginRedirect(user) {
    console.log('[Redirect] Handling post-login redirect for user:', user?.name);
    
    // Check for saved redirect URL
    const redirectUrl = sessionStorage.getItem('redirectUrl');
    
    if (redirectUrl && !redirectUrl.includes('login.html') && !redirectUrl.includes('register.html')) {
        console.log('[Redirect] Using saved redirect URL:', redirectUrl);
        sessionStorage.removeItem('redirectUrl');
        window.location.href = redirectUrl;
    } else {
        // Default redirect based on user type
        const userType = user?.memberType || user?.Member_Type;
        if (userType === 'Organization') {
            console.log('[Redirect] Redirecting organization to org dashboard');
            window.location.href = '/organization-dashboard.html';
        } else {
            console.log('[Redirect] Redirecting speaker to dashboard');
            window.location.href = '/dashboard.html';
        }
    }
  }
  
  // Make it globally available
  window.handlePostLoginRedirect = handlePostLoginRedirect;
  
  // ============================================
  // AUTO-REFRESH TOKEN (optional)
  // ============================================
  
  // Only verify token on protected pages, not login/register pages
  if (!window.location.pathname.includes('login.html') && !window.location.pathname.includes('register.html')) {
    // Delay token verification to avoid race conditions
    setTimeout(() => {
        if (api.isAuthenticated()) {
            // Verify token validity in background (don't await)
            api.verifyToken().catch(() => {
                console.log('[Token] Token verification failed, user may need to re-login');
            });
        }
    }, 2000);
  }