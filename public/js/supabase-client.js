/**
 * CoveTalks Supabase Client - COMPLETE VERSION
 * Full implementation with all features and activity tracking
 */

// Initialize Supabase client
const supabaseUrl = window.CONFIG?.SUPABASE_URL;
const supabaseAnonKey = window.CONFIG?.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase configuration missing');
}

const supabase = supabaseUrl && supabaseAnonKey ? 
    window.supabase.createClient(supabaseUrl, supabaseAnonKey) : null;

// Main CoveTalks object with all functions
window.covetalks = {
    supabase: supabase,

    // ===========================================
    // AUTHENTICATION FUNCTIONS
    // ===========================================
    
    async checkAuth() {
        const { data: { session } } = await supabase.auth.getSession();
        return session;
    },

    async signup(userData) {
        const { data, error } = await supabase.auth.signUp({
            email: userData.email,
            password: userData.password,
            options: {
                data: {
                    name: userData.name,
                    member_type: userData.memberType,
                    phone: userData.phone,
                    location: userData.location,
                    bio: userData.bio,
                    specialties: userData.specialties,
                    organizationData: userData.organizationData
                }
            }
        });
        
        if (error) throw error;
        
        // Track signup activity
        if (data?.user) {
            await this.trackActivity('signup', null, {
                member_type: userData.memberType
            });
        }
        
        return data;
    },

    async login(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) throw error;
        return data;
    },

    async logout() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        // Clear cache and redirect to home or login page
        this.clearCache();
        window.location.href = '/login.html';
    },

    async resetPassword(email) {
        const { data, error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        return data;
    },

    async updatePassword(newPassword) {
        const { data, error } = await supabase.auth.updateUser({
            password: newPassword
        });
        if (error) throw error;
        return data;
    },

    // ===========================================
    // PROFILE FUNCTIONS
    // ===========================================
    
    async getMemberProfile(userId) {
        const { data, error } = await supabase
            .from('members')
            .select('*')
            .eq('id', userId)
            .single();
        
        if (error) throw error;
        return data;
    },

    async getCurrentUser() {
        const session = await this.checkAuth();
        if (!session) return null;
        return await this.getMemberProfile(session.user.id);
    },

    async updateProfile(updates) {
        const session = await this.checkAuth();
        if (!session) throw new Error('Not authenticated');
        
        const { data, error } = await supabase
            .from('members')
            .update(updates)
            .eq('id', session.user.id)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    async searchMembers(filters = {}) {
        let query = supabase
            .from('members')
            .select(`
                *,
                reviews!reviews_speaker_id_fkey(rating)
            `);
        
        // Only filter by member_type if explicitly provided
        if (filters.memberType) {
            query = query.eq('member_type', filters.memberType);
        }
        
        if (filters.specialties && filters.specialties.length > 0) {
            query = query.contains('specialties', filters.specialties);
        }
        
        if (filters.location) {
            query = query.ilike('location', `%${filters.location}%`);
        }
        
        if (filters.minRating) {
            query = query.gte('average_rating', filters.minRating);
        }
        
        if (filters.search) {
            query = query.or(`name.ilike.%${filters.search}%,bio.ilike.%${filters.search}%`);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    // ===========================================
    // ACTIVITY TRACKING FUNCTIONS
    // ===========================================
    
    async trackActivity(activityType, targetId = null, metadata = {}) {
        try {
            const session = await this.checkAuth();
            if (!session) return; // Don't track if not logged in
            
            const { error } = await supabase
                .from('activity')
                .insert({
                    actor_id: session.user.id,
                    target_id: targetId,
                    activity_type: activityType,
                    metadata: metadata,
                    is_public: false
                });
            
            if (error) {
                console.error('Activity tracking error:', error);
            }
        } catch (err) {
            console.error('Activity tracking failed:', err);
        }
    },

    async trackProfileView(viewedUserId) {
        const session = await this.checkAuth();
        if (!session || session.user.id === viewedUserId) return;
        
        // Get viewer details for metadata
        const viewer = await this.getMemberProfile(session.user.id);
        
        await this.trackActivity('profile_view', viewedUserId, {
            viewer_name: viewer?.name,
            viewer_type: viewer?.member_type,
            viewer_id: session.user.id
        });
    },

    async trackApplicationSubmitted(opportunityId, applicationId) {
        const opportunity = await this.getOpportunityDetails(opportunityId);
        
        // The target should be the person who posted the opportunity (they receive the application)
        await this.trackActivity('application_submitted', opportunity?.posted_by, {
            opportunity_id: opportunityId,
            opportunity_title: opportunity?.title,
            organization_id: opportunity?.organization_id,
            application_id: applicationId
        });
    },

    async trackApplicationReviewed(applicationId, status, speakerId) {
    // The target should be the speaker who gets notified of the review
        await this.trackActivity('application_reviewed', speakerId, {
            status: status,
            application_id: applicationId,
            speaker_id: speakerId
        });
    },

    async trackOpportunityPosted(opportunityId, opportunityData) {
        await this.trackActivity('opportunity_posted', opportunityId, {
            title: opportunityData.title,
            event_date: opportunityData.event_date,
            location: opportunityData.location,
            opportunity_id: opportunityId
        });
    },

    async trackSpeakerSaved(speakerId, notes = '') {
        const session = await this.checkAuth();
        const org = await this.getMemberProfile(session.user.id);
        
        await this.trackActivity('speaker_saved', speakerId, {
            organization_name: org?.name,
            organization_id: session.user.id,
            notes: notes
        });
    },

    async trackReviewPosted(reviewId, speakerId, rating) {
        await this.trackActivity('review_posted', reviewId, {
            speaker_id: speakerId,
            rating: rating
        });
    },

    async trackMessageSent(messageId, recipientId, subject) {
        await this.trackActivity('message_sent', recipientId, {
            message_id: messageId,
            recipient_id: recipientId,
            subject: subject
        });
    },

    // ===========================================
    // ACTIVITY FEED FUNCTIONS
    // ===========================================
    
    async getActivityFeed(userId, limit = 50) {
        // Get activities where user is actor or target
        const { data, error } = await supabase
            .from('activity')
            .select(`
                *,
                actor:members!activity_actor_id_fkey(name, member_type, profile_image_url),
                target:members!activity_target_id_fkey(name, member_type, profile_image_url)
            `)
            .or(`actor_id.eq.${userId},target_id.eq.${userId}`)
            .order('created_at', { ascending: false })
            .limit(limit);
        
        if (error) throw error;
        
        // For organizations, also get activities for their opportunities
        const user = await this.getMemberProfile(userId);
        if (user?.member_type === 'Organization') {
            const orgActivities = await this.getOrganizationActivities(userId, limit);
            return [...(data || []), ...orgActivities].sort((a, b) => 
                new Date(b.created_at) - new Date(a.created_at)
            ).slice(0, limit);
        }
        
        return data || [];
    },

    async getOrganizationActivities(orgUserId, limit = 50) {
        // Get activities related to organization's opportunities
        const { data: opportunities } = await supabase
            .from('speaking_opportunities')
            .select('id')
            .eq('posted_by', orgUserId);
        
        if (!opportunities || opportunities.length === 0) return [];
        
        const oppIds = opportunities.map(o => o.id);
        
        // Get applications to these opportunities
        const { data: activities } = await supabase
            .from('activity')
            .select(`
                *,
                actor:members!activity_actor_id_fkey(name, member_type, profile_image_url)
            `)
            .in('metadata->>opportunity_id', oppIds)
            .order('created_at', { ascending: false })
            .limit(limit);
        
        return activities || [];
    },

    async getRecentActivity(userId, limit = 10) {
        return await this.getActivityFeed(userId, limit);
    },

    // ===========================================
    // DASHBOARD STATS
    // ===========================================
    
    async getDashboardStatsOptimized(userId) {
        const stats = {
            profileViews: 0,
            bookings: 0,
            applications: 0,
            messages: 0
        };
        
        // Get profile views (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const { count: viewCount } = await supabase
            .from('activity')
            .select('*', { count: 'exact', head: true })
            .eq('activity_type', 'profile_view')
            .eq('target_id', userId)
            .gte('created_at', thirtyDaysAgo.toISOString());
        
        stats.profileViews = viewCount || 0;
        
        // Get accepted applications (bookings)
        const { count: bookingCount } = await supabase
            .from('applications')
            .select('*', { count: 'exact', head: true })
            .eq('speaker_id', userId)
            .eq('status', 'Accepted');
        
        stats.bookings = bookingCount || 0;
        
        // Get active applications
        const { count: applicationCount } = await supabase
            .from('applications')
            .select('*', { count: 'exact', head: true })
            .eq('speaker_id', userId)
            .eq('status', 'Pending');
        
        stats.applications = applicationCount || 0;
        
        // Get unread messages
        const { count: messageCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('recipient_id', userId)
            .eq('status', 'unread');
        
        stats.messages = messageCount || 0;
        
        return stats;
    },

    async getAnalytics(userId, dateRange = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - dateRange);
        
        // Profile views over time
        const { data: viewsData } = await supabase
            .from('activity')
            .select('created_at')
            .eq('activity_type', 'profile_view')
            .eq('target_id', userId)
            .gte('created_at', startDate.toISOString())
            .order('created_at');
        
        // Applications over time
        const { data: applicationsData } = await supabase
            .from('applications')
            .select('created_at, status')
            .eq('speaker_id', userId)
            .gte('created_at', startDate.toISOString())
            .order('created_at');
        
        // Process data for charts
        const analytics = {
            profileViews: this.groupByDate(viewsData || []),
            applications: this.groupByStatus(applicationsData || []),
            totalViews: viewsData?.length || 0,
            totalApplications: applicationsData?.length || 0,
            acceptanceRate: this.calculateAcceptanceRate(applicationsData || [])
        };
        
        return analytics;
    },

    groupByDate(data) {
        const grouped = {};
        data.forEach(item => {
            const date = new Date(item.created_at).toLocaleDateString();
            grouped[date] = (grouped[date] || 0) + 1;
        });
        return grouped;
    },

    groupByStatus(data) {
        const grouped = {};
        data.forEach(item => {
            grouped[item.status] = (grouped[item.status] || 0) + 1;
        });
        return grouped;
    },

    calculateAcceptanceRate(applications) {
        const reviewed = applications.filter(a => a.status !== 'Pending');
        const accepted = applications.filter(a => a.status === 'Accepted');
        return reviewed.length > 0 ? (accepted.length / reviewed.length) * 100 : 0;
    },

    // ===========================================
    // OPPORTUNITIES
    // ===========================================
    
    async getOpportunityDetails(opportunityId) {
        const { data, error } = await supabase
            .from('speaking_opportunities')
            .select(`
                *,
                posted_by:members!speaking_opportunities_posted_by_fkey(name, email, member_type),
                organization:organizations(name, organization_type, website),
                applications(count)
            `)
            .eq('id', opportunityId)
            .single();
        
        if (error) throw error;
        return data;
    },

    async getMyOpportunities(status = null) {
        const session = await this.checkAuth();
        if (!session) throw new Error('Not authenticated');
        
        let query = supabase
            .from('speaking_opportunities')
            .select(`
                *,
                applications(count)
            `)
            .eq('posted_by', session.user.id)
            .order('created_at', { ascending: false });
        
        if (status) {
            query = query.eq('status', status);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    async getRecentOpportunities(limit = 5) {
        const { data, error } = await supabase
            .from('speaking_opportunities')
            .select(`
                *,
                posted_by:members!speaking_opportunities_posted_by_fkey(name, member_type),
                organization:organizations(name, organization_type)
            `)
            .eq('status', 'Open')
            .gte('application_deadline', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(limit);
        
        if (error) throw error;
        return data || [];
    },

    async searchOpportunities(filters = {}) {
        let query = supabase
            .from('speaking_opportunities')
            .select(`
                *,
                posted_by:members!speaking_opportunities_posted_by_fkey(name, member_type),
                organization:organizations(name, organization_type),
                applications(count)
            `)
            .eq('status', 'Open');
        
        if (filters.topics && filters.topics.length > 0) {
            query = query.contains('topics', filters.topics);
        }
        
        if (filters.location) {
            query = query.or(`location.ilike.%${filters.location}%,event_format.eq.Virtual`);
        }
        
        if (filters.eventFormat) {
            query = query.eq('event_format', filters.eventFormat);
        }
        
        if (filters.minCompensation) {
            query = query.gte('compensation_amount', filters.minCompensation);
        }
        
        if (filters.dateFrom) {
            query = query.gte('event_date', filters.dateFrom);
        }
        
        if (filters.dateTo) {
            query = query.lte('event_date', filters.dateTo);
        }
        
        if (filters.search) {
            query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
        }
        
        // Sorting
        const sortBy = filters.sortBy || 'created_at';
        const sortOrder = filters.sortOrder || 'desc';
        query = query.order(sortBy, { ascending: sortOrder === 'asc' });
        
        // Pagination
        if (filters.limit) {
            query = query.limit(filters.limit);
        }
        if (filters.offset) {
            query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    async postOpportunity(opportunityData) {
        const session = await this.checkAuth();
        if (!session) throw new Error('Not authenticated');
        
        // Get user's organization
        const { data: orgMember } = await supabase
            .from('organization_members')
            .select('organization_id')
            .eq('member_id', session.user.id)
            .single();
        
        const { data, error } = await supabase
            .from('speaking_opportunities')
            .insert({
                ...opportunityData,
                posted_by: session.user.id,
                organization_id: orgMember?.organization_id
            })
            .select()
            .single();
        
        if (error) throw error;
        
        // Track activity
        await this.trackOpportunityPosted(data.id, data);
        
        return data;
    },

    async updateOpportunity(opportunityId, updates) {
        const session = await this.checkAuth();
        if (!session) throw new Error('Not authenticated');
        
        const { data, error } = await supabase
            .from('speaking_opportunities')
            .update(updates)
            .eq('id', opportunityId)
            .eq('posted_by', session.user.id) // Ensure user owns this opportunity
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    async deleteOpportunity(opportunityId) {
        const session = await this.checkAuth();
        if (!session) throw new Error('Not authenticated');
        
        const { error } = await supabase
            .from('speaking_opportunities')
            .delete()
            .eq('id', opportunityId)
            .eq('posted_by', session.user.id);
        
        if (error) throw error;
    },

    // ===========================================
    // APPLICATIONS
    // ===========================================

    async checkApplicationStatus(opportunityId, speakerId) {
        try {
            const { data, error } = await supabase
                .from('applications')
                .select('*')
                .eq('opportunity_id', opportunityId)
                .eq('speaker_id', speakerId)
                .maybeSingle();  // Changed from .single() to .maybeSingle()
            
            if (error) {
                console.error('Error checking application status:', error);
                return null;
            }
            
            return data; // Returns null if not found, or the application if found
        } catch (error) {
            console.error('Error checking application status:', error);
            return null;
        }
    },

    async applyToOpportunity(opportunityId, applicationData) {
        const session = await this.checkAuth();
        if (!session) throw new Error('Not authenticated');
        
        // Check if already applied
        const existing = await this.checkApplicationStatus(opportunityId, session.user.id);
        if (existing) {
            throw new Error('You have already applied to this opportunity');
        }
        
        const { data, error } = await supabase
            .from('applications')
            .insert({
                opportunity_id: opportunityId,
                speaker_id: session.user.id,
                status: 'Pending',
                cover_letter: applicationData.coverLetter,
                requested_fee: applicationData.requestedFee,
                created_at: new Date().toISOString()
            })
            .select()
            .single();
        
        if (error) throw error;
        
        // Track the application
        await this.trackApplicationSubmitted(opportunityId, data.id);
        
        return data;
    },
    
    async getApplications(userId) {
        const { data, error } = await supabase
            .from('applications')
            .select(`
                *,
                opportunity:speaking_opportunities(*)
            `)
            .eq('speaker_id', userId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
    },

    async getApplicationDetails(applicationId) {
        const { data, error } = await supabase
            .from('applications')
            .select(`
                *,
                opportunity:speaking_opportunities(*),
                speaker:members!applications_speaker_id_fkey(*)
            `)
            .eq('id', applicationId)
            .single();
        
        if (error) throw error;
        
        // Get timeline entries separately if needed
        if (data) {
            const { data: timeline } = await supabase
                .from('application_timeline')
                .select('*')
                .eq('application_id', applicationId)
                .order('created_at', { ascending: false });
            
            const { data: notes } = await supabase
                .from('application_notes')
                .select('*')
                .eq('application_id', applicationId)
                .order('created_at', { ascending: false });
            
            data.timeline = timeline || [];
            data.notes = notes || [];
        }
        
        return data;
    },

    async submitApplication(opportunityId, applicationData) {
        const session = await this.checkAuth();
        if (!session) throw new Error('Not authenticated');
        
        // Check if already applied
        const { data: existing } = await supabase
            .from('applications')
            .select('id')
            .eq('opportunity_id', opportunityId)
            .eq('speaker_id', session.user.id)
            .single();
        
        if (existing) {
            throw new Error('You have already applied to this opportunity');
        }
        
        const { data, error } = await supabase
            .from('applications')
            .insert({
                opportunity_id: opportunityId,
                speaker_id: session.user.id,
                ...applicationData
            })
            .select()
            .single();
        
        if (error) throw error;
        
        // Add to timeline
        await this.addApplicationTimelineEntry(data.id, 'Submitted', 'Application submitted');
        
        // Track activity
        await this.trackApplicationSubmitted(opportunityId, data.id);
        
        // Update opportunity application count
        await supabase.rpc('increment_application_count', { opp_id: opportunityId });
        
        return data;
    },

    async withdrawApplication(applicationId) {
        const session = await this.checkAuth();
        if (!session) throw new Error('Not authenticated');
        
        const { data, error } = await supabase
            .from('applications')
            .update({ status: 'Withdrawn' })
            .eq('id', applicationId)
            .eq('speaker_id', session.user.id)
            .select()
            .single();
        
        if (error) throw error;
        
        // Add to timeline
        await this.addApplicationTimelineEntry(applicationId, 'Withdrawn', 'Application withdrawn by speaker');
        
        return data;
    },

    async getOpportunityApplications(opportunityId) {
        const { data, error } = await supabase
            .from('applications')
            .select(`
                *,
                speaker:members!applications_speaker_id_fkey(*)
            `)
            .eq('opportunity_id', opportunityId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
    },

    async updateApplicationStatus(applicationId, status, message = null) {
        const { data: application } = await supabase
            .from('applications')
            .select('speaker_id, opportunity_id')
            .eq('id', applicationId)
            .single();
        
        const session = await this.checkAuth();
        
        const { data, error } = await supabase
            .from('applications')
            .update({
                status: status,
                reviewed_by: session.user.id,
                reviewed_at: new Date().toISOString(),
                review_message: message
            })
            .eq('id', applicationId)
            .select()
            .single();
        
        if (error) throw error;
        
        // Add to timeline
        await this.addApplicationTimelineEntry(applicationId, status, `Application ${status.toLowerCase()}`);
        
        // Track activity
        await this.trackApplicationReviewed(applicationId, status, application.speaker_id);
        
        // If accepted, update opportunity status if needed
        if (status === 'Accepted') {
            await supabase
                .from('speaking_opportunities')
                .update({ status: 'Filled' })
                .eq('id', application.opportunity_id);
        }
        
        return data;
    },

    async addApplicationTimelineEntry(applicationId, status, description) {
        const { error } = await supabase
            .from('application_timeline')
            .insert({
                application_id: applicationId,
                status: status,
                title: status,
                description: description
            });
        
        if (error) console.error('Timeline entry error:', error);
    },

    async addApplicationNote(applicationId, note, isInternal = true) {
        const session = await this.checkAuth();
        if (!session) throw new Error('Not authenticated');
        
        const { data, error } = await supabase
            .from('application_notes')
            .insert({
                application_id: applicationId,
                author_id: session.user.id,
                note: note,
                is_internal: isInternal
            })
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    // ===========================================
    // SAVED SPEAKERS
    // ===========================================
    
    async getSavedSpeakers() {
        const session = await this.checkAuth();
        if (!session) throw new Error('Not authenticated');
        
        // Get user's organization
        const { data: orgMember } = await supabase
            .from('organization_members')
            .select('organization_id')
            .eq('member_id', session.user.id)
            .single();
        
        if (!orgMember) return [];
        
        // Try with created_at first, fallback to without if it fails
        let { data, error } = await supabase
            .from('saved_speakers')
            .select(`
                *,
                speaker:members!saved_speakers_speaker_id_fkey(*)
            `)
            .eq('organization_id', orgMember.organization_id)
            .order('created_at', { ascending: false });
        
        // If error is about created_at column, try without ordering
        if (error && error.message.includes('created_at does not exist')) {
            const result = await supabase
                .from('saved_speakers')
                .select(`
                    *,
                    speaker:members!saved_speakers_speaker_id_fkey(*)
                `)
                .eq('organization_id', orgMember.organization_id);
            
            data = result.data;
            error = result.error;
        }
        
        if (error) throw error;
        return data || [];
    },

    async saveSpeaker(speakerId, notes = '') {
        const session = await this.checkAuth();
        if (!session) throw new Error('Not authenticated');
        
        // Get user's organization
        const { data: orgMember } = await supabase
            .from('organization_members')
            .select('organization_id')
            .eq('member_id', session.user.id)
            .single();
        
        if (!orgMember) throw new Error('No organization found');
        
        const { data, error } = await supabase
            .from('saved_speakers')
            .insert({
                organization_id: orgMember.organization_id,
                speaker_id: speakerId,
                notes: notes
            })
            .select()
            .single();
        
        if (error) {
            // Check if already saved
            if (error.code === '23505') {
                throw new Error('Speaker already saved');
            }
            throw error;
        }
        
        // Track activity
        await this.trackSpeakerSaved(speakerId, notes);
        
        return data;
    },

    async updateSavedSpeakerNotes(speakerId, notes) {
        const session = await this.checkAuth();
        if (!session) throw new Error('Not authenticated');
        
        // Get user's organization
        const { data: orgMember } = await supabase
            .from('organization_members')
            .select('organization_id')
            .eq('member_id', session.user.id)
            .single();
        
        const { data, error } = await supabase
            .from('saved_speakers')
            .update({ 
                notes: notes,
                updated_at: new Date().toISOString()
            })
            .eq('organization_id', orgMember.organization_id)
            .eq('speaker_id', speakerId)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    async removeSavedSpeaker(speakerId) {
        const session = await this.checkAuth();
        if (!session) throw new Error('Not authenticated');
        
        // Get user's organization
        const { data: orgMember } = await supabase
            .from('organization_members')
            .select('organization_id')
            .eq('member_id', session.user.id)
            .single();
        
        const { error } = await supabase
            .from('saved_speakers')
            .delete()
            .eq('organization_id', orgMember.organization_id)
            .eq('speaker_id', speakerId);
        
        if (error) throw error;
    },

    async checkIfSpeakerSaved(speakerId) {
        const session = await this.checkAuth();
        if (!session) return false;
        
        // Get user's organization
        const { data: orgMember } = await supabase
            .from('organization_members')
            .select('organization_id')
            .eq('member_id', session.user.id)
            .single();
        
        if (!orgMember) return false;
        
        const { data } = await supabase
            .from('saved_speakers')
            .select('id')
            .eq('organization_id', orgMember.organization_id)
            .eq('speaker_id', speakerId)
            .single();
        
        return !!data;
    },

    // ===========================================
    // REVIEWS
    // ===========================================
    
    async getReviews(speakerId) {
        const { data, error } = await supabase
            .from('reviews')
            .select(`
                *,
                organization:organizations(*)
            `)
            .eq('speaker_id', speakerId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
    },

    async postReview(reviewData) {
        const session = await this.checkAuth();
        if (!session) throw new Error('Not authenticated');
        
        // Get user's organization
        const { data: orgMember } = await supabase
            .from('organization_members')
            .select('organization_id')
            .eq('member_id', session.user.id)
            .single();
        
        if (!orgMember) throw new Error('No organization found');
        
        const { data, error } = await supabase
            .from('reviews')
            .insert({
                ...reviewData,
                organization_id: orgMember.organization_id
            })
            .select()
            .single();
        
        if (error) throw error;
        
        // Track activity
        await this.trackReviewPosted(data.id, reviewData.speaker_id, reviewData.rating);
        
        // Update speaker's average rating
        await this.updateSpeakerRating(reviewData.speaker_id);
        
        return data;
    },

    async updateSpeakerRating(speakerId) {
        const { data: reviews } = await supabase
            .from('reviews')
            .select('rating')
            .eq('speaker_id', speakerId);
        
        if (reviews && reviews.length > 0) {
            const average = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
            
            await supabase
                .from('members')
                .update({
                    average_rating: Math.round(average * 10) / 10,
                    total_reviews: reviews.length
                })
                .eq('id', speakerId);
        }
    },

    async canReviewSpeaker(speakerId) {
        const session = await this.checkAuth();
        if (!session) return false;
        
        // Check if there's an accepted application between org and speaker
        const { data } = await supabase
            .from('applications')
            .select(`
                id,
                opportunity:speaking_opportunities!inner(posted_by)
            `)
            .eq('speaker_id', speakerId)
            .eq('status', 'Accepted')
            .eq('opportunity.posted_by', session.user.id)
            .single();
        
        return !!data;
    },

    // ===========================================
    // MESSAGES
    // ===========================================
    
    async sendMessage(recipientId, subject, message, opportunityId = null) {
        const session = await this.checkAuth();
        if (!session) throw new Error('Not authenticated');
        
        const { data, error } = await supabase
            .from('messages')
            .insert({
                sender_id: session.user.id,
                recipient_id: recipientId,
                subject: subject,
                message: message,
                opportunity_id: opportunityId
            })
            .select()
            .single();
        
        if (error) throw error;
        
        // Track activity
        await this.trackMessageSent(data.id, recipientId, subject);
        
        // Trigger email notification
        try {
            await supabase.functions.invoke('send-message-email', {
                body: { message_id: data.id }
            });
        } catch (err) {
            console.error('Email notification failed:', err);
        }
        
        return data;
    },

    async replyToMessage(originalMessageId, message) {
        const { data: original } = await supabase
            .from('messages')
            .select('sender_id, subject, thread_id')
            .eq('id', originalMessageId)
            .single();
        
        const session = await this.checkAuth();
        
        const threadId = original.thread_id || originalMessageId;
        
        const { data, error } = await supabase
            .from('messages')
            .insert({
                sender_id: session.user.id,
                recipient_id: original.sender_id,
                subject: `Re: ${original.subject}`,
                message: message,
                parent_message_id: originalMessageId,
                thread_id: threadId
            })
            .select()
            .single();
        
        if (error) throw error;
        
        // Track activity
        await this.trackMessageSent(data.id, original.sender_id, `Re: ${original.subject}`);
        
        return data;
    },

    async getInbox(filter = 'all') {
        const session = await this.checkAuth();
        if (!session) throw new Error('Not authenticated');
        
        let query = supabase
            .from('messages')
            .select(`
                *,
                sender:members!messages_sender_id_fkey(name, email, profile_image_url),
                opportunity:speaking_opportunities(title)
            `)
            .eq('recipient_id', session.user.id)
            .order('created_at', { ascending: false });
        
        if (filter === 'unread') {
            query = query.eq('status', 'unread');
        } else if (filter === 'archived') {
            query = query.eq('status', 'archived');
        }
        
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    async getSentMessages() {
        const session = await this.checkAuth();
        if (!session) throw new Error('Not authenticated');
        
        const { data, error } = await supabase
            .from('messages')
            .select(`
                *,
                recipient:members!messages_recipient_id_fkey(name, email, profile_image_url),
                opportunity:speaking_opportunities(title)
            `)
            .eq('sender_id', session.user.id)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
    },

    async getMessageThread(threadId) {
        const { data, error } = await supabase
            .from('messages')
            .select(`
                *,
                sender:members!messages_sender_id_fkey(name, email, profile_image_url)
            `)
            .or(`thread_id.eq.${threadId},id.eq.${threadId}`)
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        return data || [];
    },

    async markMessageRead(messageId) {
        const { error } = await supabase
            .from('messages')
            .update({ 
                status: 'read',
                read_at: new Date().toISOString()
            })
            .eq('id', messageId);
        
        if (error) throw error;
    },

    async markAllMessagesRead() {
        const session = await this.checkAuth();
        if (!session) throw new Error('Not authenticated');
        
        const { error } = await supabase
            .from('messages')
            .update({ 
                status: 'read',
                read_at: new Date().toISOString()
            })
            .eq('recipient_id', session.user.id)
            .eq('status', 'unread');
        
        if (error) throw error;
    },

    async archiveMessage(messageId) {
        const { error } = await supabase
            .from('messages')
            .update({ status: 'archived' })
            .eq('id', messageId);
        
        if (error) throw error;
    },

    async deleteMessage(messageId) {
        const { error } = await supabase
            .from('messages')
            .delete()
            .eq('id', messageId);
        
        if (error) throw error;
    },

    async getUnreadMessageCount() {
        const session = await this.checkAuth();
        if (!session) return 0;
        
        const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('recipient_id', session.user.id)
            .eq('status', 'unread');
        
        return count || 0;
    },

    // ===========================================
    // BOOKINGS
    // ===========================================
    
    async getUpcomingBookings(speakerId) {
        const { data, error } = await supabase
            .from('applications')
            .select(`
                *,
                opportunity:speaking_opportunities(*)
            `)
            .eq('speaker_id', speakerId)
            .eq('status', 'Accepted')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        // Filter for upcoming events
        const now = new Date();
        const upcoming = (data || []).filter(app => 
            app.opportunity?.event_date && 
            new Date(app.opportunity.event_date) > now
        );
        
        return upcoming;
    },

    async getPastBookings(speakerId) {
        const { data, error } = await supabase
            .from('applications')
            .select(`
                *,
                opportunity:speaking_opportunities(*)
            `)
            .eq('speaker_id', speakerId)
            .eq('status', 'Accepted')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        // Filter for past events and get reviews separately
        const now = new Date();
        const past = (data || []).filter(app => 
            app.opportunity?.event_date && 
            new Date(app.opportunity.event_date) < now
        );
        
        // Get reviews for past bookings
        for (const booking of past) {
            const { data: review } = await supabase
                .from('reviews')
                .select('*')
                .eq('speaker_id', speakerId)
                .eq('opportunity_id', booking.opportunity?.id)
                .single();
            
            booking.review = review;
        }
        
        return past;
    },

    async getBookingDetails(bookingId) {
        const { data, error } = await supabase
            .from('applications')
            .select(`
                *,
                opportunity:speaking_opportunities(*)
            `)
            .eq('id', bookingId)
            .eq('status', 'Accepted')
            .single();
        
        if (error) throw error;
        
        // Get organization details if opportunity exists
        if (data?.opportunity?.organization_id) {
            const { data: org } = await supabase
                .from('organizations')
                .select('*')
                .eq('id', data.opportunity.organization_id)
                .single();
            
            data.organization = org;
        }
        
        // Get related messages if needed
        if (data?.opportunity?.id) {
            const { data: messages } = await supabase
                .from('messages')
                .select('*')
                .eq('opportunity_id', data.opportunity.id)
                .order('created_at', { ascending: false });
            
            data.messages = messages || [];
        }
        
        return data;
    },

    // ===========================================
    // ORGANIZATIONS
    // ===========================================
    
    async getOrganization(organizationId) {
        const { data, error } = await supabase
            .from('organizations')
            .select(`
                *,
                members:organization_members(
                    member:members(*)
                )
            `)
            .eq('id', organizationId)
            .single();
        
        if (error) throw error;
        return data;
    },

    async createOrganization(orgData) {
        const session = await this.checkAuth();
        if (!session) throw new Error('Not authenticated');
        
        // Create organization
        const { data: org, error: orgError } = await supabase
            .from('organizations')
            .insert(orgData)
            .select()
            .single();
        
        if (orgError) throw orgError;
        
        // Add current user as owner
        const { error: memberError } = await supabase
            .from('organization_members')
            .insert({
                organization_id: org.id,
                member_id: session.user.id,
                role: 'Owner'
            });
        
        if (memberError) throw memberError;
        
        return org;
    },

    async updateOrganization(organizationId, updates) {
        const { data, error } = await supabase
            .from('organizations')
            .update(updates)
            .eq('id', organizationId)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    async addOrganizationMember(organizationId, memberId, role = 'Member') {
        const { data, error } = await supabase
            .from('organization_members')
            .insert({
                organization_id: organizationId,
                member_id: memberId,
                role: role
            })
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    async removeOrganizationMember(organizationId, memberId) {
        const { error } = await supabase
            .from('organization_members')
            .delete()
            .eq('organization_id', organizationId)
            .eq('member_id', memberId);
        
        if (error) throw error;
    },

    async getMyOrganization() {
        const session = await this.checkAuth();
        if (!session) return null;
        
        const { data } = await supabase
            .from('organization_members')
            .select(`
                organization:organizations(*)
            `)
            .eq('member_id', session.user.id)
            .single();
        
        return data?.organization;
    },

    // ===========================================
    // SUBSCRIPTION
    // ===========================================
    
    async getSubscriptionStatus(userId) {
        const { data, error } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('member_id', userId)
            .eq('status', 'Active')
            .single();
        
        if (error && error.code !== 'PGRST116') throw error; // Ignore not found
        return data;
    },

    async createCheckoutSession(priceId) {
        const session = await this.checkAuth();
        if (!session) throw new Error('Not authenticated');
        
        const { data, error } = await supabase.functions.invoke('create-checkout-session', {
            body: { 
                priceId: priceId,
                userId: session.user.id
            }
        });
        
        if (error) throw error;
        return data;
    },

    async createPortalSession() {
        const session = await this.checkAuth();
        if (!session) throw new Error('Not authenticated');
        
        const { data, error } = await supabase.functions.invoke('create-portal-session', {
            body: { userId: session.user.id }
        });
        
        if (error) throw error;
        return data;
    },

    async cancelSubscription() {
        const session = await this.checkAuth();
        if (!session) throw new Error('Not authenticated');
        
        const { data, error } = await supabase.functions.invoke('cancel-subscription', {
            body: { userId: session.user.id }
        });
        
        if (error) throw error;
        return data;
    },

    // ===========================================
    // FILE UPLOAD
    // ===========================================
    
    async uploadProfileImage(file) {
        const session = await this.checkAuth();
        if (!session) throw new Error('Not authenticated');
        
        // Validate file
        if (!file.type.startsWith('image/')) {
            throw new Error('File must be an image');
        }
        
        if (file.size > 5 * 1024 * 1024) {
            throw new Error('Image must be less than 5MB');
        }
        
        const fileName = `members/${session.user.id}-${Date.now()}.jpg`;
        
        const { data, error } = await supabase.storage
            .from('avatars')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: true
            });
        
        if (error) throw error;
        
        const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);
        
        await this.updateProfile({ profile_image_url: publicUrl });
        
        return { url: publicUrl };
    },

    async deleteProfileImage() {
        const session = await this.checkAuth();
        if (!session) throw new Error('Not authenticated');
        
        const user = await this.getCurrentUser();
        if (user?.profile_image_url) {
            // Extract filename from URL
            const urlParts = user.profile_image_url.split('/');
            const fileName = urlParts[urlParts.length - 1];
            
            await supabase.storage
                .from('avatars')
                .remove([`members/${fileName}`]);
            
            await this.updateProfile({ profile_image_url: null });
        }
    },

    async uploadOrganizationLogo(file, organizationId) {
        const session = await this.checkAuth();
        if (!session) throw new Error('Not authenticated');
        
        // Validate file
        if (!file.type.startsWith('image/')) {
            throw new Error('File must be an image');
        }
        
        if (file.size > 5 * 1024 * 1024) {
            throw new Error('Image must be less than 5MB');
        }
        
        const fileName = `organizations/${organizationId}-${Date.now()}.jpg`;
        
        const { data, error } = await supabase.storage
            .from('avatars')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: true
            });
        
        if (error) throw error;
        
        const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);
        
        await this.updateOrganization(organizationId, { logo_url: publicUrl });
        
        return { url: publicUrl };
    },

    // ===========================================
    // EXPORT
    // ===========================================
    
    async exportSavedSpeakers(format = 'csv') {
        const speakers = await this.getSavedSpeakers();
        
        if (format === 'csv') {
            const headers = ['Name', 'Email', 'Location', 'Specialties', 'Rating', 'Website', 'Notes'];
            const rows = speakers.map(s => [
                s.speaker.name || '',
                s.speaker.email || '',
                s.speaker.location || '',
                (s.speaker.specialties || []).join('; '),
                s.speaker.average_rating || '0',
                s.speaker.website || '',
                s.notes || ''
            ]);
            
            const csv = [
                headers.join(','),
                ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
            ].join('\n');
            
            return {
                data: csv,
                mimeType: 'text/csv',
                filename: `saved_speakers_${new Date().toISOString().split('T')[0]}.csv`
            };
        }
        
        if (format === 'json') {
            const data = speakers.map(s => ({
                name: s.speaker.name,
                email: s.speaker.email,
                location: s.speaker.location,
                specialties: s.speaker.specialties,
                rating: s.speaker.average_rating,
                website: s.speaker.website,
                notes: s.notes
            }));
            
            return {
                data: JSON.stringify(data, null, 2),
                mimeType: 'application/json',
                filename: `saved_speakers_${new Date().toISOString().split('T')[0]}.json`
            };
        }
        
        throw new Error('Unsupported format');
    },

    async exportApplications(format = 'csv') {
        const applications = await this.getApplications((await this.checkAuth()).user.id);
        
        if (format === 'csv') {
            const headers = ['Opportunity', 'Organization', 'Status', 'Date Applied', 'Event Date', 'Location'];
            const rows = applications.map(a => [
                a.opportunity?.title || '',
                a.opportunity?.organization?.name || '',
                a.status || '',
                new Date(a.created_at).toLocaleDateString(),
                a.opportunity?.event_date ? new Date(a.opportunity.event_date).toLocaleDateString() : '',
                a.opportunity?.location || ''
            ]);
            
            const csv = [
                headers.join(','),
                ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
            ].join('\n');
            
            return {
                data: csv,
                mimeType: 'text/csv',
                filename: `applications_${new Date().toISOString().split('T')[0]}.csv`
            };
        }
        
        throw new Error('Unsupported format');
    },

    // ===========================================
    // NOTIFICATIONS & PREFERENCES
    // ===========================================
    
    async getNotificationPreferences() {
        const session = await this.checkAuth();
        if (!session) throw new Error('Not authenticated');
        
        const user = await this.getMemberProfile(session.user.id);
        return user?.notification_preferences || {
            email_notifications: true,
            opportunity_notifications: true,
            application_notifications: true,
            message_notifications: true,
            review_notifications: true,
            marketing_emails: false
        };
    },

    async updateNotificationPreferences(preferences) {
        const session = await this.checkAuth();
        if (!session) throw new Error('Not authenticated');
        
        const { data, error } = await supabase
            .from('members')
            .update({ notification_preferences: preferences })
            .eq('id', session.user.id)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    async getPrivacySettings() {
        const session = await this.checkAuth();
        if (!session) throw new Error('Not authenticated');
        
        const user = await this.getMemberProfile(session.user.id);
        return user?.privacy_settings || {
            public_profile: true,
            show_contact: true,
            show_fees: false,
            show_calendar: false
        };
    },

    async updatePrivacySettings(settings) {
        const session = await this.checkAuth();
        if (!session) throw new Error('Not authenticated');
        
        const { data, error } = await supabase
            .from('members')
            .update({ privacy_settings: settings })
            .eq('id', session.user.id)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    // ===========================================
    // CALENDAR & AVAILABILITY
    // ===========================================
    
    async getAvailability(speakerId, month, year) {
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0);
        
        const { data, error } = await supabase
            .from('speaker_availability')
            .select('*')
            .eq('speaker_id', speakerId)
            .gte('date', startDate.toISOString())
            .lte('date', endDate.toISOString())
            .order('date');
        
        if (error) throw error;
        return data || [];
    },

    async updateAvailability(dates, available = true) {
        const session = await this.checkAuth();
        if (!session) throw new Error('Not authenticated');
        
        const updates = dates.map(date => ({
            speaker_id: session.user.id,
            date: date,
            available: available
        }));
        
        const { data, error } = await supabase
            .from('speaker_availability')
            .upsert(updates, { onConflict: 'speaker_id,date' })
            .select();
        
        if (error) throw error;
        return data;
    },

    async getBookingCalendar(speakerId) {
        const { data, error } = await supabase
            .from('applications')
            .select(`
                *,
                opportunity:speaking_opportunities(
                    title,
                    event_date,
                    location,
                    event_format
                )
            `)
            .eq('speaker_id', speakerId)
            .eq('status', 'Accepted')
            .gte('opportunity.event_date', new Date().toISOString())
            .order('opportunity.event_date');
        
        if (error) throw error;
        return data || [];
    },

    // ===========================================
    // SEARCH & FILTERS (Extended)
    // ===========================================
    
    async searchEverything(query) {
        const results = {
            speakers: [],
            opportunities: [],
            organizations: []
        };
        
        // Search speakers
        const { data: speakers } = await supabase
            .from('members')
            .select('*')
            .eq('member_type', 'Speaker')
            .or(`name.ilike.%${query}%,bio.ilike.%${query}%,location.ilike.%${query}%`)
            .limit(10);
        
        results.speakers = speakers || [];
        
        // Search opportunities
        const { data: opportunities } = await supabase
            .from('speaking_opportunities')
            .select(`
                *,
                organization:organizations(name)
            `)
            .eq('status', 'Open')
            .or(`title.ilike.%${query}%,description.ilike.%${query}%,location.ilike.%${query}%`)
            .limit(10);
        
        results.opportunities = opportunities || [];
        
        // Search organizations
        const { data: organizations } = await supabase
            .from('organizations')
            .select('*')
            .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
            .limit(10);
        
        results.organizations = organizations || [];
        
        return results;
    },

    async getTopSpeakers(limit = 10, category = null) {
        let query = supabase
            .from('members')
            .select(`
                *,
                reviews(count),
                applications!applications_speaker_id_fkey(count)
            `)
            .eq('member_type', 'Speaker')
            .gte('average_rating', 4.0)
            .order('average_rating', { ascending: false })
            .order('total_reviews', { ascending: false })
            .limit(limit);
        
        if (category) {
            query = query.contains('specialties', [category]);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    async getTrendingTopics(days = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        const { data, error } = await supabase
            .from('speaking_opportunities')
            .select('topics')
            .gte('created_at', startDate.toISOString());
        
        if (error) throw error;
        
        // Count topic frequency
        const topicCounts = {};
        (data || []).forEach(opp => {
            (opp.topics || []).forEach(topic => {
                topicCounts[topic] = (topicCounts[topic] || 0) + 1;
            });
        });
        
        // Sort by count
        return Object.entries(topicCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([topic, count]) => ({ topic, count }));
    },

    // ===========================================
    // RECOMMENDATIONS
    // ===========================================
    
    async getRecommendedSpeakers(opportunityId) {
        const { data: opportunity } = await supabase
            .from('speaking_opportunities')
            .select('topics, location, event_format')
            .eq('id', opportunityId)
            .single();
        
        if (!opportunity) return [];
        
        let query = supabase
            .from('members')
            .select(`
                *,
                reviews(rating)
            `)
            .eq('member_type', 'Speaker')
            .gte('average_rating', 4.0);
        
        // Match topics
        if (opportunity.topics && opportunity.topics.length > 0) {
            query = query.overlaps('specialties', opportunity.topics);
        }
        
        // Consider location for in-person events
        if (opportunity.event_format === 'In-Person' && opportunity.location) {
            query = query.or(`location.ilike.%${opportunity.location.split(',')[0]}%,willing_to_travel.eq.true`);
        }
        
        const { data, error } = await query.limit(10);
        if (error) throw error;
        return data || [];
    },

    async getRecommendedOpportunities(speakerId) {
        const speaker = await this.getMemberProfile(speakerId);
        if (!speaker) return [];
        
        let query = supabase
            .from('speaking_opportunities')
            .select(`
                *,
                organization:organizations(name),
                applications(count)
            `)
            .eq('status', 'Open')
            .gte('application_deadline', new Date().toISOString());
        
        // Match specialties
        if (speaker.specialties && speaker.specialties.length > 0) {
            query = query.overlaps('topics', speaker.specialties);
        }
        
        // Consider location
        if (speaker.location) {
            query = query.or(`location.ilike.%${speaker.location.split(',')[0]}%,event_format.eq.Virtual`);
        }
        
        // Consider fee range
        if (speaker.speaking_fee_range) {
            query = query.gte('compensation_amount', speaker.speaking_fee_range.min);
        }
        
        const { data, error } = await query.limit(10);
        if (error) throw error;
        return data || [];
    },

    // ===========================================
    // ADMIN FUNCTIONS
    // ===========================================
    
    async isAdmin() {
        const session = await this.checkAuth();
        if (!session) return false;
        
        const user = await this.getMemberProfile(session.user.id);
        return user?.is_admin === true;
    },

    async getAdminStats() {
        if (!await this.isAdmin()) throw new Error('Unauthorized');
        
        const stats = {};
        
        // User counts
        const { count: totalUsers } = await supabase
            .from('members')
            .select('*', { count: 'exact', head: true });
        
        const { count: speakers } = await supabase
            .from('members')
            .select('*', { count: 'exact', head: true })
            .eq('member_type', 'Speaker');
        
        const { count: organizations } = await supabase
            .from('members')
            .select('*', { count: 'exact', head: true })
            .eq('member_type', 'Organization');
        
        // Activity stats
        const { count: opportunities } = await supabase
            .from('speaking_opportunities')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'Open');
        
        const { count: applications } = await supabase
            .from('applications')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
        
        const { count: activeSubscriptions } = await supabase
            .from('subscriptions')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'Active');
        
        stats.totalUsers = totalUsers || 0;
        stats.speakers = speakers || 0;
        stats.organizations = organizations || 0;
        stats.opportunities = opportunities || 0;
        stats.recentApplications = applications || 0;
        stats.activeSubscriptions = activeSubscriptions || 0;
        
        return stats;
    },

    async flagContent(contentType, contentId, reason) {
        const session = await this.checkAuth();
        if (!session) throw new Error('Not authenticated');
        
        const { data, error } = await supabase
            .from('flagged_content')
            .insert({
                content_type: contentType,
                content_id: contentId,
                flagged_by: session.user.id,
                reason: reason
            })
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    // ===========================================
    // REAL-TIME SUBSCRIPTIONS
    // ===========================================
    
    subscribeToMessages(callback) {
        const session = this.checkAuth();
        if (!session) return null;
        
        return supabase
            .channel('messages')
            .on('postgres_changes', 
                { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'messages',
                    filter: `recipient_id=eq.${session.user.id}`
                },
                callback
            )
            .subscribe();
    },

    subscribeToApplications(opportunityId, callback) {
        return supabase
            .channel(`applications-${opportunityId}`)
            .on('postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'applications',
                    filter: `opportunity_id=eq.${opportunityId}`
                },
                callback
            )
            .subscribe();
    },

    subscribeToActivity(userId, callback) {
        return supabase
            .channel(`activity-${userId}`)
            .on('postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'activity',
                    filter: `target_id=eq.${userId}`
                },
                callback
            )
            .subscribe();
    },

    unsubscribe(channel) {
        if (channel) {
            supabase.removeChannel(channel);
        }
    },

    // ===========================================
    // PAYMENT & INVOICING
    // ===========================================
    
    async getInvoices() {
        const session = await this.checkAuth();
        if (!session) throw new Error('Not authenticated');
        
        const { data, error } = await supabase
            .from('invoices')
            .select('*')
            .eq('member_id', session.user.id)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
    },

    async downloadInvoice(invoiceId) {
        const { data, error } = await supabase.functions.invoke('generate-invoice', {
            body: { invoiceId }
        });
        
        if (error) throw error;
        return data;
    },

    async getPaymentMethods() {
        const session = await this.checkAuth();
        if (!session) throw new Error('Not authenticated');
        
        const { data, error } = await supabase.functions.invoke('get-payment-methods', {
            body: { userId: session.user.id }
        });
        
        if (error) throw error;
        return data;
    },

    async addPaymentMethod(paymentMethodId) {
        const session = await this.checkAuth();
        if (!session) throw new Error('Not authenticated');
        
        const { data, error } = await supabase.functions.invoke('add-payment-method', {
            body: { 
                userId: session.user.id,
                paymentMethodId 
            }
        });
        
        if (error) throw error;
        return data;
    },

    async removePaymentMethod(paymentMethodId) {
        const { data, error } = await supabase.functions.invoke('remove-payment-method', {
            body: { paymentMethodId }
        });
        
        if (error) throw error;
        return data;
    },

    // ===========================================
    // UTILITY FUNCTIONS
    // ===========================================
    
    async checkEmailExists(email) {
        const { data } = await supabase
            .from('members')
            .select('id')
            .eq('email', email)
            .single();
        
        return !!data;
    },

    async validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    async validatePassword(password) {
        return {
            isValid: password.length >= 8,
            hasUpperCase: /[A-Z]/.test(password),
            hasLowerCase: /[a-z]/.test(password),
            hasNumber: /[0-9]/.test(password),
            hasSpecialChar: /[!@#$%^&*]/.test(password),
            length: password.length
        };
    },

    async validatePhone(phone) {
        const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
        return phoneRegex.test(phone);
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    },

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    },

    formatTime(dateString) {
        return new Date(dateString).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    },

    formatTimeAgo(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            if (diffHours === 0) {
                const diffMinutes = Math.floor(diffMs / (1000 * 60));
                if (diffMinutes === 0) return 'just now';
                return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
            }
            return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        }
        if (diffDays === 1) return 'yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) > 1 ? 's' : ''} ago`;
        return `${Math.floor(diffDays / 365)} year${Math.floor(diffDays / 365) > 1 ? 's' : ''} ago`;
    },

    sanitizeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text ? text.replace(/[&<>"']/g, m => map[m]) : '';
    },

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },

    // ===========================================
    // ERROR HANDLING
    // ===========================================
    
    handleError(error) {
        console.error('[CoveTalks Error]:', error);
        
        // Parse Supabase errors
        if (error.code === '23505') {
            return { message: 'This record already exists', code: 'DUPLICATE' };
        }
        if (error.code === '23503') {
            return { message: 'Referenced record not found', code: 'REFERENCE_ERROR' };
        }
        if (error.code === '42501') {
            return { message: 'Insufficient permissions', code: 'PERMISSION_DENIED' };
        }
        if (error.code === 'PGRST116') {
            return { message: 'Record not found', code: 'NOT_FOUND' };
        }
        if (error.message?.includes('JWT')) {
            return { message: 'Authentication required', code: 'AUTH_REQUIRED' };
        }
        
        return { 
            message: error.message || 'An unexpected error occurred', 
            code: error.code || 'UNKNOWN_ERROR' 
        };
    },

    async retryOperation(operation, maxRetries = 3, delay = 1000) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await operation();
            } catch (error) {
                if (i === maxRetries - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
            }
        }
    },

    // ===========================================
    // CACHE MANAGEMENT
    // ===========================================
    
    cache: new Map(),
    cacheTimeout: 5 * 60 * 1000, // 5 minutes

    getCached(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }
        this.cache.delete(key);
        return null;
    },

    setCached(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
        
        // Limit cache size
        if (this.cache.size > 100) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
    },

    clearCache() {
        this.cache.clear();
    },

    // ===========================================
    // PAGINATION HELPERS
    // ===========================================
    
    async paginateQuery(query, page = 1, pageSize = 20) {
        const start = (page - 1) * pageSize;
        const end = start + pageSize - 1;
        
        const { data, error, count } = await query
            .range(start, end)
            .select('*', { count: 'exact' });
        
        if (error) throw error;
        
        return {
            data: data || [],
            page,
            pageSize,
            totalCount: count || 0,
            totalPages: Math.ceil((count || 0) / pageSize),
            hasMore: end < (count || 0) - 1
        };
    },

    // ===========================================
    // BATCH OPERATIONS
    // ===========================================
    
    async batchInsert(table, records, chunkSize = 100) {
        const results = [];
        
        for (let i = 0; i < records.length; i += chunkSize) {
            const chunk = records.slice(i, i + chunkSize);
            const { data, error } = await supabase
                .from(table)
                .insert(chunk)
                .select();
            
            if (error) throw error;
            results.push(...(data || []));
        }
        
        return results;
    },

    async batchUpdate(table, updates, chunkSize = 100) {
        const results = [];
        
        for (let i = 0; i < updates.length; i += chunkSize) {
            const chunk = updates.slice(i, i + chunkSize);
            
            for (const update of chunk) {
                const { id, ...data } = update;
                const { data: result, error } = await supabase
                    .from(table)
                    .update(data)
                    .eq('id', id)
                    .select()
                    .single();
                
                if (error) throw error;
                results.push(result);
            }
        }
        
        return results;
    },

    async batchDelete(table, ids, chunkSize = 100) {
        for (let i = 0; i < ids.length; i += chunkSize) {
            const chunk = ids.slice(i, i + chunkSize);
            const { error } = await supabase
                .from(table)
                .delete()
                .in('id', chunk);
            
            if (error) throw error;
        }
    },

    // ===========================================
    // FEATURE FLAGS
    // ===========================================
    
    featureFlags: {
        newDashboard: true,
        advancedSearch: true,
        videoUploads: false,
        aiRecommendations: false,
        liveStreaming: false
    },

    isFeatureEnabled(feature) {
        return this.featureFlags[feature] || false;
    },

    async getFeatureFlags() {
        try {
            const { data } = await supabase
                .from('feature_flags')
                .select('*')
                .eq('enabled', true);
            
            if (data) {
                data.forEach(flag => {
                    this.featureFlags[flag.name] = true;
                });
            }
        } catch (error) {
            console.error('Failed to load feature flags:', error);
        }
        
        return this.featureFlags;
    },

    // ===========================================
    // LOGGING & ANALYTICS
    // ===========================================
    
    async logEvent(eventName, properties = {}) {
        try {
            const session = await this.checkAuth();
            
            await supabase
                .from('analytics_events')
                .insert({
                    event_name: eventName,
                    user_id: session?.user?.id,
                    properties,
                    session_id: this.getSessionId(),
                    page_url: window.location.href,
                    referrer: document.referrer,
                    user_agent: navigator.userAgent
                });
        } catch (error) {
            console.error('Analytics error:', error);
        }
    },

    getSessionId() {
        let sessionId = sessionStorage.getItem('covetalks_session_id');
        if (!sessionId) {
            sessionId = this.generateUUID();
            sessionStorage.setItem('covetalks_session_id', sessionId);
        }
        return sessionId;
    },

    async trackPageView(pageName) {
        await this.logEvent('page_view', { page_name: pageName });
    },

    async trackClick(element, label) {
        await this.logEvent('click', { element, label });
    },

    async trackFormSubmit(formName, success = true) {
        await this.logEvent('form_submit', { form_name: formName, success });
    },

    async trackSearch(query, resultCount) {
        await this.logEvent('search', { query, result_count: resultCount });
    },

    async trackError(error, context) {
        await this.logEvent('error', { 
            error_message: error.message,
            error_code: error.code,
            context 
        });
    },

    // ===========================================
    // DATA VALIDATION
    // ===========================================
    
    validateRequired(value, fieldName) {
        if (!value || (typeof value === 'string' && !value.trim())) {
            throw new Error(`${fieldName} is required`);
        }
        return true;
    },

    validateLength(value, min, max, fieldName) {
        if (value.length < min || value.length > max) {
            throw new Error(`${fieldName} must be between ${min} and ${max} characters`);
        }
        return true;
    },

    validateUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    },

    validateDate(date) {
        const d = new Date(date);
        return d instanceof Date && !isNaN(d);
    },

    validateFutureDate(date) {
        const d = new Date(date);
        return this.validateDate(date) && d > new Date();
    },

    sanitizeInput(input) {
        if (typeof input !== 'string') return input;
        
        return input
            .trim()
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
    },

    // ===========================================
    // PERFORMANCE MONITORING
    // ===========================================
    
    performanceMarks: new Map(),

    startPerformanceMark(name) {
        this.performanceMarks.set(name, performance.now());
    },

    endPerformanceMark(name) {
        const start = this.performanceMarks.get(name);
        if (!start) return null;
        
        const duration = performance.now() - start;
        this.performanceMarks.delete(name);
        
        // Log slow operations
        if (duration > 1000) {
            console.warn(`[Performance] ${name} took ${duration.toFixed(2)}ms`);
            this.logEvent('slow_operation', { operation: name, duration });
        }
        
        return duration;
    },

    // ===========================================
    // INITIALIZATION
    // ===========================================
    
    initialized: false,

    async initialize() {
        if (this.initialized) return;
        
        try {
            // Load feature flags
            await this.getFeatureFlags();
            
            // Set up auth listener
            supabase.auth.onAuthStateChange((event, session) => {
                if (event === 'SIGNED_OUT') {
                    this.clearCache();
                    window.location.href = '/';
                }
            });
            
            // Load user preferences if logged in
            const session = await this.checkAuth();
            if (session) {
                await this.loadUserPreferences();
            }
            
            this.initialized = true;
            console.log('[CoveTalks] Initialized successfully');
            
        } catch (error) {
            console.error('[CoveTalks] Initialization failed:', error);
            throw error;
        }
    },

    async loadUserPreferences() {
        try {
            const user = await this.getCurrentUser();
            if (user?.preferences) {
                // Apply theme
                if (user.preferences.theme) {
                    document.body.setAttribute('data-theme', user.preferences.theme);
                }
                // Apply language
                if (user.preferences.language) {
                    document.documentElement.lang = user.preferences.language;
                }
            }
        } catch (error) {
            console.error('Failed to load user preferences:', error);
        }
    },

    // ===========================================
    // NETWORK STATUS
    // ===========================================
    
    isOnline() {
        return navigator.onLine;
    },

    onNetworkChange(callback) {
        window.addEventListener('online', () => callback(true));
        window.addEventListener('offline', () => callback(false));
    },

    async waitForNetwork(timeout = 30000) {
        if (this.isOnline()) return true;
        
        return new Promise((resolve) => {
            const timer = setTimeout(() => resolve(false), timeout);
            
            window.addEventListener('online', () => {
                clearTimeout(timer);
                resolve(true);
            }, { once: true });
        });
    },

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    // ===========================================
    // DEEP LINKING & ROUTING
    // ===========================================
    
    async handleDeepLink(path) {
        const parts = path.split('/').filter(Boolean);
        
        if (parts[0] === 'profile' && parts[1]) {
            window.location.href = `/profile.html?id=${parts[1]}`;
        } else if (parts[0] === 'opportunity' && parts[1]) {
            window.location.href = `/opportunity-details.html?id=${parts[1]}`;
        } else if (parts[0] === 'apply' && parts[1]) {
            const session = await this.checkAuth();
            if (session) {
                window.location.href = `/apply.html?opportunity=${parts[1]}`;
            } else {
                sessionStorage.setItem('redirect_after_login', `/apply.html?opportunity=${parts[1]}`);
                window.location.href = '/login.html';
            }
        }
    },

    getQueryParams() {
        const params = new URLSearchParams(window.location.search);
        const result = {};
        for (const [key, value] of params) {
            result[key] = value;
        }
        return result;
    },

    updateQueryParams(params) {
        const url = new URL(window.location);
        Object.entries(params).forEach(([key, value]) => {
            if (value === null || value === undefined) {
                url.searchParams.delete(key);
            } else {
                url.searchParams.set(key, value);
            }
        });
        window.history.pushState({}, '', url);
    },

    // ===========================================
    // LOCAL STORAGE MANAGEMENT
    // ===========================================
    
    storage: {
        get(key) {
            try {
                const item = localStorage.getItem(`covetalks_${key}`);
                return item ? JSON.parse(item) : null;
            } catch {
                return null;
            }
        },
        
        set(key, value) {
            try {
                localStorage.setItem(`covetalks_${key}`, JSON.stringify(value));
                return true;
            } catch {
                return false;
            }
        },
        
        remove(key) {
            localStorage.removeItem(`covetalks_${key}`);
        },
        
        clear() {
            Object.keys(localStorage)
                .filter(key => key.startsWith('covetalks_'))
                .forEach(key => localStorage.removeItem(key));
        }
    },

    // ===========================================
    // SESSION MANAGEMENT
    // ===========================================
    
    async refreshSession() {
        const { data, error } = await supabase.auth.refreshSession();
        if (error) throw error;
        return data.session;
    },

    async getSessionTimeRemaining() {
        const session = await this.checkAuth();
        if (!session) return 0;
        
        const expiresAt = new Date(session.expires_at * 1000);
        const now = new Date();
        return Math.max(0, expiresAt - now);
    },

    async setupSessionRefresh() {
        // Refresh session 5 minutes before expiry
        const timeRemaining = await this.getSessionTimeRemaining();
        if (timeRemaining > 5 * 60 * 1000) {
            setTimeout(async () => {
                await this.refreshSession();
                this.setupSessionRefresh(); // Schedule next refresh
            }, timeRemaining - 5 * 60 * 1000);
        }
    },

    // ===========================================
    // FORM HELPERS
    // ===========================================
    
    serializeForm(formElement) {
        const formData = new FormData(formElement);
        const data = {};
        
        for (const [key, value] of formData.entries()) {
            if (data[key]) {
                if (!Array.isArray(data[key])) {
                    data[key] = [data[key]];
                }
                data[key].push(value);
            } else {
                data[key] = value;
            }
        }
        
        return data;
    },

    populateForm(formElement, data) {
        Object.entries(data).forEach(([key, value]) => {
            const field = formElement.elements[key];
            if (field) {
                if (field.type === 'checkbox') {
                    field.checked = !!value;
                } else if (field.type === 'radio') {
                    const radio = formElement.querySelector(`input[name="${key}"][value="${value}"]`);
                    if (radio) radio.checked = true;
                } else {
                    field.value = value;
                }
            }
        });
    },

    validateForm(formElement) {
        const errors = {};
        const requiredFields = formElement.querySelectorAll('[required]');
        
        requiredFields.forEach(field => {
            if (!field.value || (field.type === 'checkbox' && !field.checked)) {
                errors[field.name] = `${field.dataset.label || field.name} is required`;
            }
        });
        
        // Email validation
        const emailFields = formElement.querySelectorAll('input[type="email"]');
        emailFields.forEach(field => {
            if (field.value && !this.validateEmail(field.value)) {
                errors[field.name] = 'Invalid email address';
            }
        });
        
        // Phone validation
        const phoneFields = formElement.querySelectorAll('input[type="tel"]');
        phoneFields.forEach(field => {
            if (field.value && !this.validatePhone(field.value)) {
                errors[field.name] = 'Invalid phone number';
            }
        });
        
        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    },

    // ===========================================
    // UI HELPERS
    // ===========================================
    
    showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    showConfirm(message, onConfirm, onCancel) {
        const modal = document.createElement('div');
        modal.className = 'confirm-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        
        modal.innerHTML = `
            <div style="background: white; padding: 2rem; border-radius: 10px; max-width: 400px;">
                <p style="margin-bottom: 1.5rem;">${message}</p>
                <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                    <button id="confirmCancel" style="padding: 0.5rem 1rem; border: 1px solid #ccc; border-radius: 5px; cursor: pointer;">
                        Cancel
                    </button>
                    <button id="confirmOk" style="padding: 0.5rem 1rem; background: #2196F3; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        Confirm
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('confirmOk').onclick = () => {
            modal.remove();
            if (onConfirm) onConfirm();
        };
        
        document.getElementById('confirmCancel').onclick = () => {
            modal.remove();
            if (onCancel) onCancel();
        };
    },

    showLoading(show = true) {
        const existingLoader = document.getElementById('globalLoader');
        
        if (show && !existingLoader) {
            const loader = document.createElement('div');
            loader.id = 'globalLoader';
            loader.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(255,255,255,0.9);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
            `;
            loader.innerHTML = `
                <div style="text-align: center;">
                    <div class="spinner" style="
                        border: 4px solid #f3f3f3;
                        border-top: 4px solid #3498db;
                        border-radius: 50%;
                        width: 40px;
                        height: 40px;
                        animation: spin 1s linear infinite;
                        margin: 0 auto 1rem;
                    "></div>
                    <p>Loading...</p>
                </div>
            `;
            document.body.appendChild(loader);
        } else if (!show && existingLoader) {
            existingLoader.remove();
        }
    },

    // ===========================================
    // SEO & META TAGS
    // ===========================================
    
    updateMetaTags(data) {
        // Title
        if (data.title) {
            document.title = `${data.title} - CoveTalks`;
        }
        
        // Description
        if (data.description) {
            let metaDesc = document.querySelector('meta[name="description"]');
            if (!metaDesc) {
                metaDesc = document.createElement('meta');
                metaDesc.name = 'description';
                document.head.appendChild(metaDesc);
            }
            metaDesc.content = data.description;
        }
        
        // Open Graph
        const ogTags = {
            'og:title': data.title,
            'og:description': data.description,
            'og:image': data.image,
            'og:url': window.location.href,
            'og:type': data.type || 'website'
        };
        
        Object.entries(ogTags).forEach(([property, content]) => {
            if (content) {
                let tag = document.querySelector(`meta[property="${property}"]`);
                if (!tag) {
                    tag = document.createElement('meta');
                    tag.setAttribute('property', property);
                    document.head.appendChild(tag);
                }
                tag.content = content;
            }
        });
    },

    generateStructuredData(type, data) {
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        
        let structuredData = {
            '@context': 'https://schema.org',
            '@type': type
        };
        
        if (type === 'Person' && data.speaker) {
            structuredData = {
                ...structuredData,
                name: data.speaker.name,
                description: data.speaker.bio,
                image: data.speaker.profile_image_url,
                jobTitle: data.speaker.title,
                url: `${window.location.origin}/profile.html?id=${data.speaker.id}`
            };
        } else if (type === 'Event' && data.opportunity) {
            structuredData = {
                ...structuredData,
                name: data.opportunity.title,
                description: data.opportunity.description,
                startDate: data.opportunity.event_date,
                location: data.opportunity.location,
                organizer: {
                    '@type': 'Organization',
                    name: data.opportunity.organization?.name
                }
            };
        }
        
        script.textContent = JSON.stringify(structuredData);
        document.head.appendChild(script);
    }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.covetalks;
}