/**
 * CoveTalks Header Component
 * Reusable header/navigation for all pages
 */

class CoveTalksHeader {
    constructor() {
        this.currentUser = null;
        this.mobileMenuOpen = false;
    }

    /**
     * Initialize the header component
     */
    async init() {
        await this.render();
        this.attachEventListeners();
        await this.checkAuthentication();
    }

    /**
     * Render the header HTML
     */
    async render() {
        const headerHTML = `
            <header id="main-header">
                <div class="container">
                    <nav>
                        <a href="/index.html" class="logo">
                            <img src="/Images/CoveTalks_logo.svg" alt="CoveTalks" class="logo-img" onerror="this.style.display='none'">
                        </a>
                        
                        <!-- Desktop Navigation -->
                        <ul class="nav-links" id="navLinks">
                            <!-- Will be populated dynamically -->
                        </ul>
                        
                        <div class="nav-right">
                            <!-- Auth buttons (shown when logged out) -->
                            <div class="auth-buttons" id="authButtons">
                                <a href="/register.html" class="btn btn-secondary">Join</a>
                                <a href="/login.html" class="btn btn-primary">Login</a>
                            </div>
                            
                            <!-- User menu (shown when logged in) -->
                            <div class="user-menu hidden" id="userMenu">
                                <div class="user-avatar" id="userAvatar">
                                    <img class="user-avatar-image hidden" id="userAvatarImage" alt="">
                                    <span class="user-avatar-text" id="userAvatarText">U</span>
                                </div>
                                <div class="dropdown-menu" id="dropdownMenu">
                                    <a href="/inbox.html">
                                        <span id="inboxBadge" class="notification-badge hidden"></span>
                                        Inbox
                                    </a>
                                    <a href="/settings.html">Settings</a>
                                    <a href="/billing.html">Billing</a>
                                    <div class="dropdown-divider"></div>
                                    <a href="#" id="logoutBtn">Logout</a>
                                </div>
                            </div>
                            
                            <!-- Mobile menu toggle -->
                            <button class="mobile-menu-toggle" id="mobileMenuToggle" aria-label="Toggle navigation">
                                <span class="hamburger">
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                </span>
                            </button>
                        </div>
                    </nav>
                </div>
            </header>
            
            <!-- Mobile Navigation -->
            <div class="mobile-nav" id="mobileNav">
                <div class="mobile-nav-content">
                    <ul class="mobile-nav-links" id="mobileNavLinks">
                        <!-- Will be populated dynamically -->
                    </ul>
                    
                    <!-- Mobile auth buttons -->
                    <div class="mobile-auth-buttons" id="mobileAuthButtons">
                        <a href="/register.html" class="btn btn-secondary btn-block">Join CoveTalks</a>
                        <a href="/login.html" class="btn btn-primary btn-block">Login</a>
                    </div>
                    
                    <!-- Mobile user menu (when logged in) -->
                    <ul class="mobile-nav-links mobile-user-section hidden" id="mobileUserSection">
                        <li><a href="/inbox.html">Inbox</a></li>
                        <li><a href="/settings.html">Settings</a></li>
                        <li><a href="/billing.html">Billing</a></li>
                        <li><a href="#" id="mobileLogoutBtn">Logout</a></li>
                    </ul>
                </div>
            </div>
        `;

        // Insert header at the beginning of body
        document.body.insertAdjacentHTML('afterbegin', headerHTML);
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Mobile menu toggle
        const mobileToggle = document.getElementById('mobileMenuToggle');
        if (mobileToggle) {
            mobileToggle.addEventListener('click', () => this.toggleMobileMenu());
        }

        // User avatar dropdown
        const userAvatar = document.getElementById('userAvatar');
        if (userAvatar) {
            userAvatar.addEventListener('click', () => this.toggleDropdown());
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('dropdownMenu');
            const avatar = document.getElementById('userAvatar');
            
            if (dropdown && avatar && !avatar.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.remove('show');
            }
        });

