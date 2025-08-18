# CoveTalks Database Schema Documentation

## 📋 Table of Contents
- [Overview](#overview)
- [Architecture](#architecture)
- [Database Schema](#database-schema)
- [Tables](#tables)
- [Relationships](#relationships)
- [Custom Types (Enums)](#custom-types-enums)
- [Security (RLS)](#security-rls)
- [Functions & Triggers](#functions--triggers)
- [Indexes](#indexes)
- [Usage Examples](#usage-examples)

---

## Overview

CoveTalks is a **speaker booking marketplace** that connects professional speakers with organizations looking for event speakers. The database is built on PostgreSQL via Supabase, providing:

- **User Management**: Two-sided marketplace with Speakers and Organizations
- **Opportunity Management**: Organizations post speaking opportunities
- **Application System**: Speakers apply to opportunities
- **Review System**: Post-event feedback and ratings
- **Subscription Management**: Tiered pricing with Stripe integration
- **Real-time Updates**: WebSocket subscriptions for live notifications
- **Activity Tracking**: Comprehensive audit trail

## Architecture

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   Netlify       │──────▶│    Supabase     │──────▶│     Stripe      │
│  (Frontend)     │       │   (Backend)     │       │   (Payments)    │
└─────────────────┘       └─────────────────┘       └─────────────────┘
        │                         │                         │
        │                         ├── Auth (JWT)           │
        │                         ├── Database (PostgreSQL)│
        │                         ├── Real-time (WebSocket)│
        │                         └── Storage (Files)      │
        │                                                   │
        └───────────────── API Calls ──────────────────────┘
```

## Database Schema

### Core Business Flow
```
Members ──┬──▶ Organizations ──▶ Speaking Opportunities
          │                              │
          └──── Applications ◀───────────┘
                      │
                      ▼
                  Reviews ──▶ Ratings
```

---

## Tables

### 1. **members** 
*Core user table linked to Supabase Auth*

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Links to auth.users(id) |
| `email` | TEXT | Unique email address |
| `name` | TEXT | Display name |
| `member_type` | ENUM | 'Speaker' or 'Organization' |
| `status` | ENUM | Active/Inactive/Suspended/Pending |
| `bio` | TEXT | Professional biography |
| `specialties` | TEXT[] | Array of expertise areas |
| `years_experience` | INTEGER | Professional experience |
| `speaking_fee_range` | JSONB | {min, max, currency} |
| `average_rating` | DECIMAL(3,2) | Auto-calculated from reviews |
| `total_reviews` | INTEGER | Review count |
| `stripe_customer_id` | TEXT | Stripe integration |

**Key Features:**
- Auto-created via trigger when user signs up
- Supports both speaker and organization member types
- Stores Stripe customer ID for subscription management

---

### 2. **organizations**
*Company/organization profiles*

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Organization identifier |
| `name` | TEXT | Organization name |
| `organization_type` | ENUM | Non-Profit/Educational/Corporate/etc |
| `typical_audience_size` | INTEGER | Expected attendance |
| `budget_range` | JSONB | {min, max, currency} |
| `verified` | BOOLEAN | Verification status |
| `preferred_topics` | TEXT[] | Topics of interest |

**Purpose:** Stores organization details for credibility and matching

---

### 3. **organization_members**
*Junction table for organization membership*

| Column | Type | Description |
|--------|------|-------------|
| `organization_id` | UUID (FK) | Links to organizations |
| `member_id` | UUID (FK) | Links to members |
| `role` | TEXT | Owner/Admin/Member |
| `joined_at` | TIMESTAMPTZ | Membership date |

**Key Features:**
- Many-to-many relationship
- Role-based permissions (Owner can delete, Admin can edit)

---

### 4. **speaking_opportunities**
*Posted speaking gigs*

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Opportunity identifier |
| `organization_id` | UUID (FK) | Posting organization |
| `posted_by` | UUID (FK) | Member who posted |
| `title` | TEXT | Opportunity title |
| `event_date` | DATE | When the event occurs |
| `event_format` | ENUM | In-Person/Virtual/Hybrid |
| `topics` | TEXT[] | Required topics |
| `compensation_amount` | DECIMAL | Payment offered |
| `status` | ENUM | Open/Closed/Filled/Cancelled |
| `application_count` | INTEGER | Auto-incremented |

**Features:**
- Auto-increments application count via trigger
- Supports filtering by format, date, compensation
- GIN index on topics for fast searching

---

### 5. **applications**
*Speaker applications to opportunities*

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Application identifier |
| `opportunity_id` | UUID (FK) | Target opportunity |
| `speaker_id` | UUID (FK) | Applying speaker |
| `cover_letter` | TEXT | Application message |
| `status` | ENUM | Pending/Accepted/Rejected/Withdrawn |
| `reviewed_by` | UUID (FK) | Reviewer member ID |
| `messages` | JSONB | Thread of messages |

**Constraints:**
- UNIQUE(opportunity_id, speaker_id) - One application per speaker per opportunity
- Supports message threading in JSONB

---

### 6. **reviews**
*Post-event feedback system*

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Review identifier |
| `speaker_id` | UUID (FK) | Reviewed speaker |
| `organization_id` | UUID (FK) | Reviewing organization |
| `rating` | INTEGER | 1-5 overall rating |
| `content_rating` | INTEGER | Content quality (1-5) |
| `delivery_rating` | INTEGER | Presentation quality (1-5) |
| `professionalism_rating` | INTEGER | Professional conduct (1-5) |
| `verified` | BOOLEAN | Verified attendance |

**Triggers:**
- Auto-updates speaker's average_rating and total_reviews

---

### 7. **subscriptions**
*Stripe subscription management*

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Subscription identifier |
| `member_id` | UUID (FK) | Subscriber |
| `stripe_subscription_id` | TEXT | Stripe's ID |
| `plan_type` | ENUM | Free/Standard/Plus/Premium |
| `billing_period` | ENUM | Monthly/Yearly |
| `status` | ENUM | Active/Past_Due/Cancelled |
| `amount` | DECIMAL | Subscription price |
| `current_period_end` | DATE | Renewal date |

**Pricing Tiers:**
- Free: $0
- Standard: $97/month
- Plus: $147/month  
- Premium: $197/month

---

### 8. **payments**
*Transaction history*

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Payment identifier |
| `member_id` | UUID (FK) | Payer |
| `subscription_id` | UUID (FK) | Related subscription |
| `stripe_payment_intent_id` | TEXT | Stripe payment ID |
| `amount` | DECIMAL | Payment amount |
| `status` | ENUM | Pending/Succeeded/Failed/Refunded |
| `receipt_url` | TEXT | Stripe receipt |

---

### 9. **activity**
*Audit trail and notifications*

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Activity identifier |
| `actor_id` | UUID (FK) | User who performed action |
| `target_id` | UUID (FK) | User affected |
| `activity_type` | ENUM | Type of activity |
| `metadata` | JSONB | Additional context |
| `is_public` | BOOLEAN | Visibility flag |

**Activity Types:**
- profile_view
- application_submitted
- application_accepted/rejected
- opportunity_posted
- review_received
- booking_confirmed
- subscription_started/cancelled

---

### 10. **saved_speakers**
*Organization bookmarks*

| Column | Type | Description |
|--------|------|-------------|
| `organization_id` | UUID (FK) | Organization |
| `speaker_id` | UUID (FK) | Saved speaker |
| `notes` | TEXT | Private notes |
| `tags` | TEXT[] | Custom tags |

---

### 11. **contact_submissions**
*Support/contact form entries*

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Submission ID |
| `subject` | TEXT | Message subject |
| `message` | TEXT | Message content |
| `submission_type` | TEXT | General/Support/Sales/Partnership |
| `status` | TEXT | New/In Progress/Resolved |

---

## Relationships

```sql
-- One-to-Many Relationships
members (1) ──────────▶ (N) subscriptions
members (1) ──────────▶ (N) payments
members (1) ──────────▶ (N) applications
organizations (1) ────▶ (N) speaking_opportunities
speaking_opportunities (1) ──▶ (N) applications

-- Many-to-Many Relationships
members ◀──────────▶ organizations (via organization_members)
organizations ◀────▶ speakers (via saved_speakers)

-- Foreign Key Cascade Rules
auth.users DELETE ──CASCADE──▶ members DELETE
members DELETE ──CASCADE──▶ applications DELETE
organizations DELETE ──CASCADE──▶ speaking_opportunities DELETE
speaking_opportunities DELETE ──CASCADE──▶ applications DELETE
```

---

## Custom Types (Enums)

```sql
-- User Types
member_type: 'Speaker' | 'Organization'
member_status: 'Active' | 'Inactive' | 'Suspended' | 'Pending'

-- Organization
organization_type: 'Non-Profit' | 'Educational' | 'Corporate' | 
                  'Government' | 'Religious' | 'Community' | 
                  'Healthcare' | 'Other'

-- Subscriptions
plan_type: 'Free' | 'Standard' | 'Plus' | 'Premium'
billing_period: 'Monthly' | 'Yearly'
subscription_status: 'Active' | 'Past_Due' | 'Cancelled' | 
                    'Trialing' | 'Incomplete'

-- Opportunities
opportunity_status: 'Open' | 'Closed' | 'Filled' | 'Cancelled'
event_format: 'In-Person' | 'Virtual' | 'Hybrid'

-- Applications
application_status: 'Pending' | 'Accepted' | 'Rejected' | 'Withdrawn'

-- Payments
payment_status: 'Pending' | 'Succeeded' | 'Failed' | 
                'Refunded' | 'Cancelled'

-- Activity
activity_type: 'profile_view' | 'application_submitted' | 
              'application_accepted' | 'application_rejected' | 
              'opportunity_posted' | 'review_received' | 
              'booking_confirmed' | 'payment_received' | 
              'subscription_started' | 'subscription_cancelled'
```

---

## Security (RLS)

### Row Level Security Policies

**members**
- ✅ Anyone can VIEW profiles
- ✅ Users can UPDATE own profile
- ✅ Service role bypasses all (for triggers)

**organizations**
- ✅ Anyone can VIEW organizations
- ✅ Owners/Admins can UPDATE

**speaking_opportunities**
- ✅ Anyone can VIEW open opportunities
- ✅ Organization members can CREATE
- ✅ Organization members can UPDATE/DELETE own

**applications**
- ✅ Speakers can VIEW own applications
- ✅ Organizations can VIEW applications to their opportunities
- ✅ Speakers can CREATE applications
- ✅ Only reviewers can UPDATE status

**reviews**
- ✅ Anyone can VIEW reviews
- ✅ Only verified organizations can CREATE

**subscriptions & payments**
- ✅ Users can only VIEW own records
- ✅ System/webhook can UPDATE

**activity**
- ✅ Public activities viewable by all
- ✅ Private activities only by actor/target
- ✅ Users can CREATE own activity

---

## Functions & Triggers

### 1. **handle_new_user()**
```sql
-- Automatically creates member profile on signup
TRIGGER: on_auth_user_created
WHEN: AFTER INSERT ON auth.users
ACTION: Creates entry in members table
```

### 2. **update_updated_at_column()**
```sql
-- Updates the updated_at timestamp
TRIGGER: On multiple tables
WHEN: BEFORE UPDATE
ACTION: Sets updated_at = NOW()
```

### 3. **update_speaker_rating()**
```sql
-- Recalculates speaker ratings
TRIGGER: update_speaker_rating_trigger
WHEN: AFTER INSERT/UPDATE/DELETE ON reviews
ACTION: Recalculates average_rating and total_reviews
```

### 4. **increment_application_count()**
```sql
-- Increments opportunity application counter
TRIGGER: increment_application_trigger
WHEN: AFTER INSERT ON applications
ACTION: Increments application_count on opportunity
```

### 5. **handle_stripe_webhook()**
```sql
-- Processes Stripe webhook events
CALLED BY: Edge Function
HANDLES: 
  - checkout.session.completed
  - customer.subscription.deleted
  - invoice.payment_succeeded
```

---

## Indexes

### Performance Indexes
```sql
-- Full-text search
idx_members_search: GIN index on name, bio, location
idx_opportunities_search: GIN index on title, description

-- Foreign keys (automatic)
idx_subscriptions_member: On member_id
idx_applications_opportunity: On opportunity_id
idx_applications_speaker: On speaker_id

-- Filtering
idx_organizations_type: On organization_type
idx_opportunities_status: On status
idx_opportunities_date: On event_date
idx_reviews_rating: On rating

-- Unique constraints
members.email: UNIQUE
members.stripe_customer_id: UNIQUE
applications.(opportunity_id, speaker_id): UNIQUE
```

---

## Usage Examples

### Creating a User (Automatic)
```javascript
// Signup automatically triggers member creation
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
```

### Posting an Opportunity
```javascript
const { data, error } = await supabase
  .from('speaking_opportunities')
  .insert({
    organization_id: 'org-uuid',
    title: 'Keynote Speaker Needed',
    description: 'Annual conference keynote',
    event_date: '2025-06-15',
    event_format: 'In-Person',
    compensation_amount: 5000,
    topics: ['Leadership', 'Innovation']
  });
```

### Applying to Opportunity
```javascript
const { data, error } = await supabase
  .from('applications')
  .insert({
    opportunity_id: 'opp-uuid',
    speaker_id: auth.user.id,
    cover_letter: 'I would be perfect for this...',
    requested_fee: 4500
  });
```

### Real-time Subscription
```javascript
// Listen for new opportunities
supabase
  .channel('opportunities')
  .on('postgres_changes', 
    { 
      event: 'INSERT', 
      schema: 'public', 
      table: 'speaking_opportunities',
      filter: 'status=eq.Open'
    },
    (payload) => {
      console.log('New opportunity!', payload.new);
    }
  )
  .subscribe();
```

### Search Speakers
```javascript
const { data } = await supabase
  .from('members')
  .select('*')
  .eq('member_type', 'Speaker')
  .textSearch('bio', 'leadership motivation')
  .gte('average_rating', 4.0)
  .order('total_reviews', { ascending: false });
```

---

## Migration Benefits

### Before (Custom Auth + Caching)
- 🐌 10+ second login times
- 🔧 Complex JWT management
- 📊 Manual caching layer
- 🔄 No real-time updates
- 🔍 Limited search capabilities

### After (Supabase)
- ⚡ Sub-second authentication
- 🔐 Built-in auth with RLS
- 🚀 Direct database queries
- 📡 Real-time subscriptions
- 🔍 PostgreSQL full-text search
- 📈 Auto-scaling infrastructure

---

## Best Practices

1. **Always use RLS** - Never disable in production
2. **Use transactions** for multi-table operations
3. **Index foreign keys** for join performance
4. **Validate in triggers** not just frontend
5. **Use JSONB** for flexible structured data
6. **Monitor slow queries** via Supabase dashboard
7. **Regular backups** - Enable Point-in-Time Recovery
8. **Use Edge Functions** for complex business logic

---

## Environment Variables

```javascript
// Required for frontend
SUPABASE_URL=https://[project-id].supabase.co
SUPABASE_ANON_KEY=[anon-key]

// Required for Edge Functions
SUPABASE_SERVICE_ROLE_KEY=[service-key]
STRIPE_SECRET_KEY=[stripe-key]
STRIPE_WEBHOOK_SECRET=[webhook-secret]
```

---

## Database Maintenance

### Regular Tasks
- **Weekly**: Check slow query logs
- **Monthly**: Update table statistics (`ANALYZE`)
- **Quarterly**: Review and optimize indexes
- **Yearly**: Archive old activity records

### Monitoring Queries
```sql
-- Check table sizes
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Find slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check active connections
SELECT count(*) FROM pg_stat_activity;
```

---

## Security Considerations

1. **API Keys**: Never expose service role key to frontend
2. **RLS Policies**: Test thoroughly before production
3. **Input Validation**: Use database constraints
4. **Rate Limiting**: Implement via Edge Functions
5. **Encryption**: Enable for sensitive fields (SSN, Tax ID)
6. **Audit Trail**: Use activity table for compliance
7. **GDPR**: Implement user data export/deletion

---

## Support & Resources

- **Supabase Docs**: https://supabase.com/docs
- **PostgreSQL Docs**: https://www.postgresql.org/docs/
- **Support Dashboard**: https://app.supabase.com/support
- **Status Page**: https://status.supabase.com/

---

*Last Updated: August 2025*
*Version: 1.0*