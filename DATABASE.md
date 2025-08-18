# CoveTalks Database Schema Documentation

## 📋 Table of Contents
- [Overview](#overview)
- [Architecture](#architecture)
- [Database Tables](#database-tables)
- [Views](#views)
- [Storage Buckets](#storage-buckets)
- [Row Level Security (RLS)](#row-level-security-rls)
- [Functions & Triggers](#functions--triggers)
- [Custom Types & Enums](#custom-types--enums)
- [Indexes](#indexes)
- [Edge Functions](#edge-functions)
- [Usage Examples](#usage-examples)
- [Environment Variables](#environment-variables)
- [Best Practices](#best-practices)

---

## Overview

CoveTalks is a **speaker booking marketplace** that connects professional speakers with organizations looking for event speakers. Built on PostgreSQL via Supabase, the platform provides:

- **Two-sided marketplace**: Speakers and Organizations
- **Opportunity management**: Organizations post speaking opportunities
- **Application system**: Speakers apply to opportunities  
- **Internal messaging**: Direct communication between users
- **Review system**: Post-event feedback and ratings
- **Subscription management**: Tiered pricing with Stripe integration
- **File storage**: Profile images and organization logos
- **Real-time updates**: WebSocket subscriptions for live notifications
- **Activity tracking**: Comprehensive audit trail

## Architecture

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   Frontend      │──────▶│    Supabase     │──────▶│     Stripe      │
│   (Netlify)     │       │   (Backend)     │       │   (Payments)    │
└─────────────────┘       └─────────────────┘       └─────────────────┘
        │                         │                         │
        │                         ├── Auth (JWT)            │
        │                         ├── Database (PostgreSQL)│
        │                         ├── Storage (CDN)        │
        │                         ├── Real-time (WebSocket)│
        │                         └── Edge Functions       │
        └─────────────────────────────────────────────────┘
```

### Core Business Flow
```
Members ──┬──▶ Organizations ──▶ Speaking Opportunities
          │                              │
          └──── Applications ◀───────────┘
                      │
                   Reviews ──▶ Ratings & Messages
```

---

## Database Tables

### 1. **members**
Primary user table for all members (speakers and organizations).

```sql
CREATE TABLE members (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    member_type TEXT CHECK (member_type IN ('Speaker', 'Organization')),
    bio TEXT,
    location TEXT,
    phone TEXT,
    website TEXT,
    specialties TEXT[],
    profile_image_url TEXT,
    average_rating DECIMAL(3,2),
    total_reviews INTEGER DEFAULT 0,
    subscription_tier TEXT DEFAULT 'free',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Key Features:**
- Links to Supabase Auth via `auth.users(id)`
- Supports both Speaker and Organization member types
- Auto-created via trigger on user signup
- Stores calculated rating from reviews

### 2. **organizations**
Organization details linked to members table.

```sql
CREATE TABLE organizations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    organization_type TEXT,
    website TEXT,
    description TEXT,
    location TEXT,
    logo_url TEXT,
    preferred_topics TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Purpose:** Stores organization-specific information for credibility and matching.

### 3. **organization_members**
Links members to organizations with roles.

```sql
CREATE TABLE organization_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    member_id UUID REFERENCES members(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'Member' CHECK (role IN ('Owner', 'Admin', 'Member')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, member_id)
);
```

**Features:**
- Many-to-many relationship
- Role-based permissions (Owner > Admin > Member)

### 4. **speaking_opportunities**
Posted speaking opportunities.

```sql
CREATE TABLE speaking_opportunities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    posted_by UUID REFERENCES members(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    event_date TIMESTAMP WITH TIME ZONE,
    event_format TEXT CHECK (event_format IN ('In-Person', 'Virtual', 'Hybrid')),
    location TEXT,
    audience_size INTEGER,
    audience_type TEXT,
    duration DECIMAL(3,1),
    compensation_amount DECIMAL(10,2),
    travel_covered BOOLEAN DEFAULT false,
    accommodation_covered BOOLEAN DEFAULT false,
    additional_benefits TEXT,
    topics TEXT[],
    requirements TEXT,
    experience_level TEXT,
    application_deadline TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'Open' CHECK (status IN ('Open', 'Closed', 'Filled', 'Draft')),
    application_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 5. **applications**
Speaker applications to opportunities.

```sql
CREATE TABLE applications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    opportunity_id UUID REFERENCES speaking_opportunities(id) ON DELETE CASCADE,
    speaker_id UUID REFERENCES members(id) ON DELETE CASCADE,
    cover_letter TEXT,
    requested_fee DECIMAL(10,2),
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Accepted', 'Rejected', 'Withdrawn')),
    reviewed_by UUID REFERENCES members(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(opportunity_id, speaker_id)
);
```

**Constraints:**
- One application per speaker per opportunity (UNIQUE constraint)
- Cascade delete with opportunity

### 6. **saved_speakers**
Organizations can save speakers for future reference.

```sql
CREATE TABLE saved_speakers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    speaker_id UUID REFERENCES members(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, speaker_id)
);
```

### 7. **reviews**
Reviews of speakers by organizations.

```sql
CREATE TABLE reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    speaker_id UUID REFERENCES members(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    opportunity_id UUID REFERENCES speaking_opportunities(id) ON DELETE SET NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    content_rating INTEGER CHECK (content_rating >= 1 AND content_rating <= 5),
    delivery_rating INTEGER CHECK (delivery_rating >= 1 AND delivery_rating <= 5),
    professionalism_rating INTEGER CHECK (professionalism_rating >= 1 AND professionalism_rating <= 5),
    review_text TEXT,
    would_recommend BOOLEAN,
    verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 8. **messages**
Internal messaging system between users.

```sql
CREATE TABLE messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    opportunity_id UUID REFERENCES speaking_opportunities(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'archived')),
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Optional fields for threading
    parent_message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    thread_id UUID,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Performance indexes
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_recipient ON messages(recipient_id);
CREATE INDEX idx_messages_opportunity ON messages(opportunity_id);
CREATE INDEX idx_messages_status ON messages(status);
CREATE INDEX idx_messages_created ON messages(created_at DESC);
CREATE INDEX idx_messages_thread ON messages(thread_id) WHERE thread_id IS NOT NULL;
```

### 9. **message_notifications**
Track email notification status for messages.

```sql
CREATE TABLE message_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    notification_type TEXT DEFAULT 'email' CHECK (notification_type IN ('email', 'sms', 'push')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'bounced')),
    sent_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    attempts INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_notifications_message ON message_notifications(message_id);
CREATE INDEX idx_notifications_status ON message_notifications(status);
```

### 10. **activity**
Activity tracking for analytics and feeds.

```sql
CREATE TABLE activity (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    actor_id UUID REFERENCES members(id) ON DELETE CASCADE,
    target_id UUID,
    activity_type activity_type NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activity type enum
CREATE TYPE activity_type AS ENUM (
    'profile_view',
    'opportunity_posted',
    'application_submitted',
    'application_reviewed',
    'speaker_saved',
    'review_posted',
    'message_sent'
);

CREATE INDEX idx_activity_actor ON activity(actor_id);
CREATE INDEX idx_activity_target ON activity(target_id);
CREATE INDEX idx_activity_type ON activity(activity_type);
CREATE INDEX idx_activity_created ON activity(created_at DESC);
```

### 11. **subscriptions**
Subscription management for paid tiers.

```sql
CREATE TABLE subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    member_id UUID REFERENCES members(id) ON DELETE CASCADE,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    plan_name TEXT,
    plan_amount DECIMAL(10,2),
    billing_period TEXT CHECK (billing_period IN ('monthly', 'yearly')),
    status TEXT CHECK (status IN ('Active', 'Cancelled', 'Past Due', 'Trialing')),
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 12. **application_timeline**
Track application status changes.

```sql
CREATE TABLE application_timeline (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    status TEXT,
    title TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 13. **application_notes**
Internal notes on applications.

```sql
CREATE TABLE application_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    author_id UUID REFERENCES members(id) ON DELETE CASCADE,
    note TEXT,
    is_internal BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## Views

### inbox_view
Convenience view for displaying inbox with sender/recipient details.

```sql
CREATE OR REPLACE VIEW inbox_view AS
SELECT 
    m.*,
    s.name as sender_name,
    s.email as sender_email,
    s.profile_image_url as sender_avatar,
    r.name as recipient_name,
    r.email as recipient_email,
    o.title as opportunity_title,
    COUNT(*) FILTER (WHERE m.status = 'unread') OVER (PARTITION BY m.recipient_id) as unread_count
FROM messages m
LEFT JOIN members s ON m.sender_id = s.id
LEFT JOIN members r ON m.recipient_id = r.id
LEFT JOIN speaking_opportunities o ON m.opportunity_id = o.id
ORDER BY m.created_at DESC;
```

---

## Storage Buckets

### avatars Bucket
Storage for profile images and organization logos.

```sql
-- Create bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true);
```

**Structure:**
```
avatars/
├── members/
│   └── {user_id}-{timestamp}.{ext}    # Member profile pictures
└── organizations/
    └── {org_id}-{timestamp}.{ext}     # Organization logos
```

**Storage Policies:**
```sql
-- Users can upload their own avatar
CREATE POLICY "Users can upload own avatar" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'avatars' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Users can update their own avatar
CREATE POLICY "Users can update own avatar" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'avatars' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Users can delete their own avatar  
CREATE POLICY "Users can delete own avatar" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'avatars' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Avatar images are publicly accessible
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects
    FOR SELECT USING (bucket_id = 'avatars');
```

---

## Row Level Security (RLS)

### members table
```sql
-- Users can view all members (public directory)
CREATE POLICY "Members are viewable by everyone" ON members
    FOR SELECT USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON members
    FOR UPDATE USING (auth.uid() = id);
```

### messages table
```sql
-- Users can view messages they sent or received
CREATE POLICY "Users can view own messages" ON messages
    FOR SELECT
    USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- Users can send messages
CREATE POLICY "Users can send messages" ON messages
    FOR INSERT
    WITH CHECK (auth.uid() = sender_id);

-- Recipients can update message status
CREATE POLICY "Recipients can update message status" ON messages
    FOR UPDATE
    USING (auth.uid() = recipient_id)
    WITH CHECK (auth.uid() = recipient_id);
```

### applications table
```sql
-- Speakers can view their own applications
CREATE POLICY "Speakers can view own applications" ON applications
    FOR SELECT
    USING (auth.uid() = speaker_id);

-- Organizations can view applications to their opportunities
CREATE POLICY "Organizations can view applications" ON applications
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM speaking_opportunities
            WHERE id = applications.opportunity_id
            AND posted_by = auth.uid()
        )
    );

-- Speakers can submit applications
CREATE POLICY "Speakers can submit applications" ON applications
    FOR INSERT
    WITH CHECK (auth.uid() = speaker_id);
```

### saved_speakers table
```sql
-- Organizations can manage their saved speakers
CREATE POLICY "Organizations manage saved speakers" ON saved_speakers
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_id = saved_speakers.organization_id
            AND member_id = auth.uid()
        )
    );
```

---

## Functions & Triggers

### 1. Auto-create member profile on signup
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.members (id, email, name, member_type)
    VALUES (
        new.id, 
        new.email,
        new.raw_user_meta_data->>'name',
        new.raw_user_meta_data->>'member_type'
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 2. Update timestamp trigger
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to relevant tables
CREATE TRIGGER update_members_updated_at BEFORE UPDATE ON members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_speaking_opportunities_updated_at BEFORE UPDATE ON speaking_opportunities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## Custom Types & Enums

```sql
-- Activity types
CREATE TYPE activity_type AS ENUM (
    'profile_view',
    'opportunity_posted', 
    'application_submitted',
    'application_reviewed',
    'speaker_saved',
    'review_posted',
    'message_sent'
);
```

**Type Constraints Used:**
- `member_type`: 'Speaker' | 'Organization'
- `role`: 'Owner' | 'Admin' | 'Member'
- `event_format`: 'In-Person' | 'Virtual' | 'Hybrid'
- `status` (opportunities): 'Open' | 'Closed' | 'Filled' | 'Draft'
- `status` (applications): 'Pending' | 'Accepted' | 'Rejected' | 'Withdrawn'
- `status` (messages): 'unread' | 'read' | 'archived'
- `billing_period`: 'monthly' | 'yearly'
- `notification_type`: 'email' | 'sms' | 'push'

---

## Indexes

### Performance Indexes
```sql
-- Message indexes
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_recipient ON messages(recipient_id);
CREATE INDEX idx_messages_opportunity ON messages(opportunity_id);
CREATE INDEX idx_messages_status ON messages(status);
CREATE INDEX idx_messages_created ON messages(created_at DESC);
CREATE INDEX idx_messages_thread ON messages(thread_id) WHERE thread_id IS NOT NULL;

-- Activity indexes
CREATE INDEX idx_activity_actor ON activity(actor_id);
CREATE INDEX idx_activity_target ON activity(target_id);
CREATE INDEX idx_activity_type ON activity(activity_type);
CREATE INDEX idx_activity_created ON activity(created_at DESC);

-- Notification indexes
CREATE INDEX idx_notifications_message ON message_notifications(message_id);
CREATE INDEX idx_notifications_status ON message_notifications(status);
```

---

## Edge Functions

### send-message-email
Sends email notifications when messages are created.

- **Location**: `supabase/functions/send-message-email/index.ts`
- **Triggered**: Called from client after message insert
- **Required Secrets**: `RESEND_API_KEY` or `SENDGRID_API_KEY`

**Example Implementation:**
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const { message_id } = await req.json()
  
  // Fetch message details
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  )
  
  const { data: message } = await supabase
    .from('messages')
    .select('*, sender:sender_id(name, email), recipient:recipient_id(name, email)')
    .eq('id', message_id)
    .single()
  
  // Send email notification
  // Implementation depends on email provider (Resend, SendGrid, etc.)
  
  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  })
})
```

---

## Usage Examples

### Authentication
```javascript
// Sign up with member type
const { data, error } = await supabase.auth.signUp({
  email: 'speaker@example.com',
  password: 'password',
  options: {
    data: {
      name: 'John Speaker',
      member_type: 'Speaker'
    }
  }
});

// Sign in - Supabase handles JWT automatically
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
});

// Check authentication status
const { data: { session } } = await supabase.auth.getSession();
if (session) {
  console.log('User ID:', session.user.id);
}

// Sign out
await supabase.auth.signOut();
```

### Profile Image Upload
```javascript
async function uploadProfileImage(file, userId) {
  // 1. Upload to storage
  const fileName = `members/${userId}-${Date.now()}.jpg`;
  const { data, error } = await supabase.storage
    .from('avatars')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (error) throw error;

  // 2. Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(fileName);

  // 3. Update member profile
  await supabase
    .from('members')
    .update({ profile_image_url: publicUrl })
    .eq('id', userId);

  return publicUrl;
}
```

### Posting an Opportunity
```javascript
const { data, error } = await supabase
  .from('speaking_opportunities')
  .insert({
    organization_id: orgId,
    posted_by: userId,
    title: 'Keynote Speaker Needed',
    description: 'Annual conference keynote',
    event_date: '2025-06-15',
    event_format: 'In-Person',
    location: 'San Francisco, CA',
    compensation_amount: 5000,
    topics: ['Leadership', 'Innovation'],
    status: 'Open'
  });
```

### Sending a Message
```javascript
// Send message
const { data: message, error } = await supabase
  .from('messages')
  .insert({
    sender_id: currentUserId,
    recipient_id: recipientId,
    subject: 'Re: Speaking Opportunity',
    message: 'I would love to discuss this opportunity...',
    opportunity_id: opportunityId
  })
  .select()
  .single();

// Trigger email notification
if (message) {
  await supabase.functions.invoke('send-message-email', {
    body: { message_id: message.id }
  });
}
```

### Real-time Subscriptions
```javascript
// Listen for new messages
const messageSubscription = supabase
  .channel('inbox')
  .on('postgres_changes', 
    { 
      event: 'INSERT', 
      schema: 'public', 
      table: 'messages',
      filter: `recipient_id=eq.${userId}`
    },
    (payload) => {
      console.log('New message received!', payload.new);
      // Update UI with new message
    }
  )
  .subscribe();

// Listen for application status updates
const applicationSubscription = supabase
  .channel('applications')
  .on('postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public', 
      table: 'applications',
      filter: `speaker_id=eq.${userId}`
    },
    (payload) => {
      console.log('Application status changed!', payload.new.status);
    }
  )
  .subscribe();
```

### Search Speakers
```javascript
const { data: speakers } = await supabase
  .from('members')
  .select(`
    *,
    reviews(rating)
  `)
  .eq('member_type', 'Speaker')
  .contains('specialties', ['Leadership', 'Innovation'])
  .gte('average_rating', 4.0)
  .order('total_reviews', { ascending: false })
  .limit(20);
```

### Complex Query with Joins
```javascript
// Get opportunities with organization details
const { data: opportunities } = await supabase
  .from('speaking_opportunities')
  .select(`
    *,
    organization:organizations(name, logo_url),
    posted_by:members(name, email),
    applications(count)
  `)
  .eq('status', 'Open')
  .gte('event_date', new Date().toISOString())
  .order('event_date', { ascending: true });
```

---

## Environment Variables

```bash
# Frontend (Public)
VITE_SUPABASE_URL=https://[project-id].supabase.co
VITE_SUPABASE_ANON_KEY=[anon-key]

# Backend (Edge Functions - Secret)
SUPABASE_URL=https://[project-id].supabase.co
SUPABASE_SERVICE_ROLE_KEY=[service-key]
RESEND_API_KEY=[resend-key]  # or SENDGRID_API_KEY
STRIPE_PUBLISHABLE_KEY=[stripe-public-key]
STRIPE_SECRET_KEY=[stripe-secret-key]
STRIPE_WEBHOOK_SECRET=[webhook-secret]
```

---

## Required Extensions

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_net";  -- For HTTP requests from database
CREATE EXTENSION IF NOT EXISTS "http";    -- For HTTP functions
```

---

## Best Practices

### Security
1. **Always use RLS** - Never disable Row Level Security in production
2. **Validate inputs** - Use database constraints and triggers
3. **API keys** - Never expose service role key to frontend
4. **File uploads** - Validate file types and sizes client-side
5. **Rate limiting** - Implement via Edge Functions

### Performance
1. **Use indexes** - Add indexes for frequently queried columns
2. **Optimize queries** - Use `select()` with specific columns
3. **Batch operations** - Use `upsert()` for bulk inserts/updates
4. **Connection pooling** - Handled automatically by Supabase
5. **Monitor slow queries** - Check Supabase dashboard regularly

### Data Management
1. **Use transactions** - For multi-table operations
2. **Soft deletes** - Consider adding `deleted_at` for important data
3. **Audit trails** - Use the activity table for compliance
4. **Regular backups** - Enable Point-in-Time Recovery
5. **Data validation** - Use triggers for complex business rules

### Storage
1. **Image optimization** - Resize before upload (max 1200x1200)
2. **CDN usage** - Use Supabase's built-in CDN for images
3. **Cleanup** - Delete old files when uploading new ones
4. **Naming convention** - Use `{type}/{id}-{timestamp}.{ext}`
5. **Fallbacks** - Always provide default image URLs

---

## Database Maintenance

### Regular Tasks
- **Daily**: Monitor error logs, Check failed email notifications
- **Weekly**: Review slow query logs, Check storage usage
- **Monthly**: Update table statistics (`ANALYZE`), Clean orphaned files
- **Quarterly**: Review and optimize indexes, Archive old activity records

### Monitoring Queries
```sql
-- Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Find slow queries
SELECT 
  query,
  mean_exec_time,
  calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check storage usage
SELECT 
  bucket_id,
  COUNT(*) as file_count,
  pg_size_pretty(SUM((metadata->>'size')::bigint)) as total_size
FROM storage.objects
GROUP BY bucket_id;

-- Find orphaned profile images
SELECT o.name, o.created_at
FROM storage.objects o
WHERE o.bucket_id = 'avatars'
  AND o.name LIKE 'members/%'
  AND NOT EXISTS (
    SELECT 1 FROM members m 
    WHERE m.profile_image_url LIKE '%' || o.name
  );
```

---

## Migration Benefits

### Before (Traditional Setup)
- 🔑 Manual JWT management
- 🐌 10+ second login times
- 📊 Complex caching layer
- 🔄 No real-time updates
- 📁 Separate file storage
- 🔍 Limited search capabilities

### After (Supabase)
- ⚡ Sub-second authentication
- 🔐 Automatic JWT handling
- 🚀 Direct database queries
- 📡 Real-time subscriptions
- 🖼️ Integrated storage with CDN
- 🔍 PostgreSQL full-text search
- 📈 Auto-scaling infrastructure

---

## Support & Resources

- **Supabase Documentation**: https://supabase.com/docs
- **PostgreSQL Documentation**: https://www.postgresql.org/docs/
- **Support Dashboard**: https://app.supabase.com/support
- **Status Page**: https://status.supabase.com/
- **Community Discord**: https://discord.supabase.com/

---

*Last Updated: August 2025*  
*Version: 2.0 - Complete Schema with Messaging System*