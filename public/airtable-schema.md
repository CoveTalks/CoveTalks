# Airtable Database Schema for CoveTalks

## Table 1: Members
**Purpose**: Store all member/user information

| Field Name | Field Type | Description |
|------------|------------|-------------|
| Member_ID | Autonumber | Primary key |
| Name | Single line text | Full name |
| Email | Email | Primary email (unique) |
| Phone | Phone number | Contact phone |
| Member_Type | Single select | "Speaker" or "Organization" |
| Location | Single line text | City, State/Country |
| Bio | Long text | Member biography |
| Specialty | Multiple select | Areas of expertise |
| Website | URL | Personal/company website |
| Profile_Image | Attachment | Profile photo |
| Booking_Link | URL | Calendar/booking URL |
| Status | Single select | "Active", "Inactive", "Pending" |
| Created_Date | Created time | Registration date |
| Last_Login | Date | Last login timestamp |
| Stripe_Customer_ID | Single line text | Stripe customer reference |
| Password_Hash | Single line text | Encrypted password (if not using Stripe auth) |

## Table 2: Organizations
**Purpose**: Extended info for organization members

| Field Name | Field Type | Description |
|------------|------------|-------------|
| Org_ID | Autonumber | Primary key |
| Member_ID | Link to Members | Related member record |
| Organization_Name | Single line text | Official org name |
| Organization_Type | Single select | "Non-Profit", "School", "Religious", "Youth Group", "Chamber", "Other" |
| Contact_Name | Single line text | Primary contact person |
| Speaking_Topics | Multiple select | Topics of interest |
| Event_Frequency | Single select | "Weekly", "Monthly", "Quarterly", "Annually" |
| Tax_ID | Single line text | Tax-exempt ID (optional) |

## Table 3: Subscriptions
**Purpose**: Track payment subscriptions

| Field Name | Field Type | Description |
|------------|------------|-------------|
| Subscription_ID | Autonumber | Primary key |
| Member_ID | Link to Members | Related member |
| Stripe_Subscription_ID | Single line text | Stripe subscription reference |
| Plan_Type | Single select | "Standard", "Plus", "Premium", "Organization" |
| Billing_Period | Single select | "Monthly", "Yearly" |
| Status | Single select | "Active", "Cancelled", "Past_Due", "Trialing" |
| Start_Date | Date | Subscription start |
| End_Date | Date | Subscription end/renewal |
| Amount | Currency | Subscription amount |
| Next_Billing_Date | Date | Next payment date |
| Payment_Method | Single line text | Last 4 digits of card |

## Table 4: Payments
**Purpose**: Payment transaction history

| Field Name | Field Type | Description |
|------------|------------|-------------|
| Payment_ID | Autonumber | Primary key |
| Subscription_ID | Link to Subscriptions | Related subscription |
| Member_ID | Link to Members | Related member |
| Stripe_Payment_Intent | Single line text | Stripe payment reference |
| Amount | Currency | Payment amount |
| Status | Single select | "Succeeded", "Failed", "Pending", "Refunded" |
| Payment_Date | Created time | Transaction date |
| Invoice_URL | URL | Stripe invoice link |

## Table 5: Contact_Submissions
**Purpose**: Store contact form submissions

| Field Name | Field Type | Description |
|------------|------------|-------------|
| Submission_ID | Autonumber | Primary key |
| Name | Single line text | Submitter name |
| Email | Email | Submitter email |
| Phone | Phone number | Optional phone |
| Subject | Single line text | Message subject |
| Message | Long text | Message content |
| Type | Single select | "General", "Support", "Booking", "Partnership" |
| Status | Single select | "New", "In_Progress", "Resolved" |
| Submitted_Date | Created time | Submission timestamp |
| Response_Sent | Checkbox | Email response sent? |
| Member_ID | Link to Members | If from existing member |

## Table 6: Speaking_Opportunities
**Purpose**: Posted speaking opportunities

| Field Name | Field Type | Description |
|------------|------------|-------------|
| Opportunity_ID | Autonumber | Primary key |
| Organization_ID | Link to Organizations | Posting organization |
| Title | Single line text | Event/opportunity title |
| Description | Long text | Full description |
| Event_Date | Date | Event date |
| Location | Single line text | Event location |
| Topics | Multiple select | Desired topics |
| Audience_Size | Number | Expected attendance |
| Status | Single select | "Open", "Filled", "Cancelled" |
| Posted_Date | Created time | When posted |
| Applications | Link to Applications | Related applications |

## Table 7: Applications
**Purpose**: Speaker applications to opportunities

| Field Name | Field Type | Description |
|------------|------------|-------------|
| Application_ID | Autonumber | Primary key |
| Opportunity_ID | Link to Speaking_Opportunities | Related opportunity |
| Speaker_ID | Link to Members | Applying speaker |
| Cover_Letter | Long text | Application message |
| Status | Single select | "Pending", "Accepted", "Rejected" |
| Applied_Date | Created time | Application date |

## Table 8: Reviews
**Purpose**: Reviews and ratings

| Field Name | Field Type | Description |
|------------|------------|-------------|
| Review_ID | Autonumber | Primary key |
| Speaker_ID | Link to Members | Reviewed speaker |
| Organization_ID | Link to Organizations | Reviewing organization |
| Rating | Rating | 1-5 stars |
| Review_Text | Long text | Review content |
| Event_Date | Date | Event date |
| Review_Date | Created time | Review submission date |
| Verified | Checkbox | Verified review? |

## Airtable Automations to Configure

### 1. Welcome Email Automation
- **Trigger**: When record created in Members table with Status = "Active"
- **Action**: Send email using Airtable's email action or webhook to email service

### 2. Payment Status Sync
- **Trigger**: When record in Subscriptions table updated
- **Condition**: If Status changes to "Cancelled" or "Past_Due"
- **Action**: Update Members table Status field accordingly

### 3. Contact Form Response
- **Trigger**: When record created in Contact_Submissions
- **Action**: Send notification email to admin and auto-response to submitter

### 4. Review Notification
- **Trigger**: When record created in Reviews table
- **Action**: Send email to reviewed speaker

### 5. Opportunity Match
- **Trigger**: When record created in Speaking_Opportunities
- **Action**: Find matching speakers by Topics and send notification emails