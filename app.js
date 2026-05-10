// ==================== App State & Storage ====================
const APP_STATE = {
    items: [],
    settings: {
        apiUrl: localStorage.getItem('apiUrl') || '',
        apiKey: localStorage.getItem('apiKey') || '',
        autoSync: localStorage.getItem('autoSync') === 'true'
    },
    currentFilter: 'all',
    searchQuery: ''
};

// ==================== DOM Elements ====================
const elements = {
    inputArea: document.getElementById('inputArea'),
    uploadBtn: document.getElementById('uploadBtn'),
    fileInput: document.getElementById('fileInput'),
    pasteBtn: document.getElementById('pasteBtn'),
    saveBtn: document.getElementById('saveBtn'),
    syncBtn: document.getElementById('syncBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    searchInput: document.getElementById('searchInput'),
    filterTabs: document.querySelectorAll('.filter-tab'),
    itemsList: document.getElementById('itemsList'),
    settingsModal: document.getElementById('settingsModal'),
    closeSettingsBtn: document.getElementById('closeSettingsBtn'),
    previewModal: document.getElementById('previewModal'),
    closePreviewBtn: document.getElementById('closePreviewBtn'),
    apiUrlInput: document.getElementById('apiUrl'),
    apiKeyInput: document.getElementById('apiKey'),
    autoSyncCheckbox: document.getElementById('autoSync'),
    testConnectionBtn: document.getElementById('testConnectionBtn'),
    clearDataBtn: document.getElementById('clearDataBtn'),
    toast: document.getElementById('toast')
};

// ==================== Initialize App ====================
document.addEventListener('DOMContentLoaded', () => {
    loadItemsFromStorage();
    loadSettings();
    renderItems();
    setupEventListeners();
    setupAutoSync();
    
    console.log('✅ ClipVault initialized');
});

// ==================== Event Listeners ====================
function setupEventListeners() {
    // Input actions
    elements.uploadBtn.addEventListener('click', () => elements.fileInput.click());
    elements.fileInput.addEventListener('change', handleFileUpload);
    elements.pasteBtn.addEventListener('click', handlePaste);
    elements.saveBtn.addEventListener('click', handleSave);
    elements.syncBtn.addEventListener('click', handleSync);
    
    // Settings
    elements.settingsBtn.addEventListener('click', openSettings);
    elements.closeSettingsBtn.addEventListener('click', closeSettings);
    elements.testConnectionBtn.addEventListener('click', testConnection);
    elements.clearDataBtn.addEventListener('click', clearAllData);
    
    // Search & Filter
    elements.searchInput.addEventListener('input', debounce(handleSearch, 300));
    elements.filterTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            elements.filterTabs.forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            APP_STATE.currentFilter = e.target.dataset.filter;
            renderItems();
        });
    });
    
    // Preview modal
    elements.closePreviewBtn.addEventListener('click', closePreview);
    elements.previewModal.addEventListener('click', (e) => {
        if (e.target === elements.previewModal) closePreview();
    });
    
    elements.settingsModal.addEventListener('click', (e) => {
        if (e.target === elements.settingsModal) closeSettings();
    });
}

// ==================== File Upload Handler ====================
function handleFileUpload(e) {
    const files = Array.from(e.target.files);
    
    files.forEach(file => {
        const reader = new FileReader();
        
        reader.onload = (event) => {
            const item = {
                id: generateId(),
                type: getFileType(file),
                title: file.name,
                preview: file.name,
                size: formatFileSize(file.size),
                content: event.target.result, // Base64 content
                timestamp: new Date().toLocaleString('id-ID')
            };
            
            APP_STATE.items.unshift(item);
            saveItemsToStorage();
            renderItems();
            showToast(`✅ File "${file.name}" berhasil disimpan`, 'success');
        };
        
        reader.readAsDataURL(file);
    });
    
    elements.fileInput.value = '';
}

