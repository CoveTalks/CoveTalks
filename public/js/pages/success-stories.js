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

    // View individual story
    viewStory(slug) {
        // For now, scroll to the featured story or show an alert
        // In production, this would go to a detail page
        const story = this.stories.find(s => s.slug === slug);
        if (story) {
            // Render this as the featured story and scroll to it
            this.renderFeaturedStory(story);
            document.getElementById('featuredStory').scrollIntoView({ behavior: 'smooth' });
        }
    },

    // Expand story (for featured story link)
    expandStory(slug) {
        const story = this.stories.find(s => s.slug === slug);
        if (story && story.content) {
            // Show full content in a modal or expand the featured section
            alert(`Full story view coming soon!\n\n${story.title}\n\n${story.content.substring(0, 500)}...`);
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