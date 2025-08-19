/**
 * CoveTalks Registration Page
 * Handles speaker and organization registration
 */

// Wait for Supabase client
function waitForSupabase(callback) {
    let attempts = 0;
    const maxAttempts = 10;
    
    const checkClient = () => {
        attempts++;
        if (typeof window.covetalks !== 'undefined' && window.covetalks.supabase) {
            callback();
        } else if (attempts < maxAttempts) {
            setTimeout(checkClient, 500);
        } else {
            console.error('Failed to load Supabase client');
            showMessage('error', 'Application failed to load. Please refresh the page.');
        }
    };
    
    checkClient();
}

// Check if already logged in
document.addEventListener('DOMContentLoaded', function() {
    waitForSupabase(async () => {
        const session = await window.covetalks.checkAuth();
        if (session) {
            // Already logged in, redirect
            const member = await window.covetalks.getMemberProfile(session.user.id);
            if (member) {
                if (member.member_type === 'Organization') {
                    window.location.href = '/organization-dashboard.html';
                } else {
                    window.location.href = '/dashboard.html';
                }
            }
        }
    });
});

// Show/Hide Forms
window.showSpeakerForm = function() {
    document.getElementById('speakerForm').classList.remove('hidden');
    document.getElementById('organizationForm').classList.add('hidden');
    document.getElementById('speakerForm').scrollIntoView({ behavior: 'smooth' });
}

window.showOrganizationForm = function() {
    document.getElementById('organizationForm').classList.remove('hidden');
    document.getElementById('speakerForm').classList.add('hidden');
    document.getElementById('organizationForm').scrollIntoView({ behavior: 'smooth' });
}

