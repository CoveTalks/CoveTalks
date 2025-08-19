/**
 * CoveTalks Activity Feed Page
 * Displays user activity timeline and interactions with proper tracking
 */

class ActivityFeed {
    constructor() {
        this.currentUser = null;
        this.allActivities = [];
        this.filteredActivities = [];
        this.currentOffset = 0;
        this.ITEMS_PER_PAGE = 20;
        this.isLoading = false;
        this.activityChannel = null;
    }

    async init() {
        console.log('[Activity] Initializing activity feed');
        
        try {
            // Wait for Supabase
            await this.waitForSupabase();
            
            // Check authentication
            const session = await window.covetalks.checkAuth();
            if (!session) {
                window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.href);
                return;
            }

            // Get current user
            this.currentUser = await window.covetalks.getMemberProfile(session.user.id);
            
            // Apply user type styling
            this.applyUserTypeStyling();
            
            // Attach event listeners
            this.attachEventListeners();
            
            // Load activities
            await this.loadActivities();
            
            // Subscribe to real-time updates
            this.subscribeToRealtimeUpdates();

        } catch (error) {
            console.error('[Activity] Initialization error:', error);
            this.showError('Failed to load activities');
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

    applyUserTypeStyling() {
        if (this.currentUser.member_type === 'Organization') {
            document.body.classList.add('org-view');
            document.getElementById('activityHeader').classList.add('org-header');
            document.getElementById('headerSubtext').textContent = 
                'Monitor speaker applications and opportunity interactions';
        }
    }

    attachEventListeners() {
        // Filter listeners
        document.getElementById('typeFilter').addEventListener('change', () => this.filterActivities());
        document.getElementById('periodFilter').addEventListener('change', () => this.filterActivities());
        document.getElementById('sortFilter').addEventListener('change', () => this.sortActivities());
        document.getElementById('clearFiltersBtn').addEventListener('click', () => this.clearFilters());
        document.getElementById('loadMoreBtn').addEventListener('click', () => this.loadMoreActivities());
    }

    async loadActivities() {
        if (this.isLoading) return;
        this.isLoading = true;
        
        try {
            this.showLoading(true);
            
            // Get activity feed using the proper function from supabase-client.js
            const activities = await window.covetalks.getActivityFeed(this.currentUser.id, 100);
            
            console.log('[Activity] Loaded activities:', activities.length);
            
            // Sort by date (newest first)
            activities.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            
            this.allActivities = activities;
            this.filteredActivities = activities;
            
            // Update stats
            this.updateStats();
            
            // Display initial activities
            this.displayActivities(0, this.ITEMS_PER_PAGE);
            
            // Show/hide UI elements
            this.showLoading(false);
            
            if (activities.length === 0) {
                document.getElementById('emptyState').classList.remove('hidden');
            } else {
                document.getElementById('loadMoreContainer').style.display = 
                    activities.length > this.ITEMS_PER_PAGE ? 'block' : 'none';
            }

        } catch (error) {
            console.error('[Activity] Error loading activities:', error);
            this.showError('Failed to load activities');
        } finally {
            this.isLoading = false;
        }
    }

    subscribeToRealtimeUpdates() {
        // Subscribe to new activities where current user is actor or target
        this.activityChannel = window.covetalks.supabase
            .channel('activity-feed')
            .on('postgres_changes', 
                { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'activity',
                    filter: `target_id=eq.${this.currentUser.id}`
                },
                (payload) => {
                    console.log('[Activity] New activity received:', payload.new);
                    this.handleNewActivity(payload.new);
                }
            )
            .on('postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'activity',
                    filter: `actor_id=eq.${this.currentUser.id}`
                },
                (payload) => {
                    console.log('[Activity] Own activity recorded:', payload.new);
                    this.handleNewActivity(payload.new);
                }
            )
            .subscribe();
        
        // Clean up on page unload
        window.addEventListener('beforeunload', () => {
            if (this.activityChannel) {
                this.activityChannel.unsubscribe();
            }
        });
    }

    handleNewActivity(activity) {
        // Add to beginning of array
        this.allActivities.unshift(activity);
        this.filteredActivities.unshift(activity);
        
        // Update stats
        this.updateStats();
        
        // Show notification
        this.showNewActivityNotification(activity);
        
        // Re-display if on first page
        if (this.currentOffset === 0) {
            this.displayActivities(0, this.ITEMS_PER_PAGE);
        }
    }

