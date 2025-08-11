// ============================================
// COVETALKS API CLIENT - HYBRID SMART VERSION
// ============================================

class CoveTalksAPI {
    constructor() {
        // Use consistent base URL configuration
        this.baseURL = window.location.hostname === 'localhost' 
            ? 'http://localhost:8888/.netlify/functions'
            : '/.netlify/functions';
        
        // Consistent storage keys
        this.STORAGE_KEYS = {
            TOKEN: 'authToken',
            USER: 'user',
            DEFERRED: 'deferredItems',
            DESTINATION: 'loginDestination'
        };
        
        // Initialize token from storage
        this.token = this.getToken();
        
        // Deferred loading queue
        this.deferredQueue = [];
        this.loadingDeferred = false;
        
        // Performance tracking
        this.performanceMetrics = {
            loginStart: null,
            loginEnd: null,
            deferredStart: null,
            deferredEnd: null
        };
        
        // Debug logging (disable in production)
        this.debug = window.location.hostname === 'localhost';
        this.log('API initialized', { token: !!this.token, user: !!this.getCurrentUser() });
        
        // Start background loading if there are deferred items
        this.checkDeferredItems();
    }
    
    // Debug logging helper
    log(message, data = null) {
        if (this.debug) {
            console.log(`[CoveTalks API] ${message}`, data || '');
        }
    }
    
    // Performance logging
    logPerformance(metric, value) {
        if (this.debug) {
            console.log(`⚡ Performance: ${metric} = ${value}ms`);
        }
    }
    
    // Get stored authentication token
    getToken() {
        try {
            const localToken = localStorage.getItem(this.STORAGE_KEYS.TOKEN);
            const sessionToken = sessionStorage.getItem(this.STORAGE_KEYS.TOKEN);
            return localToken || sessionToken;
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
        
        const currentToken = this.getToken();
        if (currentToken) {
            headers['Authorization'] = `Bearer ${currentToken}`;
            this.token = currentToken;
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
            if (response.status === 401) {
                this.log('Unauthorized response, clearing auth');
                this.clearAuth();
            }
            throw new Error(data.error || `Request failed with status ${response.status}`);
        }
        
        return data;
    }
    
    // Save authentication data
    saveAuth(token, user, remember = true, deferred = []) {
        this.log('Saving auth', { 
            remember, 
            userType: user?.memberType || user?.Member_Type,
            deferredItems: deferred 
        });
        
        // Clear any existing auth data first
        this.clearAuth();
        
        const storage = remember ? localStorage : sessionStorage;
        storage.setItem(this.STORAGE_KEYS.TOKEN, token);
        storage.setItem(this.STORAGE_KEYS.USER, JSON.stringify(user));
        
        // Save deferred items if any
        if (deferred && deferred.length > 0) {
            storage.setItem(this.STORAGE_KEYS.DEFERRED, JSON.stringify(deferred));
            this.deferredQueue = deferred;
        }
        
        this.token = token;
    }
    
    // Clear authentication data
    clearAuth() {
        this.log('Clearing auth data');
        try {
            localStorage.removeItem(this.STORAGE_KEYS.TOKEN);
            localStorage.removeItem(this.STORAGE_KEYS.USER);
            localStorage.removeItem(this.STORAGE_KEYS.DEFERRED);
            localStorage.removeItem(this.STORAGE_KEYS.DESTINATION);
            sessionStorage.removeItem(this.STORAGE_KEYS.TOKEN);
            sessionStorage.removeItem(this.STORAGE_KEYS.USER);
            sessionStorage.removeItem(this.STORAGE_KEYS.DEFERRED);
            sessionStorage.removeItem(this.STORAGE_KEYS.DESTINATION);
            this.token = null;
            this.deferredQueue = [];
        } catch (e) {
            this.log('Error clearing auth', e);
        }
    }
    
    // Detect intended destination
    detectDestination() {
        // Check for saved redirect URL
        const redirectUrl = sessionStorage.getItem('redirectUrl');
        
        if (redirectUrl) {
            // Parse destination from URL
            if (redirectUrl.includes('dashboard')) return 'dashboard';
            if (redirectUrl.includes('organization-dashboard')) return 'org-dashboard';
            if (redirectUrl.includes('profile')) return 'profile';
            if (redirectUrl.includes('billing')) return 'billing';
            if (redirectUrl.includes('opportunities')) return 'opportunities';
            if (redirectUrl.includes('settings')) return 'settings';
        }
        
        // Check for explicit destination
        const savedDestination = sessionStorage.getItem(this.STORAGE_KEYS.DESTINATION);
        if (savedDestination) return savedDestination;
        
        // Default to auto-detect
        return 'auto';
    }
    
    // Set intended destination before login
    setDestination(destination) {
        sessionStorage.setItem(this.STORAGE_KEYS.DESTINATION, destination);
    }
    
    // ============================================
    // SMART LOGIN METHOD
    // ============================================
    async login(email, password, remember = true) {
        this.performanceMetrics.loginStart = Date.now();
        
        const destination = this.detectDestination();
        this.log('Smart login attempt', { email, remember, destination });
        
        try {
            const response = await fetch(`${this.baseURL}/auth-login-smart`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, destination })
            });
            
