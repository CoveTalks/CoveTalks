// Service Worker Registration for CoveTalks
// This script should be included in all HTML pages

(function() {
    'use strict';

    // Check if service workers are supported
    if ('serviceWorker' in navigator) {
        // Wait for the page to load
        window.addEventListener('load', function() {
            registerServiceWorker();
        });
    } else {
        console.log('Service Workers are not supported in this browser.');
    }

    // Register the service worker
    async function registerServiceWorker() {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js', {
                scope: '/'
            });

            console.log('Service Worker registered successfully:', registration);

            // Check for updates periodically (every hour)
            setInterval(() => {
                registration.update();
            }, 60 * 60 * 1000);

            // Handle service worker updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                console.log('New Service Worker found, installing...');

                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // New service worker is installed and ready
                        showUpdateNotification(newWorker);
                    }
                });
            });

            // Handle controller change (when new SW takes over)
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                console.log('Service Worker updated, reloading page...');
                window.location.reload();
            });

        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    }

    // Show update notification to user
    function showUpdateNotification(worker) {
        // Check if there's already an update banner
        if (document.getElementById('sw-update-banner')) {
            return;
        }

        // Create update notification banner
        const banner = document.createElement('div');
        banner.id = 'sw-update-banner';
        banner.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            right: 20px;
            max-width: 400px;
            background: white;
            border-radius: 10px;
            padding: 20px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
            animation: slideUp 0.3s ease;
        `;

        banner.innerHTML = `
            <div style="flex: 1;">
                <strong style="color: #155487; display: block; margin-bottom: 5px;">
                    Update Available!
                </strong>
                <span style="color: #666; font-size: 0.9em;">
                    A new version of CoveTalks is ready.
                </span>
            </div>
            <button id="sw-update-btn" style="
                background: #155487;
                color: white;
                border: none;
                border-radius: 5px;
                padding: 10px 20px;
                cursor: pointer;
                font-weight: 600;
                white-space: nowrap;
            ">
                Update Now
            </button>
        `;

        // Add animation keyframes
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideUp {
                from {
                    transform: translateY(100%);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(banner);

        // Handle update button click
        document.getElementById('sw-update-btn').addEventListener('click', () => {
            // Tell SW to skip waiting
            worker.postMessage({ type: 'SKIP_WAITING' });
            banner.remove();
        });

        // Auto-hide after 30 seconds
        setTimeout(() => {
            if (document.getElementById('sw-update-banner')) {
                banner.style.animation = 'slideUp 0.3s ease reverse';
                setTimeout(() => banner.remove(), 300);
            }
        }, 30000);
    }

    // Check online/offline status
    function updateOnlineStatus() {
        if (!navigator.onLine) {
            showOfflineNotification();
        } else {
            hideOfflineNotification();
        }
    }

    // Show offline notification
    function showOfflineNotification() {
        if (document.getElementById('offline-notification')) {
            return;
        }

        const notification = document.createElement('div');
        notification.id = 'offline-notification';
        notification.style.cssText = `
            position: fixed;
            top: 60px;
            left: 50%;
            transform: translateX(-50%);
            background: #f44336;
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            z-index: 10001;
            animation: slideDown 0.3s ease;
        `;
        notification.textContent = '⚠️ You are currently offline';

        // Add animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideDown {
                from {
                    transform: translateX(-50%) translateY(-100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(-50%) translateY(0);
                    opacity: 1;
                }
            }
        `;
        if (!document.querySelector('style[data-offline]')) {
            style.setAttribute('data-offline', 'true');
            document.head.appendChild(style);
        }

        document.body.appendChild(notification);
    }

    // Hide offline notification
    function hideOfflineNotification() {
        const notification = document.getElementById('offline-notification');
        if (notification) {
            notification.remove();
        }
    }

    // Listen for online/offline events
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Initial check
    updateOnlineStatus();

    // Install prompt handling for A2HS (Add to Home Screen)
    let deferredPrompt;

    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent the mini-infobar from appearing on mobile
        e.preventDefault();
        // Save the event for later
        deferredPrompt = e;
        // Show custom install button if needed
        showInstallButton();
    });

    function showInstallButton() {
        // Check if user is not logged in and hasn't dismissed the prompt
        if (!localStorage.getItem('pwa-install-dismissed')) {
            // You can add a custom install button/banner here
            // For now, we'll just log it
            console.log('PWA can be installed');
        }
    }

    // Handle app installed event
    window.addEventListener('appinstalled', () => {
        console.log('CoveTalks PWA was installed');
        deferredPrompt = null;
    });

    // Expose install function globally for use in UI
    window.installPWA = async function() {
        if (!deferredPrompt) {
            console.log('Install prompt not available');
            return false;
        }

        // Show the install prompt
        deferredPrompt.prompt();
        
        // Wait for the user to respond
        const { outcome } = await deferredPrompt.userChoice;
        
        console.log(`User response to install prompt: ${outcome}`);
        
        // Clear the deferred prompt
        deferredPrompt = null;
        
        return outcome === 'accepted';
    };

    // Handle background sync registration
    if ('sync' in self.registration) {
        // Register background sync for form submissions
        window.registerBackgroundSync = async function(tag = 'sync-forms') {
            try {
                await self.registration.sync.register(tag);
                console.log('Background sync registered:', tag);
            } catch (error) {
                console.error('Background sync registration failed:', error);
            }
        };
    }

    // Cache form data for offline submission
    window.cacheFormData = async function(url, data) {
        if ('serviceWorker' in navigator && !navigator.onLine) {
            try {
                const cache = await caches.open('offline-forms');
                const response = new Response(JSON.stringify(data));
                await cache.put(url, response);
                
                // Register sync to submit when online
                if (window.registerBackgroundSync) {
                    await window.registerBackgroundSync('sync-forms');
                }
                
                return true;
            } catch (error) {
                console.error('Failed to cache form data:', error);
                return false;
            }
        }
        return false;
    };

})();