// ==================== Paste Handler ====================
async function handlePaste() {
    try {
        // Try to read clipboard
        const text = await navigator.clipboard.readText();
        elements.inputArea.value = text;
        elements.inputArea.focus();
        showToast('✅ Text dari clipboard berhasil dipaste', 'success');
    } catch (err) {
        // Fallback: Allow manual paste
        showToast('⚠️ Browser Anda tidak support direct clipboard access. Gunakan Ctrl+V', 'warning');
    }
}

// ==================== Save Handler ====================
function handleSave() {
    const content = elements.inputArea.value.trim();
    
    if (!content) {
        showToast('⚠️ Masukkan teks atau upload file terlebih dahulu', 'warning');
        return;
    }
    
    const item = {
        id: generateId(),
        type: detectContentType(content),
        title: extractTitle(content),
        preview: content.substring(0, 100),
        content: content,
        timestamp: new Date().toLocaleString('id-ID')
    };
    
    APP_STATE.items.unshift(item);
    saveItemsToStorage();
    renderItems();
    elements.inputArea.value = '';
    
    showToast('💾 Item berhasil disimpan', 'success');
}

// ==================== Copy to Clipboard ====================
function copyToClipboard(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
        // Visual feedback
        btn.classList.add('copied');
        btn.textContent = '✓';
        
        setTimeout(() => {
            btn.classList.remove('copied');
            btn.textContent = '📋';
        }, 2000);
        
        showToast('✅ Disalin ke clipboard', 'success');
    }).catch(err => {
        showToast('❌ Gagal menyalin ke clipboard', 'error');
    });
}

// ==================== Delete Item ====================
function deleteItem(id) {
    if (confirm('Apakah Anda yakin ingin menghapus item ini?')) {
        APP_STATE.items = APP_STATE.items.filter(item => item.id !== id);
        saveItemsToStorage();
        renderItems();
        showToast('🗑️ Item berhasil dihapus', 'success');
    }
}

// ==================== Render Items ====================
function renderItems() {
    const filtered = filterAndSearchItems();
    
    if (filtered.length === 0) {
        elements.itemsList.innerHTML = `
            <div class="empty-state">
                <p>📭 Tidak ada item yang sesuai</p>
                <small>Coba ubah filter atau cari dengan kata kunci lain</small>
            </div>
        `;
        return;
    }
    
    elements.itemsList.innerHTML = filtered.map(item => createItemCard(item)).join('');
    
    // Attach event listeners to cards
    document.querySelectorAll('.item-card').forEach(card => {
        const itemId = card.dataset.itemId;
        const item = APP_STATE.items.find(i => i.id === itemId);
        
        card.querySelector('.copy-btn')?.addEventListener('click', (e) => {
            copyToClipboard(item.content, e.target);
        });
        
        card.querySelector('.delete-btn')?.addEventListener('click', () => {
            deleteItem(itemId);
        });
        
        card.querySelector('.view-btn')?.addEventListener('click', () => {
            viewItem(item);
        });
        
        const imagePreview = card.querySelector('.item-image-preview');
        if (imagePreview) {
            imagePreview.addEventListener('click', () => {
                viewItem(item);
            });
        }
    });
}

