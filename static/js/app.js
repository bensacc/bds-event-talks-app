// State Management
let allNotes = [];
let activeType = 'all';
let searchQuery = '';
let sortOrder = 'desc';
let activeTweetNote = null;
let cacheTime = null;
let cacheTimerInterval = null;

// DOM Elements
const notesContainer = document.getElementById('notes-container');
const btnRefresh = document.getElementById('btn-refresh');
const spinnerIcon = document.getElementById('spinner-icon');
const cacheTimeText = document.getElementById('cache-time-text');
const searchInput = document.getElementById('search-input');
const filterChips = document.querySelectorAll('.filter-chip');
const sortOrderSelect = document.getElementById('sort-order');

// Stats Elements
const statTotalDays = document.getElementById('stat-total-days');
const statLatestDate = document.getElementById('stat-latest-date');

// Badge Count Elements
const countAll = document.getElementById('count-all');
const countFeature = document.getElementById('count-feature');
const countIssue = document.getElementById('count-issue');
const countChanged = document.getElementById('count-changed');
const countDeprecated = document.getElementById('count-deprecated');
const countGeneral = document.getElementById('count-general');

// Modal Elements
const tweetModal = document.getElementById('tweet-modal');
const tweetTextarea = document.getElementById('tweet-textarea');
const charCountText = document.getElementById('char-count');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnCancelTweet = document.getElementById('btn-cancel-tweet');
const btnSubmitTweet = document.getElementById('btn-submit-tweet');
const modalBadge = document.getElementById('modal-badge');
const modalDate = document.getElementById('modal-date');
const modalSourceText = document.getElementById('modal-source-text');

// Toast Elements
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toast-message');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    fetchNotes(false);
    setupEventListeners();
    setupCacheTimer();
});

// Setup Listeners
function setupEventListeners() {
    // Refresh Button
    btnRefresh.addEventListener('click', () => {
        fetchNotes(true);
    });

    // Search Input (with Debounce-like action on input)
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        filterAndRender();
    });

    // Filter Chips
    filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            filterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            activeType = chip.getAttribute('data-type');
            filterAndRender();
        });
    });

    // Sort Selector
    sortOrderSelect.addEventListener('change', (e) => {
        sortOrder = e.target.value;
        filterAndRender();
    });

    // Modal Close Triggers
    btnCloseModal.addEventListener('click', closeTweetModal);
    btnCancelTweet.addEventListener('click', closeTweetModal);
    
    // Close modal if user clicks backdrop
    tweetModal.addEventListener('click', (e) => {
        if (e.target === tweetModal) {
            closeTweetModal();
        }
    });

    // Tweet Textarea Character Counter & Validation
    tweetTextarea.addEventListener('input', () => {
        const len = tweetTextarea.value.length;
        charCountText.textContent = len;
        
        // Character counter visual feedback
        charCountText.classList.remove('warning', 'danger');
        if (len >= 270) {
            charCountText.classList.add('danger');
        } else if (len >= 250) {
            charCountText.classList.add('warning');
        }

        // Disable tweet button if empty or over limit
        btnSubmitTweet.disabled = (len === 0 || len > 280);
    });

    // Submit Tweet Action
    btnSubmitTweet.addEventListener('click', publishTweet);
}

// Setup Timer to keep relative cache age updated
function setupCacheTimer() {
    if (cacheTimerInterval) clearInterval(cacheTimerInterval);
    cacheTimerInterval = setInterval(updateCacheAgeDisplay, 15000);
}

