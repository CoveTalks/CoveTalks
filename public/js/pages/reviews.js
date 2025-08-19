/**
 * CoveTalks Reviews Page
 * Display and manage speaker reviews
 */

// Page state
let currentUser = null;
let allReviews = [];
let filteredReviews = [];

// Initialize page
async function initializePage() {
    try {
        // Wait for Supabase
        await waitForSupabase();
        
        // Check authentication
        const session = await window.covetalks.checkAuth();
        if (!session) {
            window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.href);
            return;
        }

        // Get current user
        currentUser = await window.covetalks.getMemberProfile(session.user.id);
        
        // Check if user is a speaker
        if (currentUser.member_type !== 'Speaker') {
            showError('This page is only available for speakers');
            return;
        }

        // Load reviews
        await loadReviews();

    } catch (error) {
        console.error('Error initializing:', error);
        showError('Failed to load reviews');
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
                setTimeout(check, 250);
            } else {
                console.error('Failed to initialize');
                resolve();
            }
        }
        check();
    });
}

// Load reviews
async function loadReviews() {
    try {
        const reviews = await window.covetalks.getReviews(currentUser.id);
        allReviews = reviews;
        filteredReviews = reviews;

        // Hide loading, show content
        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('reviewsContent').classList.remove('hidden');

        if (reviews.length === 0) {
            document.getElementById('emptyState').classList.remove('hidden');
            document.querySelector('.stats-overview').classList.add('hidden');
            document.querySelector('.filters-section').classList.add('hidden');
        } else {
            displayStats(reviews);
            displayReviews(reviews);
        }

    } catch (error) {
        console.error('Error loading reviews:', error);
        showError('Failed to load reviews');
    }
}

// Display statistics
function displayStats(reviews) {
    const totalReviews = reviews.length;
    let totalRating = 0;
    let totalContent = 0;
    let totalDelivery = 0;
    let totalProfessionalism = 0;
    let recommendCount = 0;

    reviews.forEach(review => {
        totalRating += review.rating || 0;
        totalContent += review.content_rating || 0;
        totalDelivery += review.delivery_rating || 0;
        totalProfessionalism += review.professionalism_rating || 0;
        if (review.would_recommend) recommendCount++;
    });

    const avgRating = totalReviews > 0 ? (totalRating / totalReviews).toFixed(1) : '0.0';
    const avgContent = totalReviews > 0 ? (totalContent / totalReviews).toFixed(1) : '0.0';
    const avgDelivery = totalReviews > 0 ? (totalDelivery / totalReviews).toFixed(1) : '0.0';
    const avgProfessionalism = totalReviews > 0 ? (totalProfessionalism / totalReviews).toFixed(1) : '0.0';
    const recommendPercent = totalReviews > 0 ? Math.round((recommendCount / totalReviews) * 100) : 0;

    // Update overall rating
    document.getElementById('overallRating').textContent = avgRating;
    document.getElementById('totalReviews').textContent = totalReviews;
    updateStars('overallStars', parseFloat(avgRating));

    // Update breakdown
    document.getElementById('contentRating').textContent = avgContent;
    document.getElementById('contentBar').style.width = `${(avgContent / 5) * 100}%`;
    
    document.getElementById('deliveryRating').textContent = avgDelivery;
    document.getElementById('deliveryBar').style.width = `${(avgDelivery / 5) * 100}%`;
    
    document.getElementById('professionalismRating').textContent = avgProfessionalism;
    document.getElementById('professionalismBar').style.width = `${(avgProfessionalism / 5) * 100}%`;
    
    document.getElementById('recommendPercent').textContent = recommendPercent;
    document.getElementById('recommendBar').style.width = `${recommendPercent}%`;
}

// Update star display
function updateStars(elementId, rating) {
    const starsContainer = document.getElementById(elementId);
    const stars = starsContainer.querySelectorAll('.star');
    
    stars.forEach((star, index) => {
        if (index < Math.floor(rating)) {
            star.classList.remove('empty');
        } else {
            star.classList.add('empty');
        }
    });
}

// Display reviews
function displayReviews(reviews) {
    const reviewsList = document.getElementById('reviewsList');
    
    if (reviews.length === 0) {
        reviewsList.innerHTML = '<p style="text-align: center; color: var(--color-gray);">No reviews match your filters</p>';
        return;
    }

    reviewsList.innerHTML = reviews.map(review => {
        const org = review.organization || {};
        const date = formatDate(review.created_at);

        return `
            <div class="review-card">
                <div class="review-header">
                    <div class="reviewer-info">
                        <div class="reviewer-avatar">
                            ${org.name ? org.name.substring(0, 2).toUpperCase() : 'OR'}
                        </div>
                        <div class="reviewer-details">
                            <h4>${org.name || 'Organization'}</h4>
                            <p>${org.organization_type || 'Organization'} • ${org.location || 'Location not specified'}</p>
                        </div>
                    </div>
                    <div class="review-date">${date}</div>
                </div>

                <div class="review-ratings">
                    <div class="rating-item">
                        <span class="rating-item-label">Overall Rating</span>
                        <span class="rating-item-stars">${generateStars(review.rating)}</span>
                    </div>
                    <div class="rating-item">
                        <span class="rating-item-label">Content Quality</span>
                        <span class="rating-item-stars">${generateStars(review.content_rating)}</span>
                    </div>
                    <div class="rating-item">
                        <span class="rating-item-label">Delivery</span>
                        <span class="rating-item-stars">${generateStars(review.delivery_rating)}</span>
                    </div>
                    <div class="rating-item">
                        <span class="rating-item-label">Professionalism</span>
                        <span class="rating-item-stars">${generateStars(review.professionalism_rating)}</span>
                    </div>
                </div>

                ${review.review_text ? `
                <div class="review-content">
                    <h5>Review</h5>
                    <p>${review.review_text}</p>
                </div>
                ` : ''}

                <div class="review-footer">
                    <div class="event-info">
                        ${review.would_recommend ? 
                            '✅ Would recommend to others' : 
                            '⚠️ Might not recommend'}
                    </div>
                    ${review.verified ? '<span class="verified-badge">✓ Verified Event</span>' : ''}
                </div>
            </div>
        `;
    }).join('');
}

// Generate star display
function generateStars(rating) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= rating) {
            stars += '★';
        } else {
            stars += '☆';
        }
    }
    return stars;
}

// Sort reviews
window.sortReviews = function() {
    const sortBy = document.getElementById('sortBy').value;
    let sorted = [...filteredReviews];

    switch (sortBy) {
        case 'recent':
            sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            break;
        case 'highest':
            sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
            break;
        case 'lowest':
            sorted.sort((a, b) => (a.rating || 0) - (b.rating || 0));
            break;
    }

    displayReviews(sorted);
}

// Filter reviews
window.filterReviews = function() {
    const filterRating = document.getElementById('filterRating').value;
    
    if (filterRating === 'all') {
        filteredReviews = allReviews;
    } else {
        const minRating = parseInt(filterRating);
        filteredReviews = allReviews.filter(review => 
            (review.rating || 0) >= minRating
        );
    }

    sortReviews();
}

// Format date
function formatDate(dateString) {
    if (!dateString) return 'Date not available';
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Show error
function showError(message) {
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('reviewsContent').innerHTML = `
        <div class="card">
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <h3>Error</h3>
                <p>${message}</p>
                <a href="/dashboard.html" class="btn btn-primary">Go to Dashboard</a>
            </div>
        </div>
    `;
    document.getElementById('reviewsContent').classList.remove('hidden');
}

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePage);
} else {
    initializePage();
}