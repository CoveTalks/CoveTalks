// Help Article Page JavaScript
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

    // Get article slug from URL
    getArticleSlug() {
        const pathParts = window.location.pathname.split('/');
        return pathParts[pathParts.length - 1];
    },

    // Load article from database
    async loadArticle(slug) {
        try {
            const article = await window.covetalks.getHelpArticle(slug);
            
            if (!article) {
                this.showError('Article not found');
                return;
            }

            this.currentArticle = article;
            this.renderArticle(article);
            this.loadRelatedArticles(article.category, article.id);
            
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

    // Render article content
    renderArticle(article) {
        // Update hero section
        document.getElementById('articleTitle').textContent = article.title;
        document.getElementById('mainTitle').textContent = article.title;
        
        // Update category link
        const categoryLink = document.getElementById('categoryLink');
        categoryLink.textContent = this.formatCategoryName(article.category);
        categoryLink.href = `/help/category/${article.category}`;
        
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
    async loadRelatedArticles(category, currentArticleId) {
        try {
            const articles = await window.covetalks.getHelpArticles(category, 5);
            const relatedArticles = articles.filter(a => a.id !== currentArticleId).slice(0, 4);
            
            const container = document.getElementById('relatedArticles');
            
            if (relatedArticles.length === 0) {
                container.innerHTML = '<li style="color: #999; font-size: 0.9rem;">No related articles found</li>';
                return;
            }
            
            container.innerHTML = relatedArticles.map(article => `
                <li>
                    <a href="/help/article/${article.slug}">
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
            await window.covetalks.markArticleHelpful(this.currentArticle.id, isHelpful);
            
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
            
            // Track activity
            if (window.covetalks && window.covetalks.trackActivity) {
                await window.covetalks.trackActivity('help_article_feedback', null, {
                    article_id: this.currentArticle.id,
                    article_slug: this.currentArticle.slug,
                    is_helpful: isHelpful
                });
            }
            
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
        const feedbackKey = `article_feedback_${this.currentArticle.id}`;
        localStorage.setItem(feedbackKey, 'true');
    },

    // Check if user has already submitted feedback
    checkFeedbackStatus() {
        const feedbackKey = `article_feedback_${this.currentArticle.id}`;
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
                <a href="/help" style="display: inline-block; margin-top: 1rem; padding: 0.75rem 1.5rem; background: #2B9AC9; color: white; text-decoration: none; border-radius: 8px;">
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
        // Print article
        const printBtn = document.createElement('button');
        printBtn.innerHTML = '🖨️ Print Article';
        printBtn.style.cssText = 'position: fixed; bottom: 2rem; right: 2rem; background: white; border: 2px solid #2B9AC9; color: #2B9AC9; padding: 0.75rem 1rem; border-radius: 25px; cursor: pointer; box-shadow: 0 4px 8px rgba(0,0,0,0.1); z-index: 100;';
        printBtn.addEventListener('click', () => window.print());
        document.body.appendChild(printBtn);
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    ArticlePage.init();
});

// Export for use in other scripts
window.ArticlePage = ArticlePage;