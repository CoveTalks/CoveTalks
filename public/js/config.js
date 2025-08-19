// config.js - Works with both hardcoded values and environment variables
window.CONFIG = {  // Changed from APP_CONFIG to CONFIG
    // Try to use environment variables if available (in Netlify Functions)
    // Otherwise fall back to hardcoded values
    SUPABASE_URL: window.SUPABASE_URL || 'https://rzunxswrglopenyfpeqq.supabase.co',
    SUPABASE_ANON_KEY: window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6dW54c3dyZ2xvcGVueWZwZXFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzMTg1NDMsImV4cCI6MjA3MDg5NDU0M30.bcmGzzV6gfXI7QXyxsDzzKl5CNjvzLodGXgXQszPThc',
    STRIPE_PUBLISHABLE_KEY: window.STRIPE_PUBLISHABLE_KEY || 'pk_live_51RrABe1Fvl67fP5VrtH3hkNvl4chaiFtlskEMSHJIw6M1tAHdcgZ21pgup7DCEajjyQFUDM1jnIE7W1KrGBDjieV002ztaIRXk',
    
    // Environment detection
    IS_DEVELOPMENT: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
    IS_NETLIFY_DEV: window.location.port === '8888', // Default Netlify Dev port
    
    // API endpoints (useful for future serverless functions)
    API_BASE_URL: window.location.origin,
    
    // Feature flags
    ENABLE_DEBUG: window.location.hostname === 'localhost',
    ENABLE_TEST_DATA: window.location.hostname === 'localhost'
};