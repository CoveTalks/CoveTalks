/**
 * CoveTalks Profile Page
 * Unified profile for both speakers and organizations with proper activity tracking
 */

// Page state
let currentUser = null;
let profileUser = null;
let profileId = null;
let isOwnProfile = false;
let organizationData = null;

// Get profile ID from URL
const urlParams = new URLSearchParams(window.location.search);
profileId = urlParams.get('id');

// Initialize page
async function initializePage() {
    console.log('[Profile] Initializing profile page');
    console.log('[Profile] Profile ID from URL:', profileId);
    
    try {
        // Wait for Supabase
        await waitForSupabase();
        
        // Check authentication
        const session = await window.covetalks.checkAuth();
        if (session) {
            console.log('[Profile] User authenticated:', session.user.id);
            currentUser = await window.covetalks.getMemberProfile(session.user.id);
        }
        
        // Load profile data
        await loadProfile();
        
    } catch (error) {
        console.error('[Profile] Error:', error);
        showError('Failed to load profile. Please try refreshing the page.');
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
                console.log('[Profile] Supabase client ready');
                resolve();
            } else if (attempts < maxAttempts) {
                setTimeout(check, 250);
            } else {
                console.error('[Profile] Failed to load Supabase client');
                showError('Failed to initialize. Please refresh the page.');
            }
        }
        check();
    });
}

// Load profile
async function loadProfile() {
    try {
        // Show loading state
        document.getElementById('loadingState').classList.remove('hidden');
        document.getElementById('profileContent').classList.add('hidden');
        document.getElementById('errorState').classList.add('hidden');
        
        // Determine which profile to load
        if (profileId) {
            // Load specific profile
            console.log('[Profile] Loading profile for ID:', profileId);
            profileUser = await window.covetalks.getMemberProfile(profileId);
        } else if (currentUser) {
            // Load current user's profile
            console.log('[Profile] No ID provided, loading current user profile');
            profileUser = currentUser;
            profileId = currentUser.id;
        } else {
            // Not logged in and no profile ID
            showError('Please specify a profile to view or login to view your profile');
            return;
        }
        
        if (!profileUser) {
            showError('Profile not found');
            return;
        }
        
        console.log('[Profile] Profile loaded:', profileUser);
        
        // Set profile type class
        const profileType = profileUser.member_type?.toLowerCase() || 'speaker';
        document.body.classList.add(`profile-type-${profileType}`);
        console.log('[Profile] Profile type:', profileType);
        
        // Check if viewing own profile
        isOwnProfile = currentUser && currentUser.id === profileUser.id;
        if (isOwnProfile) {
            document.body.classList.add('is-own-profile');
            console.log('[Profile] Viewing own profile');
        } else {
            // TRACK PROFILE VIEW - Only if viewing someone else's profile and logged in
            if (currentUser && window.covetalks?.trackProfileView) {
                try {
                    await window.covetalks.trackProfileView(profileUser.id);
                    console.log('[Profile] Profile view tracked successfully for:', profileUser.id);
                } catch (trackError) {
                    console.error('[Profile] Failed to track profile view:', trackError);
                    // Don't fail the page load if tracking fails
                }
            } else if (!currentUser) {
                console.log('[Profile] Not tracking view - user not logged in');
            }
        }
        
        // Load organization data if needed
        if (profileUser.member_type === 'Organization') {
            organizationData = await loadOrganizationData(profileUser.id);
            console.log('[Profile] Organization data:', organizationData);
        }
        
        // Hide loading, show content
        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('profileContent').classList.remove('hidden');
        
        // Display profile data
        displayProfile();
        
        // Load additional data
        await Promise.all([
            loadAdditionalData(),
            loadStats()
        ]);
        
        // If logged in, subscribe to real-time updates for this profile
        if (currentUser && !isOwnProfile) {
            subscribeToProfileUpdates();
        }
        
    } catch (error) {
        console.error('[Profile] Error loading profile:', error);
        showError('Failed to load profile');
    }
}

// Subscribe to real-time profile updates
function subscribeToProfileUpdates() {
    // Subscribe to updates for this profile
    const profileChannel = window.covetalks.supabase
        .channel(`profile-${profileId}`)
        .on('postgres_changes', 
            { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'members',
                filter: `id=eq.${profileId}`
            },
            (payload) => {
                console.log('[Profile] Profile updated:', payload.new);
                // Update displayed data
                profileUser = payload.new;
                displayProfile();
            }
        )
        .subscribe();
    
    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
        profileChannel.unsubscribe();
    });
}

// Load organization data
async function loadOrganizationData(memberId) {
    try {
        const { data, error } = await window.covetalks.supabase
            .from('organization_members')
            .select(`
                organization:organizations(*)
            `)
            .eq('member_id', memberId)
            .single();
        
        if (error) {
            console.error('[Profile] Error loading organization:', error);
            return null;
        }
        
        return data?.organization;
    } catch (error) {
        console.error('[Profile] Error loading organization data:', error);
        return null;
    }
}

