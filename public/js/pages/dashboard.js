// /js/pages/dashboard.js
/**
 * CoveTalks Unified Dashboard
 * Handles both Speaker and Organization dashboards with consistent design
 * FIXED VERSION - Resources display correctly
 */

class UnifiedDashboard {
    constructor() {
        this.currentUser = null;
        this.userType = null;
        this.isAuthenticated = false;
        this.data = {};
    }

    async init() {
        console.log('[Dashboard] Initializing unified dashboard');
        
        try {
            // Wait for Supabase
            await this.waitForSupabase();
            
            // Check authentication
            const session = await window.covetalks.checkAuth();
            
            if (!session) {
                console.log('[Dashboard] Not authenticated, redirecting to login');
                sessionStorage.setItem('redirectUrl', window.location.href);
                window.location.href = '/login.html';
                return;
            }
            
            this.isAuthenticated = true;
            
            // Get current user profile
            this.currentUser = await window.covetalks.getMemberProfile(session.user.id);
            
            if (!this.currentUser) {
                console.error('[Dashboard] Failed to load user profile');
                this.showError('Failed to load user profile. Please try again.');
                return;
            }
            
            // Set user type
            this.userType = this.currentUser.member_type;
            console.log('[Dashboard] User type:', this.userType);
            
            // Apply user type styling
            this.applyUserTypeStyling();
            
            // Update welcome message
            this.updateWelcomeSection();
            
            // Check for special URL parameters (welcome, subscription success, etc.)
            this.handleUrlParameters();
            
            // Load dashboard content based on user type
            if (this.userType === 'Organization') {
                await this.loadOrganizationDashboard();
            } else {
                await this.loadSpeakerDashboard();
            }
            
        } catch (error) {
            console.error('[Dashboard] Initialization error:', error);
            this.showError('Failed to load dashboard. Please refresh the page.');
        }
    }

