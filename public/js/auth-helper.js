// Create a new file: /js/auth-helper.js
// This centralizes all authentication logic to prevent inconsistencies

const AuthHelper = {
    // Storage keys - use consistent naming
    STORAGE_KEYS: {
      TOKEN: 'authToken',
      USER: 'user'
    },
  
    // Get authentication data
    getAuthData() {
      const token = localStorage.getItem(this.STORAGE_KEYS.TOKEN) || 
                    sessionStorage.getItem(this.STORAGE_KEYS.TOKEN);
      const userStr = localStorage.getItem(this.STORAGE_KEYS.USER) || 
                      sessionStorage.getItem(this.STORAGE_KEYS.USER);
      
      let user = null;
      try {
        user = userStr ? JSON.parse(userStr) : null;
      } catch (e) {
        console.error('Failed to parse user data:', e);
        this.clearAuth();
        return { token: null, user: null };
      }
      
      return { token, user };
    },
  
    // Check if user is authenticated
    isAuthenticated() {
      const { token, user } = this.getAuthData();
      return !!(token && user);
    },
  
    // Get user type consistently
    getUserType() {
      const { user } = this.getAuthData();
      if (!user) return null;
      
      // Handle different property names from backend
      return user.memberType || user.Member_Type || user.type || null;
    },
  
    // Save authentication data
    saveAuth(token, user, remember = false) {
      const storage = remember ? localStorage : sessionStorage;
      storage.setItem(this.STORAGE_KEYS.TOKEN, token);
      storage.setItem(this.STORAGE_KEYS.USER, JSON.stringify(user));
    },
  
    // Clear authentication data
    clearAuth() {
      localStorage.removeItem(this.STORAGE_KEYS.TOKEN);
      localStorage.removeItem(this.STORAGE_KEYS.USER);
      sessionStorage.removeItem(this.STORAGE_KEYS.TOKEN);
      sessionStorage.removeItem(this.STORAGE_KEYS.USER);
    },
  
    // Check authentication and redirect if needed
    requireAuth(allowedUserTypes = null) {
      const { token, user } = this.getAuthData();
      
      if (!token || !user) {
        // Save current URL for redirect after login
        sessionStorage.setItem('redirectUrl', window.location.href);
        window.location.href = '/login.html';
        return false;
      }
      
      // Check user type if specified
      if (allowedUserTypes) {
        const userType = this.getUserType();
        const typesArray = Array.isArray(allowedUserTypes) ? allowedUserTypes : [allowedUserTypes];
        
        if (!typesArray.includes(userType)) {
          // Redirect to appropriate dashboard
          if (userType === 'Organization') {
            window.location.href = '/organization-dashboard.html';
          } else {
            window.location.href = '/dashboard.html';
          }
          return false;
        }
      }
      
      return true;
    },
  
    // Redirect logged-in users away from login page
    redirectIfAuthenticated() {
      if (this.isAuthenticated()) {
        const userType = this.getUserType();
        
        // Check for saved redirect URL
        const redirectUrl = sessionStorage.getItem('redirectUrl');
        if (redirectUrl && !redirectUrl.includes('login.html')) {
          sessionStorage.removeItem('redirectUrl');
          window.location.href = redirectUrl;
          return;
        }
        
        // Otherwise redirect to appropriate dashboard
        if (userType === 'Organization') {
          window.location.href = '/organization-dashboard.html';
        } else {
          window.location.href = '/dashboard.html';
        }
      }
    },
  
    // Logout function
    logout() {
      this.clearAuth();
      window.location.href = '/login.html';
    }
  };
  
  // Make it globally available
  window.AuthHelper = AuthHelper;