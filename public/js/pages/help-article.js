// Help Article Page JavaScript - FIXED VERSION
const ArticlePage = {
    currentArticle: null,
    hasSubmittedFeedback: false,

    // Initialize the article page
    async init() {
        const slug = this.getArticleSlug();
        if (!slug) {
            this.showError('Article not found');
            return;
        }

        await this.loadArticle(slug);
        this.setupScrollSpy();
        this.setupEventListeners();
    },

    // Get article slug from URL - FIXED to handle query param
    getArticleSlug() {
        // Check for query parameter first
        const urlParams = new URLSearchParams(window.location.search);
        const articleParam = urlParams.get('article');
        if (articleParam) {
            return articleParam;
        }
        
        // Fallback to path-based slug
        const pathParts = window.location.pathname.split('/');
        const lastPart = pathParts[pathParts.length - 1];
        
        // If we're on help-article.html, there's no slug in the path
        if (lastPart === 'help-article.html' || lastPart === '') {
            return null;
        }
        
        return lastPart;
    },

    // Load article from database or use mock data
    async loadArticle(slug) {
        try {
            // Comprehensive mock article data for all categories
            const mockArticles = {
                // Original articles
                'creating-speaker-profile': {
                    title: 'Creating Your Speaker Profile',
                    category: 'getting_started',
                    content: `
# Creating Your Speaker Profile

Your speaker profile is your digital business card on CoveTalks. It's the first thing organizations see when considering you for speaking opportunities.

## Getting Started

To create your speaker profile, follow these steps:

1. **Sign up** for a CoveTalks account as a Speaker
2. **Complete your basic information** including name, location, and contact details
3. **Add your professional bio** - make it compelling and highlight your expertise
4. **Upload a professional photo** - this increases engagement by 40%
5. **List your speaking topics** - be specific about your areas of expertise

## Profile Best Practices

### Write a Compelling Bio
Your bio should be:
- **Concise**: 150-300 words is ideal
- **Achievement-focused**: Highlight your accomplishments
- **Audience-oriented**: Explain what value you bring
- **Authentic**: Let your personality shine through

### Choose the Right Topics
Select 3-5 core topics that:
- Align with your expertise
- Have market demand
- You're passionate about
- Differentiate you from others

### Set Your Speaking Fees
Be transparent about your fees:
- Research market rates for your experience level
- Consider offering different packages
- Be open to negotiation for the right opportunities

## Optimizing for Search

To increase your visibility:
- Use relevant keywords in your bio
- Keep your profile updated
- Respond quickly to inquiries
- Collect and display testimonials

[!TIP]
Complete profiles receive 3x more inquiries than incomplete ones. Take the time to fill out every section thoroughly.

## Next Steps

Once your profile is complete:
1. Start browsing speaking opportunities
2. Set up email alerts for relevant events
3. Connect with organizations in your field
4. Build your speaker portfolio with past events

[!NOTE]
Your profile is a living document. Update it regularly with new achievements, topics, and testimonials.
                    `,
                    meta_description: 'Learn how to create a compelling speaker profile on CoveTalks that attracts organizations and speaking opportunities.',
                    updated_at: new Date().toISOString(),
                    view_count: 1247,
                    helpful_count: 89,
                    not_helpful_count: 5
                },
                'finding-opportunities': {
                    title: 'Finding Speaking Opportunities',
                    category: 'getting_started',
                    content: `
# Finding Speaking Opportunities

CoveTalks connects you with hundreds of speaking opportunities. Here's how to find the right ones for you.

## Using the Search Function

### Basic Search
- Enter keywords related to your expertise
- Filter by location, date, and compensation
- Save searches for future reference

### Advanced Filters
- Event type (conference, workshop, webinar)
- Audience size
- Industry sector
- Travel requirements

## Setting Up Alerts

Never miss an opportunity:
1. Create saved searches for your topics
2. Set email notification frequency
3. Enable push notifications on mobile
4. Track application deadlines

## Evaluating Opportunities

Consider these factors:
- **Alignment** with your expertise
- **Audience** fit and size
- **Compensation** and expenses
- **Time commitment** required
- **Networking potential**

[!TIP]
Quality over quantity - apply to opportunities where you can deliver maximum value.
                    `,
                    meta_description: 'Discover how to find and apply to speaking opportunities that match your expertise on CoveTalks.',
                    updated_at: new Date().toISOString(),
                    view_count: 982,
                    helpful_count: 76,
                    not_helpful_count: 8
                },
                'setting-fees': {
                    title: 'Setting Your Speaking Fees',
                    category: 'getting_started',
                    content: `
# Setting Your Speaking Fees

Determining your speaking fees can be challenging. This guide will help you set competitive and fair rates.

## Factors to Consider

### Experience Level
- **Beginner** (0-2 years): $500-$2,500
- **Intermediate** (2-5 years): $2,500-$7,500
- **Advanced** (5-10 years): $7,500-$15,000
- **Expert** (10+ years): $15,000+

### Event Type
Different events have different budgets:
- Corporate events typically pay more
- Non-profits may have limited budgets
- Educational institutions vary widely
- Virtual events may have different rates

## Creating Your Fee Structure

### Basic Package
- Keynote presentation (45-60 minutes)
- Q&A session
- Meet and greet

### Premium Package
- Multiple sessions
- Workshop facilitation
- Executive coaching
- Custom content creation

[!NOTE]
Always be transparent about what's included in your fee and what requires additional compensation.
                    `,
                    meta_description: 'Learn how to set competitive speaking fees that reflect your value and expertise.',
                    updated_at: new Date().toISOString(),
                    view_count: 1456,
                    helpful_count: 124,
                    not_helpful_count: 12
                }
            };

            // Generate content for category-based articles dynamically
            const categoryArticles = {
                'speakers': 'For Speakers',
                'organizations': 'For Organizations',
                'billing': 'Billing & Subscriptions',
                'technical': 'Technical Support'
            };

            // Check if this is a category-based article
            for (const [categoryKey, categoryName] of Object.entries(categoryArticles)) {
                const articleTypes = ['getting-started', 'best-practices', 'faq', 'tips', 'advanced'];
                
                for (const type of articleTypes) {
                    const generatedSlug = `${categoryKey}-${type}`;
                    if (slug === generatedSlug && !mockArticles[generatedSlug]) {
                        // Generate content for this article
                        mockArticles[generatedSlug] = this.generateCategoryArticle(categoryKey, categoryName, type);
                    }
                }
            }

            // Get the article
            let article = mockArticles[slug];
            
            if (!article) {
                // Try to fetch from Supabase if available, but handle errors
                if (window.covetalks && window.covetalks.getHelpArticle) {
                    try {
                        article = await window.covetalks.getHelpArticle(slug);
                    } catch (supabaseError) {
                        console.log('Supabase fetch failed, article not found:', slug);
                        // Continue with article not found flow
                    }
                }
            }
            
            if (!article) {
                this.showError('Article not found');
                return;
            }

            // Add slug to article object
            article.slug = slug;
            
            this.currentArticle = article;
            this.renderArticle(article);
            this.loadRelatedArticles(article.category, slug);
            
            // Update page title and meta
            document.title = `${article.title} - CoveTalks Help Center`;
            const metaDesc = document.getElementById('metaDescription');
            if (metaDesc && article.meta_description) {
                metaDesc.content = article.meta_description;
            }

        } catch (error) {
            console.error('Error loading article:', error);
            this.showError('Unable to load article. Please try again.');
        }
    },

    // Generate dynamic content for category articles
    generateCategoryArticle(categoryKey, categoryName, type) {
        const typeContent = {
            'getting-started': {
                title: `Getting Started - ${categoryName}`,
                content: `
# Getting Started with ${categoryName}

Welcome to the ${categoryName} section of CoveTalks. This guide will help you get started quickly.

## Overview

${categoryKey === 'speakers' ? 
'As a speaker on CoveTalks, you have access to numerous opportunities to share your expertise and grow your speaking career.' :
categoryKey === 'organizations' ?
'CoveTalks makes it easy for organizations to find and book the perfect speakers for any event.' :
categoryKey === 'billing' ?
'Managing your subscription and payments on CoveTalks is simple and secure.' :
'Get technical support and troubleshooting help for any issues you encounter.'}

## First Steps

1. **Create Your Account** - Sign up with your email and choose your account type
2. **Complete Your Profile** - Add all relevant information to maximize your visibility
3. **Explore Features** - Familiarize yourself with the platform's capabilities
4. **Start Connecting** - Begin ${categoryKey === 'speakers' ? 'applying to opportunities' : categoryKey === 'organizations' ? 'posting opportunities' : 'using the platform'}

## Key Features

### ${categoryKey === 'speakers' ? 'Speaker Dashboard' : categoryKey === 'organizations' ? 'Organization Portal' : 'Account Management'}
- View your activity and statistics
- Manage your profile and settings
- Track your progress and engagement

### ${categoryKey === 'speakers' ? 'Opportunity Search' : categoryKey === 'organizations' ? 'Speaker Database' : 'Payment Center'}
- ${categoryKey === 'speakers' ? 'Find speaking opportunities that match your expertise' : categoryKey === 'organizations' ? 'Search for speakers by topic, location, and more' : 'Manage payment methods and view invoices'}
- Use advanced filters to refine results
- Save searches for quick access

[!TIP]
Take time to explore all the features available in your account type to get the most out of CoveTalks.
                `
            },
            'best-practices': {
                title: `Best Practices - ${categoryName}`,
                content: `
# Best Practices for ${categoryName}

Follow these proven strategies to maximize your success on CoveTalks.

## Essential Tips

${categoryKey === 'speakers' ? `
### Profile Optimization
- Use a professional headshot
- Write a compelling bio that highlights your unique value
- List specific topics you're passionate about
- Include testimonials and past speaking engagements

### Application Strategy
- Apply only to relevant opportunities
- Customize your cover letter for each application
- Respond promptly to messages
- Follow up professionally` :
categoryKey === 'organizations' ? `
### Creating Effective Opportunities
- Write clear, detailed descriptions
- Specify requirements and expectations
- Set realistic deadlines
- Offer competitive compensation

### Speaker Selection
- Review profiles thoroughly
- Check references and past events
- Conduct brief interviews when needed
- Communicate expectations clearly` :
categoryKey === 'billing' ? `
### Subscription Management
- Choose the right plan for your needs
- Keep payment information updated
- Review invoices regularly
- Take advantage of annual pricing

### Cost Optimization
- Evaluate your usage monthly
- Upgrade when you need more features
- Consider team plans for multiple users` :
`### Getting Help
- Check documentation first
- Provide detailed information in support requests
- Include screenshots when reporting issues
- Follow up if you don't receive a response`}

## Common Mistakes to Avoid

1. Incomplete profiles or listings
2. Poor communication with other users
3. Ignoring platform guidelines
4. Not utilizing available features

[!NOTE]
Consistency and professionalism are key to building a strong reputation on CoveTalks.
                `
            },
            'faq': {
                title: `FAQ - ${categoryName}`,
                content: `
# Frequently Asked Questions - ${categoryName}

Find answers to the most common questions about ${categoryName}.

## General Questions

### How do I get started?
Start by creating your account and completing your profile. The more complete your profile, the better your results will be on the platform.

### What does it cost?
CoveTalks offers various subscription plans to meet different needs. Visit our pricing page for current rates and features.

### How long does approval take?
Most accounts are approved within 24 hours. You'll receive an email confirmation once your account is active.

## ${categoryKey === 'speakers' ? 'Speaker-Specific' : categoryKey === 'organizations' ? 'Organization-Specific' : 'Account'} Questions

${categoryKey === 'speakers' ? `
### How many opportunities can I apply to?
There's no limit to the number of opportunities you can apply to, but we recommend focusing on quality over quantity.

### Can I negotiate fees?
Yes, fee negotiation is encouraged. Be transparent about your rates and what's included.

### How do I get more visibility?
Complete your profile, stay active on the platform, collect testimonials, and respond quickly to inquiries.` :
categoryKey === 'organizations' ? `
### How do I find the right speaker?
Use our advanced search filters to narrow down speakers by topic, location, fee range, and availability.

### Can I contact speakers directly?
Yes, once you've posted an opportunity or identified potential speakers, you can message them directly.

### What if a speaker cancels?
We recommend having backup options and clear cancellation policies in your agreements.` :
categoryKey === 'billing' ? `
### How do I update my payment method?
Go to your account settings, select "Billing," and update your payment information.

### Can I change plans anytime?
Yes, you can upgrade or downgrade your plan at any time. Changes take effect at the next billing cycle.

### Do you offer refunds?
We offer refunds within 30 days of purchase for annual plans. See our refund policy for details.` :
`### How do I reset my password?
Click "Forgot Password" on the login page and follow the email instructions.

### Why can't I log in?
Check that you're using the correct email and password. Clear your browser cache if issues persist.

### How do I delete my account?
Contact support to request account deletion. Note that this action is permanent.`}

[!TIP]
Can't find your answer? Contact our support team for personalized assistance.
                `
            },
            'tips': {
                title: `Tips and Tricks - ${categoryName}`,
                content: `
# Tips and Tricks - ${categoryName}

Discover insider tips to make the most of your CoveTalks experience.

## Power User Tips

${categoryKey === 'speakers' ? `
### Stand Out from the Crowd
- **Video Introduction**: Add a short video to your profile
- **Unique Topics**: Offer niche expertise that's in demand
- **Quick Response**: Reply to inquiries within 2 hours
- **Portfolio Samples**: Include slides or videos from past talks

### Networking Strategies
- Connect with other speakers in your field
- Attend virtual meetups and events
- Share insights and engage with the community
- Build relationships with event organizers` :
categoryKey === 'organizations' ? `
### Efficient Speaker Selection
- **Saved Searches**: Create templates for common speaker needs
- **Team Collaboration**: Invite colleagues to review candidates
- **Rating System**: Develop internal criteria for evaluation
- **Pipeline Management**: Track speakers through your selection process

### Event Success Tips
- Book speakers well in advance
- Provide detailed event briefs
- Offer support for travel and logistics
- Collect feedback after events` :
categoryKey === 'billing' ? `
### Maximize Your Investment
- **Annual Plans**: Save 20% with yearly subscriptions
- **Team Accounts**: Get discounts for multiple users
- **Usage Tracking**: Monitor your platform usage monthly
- **Feature Utilization**: Use all features included in your plan

### Budget Management
- Set spending alerts
- Review monthly statements
- Plan for seasonal variations
- Consider upgrade timing carefully` :
`### Productivity Hacks
- **Keyboard Shortcuts**: Learn platform shortcuts for faster navigation
- **Browser Bookmarks**: Save frequently accessed pages
- **Email Filters**: Organize CoveTalks notifications
- **Mobile App**: Use the mobile app for on-the-go access

### Troubleshooting Tips
- Clear browser cache for display issues
- Check internet connection for loading problems
- Update your browser to the latest version
- Disable extensions that might interfere`}

## Hidden Features

1. **Advanced Search Operators**: Use quotes for exact matches
2. **Bulk Actions**: Select multiple items for batch processing
3. **Export Options**: Download your data in various formats
4. **Custom Notifications**: Set specific alert preferences

[!NOTE]
These tips are based on successful user experiences. Experiment to find what works best for you.
                `
            },
            'advanced': {
                title: `Advanced Features - ${categoryName}`,
                content: `
# Advanced Features - ${categoryName}

Take your CoveTalks experience to the next level with these advanced features.

## Advanced Capabilities

${categoryKey === 'speakers' ? `
### Analytics and Insights
- **Profile Views**: Track who's viewing your profile
- **Application Success Rate**: Monitor your acceptance rate
- **Engagement Metrics**: See which topics generate most interest
- **Revenue Tracking**: Monitor your speaking income

### Automation Features
- Set up auto-responses for common inquiries
- Create template applications for efficiency
- Schedule availability updates
- Automate follow-up messages` :
categoryKey === 'organizations' ? `
### Advanced Search and Filtering
- **Boolean Search**: Use AND/OR/NOT operators
- **Proximity Search**: Find speakers near specific locations
- **Availability Matching**: Filter by specific date ranges
- **Budget Optimization**: Find speakers within budget automatically

### Team Collaboration Tools
- Assign roles and permissions
- Share shortlists with stakeholders
- Collaborative rating and notes
- Approval workflows for bookings` :
categoryKey === 'billing' ? `
### Financial Management
- **Detailed Reports**: Export financial summaries
- **Multi-Currency Support**: Handle international payments
- **Tax Documentation**: Access tax-compliant receipts
- **Budget Forecasting**: Plan future expenses

### Enterprise Features
- Single Sign-On (SSO) integration
- Custom invoicing options
- Volume discounts
- Dedicated account management` :
`### API and Integrations
- **REST API Access**: Integrate with your systems
- **Webhook Support**: Real-time event notifications
- **Calendar Sync**: Connect with Google/Outlook
- **CRM Integration**: Sync with Salesforce, HubSpot

### Data Management
- Bulk import/export capabilities
- Custom fields and tags
- Advanced reporting tools
- Data retention policies`}

## Pro Strategies

### Optimization Techniques
1. Use A/B testing for profile elements
2. Analyze peak activity times
3. Optimize for search algorithms
4. Track conversion metrics

### Integration Workflows
- Connect with your existing tools
- Automate repetitive tasks
- Create custom workflows
- Monitor performance metrics

[!WARNING]
Advanced features may require higher-tier subscriptions. Check your plan details for availability.

## Getting Help with Advanced Features

Contact our enterprise support team for assistance with advanced features and custom configurations.
                `
            }
        };

        const articleType = typeContent[type] || typeContent['getting-started'];
        
        return {
            title: articleType.title,
            category: categoryKey,
            content: articleType.content,
            meta_description: `${articleType.title} - Comprehensive guide for ${categoryName} on CoveTalks.`,
            updated_at: new Date().toISOString(),
            view_count: Math.floor(Math.random() * 1000) + 100,
            helpful_count: Math.floor(Math.random() * 100) + 10,
            not_helpful_count: Math.floor(Math.random() * 10)
        };
    },

    // Render article content
    renderArticle(article) {
        // Update hero section
        document.getElementById('articleTitle').textContent = article.title;
        document.getElementById('mainTitle').textContent = article.title;
        
        // Update category link - make it functional
        const categoryLink = document.getElementById('categoryLink');
        categoryLink.textContent = this.formatCategoryName(article.category);
        categoryLink.href = `/help.html?category=${article.category}`;
        categoryLink.onclick = (e) => {
            e.preventDefault();
            window.location.href = `/help.html?category=${article.category}`;
        };
        
        // Update meta information
        document.getElementById('lastUpdated').textContent = this.formatDate(article.updated_at);
        document.getElementById('viewCount').textContent = `${article.view_count || 0} views`;
        document.getElementById('readTime').textContent = this.calculateReadTime(article.content);
        
        // Render article content
        const contentContainer = document.getElementById('articleContent');
        contentContainer.innerHTML = this.processContent(article.content);
        
        // Generate table of contents
        this.generateTableOfContents();
        
        // Show feedback section
        document.getElementById('feedbackSection').style.display = 'block';
        
        // Check if user has already submitted feedback
        this.checkFeedbackStatus();
    },

    // Process article content (convert markdown-like syntax to HTML)
    processContent(content) {
        // Basic markdown-like processing
        let html = content;
        
        // Convert headers
        html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
        html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
        
        // Convert bold and italic
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        // Convert links
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
        
        // Convert code blocks
        html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        // Convert lists
        html = html.replace(/^\* (.*)$/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
        html = html.replace(/^\d+\. (.*)$/gm, '<li>$1</li>');
        
        // Convert blockquotes
        html = html.replace(/^> (.*)$/gm, '<blockquote>$1</blockquote>');
        
        // Convert special boxes
        html = html.replace(/\[!NOTE\]([\s\S]*?)(?=\n\n|\n$|$)/g, '<div class="note">$1</div>');
        html = html.replace(/\[!TIP\]([\s\S]*?)(?=\n\n|\n$|$)/g, '<div class="tip">$1</div>');
        html = html.replace(/\[!WARNING\]([\s\S]*?)(?=\n\n|\n$|$)/g, '<div class="warning">$1</div>');
        
        // Convert paragraphs
        html = html.split('\n\n').map(para => {
            if (!para.startsWith('<') && para.trim()) {
                return `<p>${para}</p>`;
            }
            return para;
        }).join('\n');
        
        return html;
    },

    // Generate table of contents from h2 headers
    generateTableOfContents() {
        const headers = document.querySelectorAll('.article-body h2');
        const tocList = document.getElementById('tableOfContents');
        
        if (headers.length === 0) {
            tocList.innerHTML = '<li style="color: #999; font-size: 0.9rem;">No sections available</li>';
            return;
        }
        
        tocList.innerHTML = '';
        headers.forEach((header, index) => {
            // Add ID to header for anchoring
            const headerId = `section-${index}`;
            header.id = headerId;
            
            // Create TOC item
            const li = document.createElement('li');
            const link = document.createElement('a');
            link.href = `#${headerId}`;
            link.textContent = header.textContent;
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.scrollToSection(headerId);
            });
            
            li.appendChild(link);
            tocList.appendChild(li);
        });
    },

    // Scroll to section smoothly
    scrollToSection(sectionId) {
        const section = document.getElementById(sectionId);
        if (section) {
            const offset = 100; // Account for fixed header
            const elementPosition = section.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - offset;
            
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    },

    // Setup scroll spy for table of contents
    setupScrollSpy() {
        const headers = document.querySelectorAll('.article-body h2');
        const tocLinks = document.querySelectorAll('.toc-list a');
        
        const observerOptions = {
            rootMargin: '-100px 0px -70% 0px'
        };
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // Remove active class from all links
                    tocLinks.forEach(link => link.classList.remove('active'));
                    
                    // Add active class to corresponding link
                    const activeLink = document.querySelector(`.toc-list a[href="#${entry.target.id}"]`);
                    if (activeLink) {
                        activeLink.classList.add('active');
                    }
                }
            });
        }, observerOptions);
        
        headers.forEach(header => observer.observe(header));
    },

    // Load related articles
    async loadRelatedArticles(category, currentSlug) {
        try {
            // Mock related articles - in production, fetch from Supabase
            const mockRelated = [
                { title: 'Getting Started Guide', slug: `${category}-getting-started` },
                { title: 'Best Practices', slug: `${category}-best-practices` },
                { title: 'Frequently Asked Questions', slug: `${category}-faq` },
                { title: 'Advanced Tips', slug: `${category}-advanced` }
            ].filter(a => a.slug !== currentSlug).slice(0, 4);
            
            const container = document.getElementById('relatedArticles');
            
            if (mockRelated.length === 0) {
                container.innerHTML = '<li style="color: #999; font-size: 0.9rem;">No related articles found</li>';
                return;
            }
            
            container.innerHTML = mockRelated.map(article => `
                <li>
                    <a href="/help-article.html?article=${article.slug}">
                        <span>→</span>
                        <span>${this.escapeHtml(article.title)}</span>
                    </a>
                </li>
            `).join('');
            
        } catch (error) {
            console.error('Error loading related articles:', error);
        }
    },

    // Submit feedback
    async submitFeedback(isHelpful) {
        if (this.hasSubmittedFeedback) {
            this.showFeedbackMessage('You have already submitted feedback for this article.');
            return;
        }

        const buttons = document.querySelectorAll('.feedback-btn');
        buttons.forEach(btn => btn.disabled = true);

        try {
            // In production, send to Supabase
            if (window.covetalks && window.covetalks.markArticleHelpful) {
                await window.covetalks.markArticleHelpful(this.currentArticle.id, isHelpful);
            }
            
            // Mark the selected button as active
            const selectedBtn = isHelpful ? 
                document.querySelector('.feedback-btn.helpful') : 
                document.querySelector('.feedback-btn.not-helpful');
            
            selectedBtn.classList.add('active');
            
            // Store feedback status
            this.storeFeedbackStatus();
            this.hasSubmittedFeedback = true;
            
            // Show thank you message
            this.showFeedbackMessage('Thank you for your feedback!');
            
        } catch (error) {
            console.error('Error submitting feedback:', error);
            buttons.forEach(btn => btn.disabled = false);
            this.showFeedbackMessage('Unable to submit feedback. Please try again.');
        }
    },

    // Show feedback message
    showFeedbackMessage(message) {
        const feedbackSection = document.getElementById('feedbackSection');
        const originalContent = feedbackSection.innerHTML;
        
        feedbackSection.innerHTML = `
            <div style="padding: 2rem; color: #27ae60;">
                <h3>${message}</h3>
            </div>
        `;
        
        if (!this.hasSubmittedFeedback) {
            setTimeout(() => {
                feedbackSection.innerHTML = originalContent;
            }, 3000);
        }
    },

    // Store feedback status in localStorage
    storeFeedbackStatus() {
        const feedbackKey = `article_feedback_${this.currentArticle.slug}`;
        localStorage.setItem(feedbackKey, 'true');
    },

    // Check if user has already submitted feedback
    checkFeedbackStatus() {
        const feedbackKey = `article_feedback_${this.currentArticle.slug}`;
        this.hasSubmittedFeedback = localStorage.getItem(feedbackKey) === 'true';
        
        if (this.hasSubmittedFeedback) {
            const buttons = document.querySelectorAll('.feedback-btn');
            buttons.forEach(btn => btn.disabled = true);
        }
    },

    // Show error message
    showError(message) {
        const contentContainer = document.getElementById('articleContent');
        contentContainer.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: #999;">
                <h2 style="color: #e74c3c; margin-bottom: 1rem;">Oops!</h2>
                <p>${message}</p>
                <a href="/help.html" style="display: inline-block; margin-top: 1rem; padding: 0.75rem 1.5rem; background: #2B9AC9; color: white; text-decoration: none; border-radius: 8px;">
                    Return to Help Center
                </a>
            </div>
        `;
    },

    // Calculate read time
    calculateReadTime(content) {
        const wordsPerMinute = 200;
        const wordCount = content.split(/\s+/).length;
        const minutes = Math.ceil(wordCount / wordsPerMinute);
        return `${minutes} min read`;
    },

    // Format date
    formatDate(dateString) {
        const date = new Date(dateString);
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    },

    // Format category name
    formatCategoryName(category) {
        const categoryNames = {
            'speakers': 'For Speakers',
            'organizations': 'For Organizations',
            'billing': 'Billing',
            'technical': 'Technical',
            'getting_started': 'Getting Started',
            'best_practices': 'Best Practices',
            'account': 'Account Management',
            'payments': 'Payments & Billing'
        };
        return categoryNames[category] || category;
    },

    // Escape HTML
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    },

    // Setup event listeners
    setupEventListeners() {
        // Update breadcrumb home link
        const breadcrumbHome = document.querySelector('.breadcrumb a[href="/help"]');
        if (breadcrumbHome) {
            breadcrumbHome.href = '/help.html';
        }
        
        // Print article button
        const printBtn = document.createElement('button');
        printBtn.innerHTML = '🖨️ Print Article';
        printBtn.style.cssText = 'position: fixed; bottom: 2rem; right: 2rem; background: white; border: 2px solid #2B9AC9; color: #2B9AC9; padding: 0.75rem 1rem; border-radius: 25px; cursor: pointer; box-shadow: 0 4px 8px rgba(0,0,0,0.1); z-index: 100;';
        printBtn.addEventListener('click', () => window.print());
        document.body.appendChild(printBtn);
        
        // Update contact support link
        const contactLink = document.querySelector('a[href="/contact"]');
        if (contactLink) {
            contactLink.href = '/contact.html';
        }
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    ArticlePage.init();
});

// Export for use in other scripts
window.ArticlePage = ArticlePage;