        // Logout button (desktop only now)
        const logoutBtn = document.getElementById('logoutBtn');
        
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        }

        // Close mobile menu when clicking a link
        const mobileNavLinks = document.querySelectorAll('.mobile-nav-links a');
        mobileNavLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                // Don't close menu for logout (it will redirect anyway)
                if (link.id === 'mobileLogoutBtn') {
                    e.preventDefault();
                    this.logout();
                } else {
                    this.closeMobileMenu();
                }
            });
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768 && this.mobileMenuOpen) {
                this.closeMobileMenu();
            }
        });
    }

    /**
     * Check authentication and update navigation
     */
    async checkAuthentication() {
        try {
            // Wait for Supabase client to be ready
            await this.waitForSupabase();
            
            const session = await window.covetalks.checkAuth();
            if (session) {
                this.currentUser = await window.covetalks.getMemberProfile(session.user.id);
                this.updateNavigation(this.currentUser);
                this.checkUnreadMessages();
            } else {
                this.updateNavigation(null);
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            this.updateNavigation(null);
        }
    }

    /**
     * Wait for Supabase client to be ready
     */
    waitForSupabase() {
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 20;
            
            const check = () => {
                attempts++;
                if (typeof window.covetalks !== 'undefined' && window.covetalks.supabase) {
                    resolve();
                } else if (attempts < maxAttempts) {
                    setTimeout(check, 250);
                } else {
                    console.warn('Supabase client not available');
                    resolve();
                }
            };
            check();
        });
    }

    /**
     * Update navigation based on user authentication state
     */
    updateNavigation(user) {
        const navLinks = document.getElementById('navLinks');
        const mobileNavLinks = document.getElementById('mobileNavLinks');
        const mobileNav = document.getElementById('mobileNav');
        const authButtons = document.getElementById('authButtons');
        const mobileAuthButtons = document.getElementById('mobileAuthButtons');
        const userMenu = document.getElementById('userMenu');
        const mobileUserSection = document.getElementById('mobileUserSection');
        const userAvatar = document.getElementById('userAvatar');
        const userAvatarImage = document.getElementById('userAvatarImage');
        const userAvatarText = document.getElementById('userAvatarText');
        
        if (user) {
            // Hide auth buttons, show user menu
            if (authButtons) authButtons.classList.add('hidden');
            if (mobileAuthButtons) mobileAuthButtons.classList.add('hidden');
            if (userMenu) userMenu.classList.remove('hidden');
            if (mobileUserSection) mobileUserSection.classList.remove('hidden');
            
            // Add logged-in class to mobile nav for CSS styling
            if (mobileNav) mobileNav.classList.add('logged-in');
            
            // Update avatar with user profile image or initials
            if (user.profile_image_url && userAvatarImage && userAvatarText) {
                // User has a profile image
                userAvatarImage.src = user.profile_image_url;
                userAvatarImage.alt = user.name || 'User avatar';
                userAvatarImage.classList.add('loading');
                userAvatarImage.classList.remove('hidden');
                userAvatarText.classList.add('hidden');
                
                // Remove loading class when image loads
                userAvatarImage.onload = function() {
                    this.classList.remove('loading');
                };
                
                // Add error handler in case image fails to load
                userAvatarImage.onerror = function() {
                    this.classList.add('hidden');
                    userAvatarText.classList.remove('hidden');
                    // Restore initials on error
                    const initials = user.name ? 
                        user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 
                        'U';
                    userAvatarText.textContent = initials;
                };
            } else if (userAvatarText) {
                // No profile image, use initials
                const initials = user.name ? 
                    user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 
                    'U';
                
                userAvatarText.textContent = initials;
                userAvatarText.classList.remove('hidden');
                if (userAvatarImage) userAvatarImage.classList.add('hidden');
            }
            
            // Update navigation links based on user type
            let navHTML = '';
            let currentPath = window.location.pathname;
            
            if (user.member_type === 'Organization') {
                navHTML = `
                    <li><a href="/organization-dashboard.html" class="${currentPath.includes('organization-dashboard') ? 'active' : ''}">Dashboard</a></li>
                    <li><a href="/members.html" class="${currentPath.includes('members') ? 'active' : ''}">Find Speakers</a></li>
                    <li><a href="/post-opportunity.html" class="${currentPath.includes('post-opportunity') ? 'active' : ''}">Post Opportunity</a></li>
                    <li><a href="/my-opportunities.html" class="${currentPath.includes('my-opportunities') ? 'active' : ''}">My Opportunities</a></li>
                    <li><a href="/saved-speakers.html" class="${currentPath.includes('saved-speakers') ? 'active' : ''}">Saved Speakers</a></li>
                `;
            } else {
                // Speaker navigation
                navHTML = `
                    <li><a href="/dashboard.html" class="${currentPath.includes('dashboard') && !currentPath.includes('organization') ? 'active' : ''}">Dashboard</a></li>
                    <li><a href="/members.html" class="${currentPath.includes('members') ? 'active' : ''}">Find Speakers</a></li>
                    <li><a href="/opportunities.html" class="${currentPath.includes('opportunities') && !currentPath.includes('my-') ? 'active' : ''}">Opportunities</a></li>
                    <li><a href="/bookings.html" class="${currentPath.includes('bookings') ? 'active' : ''}">My Bookings</a></li>
                    <li><a href="/profile.html" class="${currentPath.includes('profile') && !currentPath.includes('speaker-profile') ? 'active' : ''}">Profile</a></li>
                `;
            }
            
            if (navLinks) navLinks.innerHTML = navHTML;
            if (mobileNavLinks) mobileNavLinks.innerHTML = navHTML;
            
        } else {
            // Show default logged out navigation
            if (authButtons) authButtons.classList.remove('hidden');
            if (mobileAuthButtons) mobileAuthButtons.classList.remove('hidden');
            if (userMenu) userMenu.classList.add('hidden');
            if (mobileUserSection) mobileUserSection.classList.add('hidden');
            
            // Remove logged-in class from mobile nav
            const mobileNav = document.getElementById('mobileNav');
            if (mobileNav) mobileNav.classList.remove('logged-in');
            
            let currentPath = window.location.pathname;
            const defaultNavHTML = `
                <li><a href="/index.html" class="${currentPath === '/' || currentPath.includes('index') ? 'active' : ''}">Home</a></li>
                <li><a href="/members.html" class="${currentPath.includes('members') ? 'active' : ''}">Find Speakers</a></li>
                <li><a href="/pricing.html" class="${currentPath.includes('pricing') ? 'active' : ''}">Pricing</a></li>
                <li><a href="/register.html" class="${currentPath.includes('register') ? 'active' : ''}">Register</a></li>
                <li><a href="/contact.html" class="${currentPath.includes('contact') ? 'active' : ''}">Contact</a></li>
            `;
            
            if (navLinks) navLinks.innerHTML = defaultNavHTML;
            if (mobileNavLinks) mobileNavLinks.innerHTML = defaultNavHTML;
        }
    }

    /**
     * Check for unread messages
     */
    async checkUnreadMessages() {
        try {
            if (window.covetalks && window.covetalks.getUnreadMessageCount) {
                const count = await window.covetalks.getUnreadMessageCount();
                const badge = document.getElementById('inboxBadge');
                
                if (badge && count > 0) {
                    badge.textContent = count > 99 ? '99+' : count;
                    badge.classList.remove('hidden');
                }
            }
        } catch (error) {
            console.error('Failed to check unread messages:', error);
        }
    }

    /**
     * Toggle mobile menu
     */
    toggleMobileMenu() {
        const mobileNav = document.getElementById('mobileNav');
        const mobileToggle = document.getElementById('mobileMenuToggle');
        
        if (mobileNav && mobileToggle) {
            this.mobileMenuOpen = !this.mobileMenuOpen;
            
            if (this.mobileMenuOpen) {
                mobileNav.classList.add('active');
                mobileToggle.classList.add('active');
                document.body.style.overflow = 'hidden';
            } else {
                mobileNav.classList.remove('active');
                mobileToggle.classList.remove('active');
                document.body.style.overflow = '';
            }
        }
    }

    /**
     * Close mobile menu
     */
    closeMobileMenu() {
        const mobileNav = document.getElementById('mobileNav');
        const mobileToggle = document.getElementById('mobileMenuToggle');
        
        if (mobileNav && mobileToggle) {
            this.mobileMenuOpen = false;
            mobileNav.classList.remove('active');
            mobileToggle.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    /**
     * Toggle dropdown menu
     */
    toggleDropdown() {
        const dropdown = document.getElementById('dropdownMenu');
        if (dropdown) {
            dropdown.classList.toggle('show');
        }
    }

    /**
     * Logout user
     */
    async logout() {
        try {
            if (window.covetalks) {
                await window.covetalks.logout();
            } else {
                window.location.href = '/login.html';
            }
        } catch (error) {
            console.error('Logout failed:', error);
            window.location.href = '/login.html';
        }
    }
}

// Initialize header when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const header = new CoveTalksHeader();
        header.init();
        
        // Make header instance globally available
        window.covetalksHeader = header;
    });
} else {
    const header = new CoveTalksHeader();
    header.init();
    window.covetalksHeader = header;
}