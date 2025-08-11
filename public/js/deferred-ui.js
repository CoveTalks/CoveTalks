// ============================================
// DEFERRED DATA UI HANDLER
// Manages progressive loading states in the UI
// ============================================

class DeferredUI {
    constructor() {
        this.loadingStates = new Map();
        this.debug = window.location.hostname === 'localhost';
        
        // Listen for deferred data events
        if (window.api) {
            window.api.onData(this.handleDataEvent.bind(this));
        }
        
        // Add CSS for loading animations
        this.injectStyles();
    }
    
    // Handle data loading events
    handleDataEvent(event) {
        if (event.detail.type === 'deferred-loaded') {
            this.updateWithData(event.detail.data);
        }
    }
    
    // Show skeleton loader for an element
    showSkeleton(elementId, height = '20px') {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        // Save original content
        this.loadingStates.set(elementId, {
            originalContent: element.innerHTML,
            originalClass: element.className
        });
        
        // Add skeleton
        element.className = 'skeleton-loader';
        element.style.height = height;
        element.innerHTML = '';
    }
    
    // Show spinner loader
    showSpinner(elementId, message = 'Loading...') {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        // Save original content
        this.loadingStates.set(elementId, {
            originalContent: element.innerHTML,
            originalClass: element.className
        });
        
        // Add spinner
        element.innerHTML = `
            <div class="deferred-spinner">
                <div class="spinner"></div>
                <span>${message}</span>
            </div>
        `;
    }
    
    // Show placeholder content
    showPlaceholder(elementId, placeholderText) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        // Save original content
        this.loadingStates.set(elementId, {
            originalContent: element.innerHTML,
            originalClass: element.className
        });
        