// Display profile
function displayProfile() {
    // Profile image
    if (profileUser.profile_image_url) {
        document.getElementById('profileImageContent').innerHTML = 
            `<img src="${profileUser.profile_image_url}" alt="${profileUser.name}" 
                  style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" />`;
    } else {
        const initials = profileUser.name ? 
            profileUser.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U';
        document.getElementById('profileInitials').textContent = initials;
    }
    
    // Verified badge
    if (profileUser.verified) {
        document.getElementById('verifiedBadge').classList.remove('hidden');
    }
    
    // Basic info
    document.getElementById('profileName').textContent = profileUser.name || 'Anonymous User';
    document.getElementById('profileLocation').textContent = profileUser.location || 'Location not specified';
    document.getElementById('bioContent').innerHTML = 
        profileUser.bio ? `<p>${profileUser.bio}</p>` : '<p>No bio provided yet.</p>';
    
    // Type-specific display
    if (profileUser.member_type === 'Speaker') {
        displaySpeakerProfile();
    } else if (profileUser.member_type === 'Organization') {
        displayOrganizationProfile();
    }
    
    // Contact information
    displayContactInfo();
}

// Display speaker profile
function displaySpeakerProfile() {
    // Title and meta
    document.getElementById('speakerTitle').textContent = profileUser.title || 'Professional Speaker';
    document.getElementById('profileRating').textContent = 
        profileUser.average_rating ? `${profileUser.average_rating.toFixed(1)} rating` : 'No ratings yet';
    document.getElementById('profileReviews').textContent = 
        profileUser.total_reviews ? `${profileUser.total_reviews} reviews` : 'No reviews yet';
    
    // Specialties
    const specialtiesGrid = document.getElementById('speakerSpecialties');
    if (profileUser.specialties && profileUser.specialties.length > 0) {
        specialtiesGrid.innerHTML = profileUser.specialties
            .map(specialty => `<span class="specialty-tag">${specialty}</span>`)
            .join('');
    } else {
        specialtiesGrid.innerHTML = '<p style="color: #666;">No specialties listed</p>';
    }
    
    // Experience details
    document.getElementById('yearsExperience').textContent = 
        profileUser.years_experience ? `${profileUser.years_experience} years` : 'Not specified';
    
    // Fee range
    if (profileUser.speaking_fee_range) {
        const fee = profileUser.speaking_fee_range;
        document.getElementById('feeRange').textContent = 
            `$${fee.min || 0} - $${fee.max || 0}`;
    } else {
        document.getElementById('feeRange').textContent = 'Not specified';
    }
    
    // Website
    if (profileUser.website) {
        document.getElementById('website').innerHTML = 
            `<a href="${profileUser.website}" target="_blank" style="color: var(--color-deep);">
                ${profileUser.website}
            </a>`;
    } else {
        document.getElementById('website').textContent = 'Not provided';
    }
}

// Display organization profile
function displayOrganizationProfile() {
    // Organization type
    document.getElementById('orgType').textContent = 
        organizationData?.organization_type || 'Event Organization';
    
    // Topics
    const topicsGrid = document.getElementById('orgTopics');
    const topics = organizationData?.preferred_topics || profileUser.specialties || [];
    if (topics.length > 0) {
        topicsGrid.innerHTML = topics
            .map(topic => `<span class="specialty-tag">${topic}</span>`)
            .join('');
    } else {
        topicsGrid.innerHTML = '<p style="color: #666;">No specific topics listed</p>';
    }
}

// Display contact information
function displayContactInfo() {
    if (currentUser) {
        // User is logged in, show contact info
        document.getElementById('contactEmail').textContent = profileUser.email || 'Not provided';
        document.getElementById('contactPhone').textContent = profileUser.phone || 'Not provided';
        
        if (profileUser.website) {
            document.getElementById('contactWebsite').innerHTML = 
                `<a href="${profileUser.website}" target="_blank" style="color: white;">
                    ${profileUser.website}
                </a>`;
        } else {
            document.getElementById('contactWebsite').textContent = 'Not provided';
        }
    } else {
        // User not logged in
        document.getElementById('contactEmail').innerHTML = 
            '<a href="/login.html" style="color: white;">Login to view</a>';
        document.getElementById('contactPhone').innerHTML = 
            '<a href="/login.html" style="color: white;">Login to view</a>';
        document.getElementById('contactWebsite').innerHTML = 
            '<a href="/login.html" style="color: white;">Login to view</a>';
    }
}

// Load additional data
async function loadAdditionalData() {
    if (profileUser.member_type === 'Speaker') {
        await Promise.all([
            loadReviews(),
            loadUpcomingEvents()
        ]);
    } else if (profileUser.member_type === 'Organization') {
        await loadOrganizationOpportunities();
    }
}

