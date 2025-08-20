/**
 * CoveTalks Inbox Page
 * Messaging system management
 */

class InboxManager {
    constructor() {
        this.currentUser = null;
        this.allMessages = [];
        this.currentFolder = 'inbox';
        this.currentMessage = null;
        this.replyToMessage = null;
        this.selectedRecipient = null;
        this.searchTimeout = null;
    }

    async init() {
        try {
            // Wait for Supabase
            await this.waitForSupabase();

            // Check authentication
            const session = await window.covetalks.checkAuth();
            if (!session) {
                window.location.href = '/login.html';
                return;
            }

            // Get user profile
            this.currentUser = await window.covetalks.getMemberProfile(session.user.id);

            // Attach event listeners
            this.attachEventListeners();

            // Load messages
            await this.loadMessages();

            // Update unread count
            await this.updateUnreadCount();
            
            // Check URL params for compose
            this.checkUrlParams();

        } catch (error) {
            console.error('[Inbox] Initialization error:', error);
            this.showNotification('Failed to load messages', 'error');
        }
    }

    waitForSupabase() {
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 20;
            
            function check() {
                attempts++;
                if (window.covetalks && window.covetalks.supabase) {
                    resolve();
                } else if (attempts < maxAttempts) {
                    setTimeout(check, 250);
                } else {
                    console.error('Failed to initialize Supabase client');
                    window.location.href = '/login.html';
                }
            }
            check();
        });
    }

    attachEventListeners() {
        // Search
        document.getElementById('searchMessages')?.addEventListener('keyup', () => this.searchMessages());
        
        // Load more button
        document.getElementById('loadMoreBtn')?.addEventListener('click', () => this.loadMoreMessages());
        
        // Compose form
        document.getElementById('composeForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendNewMessage();
        });
        
        // Reply form
        document.getElementById('replyForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendReply();
        });
        
        // Clear filters
        document.getElementById('clearFiltersBtn')?.addEventListener('click', () => this.clearFilters());
        
        // Close modals on outside click
        document.addEventListener('click', (event) => {
            if (event.target.classList.contains('modal')) {
                this.closeModal();
            }
        });
    }

    checkUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const compose = urlParams.get('compose');
        const recipientId = urlParams.get('to');
        const recipientName = urlParams.get('name');
        const subject = urlParams.get('subject');
        const opportunityId = urlParams.get('opportunity');
        
        if (compose === 'true') {
            // Pre-fill recipient if provided
            if (recipientId) {
                this.selectedRecipient = {
                    id: recipientId,
                    name: decodeURIComponent(recipientName || 'User')
                };
            }
            
            // Show compose modal after page loads
            setTimeout(() => {
                this.showComposeModal();
                
                // Pre-fill subject if provided
                if (subject) {
                    document.getElementById('subject').value = decodeURIComponent(subject);
                }
                
                // Store opportunity ID if provided
                if (opportunityId) {
                    document.getElementById('composeForm').dataset.opportunityId = opportunityId;
                }
            }, 500);
        }
    }

    async loadMessages() {
        try {
            // FIX: Use the correct function names from supabase-client.js
            const [inbox, sent] = await Promise.all([
                window.covetalks.getInbox('all'),
                window.covetalks.getSentMessages()
            ]);

            this.allMessages = [...inbox, ...sent];
            
            // Update counts
            const inboxUnread = inbox.filter(m => m.status === 'unread').length;
            const archived = this.allMessages.filter(m => m.status === 'archived').length;
            
            // Update header stats
            document.getElementById('totalMessages').textContent = this.allMessages.length;
            document.getElementById('unreadMessages').textContent = inboxUnread;
            document.getElementById('sentMessages').textContent = sent.length;
            
            // Update sidebar
            const inboxCountElement = document.getElementById('inboxCount');
            if (inboxUnread > 0) {
                inboxCountElement.textContent = inboxUnread;
                inboxCountElement.classList.remove('hidden');
            } else {
                inboxCountElement.classList.add('hidden');
            }
            
            // Display messages
            this.displayMessages();

        } catch (error) {
            console.error('[Inbox] Error loading messages:', error);
            this.showNotification('Failed to load messages', 'error');
        }
    }

    displayMessages() {
        const container = document.getElementById('messagesList');
        
        // Filter messages based on current folder
        let messages = [];
        if (this.currentFolder === 'inbox') {
            messages = this.allMessages.filter(m => m.recipient_id === this.currentUser.id && m.status !== 'archived');
        } else if (this.currentFolder === 'sent') {
            messages = this.allMessages.filter(m => m.sender_id === this.currentUser.id);
        } else if (this.currentFolder === 'archived') {
            messages = this.allMessages.filter(m => m.status === 'archived' && m.recipient_id === this.currentUser.id);
        }

        if (messages.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📭</div>
                    <h3>No messages</h3>
                    <p>Your ${this.currentFolder} is empty</p>
                </div>
            `;
            return;
        }

        container.innerHTML = messages.map(msg => {
            const isUnread = msg.status === 'unread' && msg.recipient_id === this.currentUser.id;
            const isSent = msg.sender_id === this.currentUser.id;
            const otherPerson = isSent ? msg.recipient : msg.sender;
            const initials = otherPerson?.name ? 
                otherPerson.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 
                '??';

            return `
                <div class="message-item ${isUnread ? 'unread' : ''}" onclick="inboxManager.viewMessage('${msg.id}')">
                    <div class="message-avatar">${initials}</div>
                    <div class="message-content">
                        <div class="message-header">
                            <div>
                                <div class="message-sender ${isUnread ? 'unread' : ''}">
                                    ${isSent ? 'To: ' : ''}${otherPerson?.name || 'Unknown'}
                                </div>
                                <div class="message-subject">${msg.subject}</div>
                            </div>
                            <div class="message-time">${this.formatTimeAgo(msg.created_at)}</div>
                        </div>
                        <div class="message-preview">
                            ${msg.message.substring(0, 100)}${msg.message.length > 100 ? '...' : ''}
                        </div>
                        ${msg.opportunity ? `
                            <div class="message-meta">
                                <span class="message-tag">📌 ${msg.opportunity.title}</span>
                            </div>
                        ` : ''}
                    </div>
                    ${!isSent ? `
                        <div class="message-actions-quick">
                            <button class="quick-action-btn" onclick="event.stopPropagation(); inboxManager.quickReply('${msg.id}')">
                                Quick Reply
                            </button>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    quickReply(messageId) {
        const message = this.allMessages.find(m => m.id === messageId);
        if (message) {
            this.showReplyModal(messageId);
        }
    }

    async viewMessage(messageId) {
        const message = this.allMessages.find(m => m.id === messageId);
        if (!message) return;

        this.currentMessage = message;

        // Mark as read if unread - FIX: Use correct function name
        if (message.status === 'unread' && message.recipient_id === this.currentUser.id) {
            await window.covetalks.markMessageRead(messageId);
            message.status = 'read';
            await this.updateUnreadCount();
            this.displayMessages();
        }

        // Hide list, show message view
        document.getElementById('messagesList').style.display = 'none';
        const messageView = document.getElementById('messageView');
        messageView.classList.add('active');

        const isSent = message.sender_id === this.currentUser.id;
        const isReceived = message.recipient_id === this.currentUser.id;
        const otherPerson = isSent ? message.recipient : message.sender;

        messageView.innerHTML = `
            <div class="message-view-header">
                <button onclick="inboxManager.backToList()" class="btn btn-secondary btn-sm mb-3">
                    ← Back to Messages
                </button>
                <h2 class="message-view-subject">${message.subject}</h2>
                <div class="message-view-meta">
                    <span><strong>${isSent ? 'To' : 'From'}:</strong> ${otherPerson?.name || 'Unknown'}</span>
                    <span><strong>Date:</strong> ${this.formatDateTime(message.created_at)}</span>
                    ${message.opportunity ? `
                        <span><strong>Related:</strong> ${message.opportunity.title}</span>
                    ` : ''}
                </div>
            </div>
            <div class="message-view-body">${message.message}</div>
            <div class="message-actions">
                ${isReceived ? `
                    <button onclick="inboxManager.showReplyModal('${message.id}')" class="btn btn-primary">
                        Reply
                    </button>
                ` : ''}
                ${message.status !== 'archived' ? `
                    <button onclick="inboxManager.archiveMessage('${message.id}')" class="btn btn-secondary">
                        Archive
                    </button>
                ` : ''}
            </div>
        `;
    }

    backToList() {
        document.getElementById('messagesList').style.display = 'block';
        document.getElementById('messageView').classList.remove('active');
    }

    showComposeModal(recipientId = null, recipientName = null) {
        const modal = document.getElementById('composeModal');
        modal.classList.add('show');
        
        // Reset form
        document.getElementById('composeForm').reset();
        
        // Set recipient if provided
        if (recipientId && recipientName) {
            this.selectedRecipient = { id: recipientId, name: recipientName };
        }
        
        // Update recipient field
        if (this.selectedRecipient) {
            const recipientField = document.getElementById('recipientField');
            recipientField.innerHTML = `
                <div class="selected-recipient">
                    <span class="recipient-tag">
                        ${this.selectedRecipient.name}
                        <button onclick="inboxManager.clearRecipient()" class="remove-btn">×</button>
                    </span>
                    <input type="hidden" id="recipientId" value="${this.selectedRecipient.id}">
                </div>
            `;
        } else {
            this.setupRecipientSearch();
        }
    }

    setupRecipientSearch() {
        const recipientField = document.getElementById('recipientField');
        recipientField.innerHTML = `
            <div class="recipient-search-container">
                <span class="search-input-icon">🔍</span>
                <input type="text" 
                       id="recipientSearch" 
                       placeholder="Start typing to search for members..." 
                       onkeyup="inboxManager.handleRecipientSearch(this.value)"
                       autocomplete="off">
                <div id="recipientSuggestions" class="recipient-suggestions hidden"></div>
            </div>
            <input type="hidden" id="recipientId" value="">
        `;
        
        // Focus on the search field
        setTimeout(() => {
            document.getElementById('recipientSearch')?.focus();
        }, 100);
    }

    handleRecipientSearch(query) {
        clearTimeout(this.searchTimeout);
        
        const suggestions = document.getElementById('recipientSuggestions');
        
        if (!query || query.length < 2) {
            suggestions.classList.add('hidden');
            return;
        }
        
        // Show searching indicator
        suggestions.innerHTML = `
            <div class="searching-indicator">
                <span class="loading-spinner"></span>
                Searching...
            </div>
        `;
        suggestions.classList.remove('hidden');
        
        // Debounce search
        this.searchTimeout = setTimeout(() => {
            this.searchRecipients(query);
        }, 300);
    }

    async searchRecipients(query) {
        try {
            // Search members in database
            const { data: members, error } = await window.covetalks.supabase
                .from('members')
                .select('id, name, email, member_type')
                .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
                .neq('id', this.currentUser.id)
                .limit(10);
            
            if (error) throw error;
            
            const suggestions = document.getElementById('recipientSuggestions');
            
            if (members && members.length > 0) {
                suggestions.innerHTML = members.map(member => {
                    const initials = member.name ? 
                        member.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 
                        '??';
                    const badgeClass = member.member_type === 'Speaker' ? 'speaker' : 'organization';
                    
                    return `
                        <div class="suggestion-item" onclick="inboxManager.selectRecipient('${member.id}', '${member.name}', '${member.email}')">
                            <div class="suggestion-avatar">${initials}</div>
                            <div class="suggestion-info">
                                <div class="suggestion-name">${member.name || 'Unknown'}</div>
                                <div class="suggestion-email">${member.email}</div>
                            </div>
                            <span class="member-type-badge ${badgeClass}">${member.member_type}</span>
                        </div>
                    `;
                }).join('');
            } else {
                suggestions.innerHTML = `
                    <div class="no-results">
                        <p>No members found matching "${query}"</p>
                        <small>Try searching by name or email</small>
                    </div>
                `;
            }
            
            suggestions.classList.remove('hidden');
        } catch (error) {
            console.error('[Inbox] Error searching recipients:', error);
            const suggestions = document.getElementById('recipientSuggestions');
            suggestions.innerHTML = '<div class="no-results">Error searching members. Please try again.</div>';
        }
    }

    selectRecipient(id, name, email) {
        this.selectedRecipient = { id, name, email };
        
        const recipientField = document.getElementById('recipientField');
        recipientField.innerHTML = `
            <div class="selected-recipient">
                <span class="recipient-tag">
                    ${name}
                    <button onclick="inboxManager.clearRecipient()" class="remove-btn">×</button>
                </span>
                <input type="hidden" id="recipientId" value="${id}">
            </div>
        `;
        
        // Focus on subject field
        document.getElementById('subject').focus();
    }

    clearRecipient() {
        this.selectedRecipient = null;
        this.setupRecipientSearch();
    }

    async sendNewMessage() {
        const recipientId = this.selectedRecipient?.id || document.getElementById('recipientId')?.value;
        const subject = document.getElementById('subject').value.trim();
        const message = document.getElementById('message').value.trim();
        const opportunityId = document.getElementById('composeForm').dataset.opportunityId || null;
        
        // Validation
        if (!recipientId) {
            this.showNotification('Please select a recipient', 'error');
            return;
        }
        
        if (!subject) {
            this.showNotification('Please enter a subject', 'error');
            return;
        }
        
        if (!message) {
            this.showNotification('Please enter a message', 'error');
            return;
        }
        
        // Show loading state
        const sendBtn = document.getElementById('sendMessageBtn');
        const originalText = sendBtn.textContent;
        sendBtn.textContent = 'Sending...';
        sendBtn.disabled = true;
        
        try {
            // Send the message
            await window.covetalks.sendMessage(
                recipientId,
                subject,
                message,
                opportunityId
            );
            
            // Close modal and reset
            this.closeModal();
            document.getElementById('composeForm').reset();
            this.selectedRecipient = null;
            
            // Reload messages
            await this.loadMessages();
            
            // Show success message
            this.showNotification('Message sent successfully!', 'success');
            
        } catch (error) {
            console.error('[Inbox] Error sending message:', error);
            this.showNotification('Failed to send message. Please try again.', 'error');
        } finally {
            sendBtn.textContent = originalText;
            sendBtn.disabled = false;
        }
    }

    showReplyModal(messageId) {
        const message = this.allMessages.find(m => m.id === messageId);
        if (!message) return;
        
        this.replyToMessage = message;
        document.getElementById('replyTo').textContent = message.sender?.name || 'Unknown';
        document.getElementById('replySubject').textContent = `Re: ${message.subject}`;
        document.getElementById('originalDate').textContent = this.formatDateTime(message.created_at);
        
        // Show original message in thread
        const quotedContent = message.message.length > 500 ? 
            message.message.substring(0, 500) + '...' : 
            message.message;
        document.getElementById('quotedMessage').textContent = quotedContent;
        
        // Clear reply textarea
        document.getElementById('replyMessage').value = '';
        
        document.getElementById('replyModal').classList.add('show');
        
        // Focus on reply textarea
        setTimeout(() => {
            document.getElementById('replyMessage').focus();
        }, 100);
    }

    async sendReply() {
        if (!this.replyToMessage) return;
        
        const messageContent = document.getElementById('replyMessage').value.trim();
        
        if (!messageContent) {
            this.showNotification('Please enter a reply message', 'error');
            return;
        }
        
        const sendBtn = document.getElementById('sendReplyBtn');
        const originalText = sendBtn.textContent;
        sendBtn.textContent = 'Sending...';
        sendBtn.disabled = true;
        
        try {
            await window.covetalks.sendMessage(
                this.replyToMessage.sender_id,
                `Re: ${this.replyToMessage.subject}`,
                messageContent,
                this.replyToMessage.opportunity_id
            );
            
            this.closeModal();
            await this.loadMessages();
            this.showNotification('Reply sent successfully!', 'success');
            
        } catch (error) {
            console.error('[Inbox] Error sending reply:', error);
            this.showNotification('Failed to send reply', 'error');
        } finally {
            sendBtn.textContent = originalText;
            sendBtn.disabled = false;
        }
    }

    filterMessages(folder) {
        this.currentFolder = folder;
        
        // Update menu
        document.querySelectorAll('.inbox-menu a').forEach(a => a.classList.remove('active'));
        event.target.closest('a').classList.add('active');
        
        // Update title
        const titles = {
            'inbox': 'Inbox',
            'sent': 'Sent Messages',
            'archived': 'Archived Messages'
        };
        document.getElementById('folderTitle').textContent = titles[folder] || 'Messages';
        
        // Display filtered messages
        this.displayMessages();
        this.backToList();
    }

    searchMessages() {
        const search = document.getElementById('searchMessages').value.toLowerCase();
        
        if (!search) {
            this.displayMessages();
            return;
        }
        
        // Filter and display
        const container = document.getElementById('messagesList');
        const filtered = this.allMessages.filter(msg => 
            msg.subject.toLowerCase().includes(search) ||
            msg.message.toLowerCase().includes(search) ||
            msg.sender?.name?.toLowerCase().includes(search) ||
            msg.recipient?.name?.toLowerCase().includes(search)
        );
        
        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🔍</div>
                    <h3>No results found</h3>
                    <p>Try a different search term</p>
                </div>
            `;
        } else {
            // Display filtered results
            this.displayMessages();
        }
    }

    async archiveMessage(messageId) {
        try {
            await window.covetalks.archiveMessage(messageId);
            
            await this.loadMessages();
            this.backToList();
            this.showNotification('Message archived', 'info');
            
        } catch (error) {
            console.error('[Inbox] Error archiving message:', error);
            this.showNotification('Failed to archive message', 'error');
        }
    }

    async updateUnreadCount() {
        const count = await window.covetalks.getUnreadMessageCount();
        
        // Update badge in header if it exists
        const headerBadge = document.getElementById('inboxBadge');
        if (headerBadge) {
            if (count > 0) {
                headerBadge.textContent = count > 99 ? '99+' : count;
                headerBadge.classList.remove('hidden');
            } else {
                headerBadge.classList.add('hidden');
            }
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    closeModal() {
        document.getElementById('composeModal').classList.remove('show');
        document.getElementById('replyModal').classList.remove('show');
        
        // Clear URL parameters
        const url = new URL(window.location);
        url.searchParams.delete('compose');
        url.searchParams.delete('to');
        url.searchParams.delete('name');
        url.searchParams.delete('subject');
        url.searchParams.delete('opportunity');
        window.history.replaceState({}, document.title, url.pathname);
    }

    formatTimeAgo(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    }

    formatDateTime(dateString) {
        return new Date(dateString).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }
}

// Initialize inbox manager
const inboxManager = new InboxManager();

// Make functions globally available for onclick handlers
window.showComposeModal = () => inboxManager.showComposeModal();
window.filterMessages = (folder) => inboxManager.filterMessages(folder);
window.searchMessages = () => inboxManager.searchMessages();
window.closeModal = () => inboxManager.closeModal();
window.sendNewMessage = () => inboxManager.sendNewMessage();
window.sendReply = () => inboxManager.sendReply();
window.cancelApplication = () => inboxManager.closeModal();

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => inboxManager.init());
} else {
    inboxManager.init();
}