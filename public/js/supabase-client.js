// Supabase Client - Complete Version with All Methods
// No import statement - we'll load Supabase from CDN in HTML

class CoveTalksClient {
    constructor() {
        // Make sure Supabase is loaded from CDN
        if (typeof supabase === 'undefined') {
            console.error('Supabase not loaded! Make sure to include the CDN script.');
            return;
        }
        
        // Initialize Supabase client
        this.supabase = supabase.createClient(
            window.APP_CONFIG.SUPABASE_URL,
            window.APP_CONFIG.SUPABASE_ANON_KEY
        );
        
        console.log('CoveTalks client initialized');
        
        // Check initial auth state
        this.checkAuth();
        
        // Listen for auth changes
        this.supabase.auth.onAuthStateChange((event, session) => {
            console.log('Auth state changed:', event);
            this.handleAuthChange(event, session);
        });
    }
    
    // ============================================
    // AUTHENTICATION
    // ============================================
    
    async checkAuth() {
        try {
            const { data: { session }, error } = await this.supabase.auth.getSession();
            if (error) throw error;
            return session;
        } catch (error) {
            console.error('Auth check failed:', error);
            return null;
        }
    }
    
    async login(email, password) {
        const startTime = performance.now();
        
        try {
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email: email.trim(),
                password: password
            });
            
            const loginTime = performance.now() - startTime;
            console.log(`Login completed in ${Math.round(loginTime)}ms`);
            
            if (error) throw error;
            
            // Fetch member details
            if (data.user) {
                const member = await this.getMemberProfile(data.user.id);
                return { 
                    user: data.user,
                    session: data.session,
                    member: member, 
                    loginTime: loginTime 
                };
            }
            