// ==================== Create Item Card ====================
function createItemCard(item) {
    const typeIcon = {
        'text': '📝',
        'link': '🔗',
        'file': '📁',
        'image': '🖼️'
    };
    
    let preview = '';
    
    if (item.type === 'image' && item.content.startsWith('data:image')) {
        preview = `<img src="${item.content}" class="item-image-preview" alt="preview">`;
    } else if (item.type === 'link') {
        preview = `<p class="item-preview"><a href="${item.content}" target="_blank" rel="noopener">${item.content}</a></p>`;
    } else {
        preview = `<p class="item-preview">${escapeHtml(item.preview)}</p>`;
    }
    
    return `
        <div class="item-card" data-item-id="${item.id}">
            <div class="item-content">
                <div class="item-header">
                    <span class="item-icon">${typeIcon[item.type] || '📎'}</span>
                    <span class="item-type">${item.type}</span>
                </div>
                <h3 class="item-title">${escapeHtml(item.title)}</h3>
                ${preview}
                <div class="item-time">
                    🕐 ${item.timestamp}
                    ${item.size ? `<span> • ${item.size}</span>` : ''}
                </div>
            </div>
            <div class="item-actions">
                <button class="item-btn copy-btn" title="Salin ke clipboard">📋</button>
                ${item.type === 'image' || item.type === 'file' ? '<button class="item-btn view-btn" title="Lihat">👁️</button>' : ''}
                <button class="item-btn delete-btn" title="Hapus">🗑️</button>
            </div>
        </div>
    `;
}

// ==================== View Item ====================
function viewItem(item) {
    const previewBody = document.getElementById('previewBody');
    const previewTitle = document.getElementById('previewTitle');
    
    previewTitle.textContent = item.title;
    
    if (item.type === 'image') {
        previewBody.innerHTML = `<img src="${item.content}" style="max-width: 100%; border-radius: 8px;">`;
    } else if (item.type === 'file') {
        previewBody.innerHTML = `
            <p><strong>File:</strong> ${escapeHtml(item.title)}</p>
            <p><strong>Ukuran:</strong> ${item.size}</p>
            <a href="${item.content}" download="${item.title}" class="btn btn-primary" style="display: inline-block; margin-top: 1rem;">
                ⬇️ Download File
            </a>
        `;
    } else {
        previewBody.innerHTML = `<pre style="white-space: pre-wrap; word-wrap: break-word; background: var(--bg-secondary); padding: 1rem; border-radius: 8px;">${escapeHtml(item.content)}</pre>`;
    }
    
    elements.previewModal.classList.remove('hidden');
}

function closePreview() {
    elements.previewModal.classList.add('hidden');
}

// ==================== Search & Filter ====================
function handleSearch() {
    APP_STATE.searchQuery = elements.searchInput.value.toLowerCase();
    renderItems();
}

function filterAndSearchItems() {
    return APP_STATE.items.filter(item => {
        // Filter by type
        if (APP_STATE.currentFilter !== 'all' && item.type !== APP_STATE.currentFilter) {
            return false;
        }
        
        // Search by query
        if (APP_STATE.searchQuery) {
            const searchIn = `${item.title} ${item.preview} ${item.content}`.toLowerCase();
            if (!searchIn.includes(APP_STATE.searchQuery)) {
                return false;
            }
        }
        
        return true;
    });
}

// ==================== Settings ====================
function openSettings() {
    elements.apiUrlInput.value = APP_STATE.settings.apiUrl;
    elements.apiKeyInput.value = APP_STATE.settings.apiKey;
    elements.autoSyncCheckbox.checked = APP_STATE.settings.autoSync;
    elements.settingsModal.classList.remove('hidden');
}

function closeSettings() {
    // Save settings
    APP_STATE.settings.apiUrl = elements.apiUrlInput.value;
    APP_STATE.settings.apiKey = elements.apiKeyInput.value;
    APP_STATE.settings.autoSync = elements.autoSyncCheckbox.checked;
    
    localStorage.setItem('apiUrl', APP_STATE.settings.apiUrl);
    localStorage.setItem('apiKey', APP_STATE.settings.apiKey);
    localStorage.setItem('autoSync', APP_STATE.settings.autoSync);
    
    elements.settingsModal.classList.add('hidden');
    showToast('✅ Pengaturan disimpan', 'success');
}

