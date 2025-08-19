/**
 * CoveTalks Settings Page
 * User account and profile settings management
 */

// Page state
let currentUser = null;
let specialties = [];
let profileImageFile = null;

// Initialize page
async function initializePage() {
    console.log('[Settings] Initializing page');
    
    try {
        // Wait for Supabase client
        await waitForSupabase();
        
        // Check authentication
        const session = await window.covetalks.checkAuth();
        if (!session) {
            // Not authenticated, redirect to login
            window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.href);
            return;
        }
        
        // Get current user profile
        currentUser = await window.covetalks.getCurrentUser();
        if (!currentUser) {
            showAlert('Failed to load user profile', 'error');
            return;
        }
        
        // Load user data into forms
        loadUserData();
        
    } catch (error) {
        console.error('[Settings] Error:', error);
        showAlert('Failed to initialize settings', 'error');
    }
}

// Wait for Supabase client
function waitForSupabase() {
    return new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 20;
        
        function check() {
            attempts++;
            if (window.covetalks && window.covetalks.supabase) {
                resolve();
            } else if (attempts < maxAttempts) {
                setTimeout(check, 500);
            } else {
                console.error('Failed to load Supabase client');
                resolve();
            }
        }
        check();
    });
}

// Load user data into forms
function loadUserData() {
    // Profile section
    const nameParts = (currentUser.name || '').split(' ');
    document.getElementById('firstName').value = nameParts[0] || '';
    document.getElementById('lastName').value = nameParts.slice(1).join(' ') || '';
    document.getElementById('email').value = currentUser.email || '';
    document.getElementById('phone').value = currentUser.phone || '';
    document.getElementById('location').value = currentUser.location || '';
    document.getElementById('bio').value = currentUser.bio || '';
    document.getElementById('website').value = currentUser.website || '';
    document.getElementById('linkedin').value = currentUser.linkedin || '';
    
    // Profile image
    if (currentUser.profile_image_url) {
        const preview = document.getElementById('imagePreview');
        preview.innerHTML = `<img src="${currentUser.profile_image_url}" alt="Profile">`;
        document.getElementById('removeImageBtn').style.display = 'inline-block';
    }
    
    // Professional details (for speakers)
    if (currentUser.member_type === 'Speaker') {
        document.getElementById('title').value = currentUser.title || '';
        document.getElementById('yearsExperience').value = currentUser.years_experience || '';
        
        // Specialties
        specialties = currentUser.specialties || [];
        displaySpecialties();
        
        // Fee range
        if (currentUser.speaking_fee_range) {
            document.getElementById('minFee').value = currentUser.speaking_fee_range.min || '';
            document.getElementById('maxFee').value = currentUser.speaking_fee_range.max || '';
        }
        
        // Audience size
        document.getElementById('audienceSize').value = currentUser.preferred_audience_size || '';
        
        // Event formats
        const formats = currentUser.preferred_formats || [];
        document.querySelectorAll('input[name="formats"]').forEach(checkbox => {
            checkbox.checked = formats.includes(checkbox.value);
        });
    } else {
        // Hide professional section for organizations
        document.querySelector('.settings-nav-item[onclick*="professional"]').style.display = 'none';
    }
    
    // Load notification preferences
    if (currentUser.notification_preferences) {
        const prefs = currentUser.notification_preferences;
        document.getElementById('emailNotifications').checked = prefs.email_notifications !== false;
        document.getElementById('opportunityNotifications').checked = prefs.opportunity_notifications !== false;
        document.getElementById('applicationNotifications').checked = prefs.application_notifications !== false;
        document.getElementById('marketingEmails').checked = prefs.marketing_emails === true;
    }
    
    // Load privacy settings
    if (currentUser.privacy_settings) {
        const privacy = currentUser.privacy_settings;
        document.getElementById('publicProfile').checked = privacy.public_profile !== false;
        document.getElementById('showContact').checked = privacy.show_contact !== false;
        document.getElementById('showFees').checked = privacy.show_fees !== false;
    }
}

// Switch between sections
window.switchSection = function(section) {
    // Update nav
    document.querySelectorAll('.settings-nav-item').forEach(item => {
        item.classList.remove('active');
    });
    event.target.closest('.settings-nav-item').classList.add('active');
    
    // Update content
    document.querySelectorAll('.settings-section').forEach(sec => {
        sec.classList.remove('active');
    });
    document.getElementById(`${section}-section`).classList.add('active');
}

// Profile form submission
document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading(true);
    
    try {
        // Upload image if changed
        if (profileImageFile) {
            const result = await window.covetalks.uploadProfileImage(profileImageFile);
            currentUser.profile_image_url = result.url;
        }
        
        // Prepare update data
        const updates = {
            name: `${document.getElementById('firstName').value} ${document.getElementById('lastName').value}`.trim(),
            phone: document.getElementById('phone').value,
            location: document.getElementById('location').value,
            bio: document.getElementById('bio').value,
            website: document.getElementById('website').value,
            linkedin: document.getElementById('linkedin').value
        };
        
        // Update profile
        await window.covetalks.updateProfile(updates);
        
        showAlert('Profile updated successfully!', 'success');
        profileImageFile = null;
    } catch (error) {
        console.error('[Settings] Profile update error:', error);
        showAlert('Failed to update profile', 'error');
    } finally {
        showLoading(false);
    }
});