            return data;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }
    
    async signup(userData) {
    try {
        const { 
            email, 
            password, 
            name,
            memberType,
            ...profileData 
        } = userData;
        
        console.log('Signing up user:', email, memberType);
        
        // Create auth user
        const { data: authData, error: authError } = await this.supabase.auth.signUp({
            email: email.trim(),
            password: password,
            options: {
                data: {
                    name: name,
                    member_type: memberType
                },
                emailRedirectTo: `${window.location.origin}/verify-email.html`
            }
        });
        
        if (authError) throw authError;
        
        console.log('Auth user created:', authData.user?.id);
        
        // Check if we have a session (email verification disabled or not required)
        if (authData.session) {
            // We have a session, proceed normally
            await this.supabase.auth.setSession(authData.session);
            
            if (authData.user) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Update profile
                const { error: updateError } = await this.supabase
                    .from('members')
                    .update({
                        name: name,
                        member_type: memberType,
                        bio: profileData.bio || null,
                        location: profileData.location || null,
                        phone: profileData.phone || null,
                        specialties: profileData.specialties || []
                    })
                    .eq('id', authData.user.id);
                    
                if (updateError) {
                    console.error('Profile update error:', updateError);
                }
                
                // For organizations, create organization record
                if (memberType === 'Organization' && profileData.organizationData) {
                    await this.createOrganization(authData.user.id, profileData.organizationData);
                }
            }
        } else {
            // No session - email verification is required
            console.log('Email verification required');
            // Store the additional data for later
            if (authData.user) {
                // You might want to store this data temporarily
                localStorage.setItem('pendingProfileData', JSON.stringify({
                    userId: authData.user.id,
                    memberType: memberType,
                    profileData: profileData
                }));
            }
        }
        
        return authData;
    } catch (error) {
        console.error('Signup error:', error);
        throw error;
    }
}
    
    async logout() {
        try {
            const { error } = await this.supabase.auth.signOut();
            if (error) throw error;
            window.location.href = '/login.html';
        } catch (error) {
            console.error('Logout error:', error);
        }
    }
    
    // ============================================
    // PROFILE MANAGEMENT
    // ============================================
    
    async getMemberProfile(userId) {
        try {
            const { data, error } = await this.supabase
                .from('members')
                .select('*')
                .eq('id', userId)
                .single();
                
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Get profile error:', error);
            return null;
        }
    }
    
    async getCurrentUser() {
        try {
            const { data: { user } } = await this.supabase.auth.getUser();
            if (!user) return null;
            
            // Get full member profile
            return await this.getMemberProfile(user.id);
        } catch (error) {
            console.error('Get current user error:', error);
            return null;
        }
    }
    
    async updateProfile(updates) {
        try {
            const { data: { user } } = await this.supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');
            
            const { data, error } = await this.supabase
                .from('members')
                .update(updates)
                .eq('id', user.id)
                .select()
                .single();
                
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Update profile error:', error);
            throw error;
        }
    }
    
    // ============================================
    // ORGANIZATION MANAGEMENT
    // ============================================
    
    async createOrganization(userId, orgData) {
        try {
            // Create organization
            const { data: org, error: orgError } = await this.supabase
                .from('organizations')
                .insert({
                    name: orgData.Organization_Name,
                    organization_type: orgData.Organization_Type,
                    website: orgData.website || null,
                    description: orgData.description || null,
                    location: orgData.location || null,
                    preferred_topics: orgData.Speaking_Topics || []
                })
                .select()
                .single();
                
            if (orgError) throw orgError;
            
            // Link user to organization
            const { error: linkError } = await this.supabase
                .from('organization_members')
                .insert({
                    organization_id: org.id,
                    member_id: userId,
                    role: 'Owner'
                });
                
            if (linkError) throw linkError;
            
            return org;
        } catch (error) {
            console.error('Create organization error:', error);
            throw error;
        }
    }
    
    // ============================================
    // DASHBOARD DATA METHODS
    // ============================================
    
    async getSubscriptionStatus(userId) {
        try {
            const targetUserId = userId || (await this.getCurrentUser())?.id;
            if (!targetUserId) return null;
            
            const { data, error } = await this.supabase
                .from('subscriptions')
                .select('*')
                .eq('member_id', targetUserId)
                .eq('status', 'Active')
                .single();
                
            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
                console.error('Get subscription error:', error);
            }
            
            return data || null;
        } catch (error) {
            console.error('Get subscription error:', error);
            return null;
        }
    }
    
    async getRecentActivity(userId, limit = 5) {
        try {
            const targetUserId = userId || (await this.getCurrentUser())?.id;
            if (!targetUserId) return [];
            
            const { data, error } = await this.supabase
                .from('activity')
                .select('*')
                .eq('target_id', targetUserId)
                .order('created_at', { ascending: false })
                .limit(limit);
                
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Get activity error:', error);
            return [];
        }
    }
    
    async getApplications(speakerId) {
        try {
            const targetUserId = speakerId || (await this.getCurrentUser())?.id;
            if (!targetUserId) return [];
            
            const { data, error } = await this.supabase
                .from('applications')
                .select(`
                    *,
                    opportunity:speaking_opportunities(*)
                `)
                .eq('speaker_id', targetUserId)
                .order('created_at', { ascending: false });
                
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Get applications error:', error);
            return [];
        }
    }
    
    async getActiveApplicationsCount(speakerId) {
        try {
            const targetUserId = speakerId || (await this.getCurrentUser())?.id;
            if (!targetUserId) return 0;
            
            const { count, error } = await this.supabase
                .from('applications')
                .select('*', { count: 'exact', head: true })
                .eq('speaker_id', targetUserId)
                .eq('status', 'Pending');
                
            if (error) throw error;
            return count || 0;
        } catch (error) {
            console.error('Get applications count error:', error);
            return 0;
        }
    }
    
    async getUpcomingBookings(speakerId) {
        try {
            const targetUserId = speakerId || (await this.getCurrentUser())?.id;
            if (!targetUserId) return [];
            
            // First get all accepted applications
            const { data: applications, error } = await this.supabase
                .from('applications')
                .select(`
                    *,
                    opportunity:speaking_opportunities(*)
                `)
                .eq('speaker_id', targetUserId)
                .eq('status', 'Accepted')
                .order('created_at', { ascending: false });
                
            if (error) throw error;
            
            // Filter for future events in JavaScript
            const now = new Date();
            const upcomingBookings = (applications || []).filter(app => {
                const eventDate = app.opportunity?.event_date;
                return eventDate && new Date(eventDate) > now;
            });
            
            // Sort by event date
            upcomingBookings.sort((a, b) => {
                const dateA = new Date(a.opportunity?.event_date || 0);
                const dateB = new Date(b.opportunity?.event_date || 0);
                return dateA - dateB;
            });
            
            return upcomingBookings;
        } catch (error) {
            console.error('Get bookings error:', error);
            return [];
        }
    }
    
    async getRecentOpportunities(limit = 3) {
        try {
            const { data, error } = await this.supabase
                .from('speaking_opportunities')
                .select('*')
                .eq('status', 'Open')
                .order('created_at', { ascending: false })
                .limit(limit);
                
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Get opportunities error:', error);
            return [];
        }
    }
    
    async getDashboardStats(userId) {
        try {
            const targetUserId = userId || (await this.getCurrentUser())?.id;
            if (!targetUserId) return { profileViews: 0, applications: 0, bookings: 0 };
            
            // Get profile views count (last 30 days)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const { count: viewCount } = await this.supabase
                .from('activity')
                .select('*', { count: 'exact', head: true })
                .eq('target_id', targetUserId)
                .eq('activity_type', 'profile_view')
                .gte('created_at', thirtyDaysAgo.toISOString());
            
            // Get active applications count
            const { count: applicationsCount } = await this.supabase
                .from('applications')
                .select('*', { count: 'exact', head: true })
                .eq('speaker_id', targetUserId)
                .eq('status', 'Pending');
            
            // Get accepted bookings count
            const { count: bookingsCount } = await this.supabase
                .from('applications')
                .select('*', { count: 'exact', head: true })
                .eq('speaker_id', targetUserId)
                .eq('status', 'Accepted');
            
            return {
                profileViews: viewCount || 0,
                applications: applicationsCount || 0,
                bookings: bookingsCount || 0
            };
        } catch (error) {
            console.error('Get dashboard stats error:', error);
            return {
                profileViews: 0,
                applications: 0,
                bookings: 0
            };
        }
    }
    
    // ============================================
    // IMPROVED DASHBOARD METHODS (More Efficient)
    // ============================================
    
    async getDashboardStatsOptimized(userId) {
        try {
            const targetUserId = userId || (await this.getCurrentUser())?.id;
            if (!targetUserId) return { profileViews: 0, applications: 0, bookings: 0 };
            
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            // Use Promise.all for parallel queries
            const [viewsResult, applicationsResult, bookingsResult] = await Promise.all([
                // Profile views (last 30 days)
                this.supabase
                    .from('activity')
                    .select('*', { count: 'exact', head: true })
                    .eq('target_id', targetUserId)
                    .eq('activity_type', 'profile_view')
                    .gte('created_at', thirtyDaysAgo.toISOString()),
                
                // Active applications
                this.supabase
                    .from('applications')
                    .select('*', { count: 'exact', head: true })
                    .eq('speaker_id', targetUserId)
                    .eq('status', 'Pending'),
                
                // Accepted bookings
                this.supabase
                    .from('applications')
                    .select('*', { count: 'exact', head: true })
                    .eq('speaker_id', targetUserId)
                    .eq('status', 'Accepted')
            ]);
            
            return {
                profileViews: viewsResult.count || 0,
                applications: applicationsResult.count || 0,
                bookings: bookingsResult.count || 0
            };
        } catch (error) {
            console.error('Get dashboard stats error:', error);
            return { profileViews: 0, applications: 0, bookings: 0 };
        }
    }
    
    // ============================================
    // OPPORTUNITIES METHODS
    // ============================================
    
    async searchOpportunities(filters = {}) {
        try {
            let query = this.supabase
                .from('speaking_opportunities')
                .select(`
                    *,
                    organization:organizations(name, logo_url),
                    posted_by_member:members!posted_by(name)
                `);
            
            // Apply filters
            if (filters.status) {
                query = query.eq('status', filters.status);
            }
            if (filters.event_format) {
                query = query.eq('event_format', filters.event_format);
            }
            if (filters.min_compensation) {
                query = query.gte('compensation_amount', filters.min_compensation);
            }
            if (filters.max_compensation) {
                query = query.lte('compensation_amount', filters.max_compensation);
            }
            if (filters.location) {
                query = query.ilike('location', `%${filters.location}%`);
            }
            if (filters.after_date) {
                query = query.gte('event_date', filters.after_date);
            }
            if (filters.before_date) {
                query = query.lte('event_date', filters.before_date);
            }
            if (filters.topics && filters.topics.length > 0) {
                query = query.contains('topics', filters.topics);
            }
            
            // Add ordering
            query = query.order('created_at', { ascending: false });
            
            // Add limit if specified
            if (filters.limit) {
                query = query.limit(filters.limit);
            }
            
            const { data, error } = await query;
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Search opportunities error:', error);
            return [];
        }
    }
    
    async searchOpportunitiesOptimized(filters = {}) {
        try {
            let query = this.supabase
                .from('speaking_opportunities')
                .select(`
                    *,
                    organization:organizations(name, logo_url, organization_type),
                    posted_by_member:members!posted_by(name)
                `)
                .eq('status', 'Open');
            
            // Apply filters efficiently
            if (filters.location) {
                query = query.or(`location.ilike.%${filters.location}%,location.eq.Remote`);
            }
            
            if (filters.format && filters.format !== '') {
                query = query.eq('event_format', filters.format);
            }
            
            if (filters.compensation === 'paid') {
                query = query.gt('compensation_amount', 0);
            } else if (filters.compensation === 'volunteer') {
                query = query.or('compensation_amount.is.null,compensation_amount.eq.0');
            }
            
            if (filters.topic) {
                // For array contains, use @> operator
                query = query.contains('topics', [filters.topic]);
            }
            
            if (filters.minCompensation) {
                query = query.gte('compensation_amount', filters.minCompensation);
            }
            
            if (filters.maxCompensation) {
                query = query.lte('compensation_amount', filters.maxCompensation);
            }
            
            if (filters.afterDate) {
                query = query.gte('event_date', filters.afterDate);
            }
            
            if (filters.beforeDate) {
                query = query.lte('event_date', filters.beforeDate);
            }
            
            // Add deadline filter
            if (filters.urgentOnly) {
                const threeDaysFromNow = new Date();
                threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
                query = query.lte('application_deadline', threeDaysFromNow.toISOString());
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
                query = query.range(filters.offset, filters.offset + (filters.limit || 20) - 1);
            }
            
            const { data, error } = await query;
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Search opportunities error:', error);
            return [];
        }
    }
    
    async applyToOpportunity(opportunityId, applicationData) {
        try {
            const user = await this.getCurrentUser();
            if (!user) throw new Error('Not authenticated');
            
            const { data, error } = await this.supabase
                .from('applications')
                .insert({
                    opportunity_id: opportunityId,
                    speaker_id: user.id,
                    cover_letter: applicationData.coverLetter,
                    requested_fee: applicationData.requestedFee,
                    status: 'Pending'
                })
                .select()
                .single();
                
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Apply to opportunity error:', error);
            throw error;
        }
    }
    
    async getOpportunityById(opportunityId) {
        try {
            const { data, error } = await this.supabase
                .from('speaking_opportunities')
                .select(`
                    *,
                    organization:organizations(*),
                    posted_by_member:members!posted_by(name, email)
                `)
                .eq('id', opportunityId)
                .single();
                
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Get opportunity error:', error);
            return null;
        }
    }
    
    async getOpportunityWithRelations(opportunityId) {
        try {
            const { data, error } = await this.supabase
                .from('speaking_opportunities')
                .select(`
                    *,
                    organization:organizations(*),
                    posted_by_member:members!posted_by(name, email)
                `)
                .eq('id', opportunityId)
                .single();
            
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Get opportunity with relations error:', error);
            return null;
        }
    }

    async postOpportunity(opportunityData) {
    try {
        const user = await this.getCurrentUser();
        if (!user) throw new Error('Not authenticated');
        
        if (user.member_type !== 'Organization') {
            throw new Error('Only organizations can post opportunities');
        }
        
        // Get organization ID
        const { data: orgMember } = await this.supabase
            .from('organization_members')
            .select('organization_id')
            .eq('member_id', user.id)
            .single();
        
        // Prepare the complete opportunity data
        const completeData = {
            ...opportunityData,
            posted_by: user.id,
            organization_id: orgMember?.organization_id || null,
            status: opportunityData.status || 'Open',
            created_at: new Date().toISOString(),
            application_count: 0
        };
        
        // Insert the opportunity
        const { data, error } = await this.supabase
            .from('speaking_opportunities')
            .insert(completeData)
            .select()
            .single();
        
        if (error) throw error;
        
        // Track activity
        await this.trackActivity('opportunity_posted', data.id, {
            title: data.title,
            event_date: data.event_date
        });
        
        return data;
    } catch (error) {
        console.error('Post opportunity error:', error);
        throw error;
    }
}