function testConnection() {
    if (!APP_STATE.settings.apiUrl) {
        showToast('⚠️ Masukkan API URL terlebih dahulu', 'warning');
        return;
    }
    
    elements.testConnectionBtn.disabled = true;
    elements.testConnectionBtn.textContent = '🔄 Testing...';
    
    fetch(`${APP_STATE.settings.apiUrl}/health`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${APP_STATE.settings.apiKey}`
        }
    })
    .then(response => {
        if (response.ok) {
            showToast('✅ Koneksi berhasil!', 'success');
        } else {
            showToast('❌ Koneksi gagal (Status ' + response.status + ')', 'error');
        }
    })
    .catch(err => {
        showToast('❌ Error: ' + err.message, 'error');
    })
    .finally(() => {
        elements.testConnectionBtn.disabled = false;
        elements.testConnectionBtn.textContent = '🧪 Test Koneksi';
    });
}

function clearAllData() {
    if (confirm('⚠️ Ini akan menghapus SEMUA data lokal. Apakah Anda yakin?')) {
        if (confirm('Yakin? Data tidak bisa dikembalikan!')) {
            APP_STATE.items = [];
            localStorage.removeItem('clipvault_items');
            renderItems();
            showToast('🗑️ Semua data berhasil dihapus', 'success');
        }
    }
}

// ==================== Sync with Backend ====================
async function handleSync() {
    if (!APP_STATE.settings.apiUrl) {
        showToast('⚠️ Atur API URL di pengaturan terlebih dahulu', 'warning');
        return;
    }
    
    elements.syncBtn.disabled = true;
    elements.syncBtn.textContent = '⏳ Sinkronisasi...';
    
    try {
        // Upload local items to server
        const response = await fetch(`${APP_STATE.settings.apiUrl}/api/items`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${APP_STATE.settings.apiKey}`
            },
            body: JSON.stringify(APP_STATE.items)
        });
        
        if (response.ok) {
            showToast('✅ Sinkronisasi berhasil!', 'success');
        } else {
            showToast('❌ Sinkronisasi gagal', 'error');
        }
    } catch (err) {
        showToast('❌ Error: ' + err.message, 'error');
    } finally {
        elements.syncBtn.disabled = false;
        elements.syncBtn.textContent = '↻ Sinkronisasi';
    }
}

function setupAutoSync() {
    if (APP_STATE.settings.autoSync) {
        setInterval(handleSync, 5 * 60 * 1000); // Every 5 minutes
    }
}

// ==================== Storage Functions ====================
function saveItemsToStorage() {
    localStorage.setItem('clipvault_items', JSON.stringify(APP_STATE.items));
}

function loadItemsFromStorage() {
    const stored = localStorage.getItem('clipvault_items');
    APP_STATE.items = stored ? JSON.parse(stored) : [];
}

function loadSettings() {
    APP_STATE.settings.apiUrl = localStorage.getItem('apiUrl') || '';
    APP_STATE.settings.apiKey = localStorage.getItem('apiKey') || '';
    APP_STATE.settings.autoSync = localStorage.getItem('autoSync') === 'true';
}

// ==================== Utility Functions ====================
function generateId() {
    return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function detectContentType(content) {
    if (content.startsWith('http://') || content.startsWith('https://')) {
        return 'link';
    }
    return 'text';
}

function extractTitle(content) {
    const lines = content.split('\n');
    const title = lines[0].substring(0, 50).trim();
    return title || 'Untitled';
}

function getFileType(file) {
    if (file.type.startsWith('image/')) {
        return 'image';
    }
    return 'file';
}

function formatFileSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ==================== Toast Notification ====================
function showToast(message, type = 'default') {
    elements.toast.textContent = message;
    elements.toast.className = `toast ${type}`;
    
    setTimeout(() => {
        elements.toast.classList.add('hidden');
    }, 3000);
}

// ==================== Keyboard Shortcuts ====================
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + S: Save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
    }
    
    // Ctrl/Cmd + Shift + V: Paste from clipboard
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'V') {
        e.preventDefault();
        handlePaste();
    }
});

console.log('🚀 ClipVault v1.0 - Ready to save your stuff!');
