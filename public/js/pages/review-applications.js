/**
 * CoveTalks Review Applications Page
 * Manage speaker applications for organization opportunities
 */

class ApplicationReviewManager {
    constructor() {
        this.currentUser = null;
        this.allApplications = [];
        this.filteredApplications = [];
        this.myOpportunities = [];
        this.expandedApplications = new Set();
    }

    async init() {
        console.log('[Review] Initializing application review page');
        
        try {
            // Wait for Supabase
            await this.waitForSupabase();
            
            // Check authentication
            const session = await window.covetalks.checkAuth();
            if (!session) {
                window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.href);
                return;
            }

            // Get user profile
            this.currentUser = await window.covetalks.getMemberProfile(session.user.id);
            
            // Verify organization access
            if (this.currentUser.member_type !== 'Organization') {
                window.location.href = '/dashboard.html';
                return;
            }

            // Attach event listeners
            this.attachEventListeners();

            // Load data
            await this.loadApplications();
            await this.loadOpportunities();

            // Subscribe to real-time updates
            this.subscribeToUpdates();

        } catch (error) {
            console.error('[Review] Initialization error:', error);
            this.showMessage('Failed to load applications', 'error');
        }
    }

    waitForSupabase() {
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
                    throw new Error('Failed to initialize Supabase');
                }
            }
            check();
        });
    }

    attachEventListeners() {
        document.getElementById('opportunityFilter').addEventListener('change', () => this.filterApplications());
        document.getElementById('statusFilter').addEventListener('change', () => this.filterApplications());
        document.getElementById('dateFilter').addEventListener('change', () => this.filterApplications());
        document.getElementById('sortFilter').addEventListener('change', () => this.sortApplications());
        document.getElementById('clearFiltersBtn').addEventListener('click', () => this.clearFilters());
    }

    async loadApplications() {
        try {
            this.showLoading(true);

            // Get all opportunities for this organization
            this.myOpportunities = await window.covetalks.getMyOpportunities();
            
            // Get applications for each opportunity
            const applicationPromises = this.myOpportunities.map(opp => 
                window.covetalks.getOpportunityApplications(opp.id)
            );
            
            const applicationArrays = await Promise.all(applicationPromises);
            this.allApplications = applicationArrays.flat();

            // Add opportunity details to each application
            this.allApplications.forEach(app => {
                app.opportunity = this.myOpportunities.find(opp => opp.id === app.opportunity_id);
            });

            this.filteredApplications = [...this.allApplications];
            
            this.updateStats();
            this.displayApplications();
            
        } catch (error) {
            console.error('[Review] Error loading applications:', error);
            this.showMessage('Failed to load applications', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async loadOpportunities() {
        const select = document.getElementById('opportunityFilter');
        select.innerHTML = '<option value="all">All Opportunities</option>' +
            this.myOpportunities.map(opp => 
                `<option value="${opp.id}">${this.escapeHtml(opp.title)}</option>`
            ).join('');
    }

    updateStats() {
        const total = this.allApplications.length;
        const pending = this.allApplications.filter(a => a.status === 'Pending').length;
        const accepted = this.allApplications.filter(a => a.status === 'Accepted').length;
        const reviewed = this.allApplications.filter(a => a.status !== 'Pending').length;
        const responseRate = total > 0 ? Math.round((reviewed / total) * 100) : 0;

        document.getElementById('totalApplications').textContent = total;
        document.getElementById('pendingReview').textContent = pending;
        document.getElementById('acceptedCount').textContent = accepted;
        document.getElementById('responseRate').textContent = `${responseRate}%`;
    }

    displayApplications() {
        const container = document.getElementById('applicationsList');
        
        if (this.filteredApplications.length === 0) {
            document.getElementById('emptyState').classList.remove('hidden');
            container.innerHTML = '';
            return;
        }

        document.getElementById('emptyState').classList.add('hidden');
        container.innerHTML = this.filteredApplications.map(app => this.renderApplication(app)).join('');
    }

    renderApplication(app) {
        const speaker = app.speaker || {};
        const initials = speaker.name ? 
            speaker.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 
            '??';
        
        const avatarContent = speaker.profile_image_url ? 
            `<img src="${speaker.profile_image_url}" alt="${this.escapeHtml(speaker.name)}">` :
            initials;

        const isExpanded = this.expandedApplications.has(app.id);
        
        return `
            <div class="application-item ${isExpanded ? 'expanded' : ''}">
                <div class="application-header-row" onclick="reviewManager.toggleApplication('${app.id}')">
                    <div class="speaker-avatar">
                        ${avatarContent}
                    </div>
                    <div class="application-info">
                        <div class="speaker-name">${this.escapeHtml(speaker.name || 'Unknown Speaker')}</div>
                        <div class="application-meta">
                            <div class="meta-item">
                                📋 ${this.escapeHtml(app.opportunity?.title || 'Opportunity')}
                            </div>
                            <div class="meta-item">
                                📅 Applied ${this.formatDate(app.created_at)}
                            </div>
                            <div class="meta-item">
                                💰 ${app.requested_fee ? `$${app.requested_fee}` : 'As posted'}
                            </div>
                            ${speaker.average_rating ? `
                            <div class="meta-item">
                                ⭐ ${speaker.average_rating.toFixed(1)} rating
                            </div>` : ''}
                        </div>
                    </div>
                    <div class="application-status">
                        <span class="status-badge ${app.status.toLowerCase()}">${app.status}</span>
                        <button class="expand-btn ${isExpanded ? 'expanded' : ''}">
                            ${isExpanded ? 'Hide Details' : 'View Details'}
                        </button>
                    </div>
                </div>
                
                ${isExpanded ? this.renderApplicationDetails(app) : ''}
            </div>
        `;
    }

    renderApplicationDetails(app) {
        const speaker = app.speaker || {};
        
        return `
            <div class="application-details show" id="details-${app.id}">
                <div class="details-grid">
                    <div>
                        <div class="details-section">
                            <h4>Cover Letter</h4>
                            <div class="cover-letter-box">
                                ${this.escapeHtml(app.cover_letter || 'No cover letter provided')}
                            </div>
                        </div>
                        
                        <div class="details-section">
                            <h4>About the Speaker</h4>
                            <div class="speaker-bio">
                                ${this.escapeHtml(speaker.bio || 'No bio available')}
                            </div>
                            ${speaker.specialties && speaker.specialties.length > 0 ? `
                            <div class="speaker-specialties">
                                ${speaker.specialties.map(s => 
                                    `<span class="specialty-tag">${this.escapeHtml(s)}</span>`
                                ).join('')}
                            </div>` : ''}
                        </div>
                    </div>
                    
                    <div>
                        <div class="details-section">
                            <h4>Speaker Information</h4>
                            <div class="speaker-stats">
                                <div class="stat-box">
                                    <div class="stat-box-label">Location</div>
                                    <div class="stat-box-value">${this.escapeHtml(speaker.location || 'Not specified')}</div>
                                </div>
                                <div class="stat-box">
                                    <div class="stat-box-label">Experience</div>
                                    <div class="stat-box-value">${speaker.years_experience ? `${speaker.years_experience} years` : 'N/A'}</div>
                                </div>
                                <div class="stat-box">
                                    <div class="stat-box-label">Reviews</div>
                                    <div class="stat-box-value">${speaker.total_reviews || 0}</div>
                                </div>
                                <div class="stat-box">
                                    <div class="stat-box-label">Fee Range</div>
                                    <div class="stat-box-value">
                                        ${speaker.speaking_fee_range ? 
                                            `$${speaker.speaking_fee_range.min}-${speaker.speaking_fee_range.max}` : 
                                            'Negotiable'}
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="quick-actions">
                            <a href="/profile.html?id=${speaker.id}" target="_blank" class="quick-action-btn view-profile">
                                View Full Profile
                            </a>
                            <button onclick="reviewManager.contactSpeaker('${speaker.id}', '${this.escapeHtml(speaker.name)}')" 
                                    class="quick-action-btn contact">
                                Contact Speaker
                            </button>
                        </div>
                    </div>
                </div>
                
                ${this.renderReviewActions(app)}
            </div>
        `;
    }

    renderReviewActions(app) {
        if (app.status === 'Pending') {
            return `
                <div class="review-actions">
                    <h4>Review Application</h4>
                    <div class="review-message">
                        <label class="form-label">Message to Speaker (Optional)</label>
                        <textarea id="message-${app.id}" placeholder="Add a message for the speaker..."></textarea>
                    </div>
                    <div class="action-buttons">
                        <button onclick="reviewManager.rejectApplication('${app.id}')" class="btn btn-danger">
                            Reject Application
                        </button>
                        <button onclick="reviewManager.acceptApplication('${app.id}')" class="btn btn-success">
                            Accept Application
                        </button>
                    </div>
                </div>
            `;
        } else if (app.review_message) {
            return `
                <div class="review-actions">
                    <h4>Review Decision</h4>
                    <div class="message-box ${app.status === 'Accepted' ? 'success' : 'error'}">
                        <strong>${app.status === 'Accepted' ? 'Accepted' : 'Rejected'}</strong>
                        ${app.reviewed_at ? ` on ${this.formatDate(app.reviewed_at)}` : ''}
                        ${app.review_message ? `<p style="margin-top: 0.5rem;">${this.escapeHtml(app.review_message)}</p>` : ''}
                    </div>
                </div>
            `;
        }
        return '';
    }

    toggleApplication(appId) {
        if (this.expandedApplications.has(appId)) {
            this.expandedApplications.delete(appId);
        } else {
            this.expandedApplications.add(appId);
        }
        this.displayApplications();
    }

    async acceptApplication(appId) {
        if (!confirm('Accept this application? The speaker will be notified.')) return;
        
        const message = document.getElementById(`message-${appId}`)?.value || '';
        
        try {
            await window.covetalks.updateApplicationStatus(appId, 'Accepted', message);
            
            // Update local data
            const app = this.allApplications.find(a => a.id === appId);
            if (app) {
                app.status = 'Accepted';
                app.review_message = message;
                app.reviewed_at = new Date().toISOString();
            }
            
            this.showMessage('Application accepted successfully!', 'success');
            this.updateStats();
            this.displayApplications();
            
        } catch (error) {
            console.error('[Review] Error accepting application:', error);
            this.showMessage('Failed to accept application', 'error');
        }
    }

    async rejectApplication(appId) {
        if (!confirm('Reject this application? The speaker will be notified.')) return;
        
        const message = document.getElementById(`message-${appId}`)?.value || '';
        
        if (!message) {
            if (!confirm('No message provided. Are you sure you want to reject without feedback?')) return;
        }
        
        try {
            await window.covetalks.updateApplicationStatus(appId, 'Rejected', message);
            
            // Update local data
            const app = this.allApplications.find(a => a.id === appId);
            if (app) {
                app.status = 'Rejected';
                app.review_message = message;
                app.reviewed_at = new Date().toISOString();
            }
            
            this.showMessage('Application rejected', 'success');
            this.updateStats();
            this.displayApplications();
            
        } catch (error) {
            console.error('[Review] Error rejecting application:', error);
            this.showMessage('Failed to reject application', 'error');
        }
    }

    contactSpeaker(speakerId, speakerName) {
        window.location.href = `/inbox.html?compose=true&to=${speakerId}&name=${encodeURIComponent(speakerName)}`;
    }

    filterApplications() {
        const opportunityFilter = document.getElementById('opportunityFilter').value;
        const statusFilter = document.getElementById('statusFilter').value;
        const dateFilter = document.getElementById('dateFilter').value;
        
        this.filteredApplications = this.allApplications.filter(app => {
            // Opportunity filter
            if (opportunityFilter !== 'all' && app.opportunity_id !== opportunityFilter) {
                return false;
            }
            
            // Status filter
            if (statusFilter !== 'all' && app.status !== statusFilter) {
                return false;
            }
            
            // Date filter
            if (dateFilter !== 'all') {
                const appDate = new Date(app.created_at);
                const now = new Date();
                
                switch(dateFilter) {
                    case 'today':
                        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                        if (appDate < today) return false;
                        break;
                    case 'week':
                        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                        if (appDate < weekAgo) return false;
                        break;
                    case 'month':
                        const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
                        if (appDate < monthAgo) return false;
                        break;
                    case '3months':
                        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
                        if (appDate < threeMonthsAgo) return false;
                        break;
                }
            }
            
            return true;
        });
        
        this.sortApplications();
    }

    sortApplications() {
        const sortBy = document.getElementById('sortFilter').value;
        
        this.filteredApplications.sort((a, b) => {
            switch(sortBy) {
                case 'recent':
                    return new Date(b.created_at) - new Date(a.created_at);
                case 'oldest':
                    return new Date(a.created_at) - new Date(b.created_at);
                case 'rating':
                    return (b.speaker?.average_rating || 0) - (a.speaker?.average_rating || 0);
                case 'fee':
                    return (a.requested_fee || 0) - (b.requested_fee || 0);
                default:
                    return 0;
            }
        });
        
        this.displayApplications();
    }

    clearFilters() {
        document.getElementById('opportunityFilter').value = 'all';
        document.getElementById('statusFilter').value = 'all';
        document.getElementById('dateFilter').value = 'all';
        document.getElementById('sortFilter').value = 'recent';
        
        this.filteredApplications = [...this.allApplications];
        this.sortApplications();
    }

    subscribeToUpdates() {
        // Subscribe to application updates for all opportunities
        this.myOpportunities.forEach(opp => {
            const channel = window.covetalks.subscribeToApplications(opp.id, (payload) => {
                console.log('[Review] Application update received:', payload);
                this.handleApplicationUpdate(payload);
            });
        });
    }

    handleApplicationUpdate(payload) {
        if (payload.eventType === 'INSERT') {
            // New application received
            this.showMessage('New application received!', 'success');
            this.loadApplications(); // Reload to get the new application
        } else if (payload.eventType === 'UPDATE') {
            // Application status changed
            const app = this.allApplications.find(a => a.id === payload.new.id);
            if (app) {
                Object.assign(app, payload.new);
                this.updateStats();
                this.displayApplications();
            }
        }
    }

    showLoading(show) {
        document.getElementById('loadingState').classList.toggle('hidden', !show);
        document.getElementById('applicationsList').classList.toggle('hidden', show);
    }

    showMessage(message, type) {
        const banner = document.getElementById('messageBanner');
        banner.textContent = message;
        banner.className = `message-banner ${type} show`;
        
        setTimeout(() => {
            banner.classList.remove('show');
        }, 5000);
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }

    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text ? text.replace(/[&<>"']/g, m => map[m]) : '';
    }
}

// Initialize the review manager
const reviewManager = new ApplicationReviewManager();

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => reviewManager.init());
} else {
    reviewManager.init();
}