// Fetch notes from Backend API
async function fetchNotes(force = false) {
    // Set loading UI states
    btnRefresh.disabled = true;
    spinnerIcon.classList.add('spinning');
    
    // Show spinner if feed is completely empty
    if (allNotes.length === 0) {
        notesContainer.innerHTML = `
            <div class="loading-state">
                <div class="double-bounce">
                    <div class="bounce1"></div>
                    <div class="bounce2"></div>
                </div>
                <p>Loading BigQuery release notes...</p>
            </div>
        `;
    }

    try {
        const url = `/api/release-notes?force=${force}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Server returned code ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }

        allNotes = data.notes || [];
        cacheTime = data.cached_at * 1000; // Convert to ms
        
        updateCacheAgeDisplay();
        updateStats();
        updateCountBadges();
        filterAndRender();
        
        if (data.warning) {
            showToast(data.warning);
        } else if (force) {
            showToast("Release notes successfully refreshed!");
        }
    } catch (err) {
        console.error("Error loading release notes:", err);
        showToast(`Error: ${err.message}`);
        
        // If we have no notes at all, show error state
        if (allNotes.length === 0) {
            notesContainer.innerHTML = `
                <div class="empty-state">
                    <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p>Failed to load release notes.</p>
                    <button class="btn btn-secondary" onclick="fetchNotes(true)">Try Again</button>
                </div>
            `;
        }
    } finally {
        btnRefresh.disabled = false;
        spinnerIcon.classList.remove('spinning');
    }
}

// Update relative time in header
function updateCacheAgeDisplay() {
    if (!cacheTime) {
        cacheTimeText.textContent = "Loading...";
        return;
    }
    
    const diffMs = Date.now() - cacheTime;
    const diffSec = Math.floor(diffMs / 1000);
    
    if (diffSec < 5) {
        cacheTimeText.textContent = "Just updated";
    } else if (diffSec < 60) {
        cacheTimeText.textContent = `Updated ${diffSec}s ago`;
    } else {
        const diffMin = Math.floor(diffSec / 60);
        cacheTimeText.textContent = `Updated ${diffMin}m ago`;
    }
}

// Calculate and show overall Statistics
function updateStats() {
    // Unique dates count
    const uniqueDates = new Set(allNotes.map(n => n.date));
    statTotalDays.textContent = uniqueDates.size;
    
    // Latest Date
    if (allNotes.length > 0) {
        // Find most recent updated timestamp
        const sorted = [...allNotes].sort((a, b) => new Date(b.updated) - new Date(a.updated));
        statLatestDate.textContent = sorted[0].date;
    } else {
        statLatestDate.textContent = "-";
    }
}

// Set sidebar total badges
function updateCountBadges() {
    countAll.textContent = allNotes.length;
    countFeature.textContent = allNotes.filter(n => n.type === 'Feature').length;
    countIssue.textContent = allNotes.filter(n => n.type === 'Issue').length;
    countChanged.textContent = allNotes.filter(n => n.type === 'Changed').length;
    countDeprecated.textContent = allNotes.filter(n => n.type === 'Deprecated').length;
    countGeneral.textContent = allNotes.filter(n => n.type === 'General').length;
}

// Filter, Sort and trigger rendering
function filterAndRender() {
    let result = [...allNotes];
    
    // Filter by badge type
    if (activeType !== 'all') {
        result = result.filter(n => n.type === activeType);
    }
    
    // Filter by search query (checks title/date, type and text content)
    if (searchQuery) {
        result = result.filter(n => {
            return n.text.toLowerCase().includes(searchQuery) || 
                   n.date.toLowerCase().includes(searchQuery) ||
                   n.type.toLowerCase().includes(searchQuery);
        });
    }
    
    // Sort
    result.sort((a, b) => {
        const dateA = new Date(a.updated || 0);
        const dateB = new Date(b.updated || 0);
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
    
    renderNotes(result);
}

// Render filtered notes array to HTML
function renderNotes(notes) {
    if (notes.length === 0) {
        notesContainer.innerHTML = `
            <div class="empty-state">
                <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p>No release notes found matching the criteria.</p>
            </div>
        `;
        return;
    }

    notesContainer.innerHTML = notes.map(note => {
        return `
            <article class="note-card glass-panel" data-type="${escapeHtml(note.type)}">
                <div class="note-header">
                    <div class="note-meta">
                        <span class="badge-type" data-type="${escapeHtml(note.type)}">${escapeHtml(note.type)}</span>
                        <time class="note-date">${escapeHtml(note.date)}</time>
                    </div>
                    <div class="note-actions">
                        <button class="action-btn btn-tweet-action" title="Share update on X (Twitter)" onclick="openTweetModal('${escapeHtml(note.id)}')">
                            <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                            </svg>
                        </button>
                        <a href="${escapeHtml(note.link)}" target="_blank" class="action-btn" title="View official release page">
                            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                        </a>
                    </div>
                </div>
                <div class="note-content">
                    ${note.content}
                </div>
            </article>
        `;
    }).join('');
}

// Tweet Modal Operations
window.openTweetModal = function(noteId) {
    const note = allNotes.find(n => n.id === noteId);
    if (!note) return;
    
    activeTweetNote = note;
    
    // Set UI components in modal
    modalBadge.textContent = note.type;
    modalBadge.setAttribute('data-type', note.type);
    modalDate.textContent = note.date;
    
    // Strip HTML for the preview block
    const cleanedText = note.text;
    modalSourceText.textContent = cleanedText;
    
    // Compose Default Tweet message
    // Max characters = 280. 
    // We allocate 23 characters for X's automated t.co URL shortening.
    // The structure will be: "🚀 BigQuery Update (Date): [Content truncated] #BigQuery #GoogleCloud"
    const prefix = `🚀 BigQuery Update (${note.date}): `;
    const suffix = ` #BigQuery #GoogleCloud`;
    
    // Available characters for description: 280 - prefix.length - suffix.length - 23 (URL) - 2 (spaces)
    const urlLengthEstimate = 23;
    const reservedLength = prefix.length + suffix.length + urlLengthEstimate + 2; 
    const maxDescLength = Math.max(0, 280 - reservedLength);
    
    let tweetDesc = cleanedText;
    if (tweetDesc.length > maxDescLength) {
        tweetDesc = tweetDesc.substring(0, maxDescLength - 3) + '...';
    }
    
    const defaultTweetText = `${prefix}${tweetDesc}${suffix}`;
    
    tweetTextarea.value = defaultTweetText;
    charCountText.textContent = defaultTweetText.length;
    
    // Trigger input validation logic
    tweetTextarea.dispatchEvent(new Event('input'));
    
    // Show Modal
    tweetModal.classList.add('active');
    tweetTextarea.focus();
};

function closeTweetModal() {
    tweetModal.classList.remove('active');
    activeTweetNote = null;
}

function publishTweet() {
    if (!activeTweetNote) return;
    
    const tweetText = tweetTextarea.value;
    const url = activeTweetNote.link;
    
    // Build Twitter Intent URL
    // Intent text param carries the main text, url param carries the trailing URL
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(url)}`;
    
    // Open in a new tab
    window.open(tweetUrl, '_blank', 'noopener,noreferrer');
    
    closeTweetModal();
    showToast("Opening X/Twitter in a new tab...");
}

// Display Toast notifications
function showToast(message) {
    toastMessage.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

// Escape HTML utility helper
function escapeHtml(unsafe) {
    if (!unsafe) return "";
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}
