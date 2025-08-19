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
                            <h3>CoveTalks</h3>
                            <p>Connecting speakers with organizations worldwide to create meaningful opportunities and lasting relationships.</p>
                            <div class="social-links">
                                <a href="https://www.linkedin.com/company/108118017" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                                    </svg>
                                </a>
                            </div>
                        </div>
                        
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
                        <p>&copy; ${this.currentYear} CoveTalks. All rights reserved.</p>
                        <p class="footer-tagline">Where Connections Ignite Opportunities</p>
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
                /* Social Links */
                .social-links {
                    display: flex;
                    gap: 0.75rem;
                    margin-top: 1rem;
                }
                
                .social-links a {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 36px;
                    height: 36px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 50%;
                    transition: all 0.3s ease;
                }
                
                .social-links a:hover {
                    background: var(--color-sand);
                    transform: translateY(-2px);
                }
                
                .social-links svg {
                    width: 20px;
                    height: 20px;
                    fill: currentColor;
                }
                
                /* Footer Tagline */
                .footer-tagline {
                    font-style: italic;
                    opacity: 0.8;
                    margin-top: 0.5rem;
                }
                
                /* Mobile User Section Styles */
                .mobile-user-section {
                    padding-top: var(--spacing-lg);
                    border-top: 1px solid var(--color-border);
                    margin-top: var(--spacing-lg);
                }
                
                .mobile-user-links {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                }
                
                .mobile-user-links li {
                    border-bottom: 1px solid var(--color-border);
                }
                
                .mobile-user-links li:first-child {
                    border-top: none;
                }
                
                .mobile-user-links li:last-child {
                    border-bottom: none;
                }
                
                .mobile-user-links a {
                    display: block;
                    padding: var(--spacing-md) 0;
                    color: #333;
                    text-decoration: none;
                    font-weight: var(--font-weight-medium);
                }
                
                .mobile-user-links a:hover {
                    color: var(--color-deep);
                }
                
                /* Notification Badge */
                .notification-badge {
                    display: inline-block;
                    background: var(--color-danger);
                    color: white;
                    font-size: 0.75rem;
                    font-weight: bold;
                    padding: 2px 6px;
                    border-radius: 10px;
                    margin-left: 0.5rem;
                    min-width: 20px;
                    text-align: center;
                }
                
                /* Responsive adjustments */
                @media (max-width: 768px) {
                    .footer-content {
                        text-align: center;
                    }
                    
                    .social-links {
                        justify-content: center;
                    }
                    
                    .footer-bottom {
                        padding-top: var(--spacing-lg);
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