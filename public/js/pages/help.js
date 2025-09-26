// Help Page JavaScript - FIXED VERSION
const HelpPage = {
    currentView: 'home',
    searchResults: [],
    currentCategory: null,

    // Initialize the help page
    async init() {
        // Check if we have URL parameters for search or category
        const urlParams = new URLSearchParams(window.location.search);
        const searchQuery = urlParams.get('q');
        const category = urlParams.get('category');
        
        if (searchQuery) {
            // Show search results
            document.getElementById('helpSearch').value = searchQuery;
            await this.performSearch(false);
        } else if (category) {
            // Show category articles
            await this.showCategoryArticles(category);
        } else {
            // Show normal help page
            await this.loadPopularArticles();
        }
        
        this.setupEventListeners();
        this.animateOnScroll();
    },

    // Load popular articles from database
    async loadPopularArticles() {
        try {
            // Simulated popular articles - in production, fetch from Supabase
            const mockArticles = {
                getting_started: [
                    { title: 'Creating Your Speaker Profile', slug: 'creating-speaker-profile', is_new: true },
                    { title: 'Finding Speaking Opportunities', slug: 'finding-opportunities', view_count: 1500 },
                    { title: 'Setting Your Speaking Fees', slug: 'setting-fees' }
                ],
                best_practices: [
                    { title: 'Writing Compelling Proposals', slug: 'writing-proposals', view_count: 2000 },
                    { title: 'Building Your Speaker Brand', slug: 'building-brand' },
                    { title: 'Networking Effectively', slug: 'networking-tips', is_new: true }
                ],
                account: [
                    { title: 'Managing Your Account', slug: 'account-management' },
                    { title: 'Privacy Settings', slug: 'privacy-settings' },
                    { title: 'Subscription Options', slug: 'subscription-options', view_count: 1800 }
                ],
                payments: [
                    { title: 'Payment Methods', slug: 'payment-methods' },
                    { title: 'Understanding Invoices', slug: 'understanding-invoices' },
                    { title: 'Refund Policy', slug: 'refund-policy' }
                ]
            };

            // Render articles in each category
            this.renderCategoryArticles('gettingStartedArticles', mockArticles.getting_started);
            this.renderCategoryArticles('bestPracticesArticles', mockArticles.best_practices);
            this.renderCategoryArticles('accountArticles', mockArticles.account);
            this.renderCategoryArticles('paymentsArticles', mockArticles.payments);

        } catch (error) {
            console.error('Error loading popular articles:', error);
            this.showArticlesError();
        }
    },

    // Render articles for a specific category
    renderCategoryArticles(elementId, articles) {
        const container = document.getElementById(elementId);
        if (!container) return;

        if (articles.length === 0) {
            container.innerHTML = '<li style="color: #999;">No articles available</li>';
            return;
        }

        container.innerHTML = articles.slice(0, 4).map(article => `
            <li>
                <a href="#" onclick="event.preventDefault(); HelpPage.viewArticle('${article.slug}')">
                    <span>${this.escapeHtml(article.title)}</span>
                    ${article.is_new ? '<span class="article-badge">NEW</span>' : ''}
                    ${article.view_count > 1000 ? '<span class="article-badge popular">POPULAR</span>' : ''}
                </a>
            </li>
        `).join('');
    },

    // View individual article
    viewArticle(slug) {
        // Navigate to the help-article.html page with the slug
        window.location.href = `/help-article.html?article=${slug}`;
    },

    // Search help articles
    async searchHelp(event) {
        if (event.key === 'Enter') {
            await this.performSearch();
        }
    },

    // Perform search and show results on same page
    async performSearch(updateUrl = true) {
        const searchTerm = document.getElementById('helpSearch').value.trim();
        if (!searchTerm) {
            this.showSearchMessage('Please enter a search term');
            return;
        }

        // Update URL without navigation
        if (updateUrl) {
            const newUrl = `${window.location.pathname}?q=${encodeURIComponent(searchTerm)}`;
            window.history.pushState({ search: searchTerm }, '', newUrl);
        }

        // Show loading state
        this.showSearchResults(searchTerm, true);

        try {
            // Simulated search results - in production, use Supabase search
            const mockResults = [
                {
                    title: 'How to Create a Speaker Profile',
                    slug: 'creating-speaker-profile',
                    excerpt: 'Learn how to create a compelling speaker profile that attracts organizations...',
                    category: 'getting_started'
                },
                {
                    title: 'Setting Your Speaking Fees',
                    slug: 'setting-fees',
                    excerpt: 'Guidelines for determining and setting your speaking fees...',
                    category: 'getting_started'
                },
                {
                    title: 'Finding Speaking Opportunities',
                    slug: 'finding-opportunities',
                    excerpt: 'Discover how to find and apply to speaking opportunities...',
                    category: 'getting_started'
                }
            ];

            this.searchResults = mockResults;
            this.showSearchResults(searchTerm, false);
            
        } catch (error) {
            console.error('Search error:', error);
            this.showSearchError(searchTerm);
        }
    },

    // Show search results in main content area
    showSearchResults(searchTerm, loading = false) {
        // Get the main container and clear everything except the hero
        const container = document.querySelector('.main-content .container');
        const heroSection = document.querySelector('.help-hero');
        
        // Clear container and keep only hero if it exists
        container.innerHTML = '';
        
        if (loading) {
            container.innerHTML = `
                <div class="search-results-container">
                    <h2>Searching for "${this.escapeHtml(searchTerm)}"...</h2>
                    <div class="loading-spinner" style="margin: 3rem auto; width: 40px; height: 40px; border: 4px solid #E5E5E5; border-top-color: #2B9AC9; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                </div>
            `;
            return;
        }

        const resultsHtml = this.searchResults.length > 0 ? `
            <div class="search-results-container" style="padding: 2rem 0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <h2>${this.searchResults.length} results for "${this.escapeHtml(searchTerm)}"</h2>
                    <button onclick="HelpPage.clearSearch()" class="btn btn-secondary">Clear Search</button>
                </div>
                
                <div class="search-results-grid" style="display: grid; gap: 1.5rem;">
                    ${this.searchResults.map(result => `
                        <div class="search-result-card" style="background: white; padding: 1.5rem; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); cursor: pointer;" 
                             onclick="HelpPage.viewArticle('${result.slug}')">
                            <div style="color: #2B9AC9; font-size: 0.9rem; margin-bottom: 0.5rem;">
                                ${this.getCategoryLabel(result.category)}
                            </div>
                            <h3 style="color: #155487; margin-bottom: 0.75rem;">${this.escapeHtml(result.title)}</h3>
                            <p style="color: #666; line-height: 1.6;">${this.escapeHtml(result.excerpt)}</p>
                            <a href="#" onclick="event.stopPropagation(); event.preventDefault(); HelpPage.viewArticle('${result.slug}')" 
                               style="color: #2B9AC9; text-decoration: none; font-weight: 600; display: inline-block; margin-top: 1rem;">
                                Read More →
                            </a>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : `
            <div class="search-results-container" style="text-align: center; padding: 3rem;">
                <h2>No results found for "${this.escapeHtml(searchTerm)}"</h2>
                <p style="color: #666; margin: 1rem 0;">Try searching with different keywords or browse our categories below.</p>
                <button onclick="HelpPage.clearSearch()" class="btn btn-secondary">Back to Help Center</button>
            </div>
        `;

        container.innerHTML = resultsHtml;
    },

    // Clear search and return to normal view
    clearSearch() {
        document.getElementById('helpSearch').value = '';
        window.history.pushState({}, '', '/help.html');
        window.location.reload();
    },

    // Show category articles
    async showCategoryArticles(category) {
        // Hide the original content and show category view
        const mainContent = document.querySelector('.main-content');
        
        // Category display names
        const categoryInfo = {
            'speakers': {
                title: 'For Speakers',
                icon: '🎤',
                description: 'Everything you need to know about being a speaker on CoveTalks'
            },
            'organizations': {
                title: 'For Organizations', 
                icon: '🏢',
                description: 'Learn how to find and book the perfect speakers for your events'
            },
            'billing': {
                title: 'Billing & Subscriptions',
                icon: '💳',
                description: 'Manage your subscription and payment information'
            },
            'technical': {
                title: 'Technical Support',
                icon: '⚙️',
                description: 'Get help with technical issues and troubleshooting'
            }
        };

        const info = categoryInfo[category] || { title: category, icon: '📚', description: '' };

        // Mock articles for category - in production, fetch from Supabase
        const mockCategoryArticles = [
            { title: 'Getting Started Guide', slug: `${category}-getting-started` },
            { title: 'Best Practices', slug: `${category}-best-practices` },
            { title: 'Frequently Asked Questions', slug: `${category}-faq` },
            { title: 'Tips and Tricks', slug: `${category}-tips` },
            { title: 'Advanced Features', slug: `${category}-advanced` }
        ];

        mainContent.innerHTML = `
            <div style="background: linear-gradient(135deg, #155487 0%, #2B9AC9 100%); color: white; padding: 4rem 2rem; margin-bottom: 2rem;">
                <div class="container" style="max-width: 800px; margin: 0 auto; text-align: center;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">${info.icon}</div>
                    <h1 style="font-size: 2.5rem; margin-bottom: 1rem; color: white;">${info.title}</h1>
                    <p style="font-size: 1.1rem; opacity: 0.95;">${info.description}</p>
                    <button onclick="HelpPage.clearSearch()" style="margin-top: 1.5rem; background: white; color: #155487; border: none; padding: 0.75rem 1.5rem; border-radius: 25px; font-weight: 600; cursor: pointer;">
                        ← Back to Help Center
                    </button>
                </div>
            </div>
            
            <div class="container" style="max-width: 800px; margin: 2rem auto; padding: 0 1rem;">
                <div style="display: grid; gap: 1rem;">
                    ${mockCategoryArticles.map(article => `
                        <div style="background: white; padding: 1.5rem; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); cursor: pointer; transition: all 0.3s ease;"
                             onclick="HelpPage.viewArticle('${article.slug}')"
                             onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'"
                             onmouseout="this.style.transform=''; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)'">
                            <h3 style="color: #155487; margin-bottom: 0.5rem;">${article.title}</h3>
                            <p style="color: #666;">Learn more about ${article.title.toLowerCase()} in the ${info.title} section.</p>
                            <span style="color: #2B9AC9; font-weight: 600;">Read Article →</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    // Navigate to category page (now handled on same page)
    navigateToCategory(category) {
        window.history.pushState({ category }, '', `/help.html?category=${category}`);
        this.showCategoryArticles(category);
    },

    // Get category label
    getCategoryLabel(category) {
        const labels = {
            'getting_started': 'Getting Started',
            'best_practices': 'Best Practices',
            'account': 'Account Management',
            'payments': 'Payments & Billing',
            'speakers': 'For Speakers',
            'organizations': 'For Organizations',
            'billing': 'Billing',
            'technical': 'Technical Support'
        };
        return labels[category] || category;
    },

    // Show search message
    showSearchMessage(message) {
        const searchInput = document.getElementById('helpSearch');
        const originalPlaceholder = searchInput.placeholder;
        searchInput.placeholder = message;
        searchInput.value = '';
        
        setTimeout(() => {
            searchInput.placeholder = originalPlaceholder;
        }, 3000);
    },

    // Setup event listeners
    setupEventListeners() {
        // Search input focus effect
        const searchInput = document.getElementById('helpSearch');
        const searchContainer = document.querySelector('.help-search');
        
        if (searchInput && searchContainer) {
            searchInput.addEventListener('focus', () => {
                searchContainer.style.boxShadow = '0 10px 50px rgba(21, 84, 135, 0.25)';
            });
            
            searchInput.addEventListener('blur', () => {
                searchContainer.style.boxShadow = '0 10px 40px rgba(21, 84, 135, 0.15)';
            });
        }

        // Fix contact options
        document.querySelectorAll('.contact-option').forEach(option => {
            option.style.cursor = 'pointer';
            option.addEventListener('click', (e) => {
                const value = option.querySelector('.contact-option-value').textContent;
                
                if (value.includes('@')) {
                    // Email support - use mailto
                    e.preventDefault();
                    window.location.href = `mailto:support@covetalks.com?subject=Help Request`;
                } else if (value.includes('9am-6pm')) {
                    // Live chat - go to contact page
                    e.preventDefault();
                    window.location.href = '/contact.html';
                }
            });
        });

        // Handle browser back/forward buttons
        window.addEventListener('popstate', (event) => {
            if (event.state && event.state.search) {
                document.getElementById('helpSearch').value = event.state.search;
                this.performSearch(false);
            } else if (event.state && event.state.category) {
                this.showCategoryArticles(event.state.category);
            } else {
                window.location.reload();
            }
        });
    },

    // Animate elements on scroll
    animateOnScroll() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        // Observe all cards and sections
        const elements = document.querySelectorAll('.help-card, .article-category, .contact-section');
        elements.forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';
            el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            observer.observe(el);
        });
    },

    // Show articles error
    showArticlesError() {
        const containers = ['gettingStartedArticles', 'bestPracticesArticles', 'accountArticles', 'paymentsArticles'];
        containers.forEach(id => {
            const container = document.getElementById(id);
            if (container) {
                container.innerHTML = '<li style="color: #999;">Unable to load articles. Please try again later.</li>';
            }
        });
    },

    // Show search error
    showSearchError(searchTerm) {
        const container = document.querySelector('.main-content .container');
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem;">
                <h2 style="color: #e74c3c;">Search Error</h2>
                <p style="color: #666;">Unable to search for "${this.escapeHtml(searchTerm)}". Please try again.</p>
                <button onclick="HelpPage.clearSearch()" class="btn btn-secondary">Back to Help Center</button>
            </div>
        `;
    },

    // Utility function to escape HTML
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

    // Track page view
    async trackPageView() {
        if (window.covetalks && window.covetalks.trackActivity) {
            await window.covetalks.trackActivity('help_center_viewed', null, {
                page: 'help_center_home'
            });
        }
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    HelpPage.init();
    HelpPage.trackPageView();
});

// Export for use in other scripts
window.HelpPage = HelpPage;