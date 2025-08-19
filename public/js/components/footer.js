/**
 * CoveTalks Footer Component
 * Reusable footer for all pages
 */

class CoveTalksFooter {
    constructor() {
        this.currentYear = new Date().getFullYear();
    }

    /**
     * Initialize the footer component
     */
    init() {
        this.render();
    }

    /**
     * Render the footer HTML
     */
    render() {
        const footerHTML = `
            <footer id="main-footer">
                <div class="container">
                    <div class="footer-content">
                        <div class="footer-section">
                            <h3>Quick Links</h3>
                            <a href="/index.html">Home</a>
                            <a href="/members.html">Find Speakers</a>
                            <a href="/opportunities.html">Browse Opportunities</a>
                            <a href="/register.html">Register</a>
                            <a href="/pricing.html">Pricing</a>
                            <a href="/about.html">About Us</a>
                        </div>
                        
                        <div class="footer-section">
                            <h3>For Organizations</h3>
                            <a href="/register.html?type=organization">Register Your Organization</a>
                            <a href="/post-opportunity.html">Post Speaking Opportunity</a>
                            <a href="/members.html">Browse Speakers</a>
                            <a href="/pricing.html#organizations">Organization Plans</a>
                            <a href="/resources/organization-guide.html">Organization Guide</a>
                        </div>
                        
                        <div class="footer-section">
                            <h3>For Speakers</h3>
                            <a href="/register.html?type=speaker">Become a Speaker</a>
                            <a href="/opportunities.html">Find Opportunities</a>
                            <a href="/resources/speaker-tips.html">Speaker Resources</a>
                            <a href="/pricing.html#speakers">Speaker Plans</a>
                            <a href="/success-stories.html">Success Stories</a>
                        </div>
                        
                        <div class="footer-section">
                            <h3>Support</h3>
                            <a href="/help.html">Help Center</a>
                            <a href="/faq.html">FAQ</a>
                            <a href="/contact.html">Contact Us</a>
                            <a href="/privacy.html">Privacy Policy</a>
                            <a href="/terms.html">Terms of Service</a>
                            <a href="/accessibility.html">Accessibility</a>
                        </div>
                    </div>
                    
                    <div class="footer-bottom">
                        <div class="footer-copyright">
                            <p>&copy; ${this.currentYear} CoveTalks. All rights reserved.</p>
                        </div>
                        <div class="footer-social">
                            <a href="https://www.linkedin.com/company/108118017" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                                </svg>
                            </a>
                            <!-- Add more social icons here as needed -->
                            <!-- Example for Twitter/X:
                            <a href="https://twitter.com/covetalks" target="_blank" rel="noopener noreferrer" aria-label="Twitter">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="..."/>
                                </svg>
                            </a>
                            -->
                            <!-- Example for Facebook:
                            <a href="https://facebook.com/covetalks" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="..."/>
                                </svg>
                            </a>
                            -->
                        </div>
                    </div>
                </div>
            </footer>
        `;

        // Append footer at the end of body
        document.body.insertAdjacentHTML('beforeend', footerHTML);
        
        // Add additional styles for footer if needed
        this.addFooterStyles();
    }

    /**
     * Add additional footer-specific styles
     */
    addFooterStyles() {
        // Check if styles already exist
        if (document.getElementById('footer-styles')) return;
        
        const styles = `
            <style id="footer-styles">
                /* Main Footer */
                footer {
                    background: var(--color-dark);
                    color: white;
                    padding: var(--spacing-xl) 0 var(--spacing-md);
                    margin-top: auto;
                }
                
                /* Footer Content - 4 columns */
                .footer-content {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: var(--spacing-xl);
                    padding-bottom: var(--spacing-lg);
                    margin-bottom: var(--spacing-lg);
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                }
                
                .footer-section h3 {
                    margin-bottom: var(--spacing-md);
                    color: var(--color-sand);
                    font-size: 1.1rem;
                }
                
                .footer-section a {
                    color: var(--color-gray-lighter);
                    text-decoration: none;
                    display: block;
                    margin-bottom: var(--spacing-sm);
                    transition: color var(--transition-normal);
                    font-size: 0.9rem;
                }
                
                .footer-section a:hover {
                    color: var(--color-sand);
                }
                
                /* Footer Bottom - Two column layout */
                .footer-bottom {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding-top: var(--spacing-md);
                }
                
                .footer-copyright p {
                    margin: 0;
                    color: var(--color-gray-lighter);
                    font-size: 0.9rem;
                }
                
                /* Social Links - Horizontal layout */
                .footer-social {
                    display: flex;
                    gap: var(--spacing-md);
                    align-items: center;
                }
                
                .footer-social a {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 36px;
                    height: 36px;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 50%;
                    transition: all 0.3s ease;
                    color: var(--color-gray-lighter);
                }
                
                .footer-social a:hover {
                    border-color: var(--color-sand);
                    background: rgba(243, 179, 56, 0.1);
                    color: var(--color-sand);
                    transform: translateY(-2px);
                }
                
                .footer-social svg {
                    width: 18px;
                    height: 18px;
                    fill: currentColor;
                }
                
                /* Responsive adjustments */
                @media (max-width: 1200px) {
                    .footer-content {
                        grid-template-columns: repeat(4, 1fr);
                        gap: var(--spacing-lg);
                    }
                }
                
                @media (max-width: 992px) {
                    .footer-content {
                        grid-template-columns: repeat(2, 1fr);
                    }
                }
                
                @media (max-width: 768px) {
                    .footer-content {
                        grid-template-columns: 1fr;
                        text-align: left;
                    }
                    
                    .footer-section {
                        padding-bottom: var(--spacing-md);
                        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                    }
                    
                    .footer-section:last-child {
                        border-bottom: none;
                    }
                    
                    /* Stack footer bottom on mobile */
                    .footer-bottom {
                        flex-direction: column;
                        gap: var(--spacing-md);
                        text-align: center;
                    }
                    
                    .footer-copyright {
                        order: 2;
                    }
                    
                    .footer-social {
                        order: 1;
                        justify-content: center;
                    }
                }
                
                @media (max-width: 576px) {
                    .footer-social a {
                        width: 32px;
                        height: 32px;
                    }
                    
                    .footer-social svg {
                        width: 16px;
                        height: 16px;
                    }
                }
            </style>
        `;
        
        document.head.insertAdjacentHTML('beforeend', styles);
    }
}

// Initialize footer when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const footer = new CoveTalksFooter();
        footer.init();
        
        // Make footer instance globally available
        window.covetalksFooter = footer;
    });
} else {
    const footer = new CoveTalksFooter();
    footer.init();
    window.covetalksFooter = footer;
}