// Load reviews
async function loadReviews() {
    try {
        const reviews = await window.covetalks.getReviews(profileUser.id);
        
        const reviewsList = document.getElementById('reviewsList');
        if (reviews && reviews.length > 0) {
            reviewsList.innerHTML = reviews.slice(0, 5).map(review => `
                <div class="review-item">
                    <div class="review-header">
                        <div>
                            <h4>${review.organization?.name || 'Organization'}</h4>
                            <p style="color: #666; font-size: 0.9rem;">
                                ${review.event_title || 'Speaking Event'}
                            </p>
                        </div>
                        <div class="review-rating">
                            ${generateStars(review.rating)}
                        </div>
                    </div>
                    <div class="review-content">
                        ${review.review_text || 'No written review provided.'}
                    </div>
                    <div class="review-date">${formatDate(review.created_at)}</div>
                </div>
            `).join('');
        } else {
            reviewsList.innerHTML = `
                <div class="empty-state">
                    <h3>No reviews yet</h3>
                    <p>Reviews will appear here after speaking engagements</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('[Profile] Error loading reviews:', error);
    }
}

// Load upcoming events for speakers
async function loadUpcomingEvents() {
    try {
        const bookings = await window.covetalks.getUpcomingBookings(profileUser.id);
        
        const eventsContainer = document.getElementById('upcomingEvents');
        if (bookings && bookings.length > 0) {
            eventsContainer.innerHTML = bookings.slice(0, 3).map(booking => {
                const date = new Date(booking.opportunity?.event_date);
                return `
                    <div class="opportunity-item">
                        <h4>${booking.opportunity?.title || 'Event'}</h4>
                        <p>${date.toLocaleDateString('en-US', { 
                            month: 'long', 
                            day: 'numeric', 
                            year: 'numeric' 
                        })}</p>
                        <p>${booking.opportunity?.location || 'Location TBD'}</p>
                    </div>
                `;
            }).join('');
        }
    } catch (error) {
        console.error('[Profile] Error loading events:', error);
    }
}

// Load organization opportunities
async function loadOrganizationOpportunities() {
    try {
        const { data: opportunities, error } = await window.covetalks.supabase
            .from('speaking_opportunities')
            .select('*')
            .eq('posted_by', profileUser.id)
            .eq('status', 'Open')
            .order('created_at', { ascending: false })
            .limit(5);
        
        if (error) throw error;
        
        const oppContainer = document.getElementById('orgOpportunities');
        if (opportunities && opportunities.length > 0) {
            oppContainer.innerHTML = opportunities.map(opp => `
                <div class="opportunity-item">
                    <h4>${opp.title}</h4>
                    <div class="opportunity-meta">
                        <span>📅 ${opp.event_date ? 
                            new Date(opp.event_date).toLocaleDateString() : 
                            'Date TBD'}</span>
                        <span>📍 ${opp.location || 'Location TBD'}</span>
                        <span>💰 ${opp.compensation_amount ? 
                            `$${opp.compensation_amount}` : 
                            'Negotiable'}</span>
                    </div>
                    <p>${opp.description ? 
                        opp.description.substring(0, 150) + '...' : 
                        'No description'}</p>
                    ${!isOwnProfile ? 
                        `<a href="/opportunity-details.html?id=${opp.id}" 
                            class="btn btn-primary" style="margin-top: 1rem;">
                            View Details
                        </a>` :
                        `<a href="/manage-opportunity.html?id=${opp.id}" 
                            class="btn btn-primary" style="margin-top: 1rem;">
                            Manage
                        </a>`
                    }
                </div>
            `).join('');
        } else {
            oppContainer.innerHTML = '<p style="color: #666;">No active opportunities posted</p>';
        }
    } catch (error) {
        console.error('[Profile] Error loading opportunities:', error);
    }
}

// Load stats including profile views
async function loadStats() {
    try {
        if (profileUser.member_type === 'Speaker') {
            // Speaker stats
            const stats = await window.covetalks.getDashboardStatsOptimized(profileUser.id);
            
            document.getElementById('totalBookings').textContent = stats.bookings || '0';
            document.getElementById('avgRating').textContent = 
                profileUser.average_rating ? profileUser.average_rating.toFixed(1) : '0.0';
            
            // If viewing own profile, show profile views
            if (isOwnProfile && stats.profileViews !== undefined) {
                // Add profile views stat if element exists
                const viewsElement = document.getElementById('profileViews');
                if (viewsElement) {
                    viewsElement.textContent = `${stats.profileViews} profile views (30 days)`;
                }
            }
            
            const memberSince = new Date(profileUser.created_at);
            document.getElementById('memberSince').textContent = memberSince.getFullYear();
            
        } else if (profileUser.member_type === 'Organization') {
            // Organization stats
            const { count: oppCount } = await window.covetalks.supabase
                .from('speaking_opportunities')
                .select('*', { count: 'exact', head: true })
                .eq('posted_by', profileUser.id);
            
            const { count: hiredCount } = await window.covetalks.supabase
                .from('applications')
                .select(`
                    opportunity:speaking_opportunities!inner(posted_by)
                `, { count: 'exact', head: true })
                .eq('opportunity.posted_by', profileUser.id)
                .eq('status', 'Accepted');
            
            document.getElementById('totalOpportunities').textContent = oppCount || '0';
            document.getElementById('speakersHired').textContent = hiredCount || '0';
            document.getElementById('orgEvents').textContent = `${oppCount || 0} events posted`;
            
            const memberSince = new Date(profileUser.created_at);
            document.getElementById('orgMemberSince').textContent = memberSince.getFullYear();
        }
    } catch (error) {
        console.error('[Profile] Error loading stats:', error);
    }
}

// Helper functions
function generateStars(rating) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        stars += `<span class="star ${i <= rating ? '' : 'empty'}">★</span>`;
    }
    return stars;
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Share functions
function toggleShareMenu() {
    const dropdown = document.getElementById('shareDropdown');
    dropdown.classList.toggle('show');
}

function shareProfile(platform) {
    const url = window.location.href;
    const title = `Check out ${profileUser.name}'s profile on CoveTalks`;
    
    let shareUrl = '';
    switch(platform) {
        case 'linkedin':
            shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
            break;
        case 'twitter':
            shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;
            break;
        case 'facebook':
            shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
            break;
    }
    
    if (shareUrl) {
        window.open(shareUrl, '_blank', 'width=600,height=400');
        
        // Track share activity
        if (window.covetalks && currentUser) {
            window.covetalks.trackActivity('profile_shared', profileUser.id, {
                platform: platform,
                sharer_id: currentUser.id
            });
        }
    }
    
    document.getElementById('shareDropdown').classList.remove('show');
}

function copyProfileLink() {
    navigator.clipboard.writeText(window.location.href);
    alert('Profile link copied to clipboard!');
    document.getElementById('shareDropdown').classList.remove('show');
    
    // Track copy activity
    if (window.covetalks && currentUser) {
        window.covetalks.trackActivity('profile_link_copied', profileUser.id, {
            copier_id: currentUser.id
        });
    }
}

// Show error
function showError(message) {
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('profileContent').classList.add('hidden');
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('errorState').classList.remove('hidden');
}

// Event handlers
document.addEventListener('DOMContentLoaded', () => {
    // Contact button handler
    const contactBtn = document.getElementById('contactBtn');
    if (contactBtn) {
        contactBtn.addEventListener('click', () => {
            if (!currentUser) {
                alert('Please login to contact this user');
                window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.href)}`;
            } else {
                // Track contact intent
                if (window.covetalks) {
                    window.covetalks.trackActivity('contact_initiated', profileUser.id, {
                        from_profile: true
                    });
                }
                window.location.href = `/inbox.html?compose=true&to=${profileUser.id}&name=${encodeURIComponent(profileUser.name || '')}`;
            }
        });
    }

    // Save speaker button handler
    const saveBtn = document.getElementById('saveProfileBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            if (!currentUser) {
                alert('Please login to save speakers');
                window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.href)}`;
                return;
            }
            
            if (currentUser.member_type !== 'Organization') {
                alert('Only organizations can save speaker profiles');
                return;
            }
            
            try {
                saveBtn.textContent = 'Saving...';
                saveBtn.disabled = true;
                
                await window.covetalks.saveSpeaker(profileUser.id, '');
                // The saveSpeaker function already tracks this activity
                
                saveBtn.textContent = 'Speaker Saved!';
                saveBtn.classList.remove('btn-warning');
                saveBtn.classList.add('btn-success');
                
                setTimeout(() => {
                    saveBtn.textContent = 'Save Speaker';
                    saveBtn.classList.remove('btn-success');
                    saveBtn.classList.add('btn-warning');
                    saveBtn.disabled = false;
                }, 2000);
            } catch (error) {
                console.error('[Profile] Error saving speaker:', error);
                alert('Failed to save speaker. Please try again.');
                saveBtn.disabled = false;
            }
        });
    }

    // Close dropdowns when clicking outside
    document.addEventListener('click', (event) => {
        const shareDropdown = document.getElementById('shareDropdown');
        
        if (!event.target.closest('.share-menu')) {
            shareDropdown.classList.remove('show');
        }
    });
});

// Make functions globally available
window.toggleShareMenu = toggleShareMenu;
window.shareProfile = shareProfile;
window.copyProfileLink = copyProfileLink;

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePage);
} else {
    initializePage();
}