// ============================================
// AUTHENTICATION DEBUG HELPER
// Add this temporarily to help debug authentication issues
// ============================================

// Debug function to check authentication state
function debugAuth() {
    console.log('=== AUTHENTICATION DEBUG ===');
    
    // Check if API exists
    console.log('1. API Available:', typeof api !== 'undefined');
    
    if (typeof api === 'undefined') {
        console.log('❌ API not loaded - check if app.js is included');
        return;
    }
    
    // Check storage directly
    const localToken = localStorage.getItem('authToken');
    const sessionToken = sessionStorage.getItem('authToken');
    const localUser = localStorage.getItem('user');
    const sessionUser = sessionStorage.getItem('user');
    
    console.log('2. Storage Check:');
    console.log('   - Local Token:', localToken ? 'EXISTS' : 'MISSING');
    console.log('   - Session Token:', sessionToken ? 'EXISTS' : 'MISSING');
    console.log('   - Local User:', localUser ? 'EXISTS' : 'MISSING');
    console.log('   - Session User:', sessionUser ? 'EXISTS' : 'MISSING');
    
    // Check API methods
    console.log('3. API Methods:');
    console.log('   - getToken():', api.getToken() ? 'HAS TOKEN' : 'NO TOKEN');
    console.log('   - getCurrentUser():', api.getCurrentUser() ? 'HAS USER' : 'NO USER');
    console.log('   - isAuthenticated():', api.isAuthenticated());
    
    // Parse user data if available
    const user = api.getCurrentUser();
    if (user) {
        console.log('4. User Data:');
        console.log('   - Name:', user.name);
        console.log('   - Email:', user.email);
        console.log('   - Type:', user.memberType || user.Member_Type);
        console.log('   - Full Object:', user);
    } else {
        console.log('4. User Data: NO USER DATA');
        
        // Try to parse manually
        try {
            const rawUser = localUser || sessionUser;
            if (rawUser) {
                const parsedUser = JSON.parse(rawUser);
                console.log('   - Raw Parse Successful:', parsedUser);
            }
        } catch (e) {
            console.log('   - Raw Parse Error:', e.message);
        }
    }
    
    // Check current page
    console.log('5. Page Info:');
    console.log('   - Path:', window.location.pathname);
    console.log('   - File:', window.location.pathname.split('/').pop());
    console.log('   - Redirect URL in session:', sessionStorage.getItem('redirectUrl'));
    
    // Test API endpoint
    console.log('6. Testing API Connection...');
    fetch(api.baseURL + '/auth-verify', {
        headers: api.getHeaders()
    })
    .then(response => {
        console.log('   - API Response Status:', response.status);
        return response.json();
    })
    .then(data => {
        console.log('   - API Response Data:', data);
    })
    .catch(error => {
        console.log('   - API Error:', error.message);
    });
    
    console.log('=== END DEBUG ===');
}

// Add debug button to page (temporary)
function addDebugButton() {
    const button = document.createElement('button');
    button.textContent = 'Debug Auth';
    button.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        z-index: 10000;
        background: #ff6b6b;
        color: white;
        border: none;
        padding: 10px;
        border-radius: 5px;
        cursor: pointer;
        font-size: 12px;
    `;
    button.onclick = debugAuth;
    document.body.appendChild(button);
}

// Add debug info to console automatically
console.log('%c🔍 CoveTalks Auth Debug Helper Loaded', 'color: #4CAF50; font-weight: bold;');
console.log('Call debugAuth() in console to check authentication state');

// Auto-run debug on page load for now
setTimeout(() => {
    if (window.location.hostname === 'localhost') {
        addDebugButton();
        debugAuth();
    }
}, 1000);

// Make debugAuth globally available
window.debugAuth = debugAuth;