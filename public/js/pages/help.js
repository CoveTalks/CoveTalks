// Help Page JavaScript
const HelpPage = {
    // Initialize the help page
    async init() {
        await this.loadPopularArticles();
        this.setupEventListeners();
        this.animateOnScroll();
    },

    // Load popular articles from database
    async loadPopularArticles() {
        try {
            const articles = await window.covetalks.getPopularArticles(8);
            
            // Group articles by category
            const articlesByCategory = {
                getting_started: [],
                best_practices: [],
                account: [],
                payments: []
            };

            articles.forEach(article => {
                if (articlesByCategory[article.category]) {
                    articlesByCategory[article.category].push(article);
                }
            });

            // Render articles in each category
            this.renderCategoryArticles('gettingStartedArticles', articlesByCategory.getting_started);
            this.renderCategoryArticles('bestPracticesArticles', articlesByCategory.best_practices);
            this.renderCategoryArticles('accountArticles', articlesByCategory.account);
            this.renderCategoryArticles('paymentsArticles', articlesByCategory.payments);

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
                <a href="/help/article/${article.slug}">
                    <span>${this.escapeHtml(article.title)}</span>
                    ${article.is_new ? '<span class="article-badge">NEW</span>' : ''}
                    ${article.view_count > 1000 ? '<span class="article-badge popular">POPULAR</span>' : ''}
                </a>
            </li>
        `).join('');
    },

    // Show error message for articles
    showArticlesError() {
        const containers = ['gettingStartedArticles', 'bestPracticesArticles', 'accountArticles', 'paymentsArticles'];
        containers.forEach(id => {
            const container = document.getElementById(id);
            if (container) {
                container.innerHTML = '<li style="color: #999;">Unable to load articles. Please try again later.</li>';
            }
        });
    },

    // Search help articles
    async searchHelp(event) {
        if (event.key === 'Enter') {
            await this.performSearch();
        }
    },

    // Perform search
    async performSearch() {
        const searchTerm = document.getElementById('helpSearch').value.trim();
        if (!searchTerm) {
            this.showSearchMessage('Please enter a search term');
            return;
        }

        // Show loading state
        const searchButton = document.querySelector('.help-search button');
        const originalText = searchButton.textContent;
        searchButton.textContent = 'Searching...';
        searchButton.disabled = true;

        try {
            const results = await window.covetalks.searchHelpArticles(searchTerm);
            
            // Store results in sessionStorage for the search results page
            sessionStorage.setItem('helpSearchResults', JSON.stringify(results));
            sessionStorage.setItem('helpSearchTerm', searchTerm);
            
            // Redirect to search results page
            window.location.href = `/help/search?q=${encodeURIComponent(searchTerm)}`;
            
        } catch (error) {
            console.error('Search error:', error);
            this.showSearchMessage('Search failed. Please try again.');
            
            // Reset button
            searchButton.textContent = originalText;
            searchButton.disabled = false;
        }
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

    // Navigate to category page
    navigateToCategory(category) {
        window.location.href = `/help/category/${category}`;
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

        // Contact options click handlers
        document.querySelectorAll('.contact-option').forEach(option => {
            option.style.cursor = 'pointer';
            option.addEventListener('click', (e) => {
                const value = option.querySelector('.contact-option-value').textContent;
                
                if (value.includes('@')) {
                    window.location.href = `mailto:${value}`;
                } else if (value.includes('800')) {
                    window.location.href = `tel:${value.replace(/-/g, '')}`;
                } else if (value.includes('Chat')) {
                    this.openLiveChat();
                }
            });
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

    // Open live chat
    openLiveChat() {
        // Check if it's within business hours (Mon-Fri, 9am-6pm EST)
        const now = new Date();
        const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
        const day = easternTime.getDay();
        const hour = easternTime.getHours();
        
        const isBusinessHours = day >= 1 && day <= 5 && hour >= 9 && hour < 18;
        
        if (isBusinessHours) {
            // In production, this would open a real chat widget
            console.log('Opening live chat...');
            
            // Placeholder for chat widget integration
            if (window.Intercom) {
                window.Intercom('show');
            } else if (window.drift) {
                window.drift.api.openChat();
            } else {
                // Fallback message
                alert('Live chat is currently being set up. Please email support@covetalks.com for immediate assistance.');
            }
        } else {
            alert('Live chat is available Monday-Friday, 9am-6pm EST. Please email support@covetalks.com for assistance.');
        }
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