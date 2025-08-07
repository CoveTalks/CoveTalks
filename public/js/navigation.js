// File: /public/js/navigation.js

function updateNavigation() {
    const user = api.getCurrentUser();
    const isAuthenticated = api.isAuthenticated();
    
    // Get all navigation elements
    const navLoggedOut = document.getElementById('navLoggedOut');
    const navSpeaker = document.getElementById('navSpeaker');
    const navOrganization = document.getElementById('navOrganization');
    const authButtons = document.getElementById('authButtonsDesktop');
    const userMenu = document.getElementById('userMenuDesktop');
    
    if (isAuthenticated && user) {
      // Hide logged out navigation
      if (navLoggedOut) navLoggedOut.style.display = 'none';
      if (authButtons) authButtons.style.display = 'none';
      
      // Show appropriate logged in navigation
      if (user.memberType === 'Organization') {
        if (navOrganization) navOrganization.style.display = 'flex';
        if (navSpeaker) navSpeaker.style.display = 'none';
      } else {
        if (navSpeaker) navSpeaker.style.display = 'flex';
        if (navOrganization) navOrganization.style.display = 'none';
      }
      
      // Show user menu
      if (userMenu) {
        userMenu.style.display = 'flex';
        updateUserAvatar(user);
      }
    } else {
      // Show logged out state
      if (navLoggedOut) navLoggedOut.style.display = 'flex';
      if (authButtons) authButtons.style.display = 'flex';
      if (navSpeaker) navSpeaker.style.display = 'none';
      if (navOrganization) navOrganization.style.display = 'none';
      if (userMenu) userMenu.style.display = 'none';
    }
    
    // Update mobile navigation similarly
    updateMobileNavigation(isAuthenticated, user);
  }
  
  function updateUserAvatar(user) {
    const avatars = document.querySelectorAll('.user-avatar');
    const initials = user.name ? 
      user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 
      'U';
    
    avatars.forEach(avatar => {
      avatar.textContent = initials;
    });
  }
  
  // Protected page check
  function requireAuth(redirectTo = '/login.html') {
    if (!api.isAuthenticated()) {
      window.location.href = redirectTo;
      return false;
    }
    return true;
  }
  
  // Logout function
  function logout() {
    api.logout();
  }