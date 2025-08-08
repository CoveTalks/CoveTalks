// File: /public/js/navigation.js
// This file handles all navigation-related functionality

// Update navigation based on authentication status
function updateNavigation() {
  try {
    // Check if API is available
    if (typeof api === 'undefined') {
      console.log('[Navigation] API not yet available');
      return;
    }
    
    const user = api.getCurrentUser();
    const isAuthenticated = api.isAuthenticated();
    
    console.log('[Navigation] Updating navigation:', { isAuthenticated, hasUser: !!user });
    
    // Get all navigation elements
    const navLoggedOut = document.getElementById('navLoggedOut');
    const navSpeaker = document.getElementById('navSpeaker');
    const navOrganization = document.getElementById('navOrganization');
    const authButtons = document.getElementById('authButtonsDesktop');
    const userMenu = document.getElementById('userMenuDesktop');
    
    // Mobile elements
    const mobileNavLoggedOut = document.getElementById('mobileNavLoggedOut');
    const mobileNavSpeaker = document.getElementById('mobileNavSpeaker');
    const mobileNavOrganization = document.getElementById('mobileNavOrganization');
    const mobileUserSection = document.getElementById('mobileUserSection');
    const mobileAuthButtons = document.getElementById('mobileAuthButtons');
    const mobileLogoutSection = document.getElementById('mobileLogoutSection');
    
    if (isAuthenticated && user) {
        // Hide logged out navigation
        if (navLoggedOut) navLoggedOut.style.display = 'none';
        if (authButtons) authButtons.style.display = 'none';
        if (mobileNavLoggedOut) mobileNavLoggedOut.style.display = 'none';
        if (mobileAuthButtons) mobileAuthButtons.style.display = 'none';
        
        // Show appropriate logged in navigation based on user type
        const userType = user.memberType || user.Member_Type;
        
        if (userType === 'Organization') {
            // Organization navigation
            if (navOrganization) navOrganization.style.display = 'flex';
            if (navSpeaker) navSpeaker.style.display = 'none';
            if (mobileNavOrganization) mobileNavOrganization.style.display = 'block';
            if (mobileNavSpeaker) mobileNavSpeaker.style.display = 'none';
        } else {
            // Speaker navigation (default)
            if (navSpeaker) navSpeaker.style.display = 'flex';
            if (navOrganization) navOrganization.style.display = 'none';
            if (mobileNavSpeaker) mobileNavSpeaker.style.display = 'block';
            if (mobileNavOrganization) mobileNavOrganization.style.display = 'none';
        }
        
        // Show user menu
        if (userMenu) {
            userMenu.style.display = 'flex';
            updateUserAvatar(user);
        }
        
        // Show mobile user section
        if (mobileUserSection) {
            mobileUserSection.style.display = 'block';
            updateMobileUserInfo(user);
        }
        if (mobileLogoutSection) {
            mobileLogoutSection.style.display = 'block';
        }
    } else {
        // Show logged out state
        if (navLoggedOut) navLoggedOut.style.display = 'flex';
        if (authButtons) authButtons.style.display = 'flex';
        if (navSpeaker) navSpeaker.style.display = 'none';
        if (navOrganization) navOrganization.style.display = 'none';
        if (userMenu) userMenu.style.display = 'none';
        
        // Mobile logged out state
        if (mobileNavLoggedOut) mobileNavLoggedOut.style.display = 'block';
        if (mobileNavSpeaker) mobileNavSpeaker.style.display = 'none';
        if (mobileNavOrganization) mobileNavOrganization.style.display = 'none';
        if (mobileUserSection) mobileUserSection.style.display = 'none';
        if (mobileAuthButtons) mobileAuthButtons.style.display = 'flex';
        if (mobileLogoutSection) mobileLogoutSection.style.display = 'none';
    }
    
    // Set active navigation item
    setActiveNavItem();
  } catch (e) {
    console.error('[Navigation] Error updating navigation:', e);
  }
}

// Update user avatar with initials
function updateUserAvatar(user) {
  try {
    const initials = user.name ? 
        user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 
        'U';
    
    const userAvatar = document.getElementById('userAvatar');
    if (userAvatar) {
        userAvatar.textContent = initials;
    }
  } catch (e) {
    console.error('[Navigation] Error updating avatar:', e);
  }
}

// Update mobile user info
function updateMobileUserInfo(user) {
  try {
    const initials = user.name ? 
        user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 
        'U';
    
    const mobileUserAvatar = document.getElementById('mobileUserAvatar');
    const mobileUserName = document.getElementById('mobileUserName');
    const mobileUserType = document.getElementById('mobileUserType');
    
    if (mobileUserAvatar) {
        mobileUserAvatar.textContent = initials;
    }
    if (mobileUserName) {
        mobileUserName.textContent = user.name || 'User';
    }
    if (mobileUserType) {
        mobileUserType.textContent = user.memberType || user.Member_Type || 'Member';
    }
  } catch (e) {
    console.error('[Navigation] Error updating mobile user info:', e);
  }
}

// Set active navigation item based on current page
function setActiveNavItem() {
  try {
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    
    // Clear all active classes first
    document.querySelectorAll('.nav-links a, .mobile-nav-links a').forEach(link => {
        link.classList.remove('active');
    });
    
    // Set active class on matching links
    document.querySelectorAll('.nav-links a, .mobile-nav-links a').forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        }
    });
  } catch (e) {
    console.error('[Navigation] Error setting active nav item:', e);
  }
}

// Logout function - use API's logout
function logout() {
  if (typeof api !== 'undefined') {
      api.logout();
  } else {
      // Fallback if API not loaded
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/login.html';
  }
}

// Make functions globally available
window.updateNavigation = updateNavigation;
window.logout = logout;

// Initialize navigation when DOM is ready (but don't check auth)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
      console.log('[Navigation] DOM loaded, navigation script ready');
      // Only update navigation UI if API is available
      if (typeof api !== 'undefined') {
          updateNavigation();
      }
  });
} else {
  // DOM is already loaded
  console.log('[Navigation] Navigation script loaded (DOM ready)');
  if (typeof api !== 'undefined') {
      updateNavigation();
  }
}