    waitForSupabase() {
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 20;
            
            const check = () => {
                attempts++;
                if (window.covetalks && window.covetalks.supabase) {
                    resolve();
                } else if (attempts < maxAttempts) {
                    setTimeout(check, 250);
                } else {
                    this.showError('Failed to initialize. Please refresh the page.');
                }
            };
            check();
        });
    }

    handleUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        
        // Check for welcome parameter (new user)
        if (urlParams.get('welcome') === 'true') {
            this.showWelcomeMessage();
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
        
        // Check for subscription success
        if (urlParams.get('subscription') === 'success') {
            this.showSubscriptionSuccessMessage();
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
        
        // Check for specific session ID (from Stripe)
        const sessionId = urlParams.get('session_id');
        if (sessionId) {
            console.log('[Dashboard] Stripe session ID:', sessionId);
            // You could fetch session details here if needed
        }
    }

    showWelcomeMessage() {
        const banner = document.createElement('div');
        banner.className = 'welcome-banner';
        banner.style.cssText = `
            background: linear-gradient(135deg, var(--color-deep), var(--color-calm));
            color: white;
            padding: 2rem;
            border-radius: 15px;
            margin-bottom: 2rem;
            text-align: center;
            animation: slideDown 0.5s ease;
        `;
        banner.innerHTML = `
            <h2>Welcome to CoveTalks! 🎉</h2>
            <p style="font-size: 1.1rem; margin: 1rem 0;">
                Your account is all set up. Start exploring speaking opportunities or complete your profile for better visibility.
            </p>
            <div style="margin-top: 1.5rem;">
                <a href="/opportunities.html" class="btn btn-white" style="margin-right: 1rem; background: white; color: var(--color-deep);">
                    Browse Opportunities
                </a>
                <a href="/settings.html" class="btn btn-white" style="background: white; color: var(--color-deep);">
                    Complete Profile
                </a>
            </div>
            <button onclick="this.parentElement.style.display='none'" 
                    style="position: absolute; top: 1rem; right: 1rem; background: none; border: none; color: white; font-size: 1.5rem; cursor: pointer;">
                ×
            </button>
        `;
        
        const mainContent = document.getElementById('mainContent');
        if (mainContent) {
            mainContent.insertBefore(banner, mainContent.firstChild);
            
            // Auto-hide after 30 seconds
            setTimeout(() => {
                if (banner.parentElement) {
                    banner.style.transition = 'opacity 0.5s';
                    banner.style.opacity = '0';
                    setTimeout(() => {
                        if (banner.parentElement) {
                            banner.remove();
                        }
                    }, 500);
                }
            }, 30000);
        }
    }

    showSubscriptionSuccessMessage() {
        const banner = document.createElement('div');
        banner.className = 'success-banner';
        banner.style.cssText = `
            background: #d4edda;
            color: #155724;
            padding: 1.5rem;
            border-radius: 15px;
            margin-bottom: 1.5rem;
            border: 1px solid #c3e6cb;
            display: flex;
            align-items: center;
            justify-content: space-between;
            animation: slideDown 0.5s ease;
        `;
        banner.innerHTML = `
            <div>
                <h3 style="margin: 0 0 0.5rem 0;">✅ Subscription Activated!</h3>
                <p style="margin: 0;">
                    Your subscription is now active. You have full access to all CoveTalks features.
                    <a href="/billing.html" style="color: #155724; text-decoration: underline; margin-left: 1rem;">
                        View billing details
                    </a>
                </p>
            </div>
            <button onclick="this.parentElement.style.display='none'" 
                    style="background: none; border: none; color: #155724; font-size: 1.5rem; cursor: pointer; padding: 0 1rem;">
                ×
            </button>
        `;
        
        const mainContent = document.getElementById('mainContent');
        if (mainContent) {
            mainContent.insertBefore(banner, mainContent.firstChild);
            
            // Auto-hide after 10 seconds
            setTimeout(() => {
                if (banner.parentElement) {
                    banner.style.transition = 'opacity 0.5s';
                    banner.style.opacity = '0';
                    setTimeout(() => {
                        if (banner.parentElement) {
                            banner.remove();
                        }
                    }, 500);
                }
            }, 10000);
        }
    }

    applyUserTypeStyling() {
        const body = document.body;
        const header = document.getElementById('dashboardHeader');
        
        if (this.userType === 'Organization') {
            body.classList.add('org-view');
            if (header) {
                header.classList.add('org-gradient');
            }
        } else {
            // Keep default speaker styling
            body.classList.remove('org-view');
            if (header) {
                header.classList.remove('org-gradient');
            }
        }
    }

    updateWelcomeSection() {
        const userName = document.getElementById('userName');
        const welcomeMessage = document.getElementById('welcomeMessage');
        const headerActions = document.getElementById('headerActions');
        
        if (userName) {
            userName.textContent = this.currentUser.name?.split(' ')[0] || this.userType;
        }
        
        if (this.userType === 'Organization') {
            if (welcomeMessage) {
                welcomeMessage.textContent = 'Manage your speaking opportunities and connect with speakers';
            }
            if (headerActions) {
                headerActions.innerHTML = `
                    <a href="/post-opportunity.html" class="btn" style="background-color: var(--color-foam);">📢 Post Opportunity</a>
                    <a href="/members.html" class="btn" style="background-color: var(--color-foam);">🔍 Find Speakers</a>
                    <a href="/my-opportunities.html" class="btn" style="background-color: var(--color-foam);">📋 My Opportunities</a>
                `;
            }
        } else {
            if (welcomeMessage) {
                welcomeMessage.textContent = "Here's what's happening with your speaker profile today";
            }
            if (headerActions) {
                headerActions.innerHTML = `
                    <a href="/settings.html" class="btn">✏️ Edit Profile</a>
                    <a href="/opportunities.html" class="btn">🔍 Browse Opportunities</a>
                `;
            }
        }
    }

    // ============================================
    // SPEAKER DASHBOARD
    // ============================================
    
    async loadSpeakerDashboard() {
        console.log('[Dashboard] Loading speaker dashboard');
        
        // Load all data in parallel
        const [stats, activity, applications, opportunities, subscription] = await Promise.all([
            window.covetalks.getDashboardStatsOptimized(this.currentUser.id),
            window.covetalks.getRecentActivity(this.currentUser.id, 5),
            window.covetalks.getApplications(this.currentUser.id),
            window.covetalks.getRecentOpportunities(3),
            window.covetalks.getSubscriptionStatus(this.currentUser.id)
        ]);
        
        this.data = { stats, activity, applications, opportunities, subscription };
        
        // Render speaker components
        this.renderSpeakerStats();
        this.renderSpeakerMainContent();
        this.renderSpeakerSidebar();
    }

    renderSpeakerStats() {
        const statsGrid = document.getElementById('statsGrid');
        if (!statsGrid) return;
        
        statsGrid.innerHTML = `
            <div class="stat-card">
                <div class="stat-icon">👁️</div>
                <div class="stat-value">${this.data.stats.profileViews || 0}</div>
                <div class="stat-label">Profile Views This Month</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">📅</div>
                <div class="stat-value">${this.data.stats.bookings || 0}</div>
                <div class="stat-label">Confirmed Bookings</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">🎯</div>
                <div class="stat-value">${this.data.stats.applications || 0}</div>
                <div class="stat-label">Active Applications</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">⭐</div>
                <div class="stat-value">${this.currentUser.average_rating?.toFixed(1) || '0.0'}</div>
                <div class="stat-label">Average Rating</div>
            </div>
        `;
    }

    renderSpeakerMainContent() {
        const mainContent = document.getElementById('mainContent');
        if (!mainContent) return;
        
        // Recent Activity
        const activityHTML = this.data.activity.length > 0 ? 
            this.data.activity.map(activity => this.renderActivityItem(activity)).join('') :
            '<p style="padding: var(--spacing-md); color: var(--color-gray); text-align: center;">No recent activity</p>';
        
        // Upcoming Bookings
        const upcomingBookings = this.data.applications.filter(app => 
            app.status === 'Accepted' && 
            app.opportunity?.event_date && 
            new Date(app.opportunity.event_date) > new Date()
        );
        
        const bookingsHTML = upcomingBookings.length > 0 ?
            upcomingBookings.slice(0, 3).map(booking => this.renderBookingItem(booking)).join('') :
            '<p style="padding: var(--spacing-md); color: var(--color-gray); text-align: center;">No upcoming bookings</p>';
        
        // Recent Opportunities
        const opportunitiesHTML = this.data.opportunities.length > 0 ?
            this.data.opportunities.map(opp => this.renderOpportunityItem(opp)).join('') :
            '<p style="padding: var(--spacing-md); color: var(--color-gray); text-align: center;">No new opportunities</p>';
        
        mainContent.innerHTML = `
            <!-- Recent Activity -->
            <div class="dashboard-card">
                <div class="card-header">
                    <h2>Recent Activity</h2>
                    <a href="/activity.html">View All →</a>
                </div>
                <div class="activity-list">
                    ${activityHTML}
                </div>
            </div>

            <!-- Upcoming Bookings -->
            <div class="dashboard-card">
                <div class="card-header">
                    <h2>Upcoming Bookings</h2>
                    <a href="/bookings.html">Manage All →</a>
                </div>
                <div class="activity-list">
                    ${bookingsHTML}
                </div>
            </div>

            <!-- Recent Opportunities -->
            <div class="dashboard-card">
                <div class="card-header">
                    <h2>New Speaking Opportunities</h2>
                    <a href="/opportunities.html">Browse All →</a>
                </div>
                <div class="activity-list">
                    ${opportunitiesHTML}
                </div>
            </div>
        `;
    }

    renderSpeakerSidebar() {
        const sidebar = document.getElementById('sidebarContent');
        if (!sidebar) return;
        
        // Profile completion
        const completion = this.calculateProfileCompletion();
        
        // Subscription info
        const subscription = this.data.subscription;
        const planType = subscription?.plan_type || 'Free';
        const amount = subscription?.amount || 0;
        
        sidebar.innerHTML = `
            <!-- Profile Completion -->
            <div class="dashboard-card">
                <h3 style="color: var(--color-deep); margin-bottom: var(--spacing-md); font-weight: 900; font-family: 'Brandon Text', var(--font-primary);">Profile Completion</h3>
                <div class="profile-completion">
                    <div class="completion-header">
                        <span>Profile Strength</span>
                        <span>${completion.percentage}%</span>
                    </div>
                    <div class="completion-bar">
                        <div class="completion-progress" style="width: ${completion.percentage}%"></div>
                    </div>
                    ${completion.tips}
                </div>
            </div>

            <!-- Subscription Status -->
            <div class="subscription-card">
                <h3>Your Subscription</h3>
                <div style="font-size: 1.5rem; font-weight: bold; margin-bottom: var(--spacing-sm);">
                    ${planType} Plan
                </div>
                <div style="opacity: 0.9; margin-bottom: var(--spacing-md);">
                    ${amount > 0 ? `$${amount}/month` : 'No active subscription'}
                </div>
                <a href="/billing.html" class="btn">Manage Billing</a>
            </div>

            <!-- Quick Actions -->
            <div class="dashboard-card">
                <h3 style="color: var(--color-deep); margin-bottom: var(--spacing-md); font-weight: 900; font-family: 'Brandon Text', var(--font-primary);">Quick Actions</h3>
                <div class="quick-actions">
                    <a href="/settings.html" class="action-btn">
                        <i>✏️</i>
                        <span>Edit Profile</span>
                    </a>
                    <a href="/reviews.html" class="action-btn">
                        <i>⭐</i>
                        <span>Reviews</span>
                    </a>
                </div>
            </div>

            <!-- Resources -->
            <div class="dashboard-card">
                <h3 style="color: var(--color-deep); margin-bottom: var(--spacing-md); font-weight: 900; font-family: 'Brandon Text', var(--font-primary);">Resources</h3>
                <div class="resources-list">
                    <a href="/speaking-tips.html">📚 Speaking Tips & Best Practices</a>
                    <a href="/templates.html">📝 Proposal Templates</a>
                    <a href="/help.html">❓ Help Center</a>
                </div>
            </div>
        `;
    }

    // ============================================
    // ORGANIZATION DASHBOARD
    // ============================================
    
    async loadOrganizationDashboard() {
        console.log('[Dashboard] Loading organization dashboard');
        
        // Load organization-specific data
        const [opportunities, savedSpeakers, applications] = await Promise.all([
            window.covetalks.getMyOpportunities(),
            window.covetalks.getSavedSpeakers(),
            this.loadOrganizationApplications()
        ]);
        
        this.data = { opportunities, savedSpeakers, applications };
        
        // Render organization components
        this.renderOrganizationStats();
        this.renderOrganizationMainContent();
        this.renderOrganizationSidebar();
    }

    async loadOrganizationApplications() {
        const opportunities = await window.covetalks.getMyOpportunities();
        let allApplications = [];
        
        // Get applications for each opportunity (limit to recent 5 opportunities)
        for (const opp of opportunities.slice(0, 5)) {
            const applications = await window.covetalks.getOpportunityApplications(opp.id);
            allApplications = allApplications.concat(
                applications.map(app => ({ ...app, opportunity: opp }))
            );
        }
        
        // Sort by created_at
        allApplications.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        return allApplications;
    }

    renderOrganizationStats() {
        const activeOps = this.data.opportunities.filter(o => o.status === 'Open').length;
        const pendingApps = this.data.applications.filter(a => a.status === 'Pending').length;
        
        const statsGrid = document.getElementById('statsGrid');
        if (!statsGrid) return;
        
        statsGrid.innerHTML = `
            <div class="stat-card org-stat">
                <div class="stat-icon">📢</div>
                <div class="stat-value">${activeOps}</div>
                <div class="stat-label">Active Opportunities</div>
            </div>
            <div class="stat-card org-stat">
                <div class="stat-icon">📝</div>
                <div class="stat-value">${this.data.applications.length}</div>
                <div class="stat-label">Total Applications</div>
            </div>
            <div class="stat-card org-stat">
                <div class="stat-icon">⏳</div>
                <div class="stat-value">${pendingApps}</div>
                <div class="stat-label">Pending Reviews</div>
            </div>
            <div class="stat-card org-stat">
                <div class="stat-icon">⭐</div>
                <div class="stat-value">${this.data.savedSpeakers.length}</div>
                <div class="stat-label">Saved Speakers</div>
            </div>
        `;
    }

    renderOrganizationMainContent() {
        const mainContent = document.getElementById('mainContent');
        if (!mainContent) return;
        
        // Recent Applications Table
        const applicationsHTML = this.renderApplicationsTable();
        
        // Active Opportunities
        const activeOps = this.data.opportunities.filter(o => o.status === 'Open').slice(0, 5);
        const opportunitiesHTML = activeOps.length > 0 ?
            activeOps.map(opp => this.renderOrganizationOpportunity(opp)).join('') :
            `<div class="empty-state">
                <div class="empty-state-icon">📢</div>
                <p>No active opportunities</p>
                <a href="/post-opportunity.html" class="btn btn-primary mt-3">Post Your First Opportunity</a>
            </div>`;
        
        mainContent.innerHTML = `
            <!-- Recent Applications -->
            <div class="dashboard-card">
                <div class="card-header">
                    <h2>Recent Applications</h2>
                    <a href="/my-opportunities.html">View All →</a>
                </div>
                ${applicationsHTML}
            </div>

            <!-- Active Opportunities -->
            <div class="dashboard-card">
                <div class="card-header">
                    <h2>Your Active Opportunities</h2>
                    <a href="/post-opportunity.html">Post New →</a>
                </div>
                <div>
                    ${opportunitiesHTML}
                </div>
            </div>
        `;
    }

    renderOrganizationSidebar() {
        const sidebar = document.getElementById('sidebarContent');
        if (!sidebar) return;
        
        // Monthly stats
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthlyApps = this.data.applications.filter(a => 
            new Date(a.created_at) >= monthStart
        );
        
        sidebar.innerHTML = `
            <!-- Quick Actions -->
            <div class="dashboard-card">
                <h3 style="color: var(--color-sand); margin-bottom: var(--spacing-md); font-weight: 900; font-family: 'Brandon Text', var(--font-primary);">Quick Actions</h3>
                <div class="quick-actions">
                    <a href="/post-opportunity.html" class="action-btn">
                        <i>➕</i>
                        <span>Post Opportunity</span>
                    </a>
                    <a href="/members.html" class="action-btn">
                        <i>🔍</i>
                        <span>Find Speakers</span>
                    </a>
                    <a href="/saved-speakers.html" class="action-btn">
                        <i>💾</i>
                        <span>Saved Speakers</span>
                    </a>
                    <a href="/settings.html" class="action-btn">
                        <i>⚙️</i>
                        <span>Settings</span>
                    </a>
                </div>
            </div>

            <!-- Monthly Stats -->
            <div class="dashboard-card">
                <h3 style="color: var(--color-sand); margin-bottom: var(--spacing-md); font-weight: 900; font-family: 'Brandon Text', var(--font-primary);">This Month</h3>
                <div style="display: flex; flex-direction: column; gap: var(--spacing-md);">
                    <div style="display: flex; justify-content: space-between;">
                        <span>New Applications:</span>
                        <strong>${monthlyApps.length}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>Accepted:</span>
                        <strong>${monthlyApps.filter(a => a.status === 'Accepted').length}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>Response Rate:</span>
                        <strong>${this.calculateResponseRate()}%</strong>
                    </div>
                </div>
            </div>

            <!-- CoveTalks Pro -->
            <div class="subscription-card org-card">
                <h3>CoveTalks for Organizations</h3>
                <div style="opacity: 0.9; margin-bottom: var(--spacing-md);">
                    Free forever for organizations to find and connect with speakers
                </div>
                <a href="/help.html" class="btn">Learn More</a>
            </div>

            <!-- Resources -->
            <div class="dashboard-card">
                <h3 style="color: var(--color-sand); margin-bottom: var(--spacing-md); font-weight: 900; font-family: 'Brandon Text', var(--font-primary);">Resources</h3>
                <div class="resources-list">
                    <a href="/organization-guide.html">📖 Organization Guide</a>
                    <a href="/speaker-criteria.html">✅ Speaker Selection Tips</a>
                    <a href="/help.html">❓ Help Center</a>
                </div>
            </div>
        `;
    }

    renderApplicationsTable() {
        if (this.data.applications.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-state-icon">📝</div>
                    <p>No applications yet</p>
                    <p style="font-size: 0.9rem; margin-top: var(--spacing-sm); color: var(--color-gray-light);">
                        Applications will appear here when speakers apply to your opportunities
                    </p>
                </div>
            `;
        }
        
        return `
            <table class="applications-table">
                <thead>
                    <tr>
                        <th>Speaker</th>
                        <th>Opportunity</th>
                        <th>Status</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.data.applications.slice(0, 5).map(app => {
                        const speaker = app.speaker || {};
                        const initials = speaker.name ? 
                            speaker.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 
                            '??';
                        
                        let statusClass = '';
                        if (app.status === 'Pending') statusClass = 'pending';
                        else if (app.status === 'Accepted') statusClass = 'accepted';
                        else if (app.status === 'Rejected') statusClass = 'rejected';
                        
                        return `
                            <tr>
                                <td>
                                    <div class="applicant-info">
                                        <div class="applicant-avatar">${initials}</div>
                                        <div>
                                            <div style="font-weight: 600; color: var(--color-deep);">${speaker.name || 'Unknown'}</div>
                                            <div style="font-size: 0.85rem; color: var(--color-gray);">
                                                ${speaker.location || 'Location not specified'}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td style="color: var(--color-gray);">${app.opportunity?.title || 'Unknown'}</td>
                                <td>
                                    <span class="status-badge ${statusClass}">${app.status}</span>
                                </td>
                                <td>
                                    <a href="/application-review.html?id=${app.id}" class="btn btn-primary btn-sm">
                                        Review
                                    </a>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    }

    renderOrganizationOpportunity(opp) {
        return `
            <div class="opportunity-item">
                <div class="opportunity-title">${opp.title}</div>
                <div class="opportunity-meta">
                    <span>📅 ${this.formatDate(opp.event_date)}</span>
                    <span>📍 ${opp.location || 'TBD'}</span>
                    <span>💰 ${opp.compensation_amount ? `$${opp.compensation_amount}` : 'Volunteer'}</span>
                </div>
                <div class="opportunity-stats">
                    <span>📝 ${opp.applications?.count || 0} applications</span>
                    <span>⏰ Posted ${this.formatTimeAgo(opp.created_at)}</span>
                </div>
                <a href="/manage-opportunity.html?id=${opp.id}" class="view-btn" style="margin-top: var(--spacing-md); display: inline-block;">
                    Manage
                </a>
            </div>
        `;
    }

    // ============================================
    // SHARED RENDER METHODS
    // ============================================

    renderActivityItem(activity) {
        let icon = '📋';
        let iconClass = 'view';
        let title = 'Activity';
        let description = '';
        let actionLink = null;
        
        // Format the metadata for display
        const meta = activity.metadata || {};
        
        switch (activity.activity_type) {
            case 'profile_view':
                icon = '👁️';
                iconClass = 'view';
                title = 'Profile View';
                description = `Someone viewed your profile`;
                if (meta.viewer_type === 'Organization') {
                    description = `An organization viewed your profile`;
                }
                break;
                
            case 'application_submitted':
                icon = '🎯';
                iconClass = 'application';
                title = 'New Application';
                if (this.userType === 'Organization') {
                    description = `New application received for your opportunity`;
                    actionLink = `/application-review.html?id=${meta.application_id}`;
                } else {
                    description = `You applied to a speaking opportunity`;
                    actionLink = `/application-status.html?id=${meta.application_id}`;
                }
                break;
                
            case 'application_reviewed':
                icon = activity.metadata?.status === 'Accepted' ? '✅' : '📝';
                iconClass = activity.metadata?.status === 'Accepted' ? 'booking' : 'application';
                title = 'Application ' + (activity.metadata?.status || 'Reviewed');
                description = `Your application was ${activity.metadata?.status?.toLowerCase() || 'reviewed'}`;
                actionLink = `/application-status.html?id=${activity.target_id}`;
                break;
                
            case 'opportunity_posted':
                icon = '📢';
                iconClass = 'message';
                title = 'Opportunity Posted';
                description = `New opportunity: ${meta.title || 'Speaking Opportunity'}`;
                if (meta.event_date) {
                    description += ` - ${this.formatDate(meta.event_date)}`;
                }
                actionLink = `/opportunity-details.html?id=${activity.target_id}`;
                break;
                
            case 'speaker_saved':
                icon = '⭐';
                iconClass = 'booking';
                title = 'Speaker Saved';
                if (this.userType === 'Speaker') {
                    description = 'An organization saved your profile';
                } else {
                    description = 'You saved a speaker profile';
                    actionLink = `/profile.html?id=${activity.target_id}`;
                }
                break;
                
            case 'review_posted':
                icon = '⭐';
                iconClass = 'booking';
                title = 'New Review';
                description = `You received a ${meta.rating || 0}-star review`;
                if (meta.would_recommend) {
                    description += ' (Recommended!)';
                }
                actionLink = `/reviews.html`;
                break;
                
            case 'message_sent':
                icon = '💬';
                iconClass = 'message';
                title = 'Message Sent';
                description = meta.subject || 'New message sent';
                actionLink = `/inbox.html`;
                break;
                
            default:
                // Fallback for any unhandled activity types
                title = activity.activity_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                description = 'Activity recorded';
        }
        
        return `
            <div class="activity-item">
                <div class="activity-icon ${iconClass}">${icon}</div>
                <div class="activity-content">
                    <h4>${title}</h4>
                    <p>${description}</p>
                    <span class="activity-time">${this.formatTimeAgo(activity.created_at)}</span>
                </div>
                ${actionLink ? `
                    <a href="${actionLink}" class="view-btn">
                        View
                    </a>
                ` : ''}
            </div>
        `;
    }

    renderBookingItem(booking) {
        return `
            <div class="activity-item">
                <div class="activity-icon booking">📅</div>
                <div class="activity-content">
                    <h4>${booking.opportunity?.title || 'Event'}</h4>
                    <p>${this.formatDate(booking.opportunity?.event_date)} • ${booking.opportunity?.location || 'Location TBD'}</p>
                    <span class="activity-time">Format: ${booking.opportunity?.event_format || 'TBD'}</span>
                </div>
                <a href="/booking-details.html?id=${booking.id}" class="view-btn">
                    View Details
                </a>
            </div>
        `;
    }

    renderOpportunityItem(opp) {
        return `
            <div class="activity-item">
                <div class="activity-icon view">🎤</div>
                <div class="activity-content">
                    <h4>${opp.title}</h4>
                    <p>${opp.location || 'Remote'} • ${this.formatDate(opp.event_date)}</p>
                    <span class="activity-time">
                        ${opp.compensation_amount ? `💰 $${opp.compensation_amount}` : 'Volunteer'} • 
                        Posted ${this.formatTimeAgo(opp.created_at)}
                    </span>
                </div>
                <a href="/opportunity-details.html?id=${opp.id}" class="view-btn">
                    View & Apply
                </a>
            </div>
        `;
    }

    // ============================================
    // HELPER METHODS
    // ============================================

    calculateProfileCompletion() {
        let completedFields = 0;
        const totalFields = 8;
        const missingFields = [];
        
        if (this.currentUser.name) completedFields++;
        else missingFields.push('Add your full name');
        
        if (this.currentUser.bio && this.currentUser.bio.length >= 50) completedFields++;
        else missingFields.push('Write a compelling bio');
        
        if (this.currentUser.location) completedFields++;
        else missingFields.push('Add your location');
        
        if (this.currentUser.profile_image_url) completedFields++;
        else missingFields.push('Add a professional photo');
        
        if (this.currentUser.specialties && this.currentUser.specialties.length > 0) completedFields++;
        else missingFields.push('List your speaking topics');
        
        if (this.currentUser.website) completedFields++;
        else missingFields.push('Add your website');
        
        if (this.currentUser.years_experience) completedFields++;
        else missingFields.push('Add years of experience');
        
        if (this.currentUser.phone) completedFields++;
        else missingFields.push('Add phone number');
        
        const percentage = Math.round((completedFields / totalFields) * 100);
        
        let tips = '';
        if (percentage === 100) {
            tips = '<div style="color: var(--color-success); text-align: center; padding: var(--spacing-md); background: rgba(39, 174, 96, 0.1); border-radius: 8px; margin-top: var(--spacing-md);">✅ Your profile is complete!</div>';
        } else if (missingFields.length > 0) {
            tips = `
                <div style="margin-top: var(--spacing-md); padding: var(--spacing-md); background: var(--color-foam); border-radius: 10px;">
                    <h4 style="color: var(--color-deep); margin-bottom: var(--spacing-sm); font-size: 0.9rem; font-weight: 700;">Complete Your Profile:</h4>
                    <ul style="list-style: none; padding: 0; margin: 0;">
                        ${missingFields.slice(0, 3).map(field => `<li style="padding: 0.25rem 0; color: var(--color-gray); font-size: 0.85rem;">→ ${field}</li>`).join('')}
                        ${missingFields.length > 3 ? `<li style="padding: 0.25rem 0; color: var(--color-gray); font-size: 0.85rem;">...and ${missingFields.length - 3} more</li>` : ''}
                    </ul>
                </div>
            `;
        }
        
        return { percentage, tips };
    }

    calculateResponseRate() {
        if (this.data.applications.length === 0) return 0;
        const responded = this.data.applications.filter(a => a.status !== 'Pending').length;
        return Math.round((responded / this.data.applications.length) * 100);
    }

    formatDate(dateString) {
        if (!dateString) return 'Date TBD';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
        });
    }

    formatTimeAgo(dateString) {
        if (!dateString) return 'recently';
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'today';
        if (diffDays === 1) return 'yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        return `${Math.floor(diffDays / 30)} months ago`;
    }

    showError(message) {
        const mainContent = document.getElementById('mainContent');
        if (!mainContent) return;
        
        mainContent.innerHTML = `
            <div class="dashboard-card">
                <div class="empty-state">
                    <div class="empty-state-icon">⚠️</div>
                    <h3>Error</h3>
                    <p>${message}</p>
                    <button onclick="location.reload()" class="btn btn-primary mt-3">
                        Refresh Page
                    </button>
                </div>
            </div>
        `;
    }
}

// Initialize dashboard
const dashboard = new UnifiedDashboard();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => dashboard.init());
} else {
    dashboard.init();
}