async updateOpportunity(opportunityId, updates) {
    try {
        const user = await this.getCurrentUser();
        if (!user) throw new Error('Not authenticated');
        
        // Verify ownership
        const { data: opportunity } = await this.supabase
            .from('speaking_opportunities')
            .select('posted_by')
            .eq('id', opportunityId)
            .single();
        
        if (!opportunity || opportunity.posted_by !== user.id) {
            throw new Error('Unauthorized to update this opportunity');
        }
        
        // Update the opportunity
        const { data, error } = await this.supabase
            .from('speaking_opportunities')
            .update(updates)
            .eq('id', opportunityId)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Update opportunity error:', error);
        throw error;
    }
}

async deleteOpportunity(opportunityId) {
    try {
        const user = await this.getCurrentUser();
        if (!user) throw new Error('Not authenticated');
        
        // Verify ownership
        const { data: opportunity } = await this.supabase
            .from('speaking_opportunities')
            .select('posted_by')
            .eq('id', opportunityId)
            .single();
        
        if (!opportunity || opportunity.posted_by !== user.id) {
            throw new Error('Unauthorized to delete this opportunity');
        }
        
        // Soft delete by updating status
        const { error } = await this.supabase
            .from('speaking_opportunities')
            .update({ status: 'Closed' })
            .eq('id', opportunityId);
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Delete opportunity error:', error);
        throw error;
    }
}