            const data = await this.handleResponse(response);
            
            this.performanceMetrics.loginEnd = Date.now();
            const loginTime = this.performanceMetrics.loginEnd - this.performanceMetrics.loginStart;
            this.logPerformance('Login time', loginTime);
            
            if (data.timing) {
                this.logPerformance('Backend processing', data.timing);
            }
            
            this.log('Login response', { 
                success: data.success, 
                hasToken: !!data.token, 
                hasUser: !!data.user,
                deferred: data.deferred,
                destination: data.destination
            });
            
            if (data.success && data.token && data.user) {
                // Save authentication with deferred items
                this.saveAuth(data.token, data.user, remember, data.deferred || []);
                
                // Start loading deferred data in background
                if (data.deferred && data.deferred.length > 0) {
                    this.log('Scheduling deferred loading for:', data.deferred);
                    // Start loading after a short delay to allow navigation
                    setTimeout(() => this.loadDeferredData(), 500);
                }
                
                // Trigger auth success event
                this.triggerAuthEvent('login', data.user);
            }
            
            return data;
        } catch (error) {
            this.log('Login error', error);
            throw error;
        }
    }
    
    // ============================================
    // DEFERRED DATA LOADING
    // ============================================
    
    // Check for deferred items on initialization
    checkDeferredItems() {
        try {
            const deferredStr = localStorage.getItem(this.STORAGE_KEYS.DEFERRED) || 
                               sessionStorage.getItem(this.STORAGE_KEYS.DEFERRED);
            
            if (deferredStr) {
                const deferred = JSON.parse(deferredStr);
                if (deferred && deferred.length > 0) {
                    this.deferredQueue = deferred;
                    this.log('Found deferred items to load:', deferred);
                    
                    // Start loading after page settles
                    setTimeout(() => this.loadDeferredData(), 1000);
                }
            }
        } catch (e) {
            this.log('Error checking deferred items', e);
        }
    }
    
    // Load deferred data in background
    async loadDeferredData() {
        if (this.loadingDeferred || this.deferredQueue.length === 0) {
            return;
        }
        
        this.loadingDeferred = true;
        this.performanceMetrics.deferredStart = Date.now();
        
        const itemsToLoad = [...this.deferredQueue];
        this.log('Loading deferred data:', itemsToLoad);
        
        try {
            const response = await fetch(`${this.baseURL}/auth-load-deferred`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({ items: itemsToLoad })
            });
            
            const result = await this.handleResponse(response);
            
            if (result.success && result.data) {
                // Merge deferred data into user object
                this.mergeUserData(result.data);
                
                // Clear deferred queue
                this.deferredQueue = [];
                const storage = localStorage.getItem(this.STORAGE_KEYS.USER) ? localStorage : sessionStorage;
                storage.removeItem(this.STORAGE_KEYS.DEFERRED);
                
                this.performanceMetrics.deferredEnd = Date.now();
                const deferredTime = this.performanceMetrics.deferredEnd - this.performanceMetrics.deferredStart;
                this.logPerformance('Deferred loading time', deferredTime);
                
                // Trigger event for UI updates
                this.triggerDataEvent('deferred-loaded', result.data);
                
                this.log('Deferred data loaded successfully:', result.loaded);
            }
        } catch (error) {
            this.log('Failed to load deferred data:', error);
            // Retry after a delay
            setTimeout(() => {
                this.loadingDeferred = false;
                this.loadDeferredData();
            }, 5000);
        } finally {
            this.loadingDeferred = false;
        }
    }
    
    // Merge deferred data into stored user object
    mergeUserData(newData) {
        try {
            const user = this.getCurrentUser();
            if (!user) return;
            
            // Merge new data
            const updatedUser = { ...user, ...newData };
            
            // Save updated user
            const storage = localStorage.getItem(this.STORAGE_KEYS.TOKEN) ? localStorage : sessionStorage;
            storage.setItem(this.STORAGE_KEYS.USER, JSON.stringify(updatedUser));
            
            this.log('User data merged with deferred data');
        } catch (e) {
            this.log('Error merging user data', e);
        }
    }
    
    // ============================================
    // EVENT SYSTEM FOR UI UPDATES
    // ============================================
    
    triggerAuthEvent(type, user) {
        const event = new CustomEvent('covetalks-auth', {
            detail: { type, user }
        });
        window.dispatchEvent(event);
    }
    
    triggerDataEvent(type, data) {
        const event = new CustomEvent('covetalks-data', {
            detail: { type, data }
        });
        window.dispatchEvent(event);
    }
    
    // Listen for auth events
    onAuth(callback) {
        window.addEventListener('covetalks-auth', callback);
    }
    
    // Listen for data events
    onData(callback) {
        window.addEventListener('covetalks-data', callback);
    }
    
    // ============================================
    // CHECK DATA AVAILABILITY
    // ============================================
    
    hasCompleteData() {
        const user = this.getCurrentUser();
        if (!user) return false;
        
        const userType = user.memberType || user.Member_Type;
        
        if (userType === 'Speaker') {
            // Check if speaker has all expected data
            return !!(user.subscription !== undefined && 
                     user.specialty !== undefined);
        } else if (userType === 'Organization') {
            // Check if organization has all expected data
            return !!(user.organization || user.organizationDetails);
        }
        
        return true; // Assume complete for unknown types
    }
    
    isDataLoading(dataType) {
        return this.deferredQueue.includes(dataType);
    }
    
    // ============================================
    // EXISTING METHODS (kept for compatibility)
    // ============================================
    
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
    
    logout() {
        this.log('Logging out');
        this.clearAuth();
        window.location.href = '/login.html';
    }
    
    isAuthenticated() {
        try {
            const token = this.getToken();
            const user = this.getCurrentUser();
            return !!(token && user);
        } catch (e) {
            this.log('Error checking authentication', e);
            return false;
        }
    }
    
    getCurrentUser() {
        try {
            const localUserStr = localStorage.getItem(this.STORAGE_KEYS.USER);
            const sessionUserStr = sessionStorage.getItem(this.STORAGE_KEYS.USER);
            const userStr = localUserStr || sessionUserStr;
            
            if (!userStr) {
                return null;
            }
            
            try {
                const user = JSON.parse(userStr);
                return user;
            } catch (parseError) {
                this.log('Failed to parse user data', parseError);
                return null;
            }
        } catch (e) {
            this.log('Error getting current user', e);
            return null;
        }
    }
    
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
    
    // All other existing methods remain the same...
    // (getBookings, createBooking, getOpportunities, etc.)
    
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
    
    // Subscription methods
    async getSubscriptionStatus() {
        const response = await fetch(`${this.baseURL}/subscription-status`, {
            headers: this.getHeaders()
        });
        
        return this.handleResponse(response);
    }
    
    // Add all other methods from original...
}

