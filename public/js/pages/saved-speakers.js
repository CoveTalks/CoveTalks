/**
 * CoveTalks Saved Speakers Page
 * Manage saved speakers for organizations
 */

// Page state
let currentUser = null;
let savedSpeakers = [];
let filteredSpeakers = [];
let currentView = 'grid';
let selectedSpeakerId = null;
let editingNotesId = null;
let myOpportunities = [];

// Initialize page
async function initializePage() {
    try {
        // Wait for Supabase
        await waitForSupabase();
        
        // Check authentication
        const session = await window.covetalks.checkAuth();
        if (!session) {
            window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.href);
            return;
        }

        // Get user profile
        currentUser = await window.covetalks.getMemberProfile(session.user.id);
        if (!currentUser || currentUser.member_type !== 'Organization') {
            // Redirect non-organization users
            window.location.href = '/dashboard.html';
            return;
        }

        // Load saved speakers
        await loadSavedSpeakers();

        // Load opportunities for contact form
        await loadOpportunities();

    } catch (error) {
        console.error('Initialization error:', error);
        alert('Failed to load saved speakers. Please try refreshing the page.');
    }
}

// Wait for Supabase client
function waitForSupabase() {
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
                console.error('Failed to initialize');
                resolve();
            }
        }
        check();
    });
}

// Load saved speakers
async function loadSavedSpeakers() {
    try {
        savedSpeakers = await window.covetalks.getSavedSpeakers();
        filteredSpeakers = [...savedSpeakers];
        
        updateStats();
        displaySpeakers();
        
    } catch (error) {
        console.error('Error loading saved speakers:', error);
        displayError();
    }
}

// Load opportunities for contact form
async function loadOpportunities() {
    try {
        myOpportunities = await window.covetalks.getMyOpportunities('Open');
        
        // Populate contact form dropdown
        const select = document.getElementById('contactOpportunity');
        select.innerHTML = '<option value="">Select an opportunity...</option>' +
            myOpportunities.map(opp => 
                `<option value="${opp.id}">${opp.title} - ${formatDate(opp.event_date)}</option>`
            ).join('');
            
    } catch (error) {
        console.error('Error loading opportunities:', error);
    }
}

// Update statistics
function updateStats() {
    const total = savedSpeakers.length;
    const withNotes = savedSpeakers.filter(s => s.notes && s.notes.trim()).length;
    
    // Handle missing created_at gracefully
    let recentlyAdded = 0;
    if (savedSpeakers.length > 0 && savedSpeakers[0].created_at) {
        const thisMonth = new Date();
        thisMonth.setDate(1);
        recentlyAdded = savedSpeakers.filter(s => 
            s.created_at && new Date(s.created_at) >= thisMonth
        ).length;
    }
    
    const topRated = savedSpeakers.filter(s => 
        s.speaker?.average_rating >= 4.5
    ).length;
    
    document.getElementById('totalSaved').textContent = total;
    document.getElementById('withNotes').textContent = withNotes;
    document.getElementById('recentlyAdded').textContent = recentlyAdded;
    document.getElementById('topRated').textContent = topRated;
}