async getMyOpportunities(status = null) {
    try {
        const user = await this.getCurrentUser();
        if (!user) throw new Error('Not authenticated');
        
        let query = this.supabase
            .from('speaking_opportunities')
            .select(`
                *,
                applications(count)
            `)
            .eq('posted_by', user.id)
            .order('created_at', { ascending: false });
        
        if (status) {
            query = query.eq('status', status);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Get my opportunities error:', error);
        return [];
    }
}

async getOpportunityApplications(opportunityId) {
    try {
        const user = await this.getCurrentUser();
        if (!user) throw new Error('Not authenticated');
        
        // Verify ownership
        const { data: opportunity } = await this.supabase
            .from('speaking_opportunities')
            .select('posted_by')
            .eq('id', opportunityId)
            .single();
        
        if (!opportunity || opportunity.posted_by !== user.id) {
            throw new Error('Unauthorized to view these applications');
        }
        
        // Get applications with speaker details
        const { data, error } = await this.supabase
            .from('applications')
            .select(`
                *,
                speaker:members!speaker_id(
                    id,
                    name,
                    email,
                    phone,
                    bio,
                    location,
                    specialties,
                    profile_image_url,
                    average_rating,
                    total_reviews
                )
            `)
            .eq('opportunity_id', opportunityId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Get opportunity applications error:', error);
        return [];
    }
}

async updateApplicationStatus(applicationId, status, message = null) {
    try {
        const user = await this.getCurrentUser();
        if (!user) throw new Error('Not authenticated');
        
        // Get application and verify ownership
        const { data: application } = await this.supabase
            .from('applications')
            .select(`
                *,
                opportunity:speaking_opportunities!opportunity_id(posted_by)
            `)
            .eq('id', applicationId)
            .single();
        
        if (!application || application.opportunity.posted_by !== user.id) {
            throw new Error('Unauthorized to update this application');
        }
        
        // Update application status
        const updateData = {
            status: status,
            reviewed_at: new Date().toISOString(),
            reviewed_by: user.id
        };
        
        if (message) {
            updateData.review_message = message;
        }
        
        const { data, error } = await this.supabase
            .from('applications')
            .update(updateData)
            .eq('id', applicationId)
            .select()
            .single();
        
        if (error) throw error;
        
        // Track activity
        await this.trackActivity('application_reviewed', applicationId, {
            status: status,
            speaker_id: application.speaker_id
        });
        
        return data;
    } catch (error) {
        console.error('Update application status error:', error);
        throw error;
    }
}
    
    // ============================================
    // APPLICATION STATUS METHODS
    // ============================================
    
    async checkApplicationStatus(opportunityId, speakerId) {
        try {
            const targetSpeakerId = speakerId || (await this.getCurrentUser())?.id;
            if (!targetSpeakerId) return null;
            
            const { data, error } = await this.supabase
                .from('applications')
                .select('*')
                .eq('opportunity_id', opportunityId)
                .eq('speaker_id', targetSpeakerId)
                .single();
            
            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
                throw error;
            }
            
            return data || null;
        } catch (error) {
            console.error('Check application status error:', error);
            return null;
        }
    }
    
    async getUserApplications(speakerId) {
        try {
            const targetSpeakerId = speakerId || (await this.getCurrentUser())?.id;
            if (!targetSpeakerId) return [];
            
            const { data, error } = await this.supabase
                .from('applications')
                .select('opportunity_id, status, id')
                .eq('speaker_id', targetSpeakerId);
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Get user applications error:', error);
            return [];
        }
    }
    
    // ============================================
    // REVIEWS METHODS
    // ============================================
    
    async getReviews(speakerId) {
        try {
            const targetUserId = speakerId || (await this.getCurrentUser())?.id;
            if (!targetUserId) return [];
            
            const { data, error } = await this.supabase
                .from('reviews')
                .select(`
                    *,
                    organization:organizations(name, logo_url)
                `)
                .eq('speaker_id', targetUserId)
                .order('created_at', { ascending: false });
                
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Get reviews error:', error);
            return [];
        }
    }
    
    async submitReview(reviewData) {
        try {
            const user = await this.getCurrentUser();
            if (!user) throw new Error('Not authenticated');
            
            const { data, error } = await this.supabase
                .from('reviews')
                .insert({
                    speaker_id: reviewData.speakerId,
                    organization_id: reviewData.organizationId,
                    opportunity_id: reviewData.opportunityId,
                    rating: reviewData.rating,
                    content_rating: reviewData.contentRating,
                    delivery_rating: reviewData.deliveryRating,
                    professionalism_rating: reviewData.professionalismRating,
                    review_text: reviewData.reviewText,
                    would_recommend: reviewData.wouldRecommend,
                    verified: true
                })
                .select()
                .single();
                
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Submit review error:', error);
            throw error;
        }
    }
    
    // ============================================
    // ACTIVITY TRACKING
    // ============================================
    
    async trackActivity(activityType, targetId, metadata = {}) {
        try {
            const user = await this.getCurrentUser();
            if (!user) return;
            
            const { error } = await this.supabase
                .from('activity')
                .insert({
                    actor_id: user.id,
                    target_id: targetId,
                    activity_type: activityType,
                    metadata: metadata,
                    is_public: true
                });
                
            if (error) console.error('Track activity error:', error);
        } catch (error) {
            console.error('Track activity error:', error);
        }
    }
    
    async getActivityFeed(userId, limit = 20) {
        try {
            const targetUserId = userId || (await this.getCurrentUser())?.id;
            if (!targetUserId) return [];
            
            const { data, error } = await this.supabase
                .from('activity')
                .select(`
                    *,
                    actor:members!actor_id(name, profile_image_url),
                    target:members!target_id(name, profile_image_url)
                `)
                .or(`actor_id.eq.${targetUserId},target_id.eq.${targetUserId}`)
                .order('created_at', { ascending: false })
                .limit(limit);
                
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Get activity feed error:', error);
            return [];
        }
    }
    
    // ============================================
    // SEARCH AND DISCOVERY
    // ============================================
    
    async searchMembers(filters = {}) {
        try {
            let query = this.supabase
                .from('members')
                .select('*');
            
            // Apply filters
            if (filters.memberType) {
                query = query.eq('member_type', filters.memberType);
            }
            if (filters.search) {
                query = query.or(`name.ilike.%${filters.search}%,bio.ilike.%${filters.search}%`);
            }
            if (filters.location) {
                query = query.ilike('location', `%${filters.location}%`);
            }
            if (filters.specialty) {
                query = query.contains('specialties', [filters.specialty]);
            }
            if (filters.minRating) {
                query = query.gte('average_rating', filters.minRating);
            }
            
            // Add ordering
            if (filters.orderBy === 'rating') {
                query = query.order('average_rating', { ascending: false });
            } else if (filters.orderBy === 'reviews') {
                query = query.order('total_reviews', { ascending: false });
            } else {
                query = query.order('created_at', { ascending: false });
            }
            
            // Add limit if specified
            if (filters.limit) {
                query = query.limit(filters.limit);
            }
            
            const { data, error } = await query;
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Search members error:', error);
            return [];
        }
    }
    
    // ============================================
    // SAVED SPEAKERS (for Organizations)
    // ============================================
    
    async saveSpeaker(speakerId, notes = '') {
        try {
            const user = await this.getCurrentUser();
            if (!user || user.member_type !== 'Organization') {
                throw new Error('Only organizations can save speakers');
            }
            
            // Get organization ID
            const { data: orgMember } = await this.supabase
                .from('organization_members')
                .select('organization_id')
                .eq('member_id', user.id)
                .single();
                
            if (!orgMember) throw new Error('Organization not found');
            
            const { data, error } = await this.supabase
                .from('saved_speakers')
                .insert({
                    organization_id: orgMember.organization_id,
                    speaker_id: speakerId,
                    notes: notes
                })
                .select()
                .single();
                
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Save speaker error:', error);
            throw error;
        }
    }
    
    async getSavedSpeakers() {
        try {
            const user = await this.getCurrentUser();
            if (!user || user.member_type !== 'Organization') return [];
            
            // Get organization ID
            const { data: orgMember } = await this.supabase
                .from('organization_members')
                .select('organization_id')
                .eq('member_id', user.id)
                .single();
                
            if (!orgMember) return [];
            
            const { data, error } = await this.supabase
                .from('saved_speakers')
                .select(`
                    *,
                    speaker:members!speaker_id(*)
                `)
                .eq('organization_id', orgMember.organization_id)
                .order('created_at', { ascending: false });
                
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Get saved speakers error:', error);
            return [];
        }
    }
    
    async removeSavedSpeaker(speakerId) {
        try {
            const user = await this.getCurrentUser();
            if (!user || user.member_type !== 'Organization') {
                throw new Error('Only organizations can remove saved speakers');
            }
            
            // Get organization ID
            const { data: orgMember } = await this.supabase
                .from('organization_members')
                .select('organization_id')
                .eq('member_id', user.id)
                .single();
                
            if (!orgMember) throw new Error('Organization not found');
            
            const { error } = await this.supabase
                .from('saved_speakers')
                .delete()
                .eq('organization_id', orgMember.organization_id)
                .eq('speaker_id', speakerId);
                
            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Remove saved speaker error:', error);
            throw error;
        }
    }

    // ============================================
// SAVED SPEAKERS - ENHANCED METHODS
// ============================================

async updateSavedSpeakerNotes(speakerId, notes) {
    try {
        const user = await this.getCurrentUser();
        if (!user || user.member_type !== 'Organization') {
            throw new Error('Only organizations can update saved speaker notes');
        }
        
        // Get organization ID
        const { data: orgMember } = await this.supabase
            .from('organization_members')
            .select('organization_id')
            .eq('member_id', user.id)
            .single();
            
        if (!orgMember) throw new Error('Organization not found');
        
        const { data, error } = await this.supabase
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
    } catch (error) {
        console.error('Update saved speaker notes error:', error);
        throw error;
    }
}

async checkIfSpeakerSaved(speakerId) {
    try {
        const user = await this.getCurrentUser();
        if (!user || user.member_type !== 'Organization') return false;
        
        // Get organization ID
        const { data: orgMember } = await this.supabase
            .from('organization_members')
            .select('organization_id')
            .eq('member_id', user.id)
            .single();
            
        if (!orgMember) return false;
        
        const { data, error } = await this.supabase
            .from('saved_speakers')
            .select('id')
            .eq('organization_id', orgMember.organization_id)
            .eq('speaker_id', speakerId)
            .single();
        
        return !!data;
    } catch (error) {
        return false;
    }
}

// ============================================
// MESSAGING METHODS
// ============================================

// Updated sendMessage method in supabase-client.js
async sendMessage(recipientId, subject, message, opportunityId = null) {
    try {
        const user = await this.getCurrentUser();
        if (!user) throw new Error('Not authenticated');
        
        // Save message to database
        const { data: messageData, error } = await this.supabase
            .from('messages')
            .insert({
                sender_id: user.id,
                recipient_id: recipientId,
                subject: subject,
                message: message,
                opportunity_id: opportunityId,
                status: 'unread',
                created_at: new Date().toISOString()
            })
            .select()
            .single();
            
        if (error) throw error;
        
        console.log('Message saved, now sending email for message ID:', messageData.id);
        
        // IMPORTANT: ADD THIS PART TO SEND EMAILS!
        try {
            const { data: emailResult, error: emailError } = await this.supabase.functions.invoke(
                'send-message-email',
                {
                    body: { message_id: messageData.id }
                }
            );
            
            console.log('Email function result:', emailResult);
            if (emailError) {
                console.error('Email function error:', emailError);
            }
        } catch (emailError) {
            console.error('Failed to call email function:', emailError);
        }
        
        // Track activity
        await this.trackActivity('message_sent', recipientId, {
            subject: subject,
            opportunity_id: opportunityId
        });
        
        return messageData;
    } catch (error) {
        console.error('Send message error:', error);
        throw error;
    }
}

async getMessages(type = 'inbox') {
    try {
        const user = await this.getCurrentUser();
        if (!user) return [];
        
        let query = this.supabase
            .from('messages')
            .select(`
                *,
                sender:members!sender_id(name, email, profile_image_url),
                recipient:members!recipient_id(name, email, profile_image_url),
                opportunity:speaking_opportunities(title)
            `);
        
        if (type === 'inbox') {
            query = query.eq('recipient_id', user.id);
        } else if (type === 'sent') {
            query = query.eq('sender_id', user.id);
        }
        
        query = query.order('created_at', { ascending: false });
        
        const { data, error } = await query;
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Get messages error:', error);
        return [];
    }
}

async markMessageAsRead(messageId) {
    try {
        const user = await this.getCurrentUser();
        if (!user) throw new Error('Not authenticated');
        
        const { data, error } = await this.supabase
            .from('messages')
            .update({ 
                status: 'read',
                read_at: new Date().toISOString()
            })
            .eq('id', messageId)
            .eq('recipient_id', user.id)
            .select()
            .single();
            
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Mark message as read error:', error);
        throw error;
    }
}

async getUnreadMessageCount() {
    try {
        const user = await this.getCurrentUser();
        if (!user) return 0;
        
        const { count, error } = await this.supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('recipient_id', user.id)
            .eq('status', 'unread');
            
        if (error) throw error;
        return count || 0;
    } catch (error) {
        console.error('Get unread message count error:', error);
        return 0;
    }
}

// ============================================
// APPLICATION TRACKING METHODS (Enhanced)
// ============================================

async getApplicationById(applicationId) {
    try {
        const { data, error } = await this.supabase
            .from('applications')
            .select(`
                *,
                opportunity:speaking_opportunities(*),
                speaker:members!speaker_id(name, email, phone, bio, location, specialties),
                reviewer:members!reviewed_by(name)
            `)
            .eq('id', applicationId)
            .single();
            
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Get application by ID error:', error);
        return null;
    }
}

async getApplicationTimeline(applicationId) {
    try {
        const { data, error } = await this.supabase
            .from('application_timeline')
            .select('*')
            .eq('application_id', applicationId)
            .order('created_at', { ascending: true });
            
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Get application timeline error:', error);
        return [];
    }
}

async addApplicationNote(applicationId, note, isInternal = true) {
    try {
        const user = await this.getCurrentUser();
        if (!user) throw new Error('Not authenticated');
        
        const { data, error } = await this.supabase
            .from('application_notes')
            .insert({
                application_id: applicationId,
                author_id: user.id,
                note: note,
                is_internal: isInternal,
                created_at: new Date().toISOString()
            })
            .select()
            .single();
            
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Add application note error:', error);
        throw error;
    }
}

// ============================================
// ORGANIZATION STATS METHODS
// ============================================

async getOrganizationStats() {
    try {
        const user = await this.getCurrentUser();
        if (!user || user.member_type !== 'Organization') return null;
        
        // Get organization ID
        const { data: orgMember } = await this.supabase
            .from('organization_members')
            .select('organization_id')
            .eq('member_id', user.id)
            .single();
            
        if (!orgMember) return null;
        
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        // Parallel queries for stats
        const [opportunities, savedSpeakers, recentApplications, acceptedSpeakers] = await Promise.all([
            // Total opportunities
            this.supabase
                .from('speaking_opportunities')
                .select('*', { count: 'exact', head: true })
                .eq('posted_by', user.id),
            
            // Saved speakers count
            this.supabase
                .from('saved_speakers')
                .select('*', { count: 'exact', head: true })
                .eq('organization_id', orgMember.organization_id),
            
            // Recent applications (last 30 days)
            this.supabase
                .from('applications')
                .select('*', { count: 'exact', head: true })
                .in('opportunity_id', 
                    this.supabase
                        .from('speaking_opportunities')
                        .select('id')
                        .eq('posted_by', user.id)
                )
                .gte('created_at', thirtyDaysAgo.toISOString()),
            
            // Accepted speakers count
            this.supabase
                .from('applications')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'Accepted')
                .in('opportunity_id',
                    this.supabase
                        .from('speaking_opportunities')
                        .select('id')
                        .eq('posted_by', user.id)
                )
        ]);
        
        return {
            totalOpportunities: opportunities.count || 0,
            savedSpeakers: savedSpeakers.count || 0,
            recentApplications: recentApplications.count || 0,
            acceptedSpeakers: acceptedSpeakers.count || 0
        };
    } catch (error) {
        console.error('Get organization stats error:', error);
        return null;
    }
}
    
    // ============================================
    // PROFILE IMAGE UPLOAD
    // ============================================
    
    async uploadProfileImage(file, userId) {
        try {
            const targetUserId = userId || (await this.getCurrentUser())?.id;
            if (!targetUserId) throw new Error('User ID required');
            
            // Generate unique filename
            const fileExt = file.name.split('.').pop();
            const fileName = `members/${targetUserId}-${Date.now()}.${fileExt}`;
            
            // Upload file to storage
            const { data: uploadData, error: uploadError } = await this.supabase.storage
                .from('avatars')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: true
                });
            
            if (uploadError) throw uploadError;
            
            // Get public URL
            const { data: { publicUrl } } = this.supabase.storage
                .from('avatars')
                .getPublicUrl(fileName);
            
            // Update member profile with new URL
            const { data: updateData, error: updateError } = await this.supabase
                .from('members')
                .update({ profile_image_url: publicUrl })
                .eq('id', targetUserId)
                .select()
                .single();
            
            if (updateError) throw updateError;
            
            return {
                url: publicUrl,
                path: fileName,
                member: updateData
            };
        } catch (error) {
            console.error('Upload profile image error:', error);
            throw error;
        }
    }
    
    async deleteProfileImage(userId) {
        try {
            const targetUserId = userId || (await this.getCurrentUser())?.id;
            if (!targetUserId) throw new Error('User ID required');
            
            // Get current profile to find image path
            const { data: member } = await this.supabase
                .from('members')
                .select('profile_image_url')
                .eq('id', targetUserId)
                .single();
            
            if (member?.profile_image_url) {
                // Extract path from URL
                const url = new URL(member.profile_image_url);
                const path = url.pathname.split('/').slice(-2).join('/'); // Gets "members/uuid-timestamp.ext"
                
                // Delete from storage
                await this.supabase.storage
                    .from('avatars')
                    .remove([path]);
            }
            
            // Clear URL in database
            await this.supabase
                .from('members')
                .update({ profile_image_url: null })
                .eq('id', targetUserId);
            
            return true;
        } catch (error) {
            console.error('Delete profile image error:', error);
            throw error;
        }
    }
    
    // ============================================
    // REAL-TIME SUBSCRIPTIONS
    // ============================================
    
    subscribeToOpportunities(callback) {
        try {
            const channel = this.supabase
                .channel('public-opportunities')
                .on('postgres_changes', 
                    { 
                        event: 'INSERT', 
                        schema: 'public', 
                        table: 'speaking_opportunities',
                        filter: 'status=eq.Open'
                    },
                    (payload) => {
                        console.log('New opportunity:', payload);
                        callback(payload.new);
                    }
                )
                .subscribe();
            
            return channel;
        } catch (error) {
            console.error('Subscribe to opportunities error:', error);
            return null;
        }
    }
    
    subscribeToApplicationUpdates(speakerId, callback) {
        try {
            const targetSpeakerId = speakerId || this.getCurrentUser()?.id;
            if (!targetSpeakerId) return null;
            
            const channel = this.supabase
                .channel(`applications-${targetSpeakerId}`)
                .on('postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'applications',
                        filter: `speaker_id=eq.${targetSpeakerId}`
                    },
                    (payload) => {
                        console.log('Application updated:', payload);
                        callback(payload.new);
                    }
                )
                .subscribe();
            
            return channel;
        } catch (error) {
            console.error('Subscribe to application updates error:', error);
            return null;
        }
    }
    
    unsubscribeChannel(channel) {
        if (channel) {
            this.supabase.removeChannel(channel);
        }
    }
    
    // ============================================
    // BATCH OPERATIONS
    // ============================================
    
    async batchUpdateApplicationStatus(applicationIds, newStatus, reviewerId) {
        try {
            const { data, error } = await this.supabase
                .from('applications')
                .update({ 
                    status: newStatus,
                    reviewed_by: reviewerId,
                    reviewed_at: new Date().toISOString()
                })
                .in('id', applicationIds)
                .select();
            
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Batch update applications error:', error);
            throw error;
        }
    }

    // ============================================