    showNewActivityNotification(activity) {
        const details = this.getActivityDetails(activity);
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'activity-notification';
        notification.innerHTML = `
            <div class="notification-icon">${details.icon}</div>
            <div class="notification-content">
                <strong>New Activity!</strong>
                <p>${details.description}</p>
            </div>
        `;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        // Remove after 5 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 5000);
    }

    updateStats() {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        
        const stats = {
            today: this.allActivities.filter(a => new Date(a.created_at) >= today).length,
            week: this.allActivities.filter(a => new Date(a.created_at) >= weekAgo).length,
            month: this.allActivities.filter(a => new Date(a.created_at) >= monthAgo).length,
            unread: this.allActivities.filter(a => a.metadata?.unread === true).length
        };
        
        document.getElementById('todayCount').textContent = stats.today;
        document.getElementById('weekCount').textContent = stats.week;
        document.getElementById('monthCount').textContent = stats.month;
        document.getElementById('unreadCount').textContent = stats.unread;
    }

    displayActivities(start, count) {
        const container = document.getElementById('activitiesContainer');
        const activities = this.filteredActivities.slice(start, start + count);
        
        if (start === 0) {
            container.innerHTML = ''; // Clear if starting fresh
        }
        
        // Group by date
        const grouped = this.groupByDate(activities);
        
        Object.entries(grouped).forEach(([date, items]) => {
            const dateGroup = document.createElement('div');
            dateGroup.className = 'date-group';
            
            // Date header
            const dateHeader = document.createElement('div');
            dateHeader.className = 'date-header';
            dateHeader.textContent = this.formatDateHeader(date);
            dateGroup.appendChild(dateHeader);
            
            // Activity items
            items.forEach(activity => {
                dateGroup.appendChild(this.createActivityElement(activity));
            });
            
            container.appendChild(dateGroup);
        });
        
        this.currentOffset = start + count;
        
        // Update load more button
        const hasMore = this.currentOffset < this.filteredActivities.length;
        document.getElementById('loadMoreContainer').style.display = hasMore ? 'block' : 'none';
    }

    createActivityElement(activity) {
        const item = document.createElement('div');
        item.className = 'activity-item';
        
        const details = this.getActivityDetails(activity);
        
        item.innerHTML = `
            <div class="activity-icon ${details.iconClass}">${details.icon}</div>
            <div class="activity-header-row">
                <div>
                    <div class="activity-title">${details.title}</div>
                    <div class="activity-meta">
                        <div class="activity-meta-item">
                            🕐 ${this.formatTime(activity.created_at)}
                        </div>
                        ${activity.metadata?.location ? `
                            <div class="activity-meta-item">
                                📍 ${activity.metadata.location}
                            </div>
                        ` : ''}
                    </div>
                </div>
                ${activity.metadata?.unread ? 
                    '<span class="activity-badge new">NEW</span>' : ''
                }
            </div>
            <div class="activity-description">${details.description}</div>
            ${details.actionUrl ? `
                <a href="${details.actionUrl}" class="btn btn-primary btn-sm activity-action">
                    ${details.actionText}
                </a>
            ` : ''}
        `;
        
        // Mark as read on hover (if applicable)
        if (activity.metadata?.unread) {
            item.addEventListener('mouseenter', () => {
                this.markActivityRead(activity.id);
            });
        }
        
        return item;
    }

    async markActivityRead(activityId) {
        try {
            // Update in database
            await window.covetalks.supabase
                .from('activity')
                .update({ 
                    metadata: window.covetalks.supabase.sql`
                        jsonb_set(metadata, '{unread}', 'false')
                    `
                })
                .eq('id', activityId);
            
            // Update local data
            const activity = this.allActivities.find(a => a.id === activityId);
            if (activity && activity.metadata) {
                activity.metadata.unread = false;
            }
            
            // Update stats
            this.updateStats();
        } catch (error) {
            console.error('[Activity] Error marking as read:', error);
        }
    }