// ============================================
// SMART AUTH GUARD
// ============================================

function requireAuth(redirectTo = '/login.html') {
    const currentPath = window.location.pathname;
    
    // Don't run on login/register pages
    if (currentPath.includes('login.html') || currentPath.includes('register.html')) {
        return false;
    }
    
    console.log('[Auth Guard] Checking authentication for:', currentPath);
    
    if (!api.isAuthenticated()) {
        console.log('[Auth Guard] Not authenticated, redirecting to login');
        sessionStorage.setItem('redirectUrl', window.location.href);
        
        // Set destination hint for smart loading
        if (currentPath.includes('dashboard')) {
            api.setDestination('dashboard');
        } else if (currentPath.includes('profile')) {
            api.setDestination('profile');
        } else if (currentPath.includes('billing')) {
            api.setDestination('billing');
        }
        
        window.location.href = redirectTo;
        return false;
    }
    
    const user = api.getCurrentUser();
    if (!user) {
        console.log('[Auth Guard] No user data found');
        api.clearAuth();
        window.location.href = redirectTo;
        return false;
    }
    
    console.log('[Auth Guard] Authentication check passed');
    return true;
}

// ============================================
// POST-LOGIN REDIRECT
// ============================================

function handlePostLoginRedirect(user) {
    console.log('[Redirect] Handling post-login redirect');
    
    const redirectUrl = sessionStorage.getItem('redirectUrl');
    
    if (redirectUrl && !redirectUrl.includes('login.html') && !redirectUrl.includes('register.html')) {
        console.log('[Redirect] Using saved redirect URL:', redirectUrl);
        sessionStorage.removeItem('redirectUrl');
        window.location.href = redirectUrl;
    } else {
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

// ============================================
// INITIALIZE
// ============================================

// Initialize API client
const api = new CoveTalksAPI();

// Make globally available
window.api = api;
window.requireAuth = requireAuth;
window.handlePostLoginRedirect = handlePostLoginRedirect;

// Listen for deferred data loads and update UI
api.onData((event) => {
    if (event.detail.type === 'deferred-loaded') {
        console.log('[App] Deferred data loaded, updating UI...');
        
        // Trigger UI updates
        if (typeof window.updateUIWithDeferredData === 'function') {
            window.updateUIWithDeferredData(event.detail.data);
        }
    }
});

// Auto-verify token on protected pages (delayed)
if (!window.location.pathname.includes('login.html') && 
    !window.location.pathname.includes('register.html')) {
    setTimeout(() => {
        if (api.isAuthenticated() && !api.hasCompleteData()) {
            console.log('[App] Incomplete user data detected, loading deferred items...');
            api.loadDeferredData();
        }
    }, 2000);
}