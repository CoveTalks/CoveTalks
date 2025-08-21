// Success Stories Page JavaScript
const SuccessStories = {
    stories: [],
    filteredStories: [],
    testimonials: [],
    currentFilter: 'all',
    stats: {
        totalConnections: 0,
        avgRating: 0,
        countriesReached: 0,
        speakerEarnings: 0
    },

    // Initialize the page
    async init() {
        await this.loadStats();
        await this.loadStories();
        await this.loadTestimonials();
        this.setupEventListeners();
        this.animateOnScroll();
        this.trackPageView();
    },

    // Load impact statistics
    async loadStats() {
        try {
            const stats = await window.covetalks.getSuccessStats();
            this.stats = stats;
            this.animateStats();
        } catch (error) {
            console.log('Using default stats');
            // Use default values if loading fails
            this.stats = {
                totalConnections: 2847,
                avgRating: 4.8,
                countriesReached: 42,
                speakerEarnings: 1250000
            };
            this.animateStats();
        }
    },

    // Animate statistics counters
    animateStats() {
        this.animateValue('totalConnections', 0, this.stats.totalConnections || 2847, 2000);
        this.animateValue('avgRating', 0, this.stats.avgRating || 4.8, 2000, 1);
        this.animateValue('countriesReached', 0, this.stats.countriesReached || 42, 2000);
        this.animateValue('speakerEarnings', 0, this.stats.speakerEarnings || 1250000, 2000, 0, true);
    },

    // Animate counter values
    animateValue(id, start, end, duration, decimals = 0, isCurrency = false) {
        const element = document.getElementById(id);
        if (!element) return;

        const startTime = Date.now();
        const endTime = startTime + duration;

        const update = () => {
            const now = Date.now();
            const progress = Math.min((now - startTime) / duration, 1);
            
            // Easing function for smooth animation
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            const current = start + (end - start) * easeOutQuart;
            
            if (isCurrency) {
                element.textContent = '$' + this.formatNumber(Math.floor(current));
            } else if (decimals > 0) {
                element.textContent = current.toFixed(decimals);
            } else {
                element.textContent = Math.floor(current).toLocaleString();
            }
            
            if (progress < 1) {
                requestAnimationFrame(update);
            }
        };
        
        requestAnimationFrame(update);
    },

    // Format large numbers
    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(0) + 'K';
        }
        return num.toLocaleString();
    },

    // Load success stories
    async loadStories() {
        try {
            const stories = await window.covetalks.getSuccessStories();
            this.stories = stories;
            this.filteredStories = stories;
            
            // Load featured story
            const featured = stories.find(s => s.is_featured) || stories[0];
            if (featured) {
                this.renderFeaturedStory(featured);
            }
            
            // Render stories grid
            this.renderStories();
        } catch (error) {
            console.error('Error loading stories:', error);
            this.showError('stories');
        }
    },

    // Render featured story
    renderFeaturedStory(story) {
        const container = document.getElementById('featuredStory');
        
        container.innerHTML = `
            <div class="featured-content">
                <div class="featured-image">
                    ${story.image_url ? 
                        `<img src="${story.image_url}" alt="${this.escapeHtml(story.title)}">` :
                        `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 4rem;">🌟</div>`
                    }
                    <div class="featured-badge">Featured Story</div>
                </div>
                <div class="featured-text">
                    <div class="featured-category">${this.getCategoryLabel(story.category)}</div>
                    <h2 class="featured-title">${this.escapeHtml(story.title)}</h2>
                    <div class="featured-quote">${this.escapeHtml(story.quote || story.excerpt)}</div>
                    
                    <div class="featured-author">
                        <div class="author-avatar">
                            ${story.author_avatar ? 
                                `<img src="${story.author_avatar}" alt="${this.escapeHtml(story.author_name)}">` :
                                story.author_name.charAt(0).toUpperCase()
                            }
                        </div>
                        <div class="author-info">
                            <div class="author-name">${this.escapeHtml(story.author_name)}</div>
                            <div class="author-role">${this.escapeHtml(story.author_role)}</div>
                        </div>
                    </div>
                    
                    <a href="#" onclick="event.preventDefault(); SuccessStories.expandStory('${story.slug}')" class="featured-link">
                        Read Full Story →
                    </a>
                </div>
            </div>
        `;
    },

    // Render stories grid
    renderStories() {
        const container = document.getElementById('storiesGrid');
        
        // Filter out featured story from grid
        const gridStories = this.filteredStories.filter(s => !s.is_featured);
        
        if (gridStories.length === 0) {
            container.innerHTML = this.getEmptyState();
            return;
        }
        
        container.innerHTML = gridStories.slice(0, 9).map(story => this.createStoryCard(story)).join('');
    },

    // Create story card HTML
    createStoryCard(story) {
        const typeLabel = story.story_type === 'speaker' ? 'Speaker Story' : 'Organization Story';
        const typeBadgeClass = story.story_type === 'speaker' ? 'speaker' : 'organization';
        
        return `
            <div class="story-card" onclick="SuccessStories.viewStory('${story.slug}')">
                <div class="story-type-badge ${typeBadgeClass}">${typeLabel}</div>
                <div class="story-image">
                    ${story.image_url ? 
                        `<img src="${story.image_url}" alt="${this.escapeHtml(story.title)}">` :
                        `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 3rem; color: white;">
                            ${story.story_type === 'speaker' ? '🎤' : '🏢'}
                        </div>`
                    }
                </div>
                <div class="story-content">
                    <div class="story-category">${this.getCategoryLabel(story.category)}</div>
                    <h3 class="story-title">${this.escapeHtml(story.title)}</h3>
                    <p class="story-excerpt">${this.escapeHtml(story.excerpt)}</p>
                    
                    <div class="story-metrics">
                        ${story.event_size ? `
                            <div class="metric">
                                <span class="metric-icon">👥</span>
                                <span>${story.event_size} attendees</span>
                            </div>
                        ` : ''}
                        ${story.rating ? `
                            <div class="metric">
                                <span class="metric-icon">⭐</span>
                                <span>${story.rating} rating</span>
                            </div>
                        ` : ''}
                        ${story.impact_metric ? `
                            <div class="metric">
                                <span class="metric-icon">📈</span>
                                <span>${story.impact_metric}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    },

    // Load testimonials
    async loadTestimonials() {
        try {
            const testimonials = await window.covetalks.getTestimonials(4);
            this.testimonials = testimonials;
            this.renderTestimonials();
        } catch (error) {
            console.error('Error loading testimonials:', error);
        }
    },

    // Render testimonials
    renderTestimonials() {
        const container = document.getElementById('testimonialsGrid');
        
        if (this.testimonials.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--color-gray);">Loading testimonials...</p>';
            return;
        }
        
        container.innerHTML = this.testimonials.map(testimonial => `
            <div class="testimonial-card">
                <div class="testimonial-text">
                    ${this.escapeHtml(testimonial.content)}
                </div>
                <div class="testimonial-author">
                    <div class="testimonial-avatar">
                        ${testimonial.avatar_url ? 
                            `<img src="${testimonial.avatar_url}" alt="${this.escapeHtml(testimonial.author_name)}" style="width: 100%; height: 100%; object-fit: cover;">` :
                            testimonial.author_name.charAt(0).toUpperCase()
                        }
                    </div>
                    <div class="testimonial-info">
                        <div class="testimonial-name">${this.escapeHtml(testimonial.author_name)}</div>
                        <div class="testimonial-role">${this.escapeHtml(testimonial.author_role)}</div>
                    </div>
                    ${testimonial.rating ? `
                        <div class="testimonial-rating">
                            ${'⭐'.repeat(testimonial.rating)}
                        </div>
                    ` : ''}
                </div>
            </div>
        `).join('');
    },

    // Filter stories
    filterStories(filter) {
        this.currentFilter = filter;
        
        // Update active tab
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        event.target.classList.add('active');
        
        // Filter stories
        if (filter === 'all') {
            this.filteredStories = this.stories;
        } else if (filter === 'featured') {
            this.filteredStories = this.stories.filter(s => s.is_featured);
        } else {
            this.filteredStories = this.stories.filter(s => s.story_type === filter);
        }
        
        this.renderStories();
        
        // Smooth scroll to stories grid
        const gridElement = document.getElementById('storiesGrid');
        gridElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    // View individual story - when clicking on story card
    viewStory(slug) {
        const story = this.stories.find(s => s.slug === slug);
        if (story) {
            this.showStoryModal(story);
        }
    },

    // Expand story - when clicking "Read Full Story" on featured
    expandStory(slug) {
        const story = this.stories.find(s => s.slug === slug);
        if (story) {
            this.showStoryModal(story);
        }
    },

    // Show story in modal
    showStoryModal(story) {
        // Create modal if it doesn't exist
        let modal = document.getElementById('storyModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'storyModal';
            modal.className = 'story-modal';
            modal.innerHTML = `
                <div class="story-modal-content">
                    <button class="story-modal-close" onclick="SuccessStories.closeStoryModal()">&times;</button>
                    <div class="story-modal-header">
                        <div class="story-modal-category"></div>
                        <h2 class="story-modal-title"></h2>
                        <div class="story-modal-meta"></div>
                    </div>
                    <div class="story-modal-body"></div>
                    <div class="story-modal-footer">
                        <div class="story-modal-author"></div>
                        <div class="story-modal-actions">
                            <button class="btn btn-secondary" onclick="SuccessStories.shareStory()">Share Story</button>
                            <button class="btn btn-primary" onclick="SuccessStories.closeStoryModal()">Close</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            // Add click outside to close
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeStoryModal();
                }
            });

            // Add ESC key to close
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && modal.classList.contains('show')) {
                    this.closeStoryModal();
                }
            });
        }

        // Populate modal with story content
        modal.querySelector('.story-modal-category').textContent = this.getCategoryLabel(story.category);
        modal.querySelector('.story-modal-title').textContent = story.title;
        
        // Meta information
        const metaHtml = [];
        if (story.event_name) metaHtml.push(`<span>📍 ${story.event_name}</span>`);
        if (story.event_date) metaHtml.push(`<span>📅 ${new Date(story.event_date).toLocaleDateString()}</span>`);
        if (story.location) metaHtml.push(`<span>🌍 ${story.location}</span>`);
        if (story.event_size) metaHtml.push(`<span>👥 ${story.event_size} attendees</span>`);
        modal.querySelector('.story-modal-meta').innerHTML = metaHtml.join(' • ');

        // Main content
        const contentHtml = `
            ${story.quote ? `<blockquote class="story-quote">"${this.escapeHtml(story.quote)}"</blockquote>` : ''}
            <div class="story-full-content">${this.formatContent(story.content)}</div>
            ${story.impact_metric ? `
                <div class="story-impact">
                    <h3>Impact</h3>
                    <p class="impact-metric">📈 ${story.impact_metric}</p>
                </div>
            ` : ''}
        `;
        modal.querySelector('.story-modal-body').innerHTML = contentHtml;

        // Author information
        modal.querySelector('.story-modal-author').innerHTML = `
            <div class="author-avatar">
                ${story.author_avatar ? 
                    `<img src="${story.author_avatar}" alt="${this.escapeHtml(story.author_name)}">` :
                    story.author_name.charAt(0).toUpperCase()
                }
            </div>
            <div class="author-info">
                <div class="author-name">${this.escapeHtml(story.author_name)}</div>
                <div class="author-role">${this.escapeHtml(story.author_role)}</div>
                ${story.author_company ? `<div class="author-company">${this.escapeHtml(story.author_company)}</div>` : ''}
            </div>
        `;

        // Show modal
        modal.classList.add('show');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
        
        // Track view
        this.trackStoryView(story.slug);
    },

    // Close modal
    closeStoryModal() {
        const modal = document.getElementById('storyModal');
        if (modal) {
            modal.classList.remove('show');
            document.body.style.overflow = '';
        }
    },

    // Share story
    shareStory() {
        const modal = document.getElementById('storyModal');
        const title = modal.querySelector('.story-modal-title').textContent;
        const url = window.location.href;
        
        if (navigator.share) {
            navigator.share({
                title: title,
                text: `Check out this success story on CoveTalks: ${title}`,
                url: url
            }).catch(err => console.log('Share cancelled'));
        } else {
            // Fallback to copying link
            navigator.clipboard.writeText(url).then(() => {
                alert('Story link copied to clipboard!');
            }).catch(() => {
                alert('Share this link: ' + url);
            });
        }
    },

    // Format content with paragraphs
    formatContent(content) {
        if (!content) return '';
        return content.split('\n\n').map(para => `<p>${this.escapeHtml(para)}</p>`).join('');
    },

    // Track story view
    async trackStoryView(slug) {
        const story = this.stories.find(s => s.slug === slug);
        if (story && window.covetalks && window.covetalks.incrementStoryViews) {
            try {
                await window.covetalks.incrementStoryViews(story.id);
            } catch (error) {
                console.log('View tracking not available');
            }
        }
    },

    // Get category label
    getCategoryLabel(category) {
        const labels = {
            'conference': 'Conference',
            'workshop': 'Workshop',
            'keynote': 'Keynote',
            'panel': 'Panel Discussion',
            'webinar': 'Webinar',
            'corporate': 'Corporate Event',
            'education': 'Educational',
            'nonprofit': 'Non-Profit'
        };
        return labels[category] || category;
    },

    // Get empty state HTML
    getEmptyState() {
        return `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--color-gray);">
                <div style="font-size: 3rem; margin-bottom: 1rem;">📚</div>
                <h3 style="color: var(--color-deep); margin-bottom: 1rem;">No stories found</h3>
                <p>Check back soon for more success stories!</p>
            </div>
        `;
    },

    // Show error state
    showError(section) {
        const container = section === 'stories' ? 
            document.getElementById('storiesGrid') : 
            document.getElementById('testimonialsGrid');
            
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--color-gray);">
                <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
                <h3 style="color: var(--color-deep); margin-bottom: 1rem;">Unable to load content</h3>
                <p>Please try refreshing the page.</p>
            </div>
        `;
    },

    // Setup event listeners
    setupEventListeners() {
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

        // Observe story cards and testimonials
        setTimeout(() => {
            document.querySelectorAll('.story-card, .testimonial-card').forEach(el => {
                el.style.opacity = '0';
                el.style.transform = 'translateY(20px)';
                el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                observer.observe(el);
            });
        }, 100);
    },

    // Track page view
    async trackPageView() {
        if (window.covetalks && window.covetalks.trackActivity) {
            try {
                await window.covetalks.trackActivity('success_stories_viewed', null, {
                    page: 'success_stories'
                });
            } catch (error) {
                console.log('Activity tracking not available');
            }
        }
    },

    // Utility function to escape HTML
    escapeHtml(text) {
        if (!text) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    SuccessStories.init();
});

// Export for use in other scripts
window.SuccessStories = SuccessStories;