    getActivityDetails(activity) {
        const type = activity.activity_type;
        const metadata = activity.metadata || {};
        
        const detailsMap = {
            'profile_view': {
                icon: '👁️',
                iconClass: 'profile-view',
                title: 'Profile View',
                description: metadata.viewer_name ? 
                    `${metadata.viewer_name} ${metadata.viewer_type === 'Organization' ? '(Organization)' : ''} viewed your profile` : 
                    'Someone viewed your profile',
                actionText: metadata.viewer_type === 'Organization' ? 'View Organization' : '',
                actionUrl: metadata.viewer_id && metadata.viewer_type === 'Organization' ? 
                    `/profile.html?id=${metadata.viewer_id}` : ''
            },
            'application_submitted': {
                icon: '📝',
                iconClass: 'application',
                title: 'Application Submitted',
                description: this.currentUser.member_type === 'Organization' ?
                    `New application received for "${metadata.opportunity_title || 'your opportunity'}"` :
                    `You applied to "${metadata.opportunity_title || 'opportunity'}"`,
                actionText: this.currentUser.member_type === 'Organization' ? 'Review Application' : 'View Status',
                actionUrl: this.currentUser.member_type === 'Organization' ?
                    `/application-review.html?id=${metadata.application_id}` :
                    `/application-status.html?id=${metadata.application_id}`
            },
            'application_reviewed': {
                icon: metadata.status === 'Accepted' ? '✅' : metadata.status === 'Rejected' ? '❌' : '📋',
                iconClass: metadata.status === 'Accepted' ? 'booking' : 'application',
                title: `Application ${metadata.status}`,
                description: metadata.status === 'Accepted' ? 
                    'Congratulations! Your application has been accepted' :
                    `Your application was ${metadata.status?.toLowerCase() || 'reviewed'}`,
                actionText: 'View Details',
                actionUrl: metadata.status === 'Accepted' ?
                    `/booking-details.html?id=${metadata.application_id}` :
                    `/application-status.html?id=${metadata.application_id}`
            },
            'opportunity_posted': {
                icon: '📢',
                iconClass: 'opportunity',
                title: 'Opportunity Posted',
                description: `Posted "${metadata.title || 'New opportunity'}"${metadata.event_date ? ` - ${this.formatDate(metadata.event_date)}` : ''}`,
                actionText: 'Manage',
                actionUrl: `/manage-opportunity.html?id=${metadata.opportunity_id}`
            },
            'speaker_saved': {
                icon: '⭐',
                iconClass: 'booking',
                title: 'Added to Saved Speakers',
                description: `${metadata.organization_name || 'An organization'} saved your profile`,
                actionText: '',
                actionUrl: ''
            },
            'review_posted': {
                icon: '⭐',
                iconClass: 'review',
                title: 'New Review',
                description: `Received a ${metadata.rating || 0} star review${metadata.would_recommend ? ' (Recommended!)' : ''}`,
                actionText: 'View Review',
                actionUrl: '/reviews.html'
            },
            'message_sent': {
                icon: '💬',
                iconClass: 'message',
                title: 'Message Sent',
                description: metadata.subject || 'Message sent successfully',
                actionText: 'View Message',
                actionUrl: '/inbox.html?tab=sent'
            },
            'message_received': {
                icon: '📨',
                iconClass: 'message',
                title: 'New Message',
                description: metadata.subject || 'You have a new message',
                actionText: 'Read Message',
                actionUrl: '/inbox.html'
            },
            'profile_updated': {
                icon: '✏️',
                iconClass: 'profile-view',
                title: 'Profile Updated',
                description: `Updated ${(metadata.sections_updated || []).join(', ')} section${(metadata.sections_updated || []).length > 1 ? 's' : ''}`,
                actionText: 'View Profile',
                actionUrl: '/profile.html'
            },
            'member_registered': {
                icon: '🎉',
                iconClass: 'success',
                title: 'Welcome to CoveTalks!',
                description: `Successfully registered as ${metadata.member_type === 'Organization' ? metadata.organization_name : metadata.name}`,
                actionText: 'Complete Profile',
                actionUrl: '/settings.html'
            }
        };
        
        return detailsMap[type] || {
            icon: '📋',
            iconClass: 'profile-view',
            title: type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            description: 'Activity recorded',
            actionText: '',
            actionUrl: ''
        };
    }

    filterActivities() {
        const typeFilter = document.getElementById('typeFilter').value;
        const periodFilter = document.getElementById('periodFilter').value;
        
        let filtered = [...this.allActivities];
        
        // Type filter
        if (typeFilter !== 'all') {
            filtered = filtered.filter(a => {
                // Handle variations in activity type naming
                if (typeFilter === 'application') {
                    return a.activity_type.includes('application');
                }
                if (typeFilter === 'profile_view') {
                    return a.activity_type === 'profile_view';
                }
                if (typeFilter === 'booking') {
                    return a.activity_type === 'application_reviewed' && 
                           a.metadata?.status === 'Accepted';
                }
                if (typeFilter === 'message') {
                    return a.activity_type.includes('message');
                }
                if (typeFilter === 'review') {
                    return a.activity_type === 'review_posted';
                }
                if (typeFilter === 'opportunity') {
                    return a.activity_type === 'opportunity_posted';
                }
                return a.activity_type === typeFilter;
            });
        }
        
        // Period filter
        if (periodFilter !== 'all') {
            const now = new Date();
            let startDate;
            
            switch(periodFilter) {
                case 'today':
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    break;
                case 'week':
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case 'month':
                    startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
                    break;
                case '3months':
                    startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
                    break;
            }
            
            if (startDate) {
                filtered = filtered.filter(a => new Date(a.created_at) >= startDate);
            }
        }
        
        this.filteredActivities = filtered;
        this.currentOffset = 0;
        
        // Clear and redisplay
        document.getElementById('activitiesContainer').innerHTML = '';
        this.displayActivities(0, this.ITEMS_PER_PAGE);
        
        // Show/hide empty state
        document.getElementById('emptyState').classList.toggle('hidden', filtered.length > 0);
        document.getElementById('loadMoreContainer').style.display = 
            filtered.length > this.ITEMS_PER_PAGE ? 'block' : 'none';
    }

