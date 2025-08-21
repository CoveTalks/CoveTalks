// FAQ Page JavaScript
const FAQPage = {
    faqs: [],
    filteredFAQs: [],
    currentCategory: 'all',
    expandedItems: new Set(),

    // Initialize the FAQ page
    async init() {
        await this.loadFAQs();
        this.setupEventListeners();
        this.updateCategoryCounts();
        this.trackPageView();
    },

    // Load FAQs from database
    async loadFAQs() {
        try {
            const faqs = await window.covetalks.getFAQs();
            this.faqs = faqs;
            this.filteredFAQs = faqs;
            this.renderFAQs();
        } catch (error) {
            console.error('Error loading FAQs:', error);
            this.showError();
        }
    },

    // Render FAQ items
    renderFAQs() {
        const container = document.getElementById('faqContainer');
        
        if (this.filteredFAQs.length === 0) {
            container.innerHTML = this.getEmptyState();
            return;
        }

        container.innerHTML = this.filteredFAQs.map(faq => this.createFAQItem(faq)).join('');
        
        // Restore expanded state
        this.expandedItems.forEach(id => {
            const item = document.querySelector(`[data-faq-id="${id}"]`);
            if (item) {
                item.classList.add('active');
            }
        });
    },

    // Create FAQ item HTML
    createFAQItem(faq) {
        const isExpanded = this.expandedItems.has(faq.id);
        const categoryLabel = this.getCategoryLabel(faq.category);
        
        return `
            <div class="faq-item ${isExpanded ? 'active' : ''}" data-faq-id="${faq.id}">
                <div class="faq-question" onclick="FAQPage.toggleFAQ('${faq.id}')">
                    <div class="faq-question-content">
                        <h3>${this.escapeHtml(faq.question)}</h3>
                        <div class="faq-meta">
                            <span class="faq-category-tag">${categoryLabel}</span>
                            ${faq.helpful_count > 0 ? `
                                <span class="faq-helpful">
                                    👍 ${faq.helpful_count} found this helpful
                                </span>
                            ` : ''}
                        </div>
                    </div>
                    <div class="faq-toggle">
                        <span>${isExpanded ? '−' : '+'}</span>
                    </div>
                </div>
                <div class="faq-answer">
                    <div class="faq-answer-content">
                        ${this.processAnswer(faq.answer)}
                    </div>
                    ${!this.hasSubmittedFeedback(faq.id) ? `
                        <div class="faq-feedback">
                            <span class="faq-feedback-text">Was this answer helpful?</span>
                            <div class="faq-feedback-buttons">
                                <button class="feedback-btn helpful" onclick="FAQPage.submitFeedback('${faq.id}', true)">
                                    <span>👍</span>
                                    <span>Yes</span>
                                </button>
                                <button class="feedback-btn not-helpful" onclick="FAQPage.submitFeedback('${faq.id}', false)">
                                    <span>👎</span>
                                    <span>No</span>
                                </button>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    },

    // Process answer content (convert markdown-like syntax)
    processAnswer(answer) {
        // Convert line breaks to paragraphs
        const paragraphs = answer.split('\n\n');
        return paragraphs.map(para => {
            // Check for lists
            if (para.includes('\n•') || para.includes('\n-')) {
                const items = para.split('\n').filter(item => item.trim());
                return `<ul>${items.map(item => 
                    `<li>${item.replace(/^[•\-]\s*/, '')}</li>`
                ).join('')}</ul>`;
            }
            // Check for numbered lists
            if (para.match(/^\d+\./m)) {
                const items = para.split('\n').filter(item => item.trim());
                return `<ol>${items.map(item => 
                    `<li>${item.replace(/^\d+\.\s*/, '')}</li>`
                ).join('')}</ol>`;
            }
            // Regular paragraph
            return `<p>${para}</p>`;
        }).join('');
    },

    // Toggle FAQ item
    toggleFAQ(faqId) {
        const item = document.querySelector(`[data-faq-id="${faqId}"]`);
        if (!item) return;

        const isActive = item.classList.contains('active');
        
        if (isActive) {
            item.classList.remove('active');
            this.expandedItems.delete(faqId);
        } else {
            item.classList.add('active');
            this.expandedItems.add(faqId);
            
            // Track view
            this.trackFAQView(faqId);
        }
    },

    // Track FAQ view
    async trackFAQView(faqId) {
        try {
            await window.covetalks.incrementFAQViews(faqId);
        } catch (error) {
            console.error('Error tracking FAQ view:', error);
        }
    },

    // Submit feedback
    async submitFeedback(faqId, isHelpful) {
        try {
            await window.covetalks.markFAQHelpful(faqId, isHelpful);
            
            // Store feedback in localStorage
            const feedbackKey = `faq_feedback_${faqId}`;
            localStorage.setItem(feedbackKey, 'true');
            
            // Update UI
            const item = document.querySelector(`[data-faq-id="${faqId}"]`);
            const feedbackSection = item.querySelector('.faq-feedback');
            if (feedbackSection) {
                feedbackSection.innerHTML = `
                    <div style="text-align: center; color: #27ae60; padding: 1rem;">
                        Thank you for your feedback!
                    </div>
                `;
            }
            
            // Update helpful count in data
            const faq = this.faqs.find(f => f.id === faqId);
            if (faq && isHelpful) {
                faq.helpful_count = (faq.helpful_count || 0) + 1;
            }
            
            // Track activity
            if (window.covetalks && window.covetalks.trackActivity) {
                await window.covetalks.trackActivity('faq_feedback', null, {
                    faq_id: faqId,
                    is_helpful: isHelpful
                });
            }
        } catch (error) {
            console.error('Error submitting feedback:', error);
        }
    },

    // Check if user has submitted feedback
    hasSubmittedFeedback(faqId) {
        const feedbackKey = `faq_feedback_${faqId}`;
        return localStorage.getItem(feedbackKey) === 'true';
    },

    // Filter by category
    filterByCategory(category) {
        this.currentCategory = category;
        
        // Update active button
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.closest('.category-btn').classList.add('active');
        
        // Filter FAQs
        if (category === 'all') {
            this.filteredFAQs = this.faqs;
        } else {
            this.filteredFAQs = this.faqs.filter(faq => faq.category === category);
        }
        
        // Clear search
        document.getElementById('faqSearch').value = '';
        
        this.renderFAQs();
    },

    // Search FAQs
    searchFAQs(event) {
        if (event.key === 'Enter') {
            this.performSearch();
        }
    },

    // Perform search
    async performSearch() {
        const searchTerm = document.getElementById('faqSearch').value.trim().toLowerCase();
        
        if (!searchTerm) {
            // Reset to current category
            if (this.currentCategory === 'all') {
                this.filteredFAQs = this.faqs;
            } else {
                this.filteredFAQs = this.faqs.filter(faq => faq.category === this.currentCategory);
            }
        } else {
            // Search in questions and answers
            this.filteredFAQs = this.faqs.filter(faq => {
                const matchesSearch = faq.question.toLowerCase().includes(searchTerm) ||
                                     faq.answer.toLowerCase().includes(searchTerm);
                const matchesCategory = this.currentCategory === 'all' || 
                                       faq.category === this.currentCategory;
                return matchesSearch && matchesCategory;
            });
            
            // Track search
            if (window.covetalks && window.covetalks.trackActivity) {
                await window.covetalks.trackActivity('faq_search', null, {
                    search_term: searchTerm,
                    results_count: this.filteredFAQs.length
                });
            }
        }
        
        this.renderFAQs();
    },

    // Update category counts
    updateCategoryCounts() {
        const counts = {
            all: this.faqs.length,
            general: 0,
            speakers: 0,
            organizations: 0,
            billing: 0,
            technical: 0
        };
        
        this.faqs.forEach(faq => {
            if (counts[faq.category] !== undefined) {
                counts[faq.category]++;
            }
        });
        
        // Update UI
        Object.keys(counts).forEach(category => {
            const element = document.getElementById(`count${this.capitalizeFirst(category)}`);
            if (element) {
                element.textContent = counts[category];
            }
        });
    },

    // Get category label
    getCategoryLabel(category) {
        const labels = {
            'general': 'General',
            'speakers': 'For Speakers',
            'organizations': 'For Organizations',
            'billing': 'Billing',
            'technical': 'Technical'
        };
        return labels[category] || category;
    },

    // Get empty state HTML
    getEmptyState() {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">🔍</div>
                <h3>No FAQs Found</h3>
                <p>We couldn't find any questions matching your criteria.</p>
                <button onclick="FAQPage.resetFilters()" class="btn btn-primary" style="margin-top: 1rem;">
                    Show All FAQs
                </button>
            </div>
        `;
    },

    // Reset filters
    resetFilters() {
        this.currentCategory = 'all';
        this.filteredFAQs = this.faqs;
        document.getElementById('faqSearch').value = '';
        
        // Update active button
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector('.category-btn').classList.add('active');
        
        this.renderFAQs();
    },

    // Show error state
    showError() {
        const container = document.getElementById('faqContainer');
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <h3>Unable to Load FAQs</h3>
                <p>We're having trouble loading the FAQs. Please try again later.</p>
                <button onclick="location.reload()" class="btn btn-primary" style="margin-top: 1rem;">
                    Refresh Page
                </button>
            </div>
        `;
    },

    // Setup event listeners
    setupEventListeners() {
        // Search input focus effect
        const searchInput = document.getElementById('faqSearch');
        const searchContainer = document.querySelector('.faq-search');
        
        if (searchInput && searchContainer) {
            searchInput.addEventListener('focus', () => {
                searchContainer.style.boxShadow = '0 10px 50px rgba(21, 84, 135, 0.25)';
            });
            
            searchInput.addEventListener('blur', () => {
                searchContainer.style.boxShadow = '0 10px 40px rgba(21, 84, 135, 0.15)';
            });
        }

        // Smooth scroll for anchor links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
    },

    // Track page view
    async trackPageView() {
        if (window.covetalks && window.covetalks.trackActivity) {
            await window.covetalks.trackActivity('faq_page_viewed', null, {
                page: 'faq'
            });
        }
    },

    // Utility functions
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

    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    FAQPage.init();
});

// Export for use in other scripts
window.FAQPage = FAQPage;