window.hideAllForms = function() {
    document.getElementById('speakerForm').classList.add('hidden');
    document.getElementById('organizationForm').classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Speaker Registration
document.getElementById('speakerRegForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const firstName = document.getElementById('speakerFirstName').value.trim();
    const lastName = document.getElementById('speakerLastName').value.trim();
    const email = document.getElementById('speakerEmail').value.trim();
    const phone = document.getElementById('speakerPhone').value.trim();
    const password = document.getElementById('speakerPassword').value;
    const confirmPassword = document.getElementById('speakerConfirmPassword').value;
    const location = document.getElementById('speakerLocation').value.trim();
    const bio = document.getElementById('speakerBio').value.trim();
    const topics = document.getElementById('speakerTopics').value.trim();
    
    // Validate passwords
    if (password !== confirmPassword) {
        showMessage('error', 'Passwords do not match');
        return;
    }
    
    if (password.length < 8) {
        showMessage('error', 'Password must be at least 8 characters long');
        return;
    }
    
    // Show loading
    const submitBtn = document.getElementById('speakerSubmitBtn');
    submitBtn.disabled = true;
    document.getElementById('speakerSubmitText').classList.add('hidden');
    document.getElementById('speakerSubmitLoader').classList.remove('hidden');
    
    try {
        // Register with Supabase
        const result = await window.covetalks.signup({
            email: email,
            password: password,
            name: `${firstName} ${lastName}`,
            memberType: 'Speaker',
            phone: phone,
            location: location,
            bio: bio,
            specialties: topics ? topics.split(',').map(t => t.trim()) : []
        });
        
        if (result && result.user) {
            showMessage('success', 'Account created successfully! Redirecting to pricing...');
            
            // Auto-login and redirect to pricing
            setTimeout(() => {
                window.location.href = '/pricing.html';
            }, 1500);
        } else {
            throw new Error('Registration failed');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showMessage('error', error.message || 'Registration failed. Please try again.');
    } finally {
        submitBtn.disabled = false;
        document.getElementById('speakerSubmitText').classList.remove('hidden');
        document.getElementById('speakerSubmitLoader').classList.add('hidden');
    }
});

// Organization Registration
document.getElementById('orgForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const orgName = document.getElementById('orgName').value.trim();
    const orgType = document.getElementById('orgType').value;
    const firstName = document.getElementById('contactFirstName').value.trim();
    const lastName = document.getElementById('contactLastName').value.trim();
    const email = document.getElementById('contactEmail').value.trim();
    const phone = document.getElementById('contactPhone').value.trim();
    const password = document.getElementById('orgPassword').value;
    const confirmPassword = document.getElementById('orgConfirmPassword').value;
    const website = document.getElementById('orgWebsite').value.trim();
    const location = document.getElementById('orgLocation').value.trim();
    const description = document.getElementById('orgDescription').value.trim();
    const speakingTopics = document.getElementById('speakingTopics').value.trim();
    
    // Validate passwords
    if (password !== confirmPassword) {
        showMessage('error', 'Passwords do not match');
        return;
    }
    
    if (password.length < 8) {
        showMessage('error', 'Password must be at least 8 characters long');
        return;
    }
    
    // Show loading
    const submitBtn = document.getElementById('orgSubmitBtn');
    submitBtn.disabled = true;
    document.getElementById('orgSubmitText').classList.add('hidden');
    document.getElementById('orgSubmitLoader').classList.remove('hidden');
    
    try {
        // Register with Supabase
        const result = await window.covetalks.signup({
            email: email,
            password: password,
            name: `${firstName} ${lastName}`,
            memberType: 'Organization',
            phone: phone,
            location: location,
            bio: description,
            organizationData: {
                Organization_Name: orgName,
                Organization_Type: orgType,
                website: website,
                description: description,
                Speaking_Topics: speakingTopics ? speakingTopics.split(',').map(t => t.trim()) : []
            }
        });
        
        if (result && result.user) {
            showMessage('success', 'Organization registered successfully! Redirecting to dashboard...');
            
            // Auto-login and redirect to organization dashboard
            setTimeout(() => {
                window.location.href = '/organization-dashboard.html';
            }, 1500);
        } else {
            throw new Error('Registration failed');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showMessage('error', error.message || 'Registration failed. Please try again.');
    } finally {
        submitBtn.disabled = false;
        document.getElementById('orgSubmitText').classList.remove('hidden');
        document.getElementById('orgSubmitLoader').classList.add('hidden');
    }
});

// Password strength checker
function checkPasswordStrength(password, strengthElementId) {
    const strengthElement = document.getElementById(strengthElementId);
    let strength = 0;
    
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    
    if (password.length === 0) {
        strengthElement.textContent = '';
        strengthElement.className = 'password-strength';
    } else if (strength < 2) {
        strengthElement.textContent = 'Weak password';
        strengthElement.className = 'password-strength weak';
    } else if (strength < 4) {
        strengthElement.textContent = 'Medium strength';
        strengthElement.className = 'password-strength medium';
    } else {
        strengthElement.textContent = 'Strong password';
        strengthElement.className = 'password-strength strong';
    }
}

// Add password strength listeners
document.getElementById('speakerPassword').addEventListener('input', function() {
    checkPasswordStrength(this.value, 'speakerPasswordStrength');
});

document.getElementById('orgPassword').addEventListener('input', function() {
    checkPasswordStrength(this.value, 'orgPasswordStrength');
});

// Password confirmation validation
document.getElementById('speakerConfirmPassword').addEventListener('input', function() {
    const password = document.getElementById('speakerPassword').value;
    if (this.value && password !== this.value) {
        this.setCustomValidity('Passwords do not match');
    } else {
        this.setCustomValidity('');
    }
});

document.getElementById('orgConfirmPassword').addEventListener('input', function() {
    const password = document.getElementById('orgPassword').value;
    if (this.value && password !== this.value) {
        this.setCustomValidity('Passwords do not match');
    } else {
        this.setCustomValidity('');
    }
});

// Show message
function showMessage(type, message) {
    const errorDiv = document.getElementById('errorMessage');
    const successDiv = document.getElementById('successMessage');
    
    // Hide all messages first
    errorDiv.classList.remove('show');
    successDiv.classList.remove('show');
    
    if (type === 'error') {
        errorDiv.textContent = message;
        errorDiv.classList.add('show');
        errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
        successDiv.textContent = message;
        successDiv.classList.add('show');
        successDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        errorDiv.classList.remove('show');
        successDiv.classList.remove('show');
    }, 5000);
}