// Display speakers
function displaySpeakers() {
    const container = document.getElementById('speakersContent');
    
    if (filteredSpeakers.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⭐</div>
                <h3>No saved speakers yet</h3>
                <p>Start building your speaker collection by browsing and saving speakers.</p>
                <a href="/members.html" class="btn btn-primary mt-3">
                    Browse Speakers
                </a>
            </div>
        `;
        return;
    }
    
    if (currentView === 'grid') {
        displayGridView();
    } else {
        displayListView();
    }
}

// Display grid view
function displayGridView() {
    const container = document.getElementById('speakersContent');
    
    container.innerHTML = `
        <div class="speakers-grid">
            ${filteredSpeakers.map(item => {
                const speaker = item.speaker;
                const initials = speaker.name ? 
                    speaker.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 
                    '??';
                
                const avatarContent = speaker.profile_image_url ? 
                    `<img src="${speaker.profile_image_url}" alt="${speaker.name}">` :
                    initials;
                
                const rating = speaker.average_rating || 0;
                const stars = '⭐'.repeat(Math.floor(rating)) + '☆'.repeat(5 - Math.floor(rating));
                
                const specialties = speaker.specialties || [];
                
                return `
                    <div class="speaker-card">
                        <div class="saved-indicator">⭐</div>
                        <div class="speaker-header">
                            <div class="speaker-avatar">
                                ${avatarContent}
                            </div>
                            <div class="speaker-info">
                                <h3>${speaker.name || 'Unknown'}</h3>
                                <div class="speaker-location">${speaker.location || 'Location not specified'}</div>
                                ${rating > 0 ? `
                                <div class="speaker-rating">
                                    <span class="stars">${stars}</span>
                                    <span class="rating-value">(${rating.toFixed(1)})</span>
                                </div>` : ''}
                            </div>
                        </div>
                        <div class="speaker-bio">
                            ${speaker.bio ? speaker.bio.substring(0, 150) + (speaker.bio.length > 150 ? '...' : '') : 'No bio available'}
                        </div>
                        ${specialties.length > 0 ? `
                        <div class="speaker-specialties">
                            ${specialties.slice(0, 3).map(s => `<span class="specialty-tag">${s}</span>`).join('')}
                            ${specialties.length > 3 ? `<span class="specialty-tag">+${specialties.length - 3}</span>` : ''}
                        </div>` : ''}
                        
                        <div class="speaker-notes">
                            <div class="notes-header">
                                <span class="notes-label">Your Notes:</span>
                                ${editingNotesId !== item.id ? 
                                    `<button class="edit-notes-btn" onclick="editNotes('${item.id}')">Edit</button>` :
                                    ''
                                }
                            </div>
                            ${editingNotesId === item.id ? `
                                <textarea class="notes-input" id="notes-${item.id}">${item.notes || ''}</textarea>
                                <div class="notes-actions">
                                    <button onclick="cancelEditNotes()" class="btn btn-secondary btn-sm">Cancel</button>
                                    <button onclick="saveNotes('${item.id}', '${speaker.id}')" class="btn btn-primary btn-sm">Save</button>
                                </div>
                            ` : `
                                <div class="notes-content">
                                    ${item.notes || 'No notes added yet.'}
                                </div>
                            `}
                        </div>
                        
                        <div class="card-actions">
                            <button onclick="showContactModal('${speaker.id}', '${escapeHtml(speaker.name)}')" class="btn btn-primary btn-sm">
                                Contact
                            </button>
                            <a href="/profile.html?id=${speaker.id}" class="btn btn-secondary btn-sm">
                                View Profile
                            </a>
                            <button onclick="showRemoveModal('${speaker.id}', '${escapeHtml(speaker.name)}')" class="btn btn-danger btn-sm">
                                Remove
                            </button>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// Display list view
function displayListView() {
    const container = document.getElementById('speakersContent');
    
    container.innerHTML = `
        <div class="speakers-list">
            <table class="speakers-table">
                <thead>
                    <tr>
                        <th>Speaker</th>
                        <th>Location</th>
                        <th>Specialties</th>
                        <th>Rating</th>
                        <th>Notes</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredSpeakers.map(item => {
                        const speaker = item.speaker;
                        const specialties = speaker.specialties || [];
                        const rating = speaker.average_rating || 0;
                        
                        return `
                            <tr>
                                <td>
                                    <strong>${speaker.name || 'Unknown'}</strong><br>
                                    <small>${speaker.email || ''}</small>
                                </td>
                                <td>${speaker.location || '-'}</td>
                                <td>${specialties.slice(0, 2).join(', ') || '-'}</td>
                                <td>${rating > 0 ? `⭐ ${rating.toFixed(1)}` : '-'}</td>
                                <td>
                                    <small>${item.notes ? item.notes.substring(0, 50) + '...' : 'No notes'}</small>
                                </td>
                                <td>
                                    <div class="action-buttons">
                                        <button onclick="showContactModal('${speaker.id}', '${escapeHtml(speaker.name)}')" class="btn btn-primary btn-sm">
                                            Contact
                                        </button>
                                        <button onclick="showRemoveModal('${speaker.id}', '${escapeHtml(speaker.name)}')" class="btn btn-danger btn-sm">
                                            Remove
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// Set view
window.setView = function(view) {
    currentView = view;
    
    // Update toggle buttons
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    displaySpeakers();
}

// Filter speakers
window.filterSpeakers = function() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const specialty = document.getElementById('specialtyFilter').value;
    
    filteredSpeakers = savedSpeakers.filter(item => {
        const speaker = item.speaker;
        
        // Search filter
        if (search) {
            const nameMatch = speaker.name?.toLowerCase().includes(search);
            const bioMatch = speaker.bio?.toLowerCase().includes(search);
            const notesMatch = item.notes?.toLowerCase().includes(search);
            if (!nameMatch && !bioMatch && !notesMatch) return false;
        }
        
        // Specialty filter
        if (specialty) {
            const specialties = speaker.specialties || [];
            if (!specialties.some(s => s.includes(specialty))) return false;
        }
        
        return true;
    });
    
    displaySpeakers();
}

// Sort speakers
window.sortSpeakers = function() {
    const sortBy = document.getElementById('sortBy').value;
    
    filteredSpeakers.sort((a, b) => {
        switch(sortBy) {
            case 'name':
                return (a.speaker.name || '').localeCompare(b.speaker.name || '');
            case 'rating':
                return (b.speaker.average_rating || 0) - (a.speaker.average_rating || 0);
            case 'location':
                return (a.speaker.location || '').localeCompare(b.speaker.location || '');
            case 'recent':
            default:
                // Handle missing created_at
                if (!a.created_at || !b.created_at) return 0;
                return new Date(b.created_at) - new Date(a.created_at);
        }
    });
    
    displaySpeakers();
}

// Edit notes
window.editNotes = function(savedSpeakerId) {
    editingNotesId = savedSpeakerId;
    displaySpeakers();
}

// Cancel edit notes
window.cancelEditNotes = function() {
    editingNotesId = null;
    displaySpeakers();
}

// Save notes
window.saveNotes = async function(savedSpeakerId, speakerId) {
    const notes = document.getElementById(`notes-${savedSpeakerId}`).value;
    
    try {
        await window.covetalks.updateSavedSpeakerNotes(speakerId, notes);
        
        // Update local data
        const item = savedSpeakers.find(s => s.id === savedSpeakerId);
        if (item) {
            item.notes = notes;
        }
        
        editingNotesId = null;
        displaySpeakers();
        updateStats();
        
    } catch (error) {
        console.error('Error saving notes:', error);
        alert('Failed to save notes. Please try again.');
    }
}

// Show contact modal
window.showContactModal = function(speakerId, speakerName) {
    selectedSpeakerId = speakerId;
    document.getElementById('contactSubject').value = `Speaking Opportunity from ${currentUser.name}`;
    document.getElementById('contactMessage').value = '';
    document.getElementById('contactModal').classList.add('show');
}

// Show remove modal
window.showRemoveModal = function(speakerId, speakerName) {
    selectedSpeakerId = speakerId;
    document.getElementById('removeSpeakerName').textContent = speakerName;
    document.getElementById('removeModal').classList.add('show');
}

// Close modal
window.closeModal = function() {
    document.getElementById('contactModal').classList.remove('show');
    document.getElementById('removeModal').classList.remove('show');
    selectedSpeakerId = null;
}

// Send message
window.sendMessage = async function() {
    const subject = document.getElementById('contactSubject').value;
    const message = document.getElementById('contactMessage').value;
    const opportunityId = document.getElementById('contactOpportunity').value || null;
    
    if (!subject || !message) {
        alert('Please fill in all required fields');
        return;
    }
    
    try {
        await window.covetalks.sendMessage(selectedSpeakerId, subject, message, opportunityId);
        alert('Message sent successfully!');
        closeModal();
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message. Please try again.');
    }
}

// Confirm remove speaker
window.confirmRemoveSpeaker = async function() {
    try {
        await window.covetalks.removeSavedSpeaker(selectedSpeakerId);
        
        // Remove from local data
        savedSpeakers = savedSpeakers.filter(s => s.speaker.id !== selectedSpeakerId);
        filteredSpeakers = filteredSpeakers.filter(s => s.speaker.id !== selectedSpeakerId);
        
        closeModal();
        updateStats();
        displaySpeakers();
        
    } catch (error) {
        console.error('Error removing speaker:', error);
        alert('Failed to remove speaker. Please try again.');
    }
}

// Export speakers
window.exportSpeakers = async function() {
    try {
        const result = await window.covetalks.exportSavedSpeakers('csv');
        
        // Create download link
        const blob = new Blob([result.data], { type: result.mimeType });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
    } catch (error) {
        console.error('Error exporting speakers:', error);
        alert('Failed to export speakers. Please try again.');
    }
}

// Display error
function displayError() {
    const container = document.getElementById('speakersContent');
    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">⚠️</div>
            <h3>Error Loading Speakers</h3>
            <p>There was an error loading your saved speakers.</p>
            <button onclick="location.reload()" class="btn btn-primary mt-3">
                Try Again
            </button>
        </div>
    `;
}

// Utility function to escape HTML
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text ? text.replace(/[&<>"']/g, m => map[m]) : '';
}

// Format date
function formatDate(dateString) {
    if (!dateString) return 'Date TBD';
    return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

// Close modals when clicking outside
document.addEventListener('click', function(event) {
    if (event.target.classList.contains('modal')) {
        closeModal();
    }
});

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePage);
} else {
    initializePage();
}