        // Add placeholder
        element.innerHTML = `<span class="text-muted">${placeholderText}</span>`;
    }
    
    // Update element with loaded data
    updateElement(elementId, content) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        // Clear loading state
        const savedState = this.loadingStates.get(elementId);
        if (savedState) {
            element.className = savedState.originalClass;
        }
        
        // Update content with fade-in effect
        element.style.opacity = '0';
        element.innerHTML = content;
        
        // Fade in
        setTimeout(() => {
            element.style.transition = 'opacity 0.3s ease';
            element.style.opacity = '1';
        }, 10);
        
        // Clean up
        this.loadingStates.delete(elementId);
    }
    
    // Update multiple elements with deferred data
    updateWithData(data) {
        if (this.debug) {
            console.log('[DeferredUI] Updating UI with deferred data:', Object.keys(data));
        }
        
        // Update subscription elements
        if (data.subscription !== undefined) {
            this.updateSubscriptionUI(data.subscription);
        }
        
        // Update specialty elements
        if (data.specialty !== undefined) {
            this.updateSpecialtyUI(data.specialty);
        }
        
        // Update reviews elements
        if (data.reviews !== undefined) {
            this.updateReviewsUI(data.reviews, data.averageRating, data.totalReviews);
        }
        
        // Update organization elements
        if (data.organization !== undefined) {
            this.updateOrganizationUI(data.organization);
        }
        
        // Update opportunities
        if (data.opportunities !== undefined) {
            this.updateOpportunitiesUI(data.opportunities);
        }
        
        // Update applications
        if (data.applications !== undefined) {
            this.updateApplicationsUI(data.applications);
        }
        
        // Call custom update function if defined
        if (typeof window.updateUIWithDeferredData === 'function') {
            window.updateUIWithDeferredData(data);
        }
    }
    
    // Update subscription UI elements
    updateSubscriptionUI(subscription) {
        // Update plan badge
        if (document.getElementById('planBadge')) {
            const planClass = subscription ? `badge-${subscription.plan.toLowerCase()}` : 'badge-free';
            const planText = subscription ? subscription.plan : 'Free';
            this.updateElement('planBadge', 
                `<span class="badge ${planClass}">${planText}</span>`
            );
        }
        
        // Update billing info
        if (document.getElementById('billingInfo')) {
            if (subscription) {
                const billingText = `$${subscription.amount}/${subscription.billingPeriod === 'Yearly' ? 'year' : 'month'}`;
                this.updateElement('billingInfo', billingText);
            } else {
                this.updateElement('billingInfo', 'Free Plan');
            }
        }
        
        // Update next billing date
        if (document.getElementById('nextBilling') && subscription?.nextBilling) {
            const date = new Date(subscription.nextBilling).toLocaleDateString();
            this.updateElement('nextBilling', `Next billing: ${date}`);
        }
    }
    
    // Update specialty UI elements
    updateSpecialtyUI(specialties) {
        // Update specialty badges
        if (document.getElementById('specialtyBadges')) {
            if (specialties && specialties.length > 0) {
                const badges = specialties.map(s => 
                    `<span class="specialty-badge">${s}</span>`
                ).join(' ');
                this.updateElement('specialtyBadges', badges);
            } else {
                this.updateElement('specialtyBadges', 
                    '<span class="text-muted">No specialties added</span>'
                );
            }
        }
        
        // Update specialty count
        if (document.getElementById('specialtyCount')) {
            this.updateElement('specialtyCount', specialties ? specialties.length.toString() : '0');
        }
    }
    
    // Update reviews UI elements
    updateReviewsUI(reviews, averageRating, totalReviews) {
        // Update rating display
        if (document.getElementById('averageRating')) {
            const rating = averageRating || '0.0';
            const stars = this.generateStars(parseFloat(rating));
            this.updateElement('averageRating', 
                `${stars} <span class="rating-number">${rating}</span>`
            );
        }
        
        // Update review count
        if (document.getElementById('reviewCount')) {
            const count = totalReviews || 0;
            this.updateElement('reviewCount', 
                `${count} ${count === 1 ? 'review' : 'reviews'}`
            );
        }
        
        // Update recent reviews list
        if (document.getElementById('recentReviews') && reviews) {
            if (reviews.length > 0) {
                const reviewsHTML = reviews.slice(0, 3).map(r => `
                    <div class="review-item">
                        <div class="review-rating">${this.generateStars(r.rating)}</div>
                        <div class="review-text">${r.reviewText || 'No comment'}</div>
                        <div class="review-date">${new Date(r.reviewDate).toLocaleDateString()}</div>
                    </div>
                `).join('');
                this.updateElement('recentReviews', reviewsHTML);
            } else {
                this.updateElement('recentReviews', 
                    '<p class="text-muted">No reviews yet</p>'
                );
            }
        }
    }
    
    // Update organization UI elements
    updateOrganizationUI(organization) {
        if (!organization) return;
        
        // Update org name
        if (document.getElementById('orgName')) {
            this.updateElement('orgName', organization.organizationName || 'Organization');
        }
        
        // Update org type
        if (document.getElementById('orgType')) {
            this.updateElement('orgType', organization.organizationType || '');
        }
    }
    
    // Update opportunities UI
    updateOpportunitiesUI(opportunities) {
        if (document.getElementById('opportunityCount')) {
            this.updateElement('opportunityCount', 
                opportunities ? opportunities.length.toString() : '0'
            );
        }
        
        if (document.getElementById('activeOpportunities')) {
            const active = opportunities ? 
                opportunities.filter(o => o.status === 'Open').length : 0;
            this.updateElement('activeOpportunities', active.toString());
        }
    }
    
    // Update applications UI
    updateApplicationsUI(applications) {
        if (document.getElementById('applicationCount')) {
            this.updateElement('applicationCount', 
                applications ? applications.length.toString() : '0'
            );
        }
        
        if (document.getElementById('pendingApplications')) {
            const pending = applications ? 
                applications.filter(a => a.status === 'Pending').length : 0;
            this.updateElement('pendingApplications', pending.toString());
        }
    }
    
    // Generate star rating HTML
    generateStars(rating) {
        const fullStars = Math.floor(rating);
        const halfStar = rating % 1 >= 0.5 ? 1 : 0;
        const emptyStars = 5 - fullStars - halfStar;
        
        let stars = '';
        for (let i = 0; i < fullStars; i++) {
            stars += '★';
        }
        if (halfStar) {
            stars += '☆';
        }
        for (let i = 0; i < emptyStars; i++) {
            stars += '☆';
        }
        
        return `<span class="stars">${stars}</span>`;
    }
    
    // Inject CSS styles for loading states
    injectStyles() {
        if (document.getElementById('deferred-ui-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'deferred-ui-styles';
        style.textContent = `
            .skeleton-loader {
                background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                background-size: 200% 100%;
                animation: loading 1.5s infinite;
                border-radius: 4px;
                display: block;
            }
            
            @keyframes loading {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
            }
            
            .deferred-spinner {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px;
            }
            
            .spinner {
                width: 20px;
                height: 20px;
                border: 3px solid #f3f3f3;
                border-top: 3px solid #155588;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .text-muted {
                color: #6c757d;
                font-style: italic;
            }
            
            .specialty-badge {
                display: inline-block;
                padding: 4px 12px;
                margin: 2px;
                background: #e8f4fd;
                color: #155588;
                border-radius: 15px;
                font-size: 0.85em;
            }
            
            .badge {
                display: inline-block;
                padding: 4px 12px;
                border-radius: 12px;
                font-size: 0.85em;
                font-weight: 500;
            }
            
            .badge-free { background: #e9ecef; color: #495057; }
            .badge-standard { background: #28a745; color: white; }
            .badge-plus { background: #007bff; color: white; }
            .badge-premium { background: #ffc107; color: #212529; }
            
            .stars { color: #ffa500; }
            
            .review-item {
                padding: 12px;
                border-bottom: 1px solid #e9ecef;
            }
            
            .review-item:last-child {
                border-bottom: none;
            }
            
            .review-rating {
                margin-bottom: 4px;
            }
            
            .review-text {
                color: #495057;
                margin-bottom: 4px;
            }
            
            .review-date {
                color: #6c757d;
                font-size: 0.85em;
            }
        `;
        
        document.head.appendChild(style);
    }
}

// Initialize deferred UI handler
const deferredUI = new DeferredUI();

// Make globally available
window.deferredUI = deferredUI;

// Helper function for pages to set up loading states
window.setupDeferredLoading = function(config) {
    // Example config:
    // {
    //   subscription: { elementId: 'planBadge', type: 'skeleton' },
    //   specialties: { elementId: 'specialtyBadges', type: 'placeholder', text: 'Loading specialties...' }
    // }
    
    const user = api.getCurrentUser();
    if (!user) return;
    
    // Check what data is missing and show appropriate loaders
    if (!user.subscription && config.subscription) {
        if (config.subscription.type === 'skeleton') {
            deferredUI.showSkeleton(config.subscription.elementId, config.subscription.height);
        } else if (config.subscription.type === 'spinner') {
            deferredUI.showSpinner(config.subscription.elementId, config.subscription.message);
        } else {
            deferredUI.showPlaceholder(config.subscription.elementId, config.subscription.text);
        }
    }
    
    if (!user.specialty && config.specialties) {
        if (config.specialties.type === 'skeleton') {
            deferredUI.showSkeleton(config.specialties.elementId, config.specialties.height);
        } else if (config.specialties.type === 'spinner') {
            deferredUI.showSpinner(config.specialties.elementId, config.specialties.message);
        } else {
            deferredUI.showPlaceholder(config.specialties.elementId, config.specialties.text);
        }
    }
    
    // Add more data types as needed...
};