// EXPORT/IMPORT METHODS
// ============================================

async exportSavedSpeakers(format = 'csv') {
    try {
        const savedSpeakers = await this.getSavedSpeakers();
        
        if (format === 'csv') {
            const headers = ['Name', 'Email', 'Phone', 'Location', 'Specialties', 'Rating', 'Notes', 'Saved Date'];
            const rows = savedSpeakers.map(item => [
                item.speaker.name || '',
                item.speaker.email || '',
                item.speaker.phone || '',
                item.speaker.location || '',
                (item.speaker.specialties || []).join('; '),
                item.speaker.average_rating || '',
                item.notes || '',
                new Date(item.created_at).toLocaleDateString()
            ]);
            
            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
            ].join('\n');
            
            return {
                data: csvContent,
                filename: `saved_speakers_${new Date().toISOString().split('T')[0]}.csv`,
                mimeType: 'text/csv'
            };
        }
        
        // JSON format
        return {
            data: JSON.stringify(savedSpeakers, null, 2),
            filename: `saved_speakers_${new Date().toISOString().split('T')[0]}.json`,
            mimeType: 'application/json'
        };
    } catch (error) {
        console.error('Export saved speakers error:', error);
        throw error;
    }
}
    
    // ============================================
    // ANALYTICS METHODS
    // ============================================
    
    async getSpeakerAnalytics(speakerId, dateRange = 30) {
        try {
            const targetSpeakerId = speakerId || (await this.getCurrentUser())?.id;
            if (!targetSpeakerId) return null;
            
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - dateRange);
            
            // Parallel queries for analytics
            const [profileViews, applications, bookings, reviews] = await Promise.all([
                // Profile views over time
                this.supabase
                    .from('activity')
                    .select('created_at')
                    .eq('target_id', targetSpeakerId)
                    .eq('activity_type', 'profile_view')
                    .gte('created_at', startDate.toISOString())
                    .order('created_at', { ascending: true }),
                
                // Applications over time
                this.supabase
                    .from('applications')
                    .select('created_at, status')
                    .eq('speaker_id', targetSpeakerId)
                    .gte('created_at', startDate.toISOString()),
                
                // Bookings
                this.supabase
                    .from('applications')
                    .select('created_at, opportunity:speaking_opportunities(event_date, compensation_amount)')
                    .eq('speaker_id', targetSpeakerId)
                    .eq('status', 'Accepted')
                    .gte('created_at', startDate.toISOString()),
                
                // Reviews
                this.supabase
                    .from('reviews')
                    .select('rating, created_at')
                    .eq('speaker_id', targetSpeakerId)
                    .gte('created_at', startDate.toISOString())
            ]);
            
            return {
                profileViews: profileViews.data || [],
                applications: applications.data || [],
                bookings: bookings.data || [],
                reviews: reviews.data || [],
                dateRange: dateRange
            };
        } catch (error) {
            console.error('Get speaker analytics error:', error);
            return null;
        }
    }
    
    // ============================================
    // HELPER METHODS
    // ============================================
    
    handleAuthChange(event, session) {
        // Emit custom event for UI updates
        window.dispatchEvent(new CustomEvent('auth-change', {
            detail: { event, session }
        }));
        
        // Update navigation if the function exists
        if (typeof window.updateNavigation === 'function') {
            window.updateNavigation();
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.covetalks = new CoveTalksClient();
    });
} else {
    window.covetalks = new CoveTalksClient();
}