    sortActivities() {
        const sortBy = document.getElementById('sortFilter').value;
        
        switch(sortBy) {
            case 'recent':
                this.filteredActivities.sort((a, b) => 
                    new Date(b.created_at) - new Date(a.created_at)
                );
                break;
            case 'oldest':
                this.filteredActivities.sort((a, b) => 
                    new Date(a.created_at) - new Date(b.created_at)
                );
                break;
            case 'type':
                this.filteredActivities.sort((a, b) => 
                    a.activity_type.localeCompare(b.activity_type)
                );
                break;
        }
        
        this.currentOffset = 0;
        document.getElementById('activitiesContainer').innerHTML = '';
        this.displayActivities(0, this.ITEMS_PER_PAGE);
    }

    clearFilters() {
        document.getElementById('typeFilter').value = 'all';
        document.getElementById('periodFilter').value = 'all';
        document.getElementById('sortFilter').value = 'recent';
        
        this.filteredActivities = [...this.allActivities];
        this.currentOffset = 0;
        
        document.getElementById('activitiesContainer').innerHTML = '';
        this.displayActivities(0, this.ITEMS_PER_PAGE);
        
        document.getElementById('emptyState').classList.toggle('hidden', this.filteredActivities.length > 0);
        document.getElementById('loadMoreContainer').style.display = 
            this.filteredActivities.length > this.ITEMS_PER_PAGE ? 'block' : 'none';
    }

    loadMoreActivities() {
        this.displayActivities(this.currentOffset, this.ITEMS_PER_PAGE);
    }

    // Helper methods
    groupByDate(activities) {
        const grouped = {};
        
        activities.forEach(activity => {
            const date = new Date(activity.created_at).toDateString();
            if (!grouped[date]) {
                grouped[date] = [];
            }
            grouped[date].push(activity);
        });
        
        return grouped;
    }

    formatDateHeader(dateString) {
        const date = new Date(dateString);
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        
        if (dateString === today) return 'Today';
        if (dateString === yesterday) return 'Yesterday';
        
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
    }

    formatDate(dateString) {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }

    formatTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }

    showLoading(show) {
        document.getElementById('loadingState').classList.toggle('hidden', !show);
    }

    showError(message) {
        this.showLoading(false);
        document.getElementById('activitiesContainer').innerHTML = `
            <div class="empty-activity">
                <div class="empty-activity-icon">⚠️</div>
                <h3>Error Loading Activities</h3>
                <p>${message}</p>
                <button onclick="location.reload()" class="btn btn-primary">
                    Try Again
                </button>
            </div>
        `;
    }
}

// Add notification styles if not present
if (!document.getElementById('activity-notification-styles')) {
    const style = document.createElement('style');
    style.id = 'activity-notification-styles';
    style.textContent = `
        .activity-notification {
            position: fixed;
            top: 20px;
            right: -400px;
            background: white;
            border-radius: 10px;
            padding: 1rem;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            display: flex;
            align-items: center;
            gap: 1rem;
            max-width: 350px;
            z-index: 1000;
            transition: right 0.3s ease;
        }
        
        .activity-notification.show {
            right: 20px;
        }
        
        .notification-icon {
            font-size: 1.5rem;
            flex-shrink: 0;
        }
        
        .notification-content strong {
            display: block;
            margin-bottom: 0.25rem;
            color: var(--color-deep);
        }
        
        .notification-content p {
            margin: 0;
            color: var(--color-gray);
            font-size: 0.9rem;
        }
    `;
    document.head.appendChild(style);
}

// Initialize on page load
const activityFeed = new ActivityFeed();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => activityFeed.init());
} else {
    activityFeed.init();
}