// Professional form submission
document.getElementById('professionalForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading(true);
    
    try {
        const formats = [];
        document.querySelectorAll('input[name="formats"]:checked').forEach(checkbox => {
            formats.push(checkbox.value);
        });
        
        const updates = {
            title: document.getElementById('title').value,
            years_experience: parseInt(document.getElementById('yearsExperience').value) || null,
            specialties: specialties,
            speaking_fee_range: {
                min: parseInt(document.getElementById('minFee').value) || 0,
                max: parseInt(document.getElementById('maxFee').value) || 0
            },
            preferred_audience_size: document.getElementById('audienceSize').value,
            preferred_formats: formats
        };
        
        await window.covetalks.updateProfile(updates);
        showAlert('Professional details updated successfully!', 'success');
    } catch (error) {
        console.error('[Settings] Professional update error:', error);
        showAlert('Failed to update professional details', 'error');
    } finally {
        showLoading(false);
    }
});

// Password form submission
document.getElementById('passwordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (newPassword !== confirmPassword) {
        showAlert('Passwords do not match', 'error');
        return;
    }
    
    if (newPassword.length < 8) {
        showAlert('Password must be at least 8 characters', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        // Update password using Supabase Auth
        const { error } = await window.covetalks.supabase.auth.updateUser({
            password: newPassword
        });
        
        if (error) throw error;
        
        showAlert('Password updated successfully!', 'success');
        document.getElementById('passwordForm').reset();
    } catch (error) {
        console.error('[Settings] Password update error:', error);
        showAlert('Failed to update password', 'error');
    } finally {
        showLoading(false);
    }
});

// Notifications form submission
document.getElementById('notificationsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading(true);
    
    try {
        const preferences = {
            email_notifications: document.getElementById('emailNotifications').checked,
            opportunity_notifications: document.getElementById('opportunityNotifications').checked,
            application_notifications: document.getElementById('applicationNotifications').checked,
            marketing_emails: document.getElementById('marketingEmails').checked
        };
        
        await window.covetalks.updateProfile({ notification_preferences: preferences });
        showAlert('Notification preferences updated!', 'success');
    } catch (error) {
        console.error('[Settings] Notifications update error:', error);
        showAlert('Failed to update preferences', 'error');
    } finally {
        showLoading(false);
    }
});

// Privacy form submission
document.getElementById('privacyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading(true);
    
    try {
        const privacy = {
            public_profile: document.getElementById('publicProfile').checked,
            show_contact: document.getElementById('showContact').checked,
            show_fees: document.getElementById('showFees').checked
        };
        
        await window.covetalks.updateProfile({ privacy_settings: privacy });
        showAlert('Privacy settings updated!', 'success');
    } catch (error) {
        console.error('[Settings] Privacy update error:', error);
        showAlert('Failed to update privacy settings', 'error');
    } finally {
        showLoading(false);
    }
});

// Image preview
window.previewImage = function(event) {
    const file = event.target.files[0];
    if (file) {
        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            showAlert('Image must be less than 5MB', 'error');
            event.target.value = '';
            return;
        }
        
        profileImageFile = file;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.getElementById('imagePreview');
            preview.innerHTML = `<img src="${e.target.result}" alt="Profile">`;
            document.getElementById('removeImageBtn').style.display = 'inline-block';
        };
        reader.readAsDataURL(file);
    }
}

// Remove image
window.removeImage = async function() {
    if (confirm('Remove profile photo?')) {
        showLoading(true);
        try {
            await window.covetalks.deleteProfileImage();
            document.getElementById('imagePreview').innerHTML = 
                '<span class="profile-image-placeholder">👤</span>';
            document.getElementById('removeImageBtn').style.display = 'none';
            document.getElementById('imageUpload').value = '';
            profileImageFile = null;
            showAlert('Profile photo removed', 'success');
        } catch (error) {
            console.error('[Settings] Remove image error:', error);
            showAlert('Failed to remove photo', 'error');
        } finally {
            showLoading(false);
        }
    }
}

// Specialties management
document.getElementById('specialtyInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const value = e.target.value.trim();
        if (value && !specialties.includes(value)) {
            specialties.push(value);
            displaySpecialties();
            e.target.value = '';
        }
    }
});

function displaySpecialties() {
    const container = document.getElementById('specialtiesInput');
    const input = document.getElementById('specialtyInput');
    
    // Clear existing tags
    container.querySelectorAll('.specialty-tag').forEach(tag => tag.remove());
    
    // Add tags
    specialties.forEach((specialty, index) => {
        const tag = document.createElement('div');
        tag.className = 'specialty-tag';
        tag.innerHTML = `
            ${specialty}
            <span class="remove" onclick="removeSpecialty(${index})">×</span>
        `;
        container.insertBefore(tag, input);
    });
}

window.removeSpecialty = function(index) {
    specialties.splice(index, 1);
    displaySpecialties();
}

// Delete account
window.confirmDeleteAccount = async function() {
    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
        if (confirm('This will permanently delete all your data. Are you absolutely sure?')) {
            showLoading(true);
            try {
                // Delete user account
                const { error } = await window.covetalks.supabase.auth.admin.deleteUser(currentUser.id);
                if (error) throw error;
                
                // Sign out and redirect
                await window.covetalks.logout();
                window.location.href = '/';
            } catch (error) {
                console.error('[Settings] Delete account error:', error);
                showAlert('Failed to delete account. Please contact support.', 'error');
                showLoading(false);
            }
        }
    }
}

// Show alert message
function showAlert(message, type) {
    const alert = document.getElementById('alertMessage');
    alert.className = `alert alert-${type} show`;
    alert.textContent = message;
    
    // Scroll to alert
    alert.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    setTimeout(() => {
        alert.classList.remove('show');
    }, 5000);
}

// Show/hide loading overlay
function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    overlay.classList.toggle('show', show);
}

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePage);
} else {
    initializePage();
}