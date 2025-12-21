// Supabase Configuration
const SUPABASE_CONFIG = {
    url: 'https://bhaexzjmspamqxcszkgm.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoYWV4emptc3BhbXF4Y3N6a2dtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE1NjQ3MjEsImV4cCI6MjA2NzE0MDcyMX0.vCYNKtOp6phSWEK36XYNqL6DznS5pw_49QduBfUvckk'
};

// Initialize Supabase
const supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);

// Global variables
let inventory = [];
let transactionHistory = [];
let itemCounter = 1;
let currentUser = null;
let isEditMode = false;
let currentEditItemId = null;
let currentStockItemId = null;
let currentRelocationItemId = null;

// Wishlist variables
let wishlist = [];
let currentWishlistEditId = null;

// Wishlist Event Listeners
function setupWishlistEventListeners() {
    // Open wishlist modal button
    const wishlistBtn = document.getElementById('openWishlistBtn');
    if (wishlistBtn) {
        wishlistBtn.addEventListener('click', showWishlistModal);
    }

    // Wishlist form submit
    const wishlistForm = document.getElementById('wishlistForm');
    if (wishlistForm) {
        wishlistForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveWishlistItem(new FormData(wishlistForm));
        });
    }

    // Cancel button
    const cancelWishlistBtn = document.getElementById('cancelWishlistBtn');
    if (cancelWishlistBtn) {
        cancelWishlistBtn.addEventListener('click', () => closeModal('wishlistModal'));
    }

    // Close modal on X or outside
    const wishlistModal = document.getElementById('wishlistModal');
    if (wishlistModal) {
        wishlistModal.querySelector('.close')?.addEventListener('click', () => closeModal('wishlistModal'));
        wishlistModal.addEventListener('click', (e) => {
            if (e.target === wishlistModal) closeModal('wishlistModal');
        });
    }
}

// Show wishlist modal and load data
function showWishlistModal() {
    loadWishlistData();
    document.getElementById('wishlistForm')?.reset();
    document.getElementById('wishlistModal').style.display = 'block';
}

// Load wishlist from Supabase
async function loadWishlistData() {
    if (!currentUser) return;
    try {
        const { data, error } = await supabase
            .from('wishlist')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        wishlist = data || [];
        updateWishlistDisplay();
    } catch (error) {
        console.error('Failed to load wishlist:', error);
        wishlist = [];
        updateWishlistDisplay();
    }
}

// Display wishlist items in modal
function updateWishlistDisplay() {
    const tbody = document.getElementById('wishlistTableBody');
    if (!tbody) return;
    if (!wishlist || wishlist.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-state"><i class="fas fa-heart"></i><h3>No wishlist items</h3><p>Add your first wish!</p></td></tr>`;
        return;
    }
    tbody.innerHTML = wishlist.map(item => `
        <tr>
            <td>${item.product_name}</td>
            <td>${item.quantity}</td>
            <td>${item.purpose}</td>
            <td>${item.product_link ? `<a href="${item.product_link}" target="_blank">Link</a>` : '-'}</td>
            <td>${item.user_name}</td>
            <td>${item.created_at ? new Date(item.created_at).toLocaleString() : '-'}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="migrateWishlistToInventory('${item.id}')" title="Migrate to Inventory"><i class="fas fa-arrow-right"></i></button>
                <button class="btn btn-sm btn-danger" onclick="deleteWishlistItem('${item.id}')" title="Delete"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

// Migrate wishlist item to inventory
async function migrateWishlistToInventory(wishlistId) {
    // Ensure wishlist is up-to-date and id types match
    let wish = wishlist.find(w => String(w.id) === String(wishlistId));
    if (!wish) {
        // Try reloading wishlist in case it's stale
        await loadWishlistData();
        wish = wishlist.find(w => String(w.id) === String(wishlistId));
        if (!wish) {
            showNotification('Wishlist item not found', 'error');
            return;
        }
    }
    // Check if an inventory item with the same name exists
    const existingItem = inventory.find(inv => inv.item.trim().toLowerCase() === wish.product_name.trim().toLowerCase());
    if (existingItem) {
        // Add stock instead of creating new item
        closeModal('wishlistModal');
        setTimeout(() => {
            showStockModal(existingItem.item_id, 'add');
            document.getElementById('adjustmentQuantity').value = wish.quantity;
            document.getElementById('adjustmentReason').value = `Migrated from wishlist${wish.product_link ? ' | Link: ' + wish.product_link : ''}`;
            // Attach a one-time event to handle post-add deletion
            const stockForm = document.getElementById('stockForm');
            if (!stockForm) return;
            const handler = async (e) => {
                setTimeout(async () => {
                    await deleteWishlistItem(wish.id);
                }, 500);
                stockForm.removeEventListener('submit', handler);
            };
            stockForm.addEventListener('submit', handler);
        }, 300);
    } else {
        // Prefill inventory modal with wishlist data (original behavior)
        closeModal('wishlistModal');
        setTimeout(() => {
            document.getElementById('modalTitle').textContent = 'Add New Item';
            document.getElementById('inventoryForm').reset();
            document.getElementById('itemName').value = wish.product_name;
            document.getElementById('itemQuantity').value = wish.quantity;
            document.getElementById('itemDescription').value = wish.purpose;
            document.getElementById('itemRemarks').value = `Migrated from wishlist${wish.product_link ? ' | Link: ' + wish.product_link : ''}`;
            document.getElementById('inventoryModal').style.display = 'block';
            // Attach a one-time event to handle post-add deletion
            const inventoryForm = document.getElementById('inventoryForm');
            if (!inventoryForm) return;
            const handler = async (e) => {
                setTimeout(async () => {
                    await deleteWishlistItem(wish.id);
                }, 500);
                inventoryForm.removeEventListener('submit', handler);
            };
            inventoryForm.addEventListener('submit', handler);
        }, 300);
    }
}

// Add to Wishlist from Inventory (must be global)
window.addToWishlistFromInventory = async function(itemId) {
    console.log('addToWishlistFromInventory called with itemId:', itemId);
    console.log('Current inventory:', inventory);
    
    const item = inventory.find(inv => inv.item_id === itemId);
    if (!item) {
        console.error('Item not found for ID:', itemId);
        console.error('Available items:', inventory.map(i => i.item_id));
        showNotification('Item not found', 'error');
        return;
    }
    
    console.log('Found item:', item);
    
    // Check if wishlist modal elements exist
    const wishlistForm = document.getElementById('wishlistForm');
    const wishlistModal = document.getElementById('wishlistModal');
    const productNameField = document.getElementById('wishlistProductName');
    
    console.log('Modal elements check:', {
        wishlistForm: !!wishlistForm,
        wishlistModal: !!wishlistModal,
        productNameField: !!productNameField
    });
    
    if (!wishlistForm || !wishlistModal || !productNameField) {
        console.error('Wishlist modal elements not found');
        showNotification('Wishlist modal not properly initialized', 'error');
        return;
    }
    
    // Open wishlist modal prefilled with item name and quantity 1
    document.getElementById('wishlistForm').reset();
    document.getElementById('wishlistProductName').value = item.item;
    document.getElementById('wishlistQuantity').value = 1;
    document.getElementById('wishlistPurpose').value = item.description || '';
    document.getElementById('wishlistProductLink').value = '';
    document.getElementById('wishlistModal').style.display = 'block';
    console.log('Wishlist modal should now be visible');
};

// Expose migrateWishlistToInventory globally for inline onclick
window.migrateWishlistToInventory = migrateWishlistToInventory;

// Expose deleteWishlistItem globally for inline onclick
window.deleteWishlistItem = deleteWishlistItem;

// Save wishlist item (add)
async function saveWishlistItem(formData) {
    if (!currentUser) {
        showNotification('You must be logged in to add to wishlist', 'error');
        return;
    }
    const product_name = formData.get('wishlistProductName')?.trim();
    const quantity = parseInt(formData.get('wishlistQuantity'));
    const purpose = formData.get('wishlistPurpose')?.trim();
    const product_link = formData.get('wishlistProductLink')?.trim();
    const user_name = currentUser.name;
    if (!product_name || !purpose || !quantity || quantity < 1) {
        showNotification('Please fill all required fields', 'warning');
        return;
    }
    try {
        const wish = {
            product_name,
            quantity,
            purpose,
            product_link,
            user_name,
            created_at: new Date().toISOString()
        };
        const { error } = await supabase.from('wishlist').insert([wish]);
        if (error) throw error;
        showNotification('Wish added!', 'success');
        await loadWishlistData();
        closeModal('wishlistModal');
    } catch (error) {
        console.error('Failed to add wish:', error);
        showNotification('Failed to add wish', 'error');
    }
}

// Delete wishlist item
async function deleteWishlistItem(id) {
    if (!currentUser) {
        showNotification('You must be logged in to delete wishlist items', 'error');
        return;
    }
    if (!confirm('Delete this wish?')) return;
    try {
        const { error } = await supabase.from('wishlist').delete().eq('id', id);
        if (error) throw error;
        showNotification('Wish deleted', 'success');
        await loadWishlistData();
    } catch (error) {
        console.error('Failed to delete wish:', error);
        showNotification('Failed to delete wish', 'error');
    }
}
// Initialize the application
window.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing app...');
    // Check for saved user session
    const savedUser = localStorage.getItem('ims_user');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            console.log('Restored user session:', currentUser);
            showDashboard();
            updateConnectionStatus('connected');
            loadInventoryData();
            setupWishlistEventListeners();
            loadWishlistData();
            // Do NOT call initializeApp if session is restored
            return;
        } catch (e) {
            console.warn('Failed to parse saved user session:', e);
            localStorage.removeItem('ims_user');
        }
    }
    // Only call initializeApp if no session
    initializeApp();
    setupWishlistEventListeners();
});

async function initializeApp() {
    console.log('Initializing app...');
    console.log('Supabase URL:', SUPABASE_CONFIG.url);
    console.log('Supabase Key:', SUPABASE_CONFIG.key.substring(0, 20) + '...');
    
    // Initialize connection status
    updateConnectionStatus('connecting');
    
    // Check Supabase connection (non-blocking)
    console.log('Checking Supabase connection...');
    const isConnected = await checkSupabaseConnection();
    console.log('Connection result:', isConnected);
    
    // Only show login page if not already logged in
    if (!currentUser) {
        showLoginPage();
    } else {
        showDashboard();
        updateConnectionStatus('connected');
        // DO NOT call loadInventoryData here, it is already called in DOMContentLoaded if session is restored
    }
    
    setupEventListeners();
    setupModalEventListeners();
    setupSearchEnhancements();
    
    // Set up periodic connection checking (every 30 seconds)
    setInterval(checkSupabaseConnection, 30000);
    
    console.log('App initialization complete');
}

// Page Management
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');
}

function showLoginPage() {
    showPage('loginPage');
}

function showDashboard() {
    showPage('dashboardPage');
    if (currentUser) {
        const userElement = document.getElementById('currentUser');
        if (userElement) {
            userElement.textContent = `Welcome, ${currentUser.name}!`;
        }
    }
    updateInventoryDisplay();
    updateStats();
}

// Event Listeners Setup
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Name form submission - try multiple approaches
    const nameForm = document.getElementById('nameForm');
    if (nameForm) {
        console.log('Found nameForm, adding event listener');
        nameForm.addEventListener('submit', function(e) {
            console.log('Form submit event triggered');
            handleNameSubmit(e);
        });
        
        // Also try the submit button directly
        const submitBtn = nameForm.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.addEventListener('click', function(e) {
                console.log('Submit button clicked');
                e.preventDefault();
                handleNameSubmit(e);
            });
        }
    } else {
        console.error('nameForm not found!');
    }
    
    // Dashboard actions
    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
    document.getElementById('addInventoryBtn')?.addEventListener('click', showAddInventoryModal);
    document.getElementById('syncBtn')?.addEventListener('click', handleManualSync);
    document.getElementById('viewHistoryBtn')?.addEventListener('click', showHistoryModal);
    
    // Search and filter
    document.getElementById('searchInput')?.addEventListener('input', filterInventory);
    document.getElementById('typeFilter')?.addEventListener('change', filterInventory);
    
    console.log('Event listeners setup complete');
}

// Modal Event Listeners Setup
function setupModalEventListeners() {
    console.log('Setting up modal event listeners...');
    
    // Inventory modal
    const inventoryForm = document.getElementById('inventoryForm');
    if (inventoryForm) {
        console.log('Found inventoryForm, adding submit listener');
        inventoryForm.addEventListener('submit', (e) => {
            console.log('Inventory form submit event triggered');
            e.preventDefault();
            const formData = new FormData(e.target);
            console.log('FormData created:', formData);
            
            // Debug: Log all form data
            for (let [key, value] of formData.entries()) {
                console.log(`${key}: ${value}`);
            }
            
            saveInventoryItem(formData);
        });
        console.log('Inventory form submit listener added');
    } else {
        console.error('inventoryForm not found!');
    }
    
    document.getElementById('cancelBtn')?.addEventListener('click', () => {
        closeModal('inventoryModal');
    });
    
    // Stock modal
    document.getElementById('stockForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        adjustStock(formData);
    });
    
    document.getElementById('cancelStockBtn')?.addEventListener('click', () => {
        closeModal('stockModal');
    });
    
    // Relocation modal
    document.getElementById('relocationForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        processRelocation(formData);
    });
    
    document.getElementById('cancelRelocationBtn')?.addEventListener('click', () => {
        closeModal('relocationModal');
    });
    
    // History modal
    document.getElementById('closeHistoryBtn')?.addEventListener('click', () => {
        closeModal('historyModal');
    });
    
    document.getElementById('historyItemFilter')?.addEventListener('change', updateTransactionHistory);
    document.getElementById('historyActionFilter')?.addEventListener('change', updateTransactionHistory);
    
    // Item Details modal
    document.getElementById('closeItemDetailsBtn')?.addEventListener('click', () => {
        closeModal('itemDetailsModal');
    });
    
    document.getElementById('closeItemDetailsModal')?.addEventListener('click', () => {
        closeModal('itemDetailsModal');
    });
    
    // Close modal when clicking the X or outside the modal
    document.querySelectorAll('.modal .close').forEach(closeBtn => {
        closeBtn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) closeModal(modal.id);
        });
    });
    
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
    });
    
    console.log('Modal event listeners setup complete');
}

// Modal utility functions
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    // Reset forms when closing
    if (modalId === 'inventoryModal') {
        document.getElementById('inventoryForm').reset();
        isEditMode = false;
        currentEditItemId = null;
    } else if (modalId === 'stockModal') {
        document.getElementById('stockForm').reset();
        currentStockItemId = null;
    } else if (modalId === 'relocationModal') {
        document.getElementById('relocationForm').reset();
        window.currentRelocationItemId = null;
    }
}

// Authentication Functions
async function handleNameSubmit(e) {
    e.preventDefault();
    const userName = document.getElementById('userName').value.trim();
    if (userName) {
        console.log('Attempting login for:', userName);
        
        // Use a simple hash of the username for consistent user_id
        const userId = btoa(userName.toLowerCase()).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
        
        currentUser = {
            name: userName,
            id: userId,
            loginTime: new Date().toISOString()
        };
        // Save session
        localStorage.setItem('ims_user', JSON.stringify(currentUser));
        
        console.log('User logged in:', currentUser);
        showNotification(`Welcome, ${userName}!`, 'success');
        showDashboard();
        
        // Set connection status to connected initially
        updateConnectionStatus('connected');
        
        // Try to load data (this will handle connection checking)
        try {
            await loadInventoryData();
        } catch (error) {
            console.error('Initial data load failed:', error);
            // Keep connected status, just show warning about data
            showNotification('Connected to cloud but unable to load existing data. You can still add new items.', 'warning');
        }
    }
}

function handleLogout() {
    // Clear user data from memory only
    currentUser = null;
    // Clear session
    localStorage.removeItem('ims_user');
    
    // Clear inventory data from memory
    clearInventoryData();
    
    showNotification('Logged out successfully', 'success');
    showLoginPage();
}

// Data Management Functions
async function loadInventoryData() {
    if (!currentUser) return;
    
    try {
        updateConnectionStatus('connecting');
        showNotification('Loading inventory from cloud...', 'info');
        
        console.log('Loading inventory for user:', currentUser.id);
        
        // Load all inventory items from Supabase (no user filter)
        const { data: inventoryData, error: invError } = await supabase
            .from('inventory')
            .select('*')
            .order('last_updated', { ascending: false });
        
        if (invError) {
            console.error('Inventory load error:', invError);
            throw new Error(`Failed to load inventory: ${invError.message}`);
        }
        
        console.log('Loaded inventory items:', inventoryData?.length || 0);
        
        // Load all transaction history
        const { data: historyData, error: histError } = await supabase
            .from('transaction_history')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(1000);
        
        if (histError) {
            console.warn('Transaction history load error:', histError);
            // Transaction history is optional, continue without it
        } else {
            console.log('Loaded transaction history items:', historyData?.length || 0);
        }
        
        inventory = inventoryData || [];
        transactionHistory = historyData || [];
        
        // Calculate next item counter based on existing items
        if (inventory.length > 0) {
            const maxId = Math.max(...inventory.map(item => {
                const match = item.item_id.match(/INV-(\d+)/);
                return match ? parseInt(match[1]) : 0;
            }));
            itemCounter = maxId + 1;
        } else {
            // Get next value from sequence
            try {
                const { data: seqData, error: seqError } = await supabase
                    .rpc('nextval', { sequence_name: 'item_counter' });
                if (!seqError && seqData) {
                    itemCounter = seqData;
                } else {
                    itemCounter = 1;
                }
            } catch (error) {
                console.warn('Could not get sequence value, using default:', error);
                itemCounter = 1;
            }
        }
        
        updateInventoryDisplay();
        updateStats();
        populateFilters();
        
        updateConnectionStatus('connected');
        showNotification(`Loaded ${inventory.length} items from cloud`, 'success');
        
    } catch (error) {
        console.error('Error loading from Supabase:', error);
        
        // Don't automatically set to disconnected - could be empty tables or other issues
        console.log('Data load failed, but maintaining connection status');
        
        // Provide more specific error messages
        let errorMessage = 'Unable to load existing data. ';
        if (error.message.includes('does not exist') || error.message.includes('PGRST116')) {
            errorMessage = 'Database tables are empty or need setup. You can start adding items.';
            console.log('🔧 INFO: Database tables appear to be empty or need setup');
            // Keep connected status since this is just empty data
            updateConnectionStatus('connected');
        } else if (error.message.includes('network')) {
            errorMessage += 'Network connection issue. ';
            updateConnectionStatus('disconnected');
        } else {
            errorMessage += 'You can still add new items. ';
            // Keep connected status for other errors
            updateConnectionStatus('connected');
        }
        
        showNotification(errorMessage, 'warning');
        
        // Clear local data since we can't load from cloud
        clearInventoryData();
        updateInventoryDisplay();
        updateStats();
        populateFilters();
    }
}

function clearInventoryData() {
    inventory = [];
    transactionHistory = [];
    itemCounter = 1;
}

function updateInventoryDisplay() {
    const tbody = document.getElementById('inventoryTableBody');
    if (!tbody) return;
    
    if (inventory.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    <i class="fas fa-box-open"></i>
                    <h3>No inventory items</h3>
                    <p>Start by adding your first item</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = inventory.map(item => {
        const isLowStock = item.quantity <= 5;
        return `
            <tr>
                <td><span class="item-id clickable" onclick="showItemDetails('${item.item_id}')" title="Click to view details">${item.item_id}</span></td>
                <td>${item.item}</td>
                <td>${item.type}</td>
                <td>${item.description || '-'}</td>
                <td><span class="quantity ${isLowStock ? 'low-stock' : ''}">${item.quantity}</span></td>
                <td>${item.location}</td>
                <td>${new Date(item.last_updated).toLocaleDateString()}</td>
                <td class="actions">
                    <button class="btn btn-sm btn-success" onclick="addStock('${item.item_id}')" title="Add Stock">
                        <i class="fas fa-plus"></i>
                    </button>
                    <button class="btn btn-sm btn-warning" onclick="takeStock('${item.item_id}')" title="Take Stock">
                        <i class="fas fa-minus"></i>
                    </button>
                    <button class="btn btn-sm btn-info" onclick="relocateItem('${item.item_id}')" title="Relocate">
                        <i class="fas fa-map-marker-alt"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteItem('${item.item_id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-primary" onclick="addToWishlistFromInventory('${item.item_id}')" title="Add to Wishlist">
                        <i class="fas fa-heart"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function updateStats() {
    const totalItems = inventory.length;
    const lowStockItems = inventory.filter(item => item.quantity <= 5).length;
    
    const totalItemsElement = document.getElementById('totalItems');
    const lowStockElement = document.getElementById('lowStockItems');
    
    if (totalItemsElement) totalItemsElement.textContent = totalItems;
    if (lowStockElement) lowStockElement.textContent = lowStockItems;
}

function populateFilters() {
    const typeFilter = document.getElementById('typeFilter');
    if (!typeFilter) return;
    
    // Get unique types from inventory
    const uniqueTypes = [...new Set(inventory.map(item => item.type))];
    
    // Clear existing options except "All Types"
    typeFilter.innerHTML = '<option value="">All Types</option>';
    
    // Add unique types
    uniqueTypes.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        typeFilter.appendChild(option);
    });
}

// Enhanced search functionality
function setupSearchEnhancements() {
    const searchInput = document.getElementById('searchInput');
    const typeFilter = document.getElementById('typeFilter');
    
    if (searchInput) {
        // Add clear button functionality
        searchInput.addEventListener('input', function() {
            const clearBtn = this.parentElement.querySelector('.search-clear-btn');
            if (this.value.length > 0) {
                if (!clearBtn) {
                    const btn = document.createElement('button');
                    btn.className = 'search-clear-btn visible';
                    btn.innerHTML = '×';
                    btn.addEventListener('click', () => {
                        searchInput.value = '';
                        filterInventory();
                        btn.remove();
                    });
                    this.parentElement.appendChild(btn);
                }
            } else {
                if (clearBtn) clearBtn.remove();
            }
        });
        
        // Add keyboard shortcuts
        searchInput.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                this.value = '';
                filterInventory();
                const clearBtn = this.parentElement.querySelector('.search-clear-btn');
                if (clearBtn) clearBtn.remove();
            }
        });
    }
    
    // Add filter indicator
    if (typeFilter) {
        typeFilter.addEventListener('change', function() {
            const indicator = this.parentElement.querySelector('.filter-indicator');
            if (this.value) {
                if (!indicator) {
                    const ind = document.createElement('span');
                    ind.className = 'filter-indicator active';
                    ind.textContent = '1';
                    this.parentElement.style.position = 'relative';
                    this.parentElement.appendChild(ind);
                }
            } else {
                if (indicator) indicator.remove();
            }
        });
    }
}

function filterInventory() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const typeFilter = document.getElementById('typeFilter').value;
    
    const filteredInventory = inventory.filter(item => {
        const matchesSearch = !searchTerm || 
            item.item.toLowerCase().includes(searchTerm) ||
            item.description.toLowerCase().includes(searchTerm) ||
            item.location.toLowerCase().includes(searchTerm) ||
            item.item_id.toLowerCase().includes(searchTerm);
        
        const matchesType = !typeFilter || item.type === typeFilter;
        
        return matchesSearch && matchesType;
    });
    
    displayFilteredInventory(filteredInventory);
}

function displayFilteredInventory(filteredInventory) {
    const tbody = document.getElementById('inventoryTableBody');
    if (!tbody) return;
    
    if (filteredInventory.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    <i class="fas fa-search"></i>
                    <h3>No items match your search</h3>
                    <p>Try adjusting your search criteria</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = filteredInventory.map(item => {
        const isLowStock = item.quantity <= 5;
        return `
            <tr>
                <td><span class="item-id clickable" onclick="showItemDetails('${item.item_id}')" title="Click to view details">${item.item_id}</span></td>
                <td>${item.item}</td>
                <td>${item.type}</td>
                <td>${item.description || '-'}</td>
                <td><span class="quantity ${isLowStock ? 'low-stock' : ''}">${item.quantity}</span></td>
                <td>${item.location}</td>
                <td>${new Date(item.last_updated).toLocaleDateString()}</td>
                <td class="actions">
                    <button class="btn btn-sm btn-success" onclick="addStock('${item.item_id}')" title="Add Stock">
                        <i class="fas fa-plus"></i>
                    </button>
                    <button class="btn btn-sm btn-warning" onclick="takeStock('${item.item_id}')" title="Take Stock">
                        <i class="fas fa-minus"></i>
                    </button>
                    <button class="btn btn-sm btn-info" onclick="relocateItem('${item.item_id}')" title="Relocate">
                        <i class="fas fa-map-marker-alt"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteItem('${item.item_id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-primary" onclick="addToWishlistFromInventory('${item.item_id}')" title="Add to Wishlist">
                        <i class="fas fa-heart"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Inventory CRUD Operations

function showAddInventoryModal() {
    console.log('showAddInventoryModal called');
    isEditMode = false;
    currentEditItemId = null;
    document.getElementById('modalTitle').textContent = 'Add New Item';
    document.getElementById('inventoryForm').reset();
    document.getElementById('inventoryModal').style.display = 'block';
    console.log('Modal should now be visible');
}

function showEditInventoryModal(itemId) {
    const item = inventory.find(inv => inv.item_id === itemId);
    if (!item) return;
    
    isEditMode = true;
    currentEditItemId = itemId;
    document.getElementById('modalTitle').textContent = 'Edit Item';
    
    // Populate form with existing data
    document.getElementById('itemName').value = item.item;
    document.getElementById('itemType').value = item.type;
    document.getElementById('itemDescription').value = item.description || '';
    document.getElementById('itemQuantity').value = item.quantity;
    document.getElementById('itemLocation').value = item.location;
    document.getElementById('itemRemarks').value = item.remarks || '';
    
    document.getElementById('inventoryModal').style.display = 'block';
}

async function saveInventoryItem(formData) {
    console.log('saveInventoryItem called with formData:', formData);
    
    // Prevent double submission
    if (window.isSubmittingForm) {
        console.log('Form submission already in progress, preventing duplicate');
        return;
    }
    
    window.isSubmittingForm = true;
    setTimeout(() => { window.isSubmittingForm = false; }, 5000); // Reset after 5 seconds
    
    if (!currentUser) {
        console.error('No current user logged in');
        showNotification('You must be logged in to save items', 'error');
        window.isSubmittingForm = false;
        return;
    }
    
    console.log('Current user:', currentUser);
    
    // Check connection first
    const isConnected = await checkSupabaseConnection();
    console.log('Connection status:', isConnected);
    
    if (!isConnected) {
        showNotification('No internet connection. Please check your connection and try again.', 'error');
        window.isSubmittingForm = false;
        return;
    }
    
    try {
        const itemData = {
            item: formData.get('itemName'),
            type: formData.get('itemType'),
            description: formData.get('itemDescription'),
            quantity: parseInt(formData.get('itemQuantity')),
            location: formData.get('itemLocation'),
            remarks: formData.get('itemRemarks'),
            created_by: currentUser.name,
            last_updated_by: currentUser.name,
            last_updated: new Date().toISOString()
        };
        
        if (isEditMode && currentEditItemId) {
            // Update existing item in Supabase
            const { error } = await supabase
                .from('inventory')
                .update(itemData)
                .eq('item_id', currentEditItemId);
            
            if (error) {
                throw new Error(`Failed to update item: ${error.message}`);
            }
            
            // Update local array
            const index = inventory.findIndex(item => item.item_id === currentEditItemId);
            if (index !== -1) {
                inventory[index] = { ...inventory[index], ...itemData };
            }
            
            // Add transaction history
            await addTransactionHistory({
                action: 'edit',
                item: itemData.item,
                type: itemData.type,
                quantity: itemData.quantity,
                location: itemData.location,
                user_name: currentUser.name,
                remarks: 'Item updated'
            });
            
            showNotification('Item updated successfully', 'success');
            
        } else {
            // Generate a unique item ID
            let itemId;
            let isDuplicate = true;
            let attempts = 0;
            const maxAttempts = 10;
            
            // Try to generate a unique ID
            while (isDuplicate && attempts < maxAttempts) {
                attempts++;
                // Use timestamp to ensure uniqueness
                const timestamp = new Date().getTime();
                itemId = `INV-${String(itemCounter).padStart(4, '0')}-${timestamp.toString().substring(6)}`;
                
                // Check if this ID already exists
                const { data, error: checkError } = await supabase
                    .from('inventory')
                    .select('item_id')
                    .eq('item_id', itemId)
                    .limit(1);
                    
                isDuplicate = data && data.length > 0;
                
                if (checkError) {
                    console.warn('Error checking for duplicate ID:', checkError);
                    // Continue anyway, worst case we'll get a unique constraint error
                }
            }
            
            itemData.item_id = itemId;
            itemData.created_date = new Date().toISOString();
            
            const { error } = await supabase
                .from('inventory')
                .insert([itemData]);
            
            if (error) {
                throw new Error(`Failed to create item: ${error.message}`);
            }
            
            // Add to local array
            inventory.unshift(itemData);
            itemCounter++;
            
            // Add transaction history
            await addTransactionHistory({
                action: 'add',
                item: itemData.item,
                type: itemData.type,
                quantity: itemData.quantity,
                location: itemData.location,
                user_name: currentUser.name,
                remarks: 'Item created'
            });
            
            showNotification('Item added successfully', 'success');
        }
        
        updateInventoryDisplay();
        updateStats();
        populateFilters();
        closeModal('inventoryModal');
        
    } catch (error) {
        console.error('Save error:', error);
        showNotification(error.message || 'Failed to save item', 'error');
    } finally {
        // Always reset the submission flag
        window.isSubmittingForm = false;
    }
}

function editItem(itemId) {
    // Close the history modal if it's open
    closeModal('historyModal');
    showEditInventoryModal(itemId);
}

async function deleteItem(itemId) {
    console.log('Delete item called for ID:', itemId);
    
    if (!confirm('Are you sure you want to delete this item?')) return;
    
    if (!currentUser) {
        showNotification('You must be logged in to delete items', 'error');
        return;
    }
    
    // Check connection first
    const isConnected = await checkSupabaseConnection();
    if (!isConnected) {
        showNotification('No internet connection. Please check your connection and try again.', 'error');
        return;
    }
    
    try {
        // Get item data before deletion for transaction history
        const deletedItem = inventory.find(item => item.item_id === itemId);
        console.log('Item to delete:', deletedItem);
        
        if (!deletedItem) {
            throw new Error('Item not found in local inventory');
        }
        
        // Delete from Supabase
        console.log('Deleting from Supabase with user:', currentUser.name);
        const { data, error } = await supabase
            .from('inventory')
            .delete()
            .eq('item_id', itemId)
            .select(); // Add select to see what was deleted
        
        console.log('Supabase delete result:', { data, error });
        
        if (error) {
            throw new Error(`Failed to delete item: ${error.message}`);
        }
        
        if (!data || data.length === 0) {
            console.warn('No rows were deleted from Supabase');
            throw new Error('No item was deleted from database. Check if item exists and you have permission.');
        }
        
        console.log('Successfully deleted from Supabase:', data);
        
        // Remove from local array
        const originalLength = inventory.length;
        inventory = inventory.filter(item => item.item_id !== itemId);
        console.log(`Local inventory updated: ${originalLength} -> ${inventory.length}`);
        
        // Add transaction history
        if (deletedItem) {
            await addTransactionHistory({
                action: 'delete',
                item: deletedItem.item,
                type: deletedItem.type,
                quantity: 0,
                location: deletedItem.location,
                user_name: currentUser.name,
                remarks: 'Item deleted'
            });
        }
        
        updateInventoryDisplay();
        updateStats();
        populateFilters();
        showNotification('Item deleted successfully', 'success');
        
    } catch (error) {
        console.error('Delete error:', error);
        showNotification(error.message || 'Failed to delete item', 'error');
    }
}

// Stock adjustment functions
// Stock adjustment functions

function showStockModal(itemId, action) {
    const item = inventory.find(inv => inv.item_id === itemId);
    if (!item) return;
    
    currentStockItemId = itemId;
    document.getElementById('stockModalTitle').textContent = 
        action === 'take' ? 'Remove Stock' : 'Add Stock';
    document.getElementById('stockItemName').value = item.item;
    document.getElementById('currentStock').value = item.quantity;
    document.getElementById('adjustmentType').value = action === 'take' ? 'remove' : 'add';
    document.getElementById('adjustmentQuantity').value = '';
    document.getElementById('adjustmentReason').value = '';
    
    document.getElementById('stockModal').style.display = 'block';
}

async function adjustStock(formData) {
    if (!currentStockItemId || !currentUser) {
        showNotification('Invalid operation or user not logged in', 'error');
        return;
    }
    // Prevent double submission
    if (window.isSubmittingStock) {
        console.log('Stock adjustment already in progress, preventing duplicate');
        return;
    }
    window.isSubmittingStock = true;
    setTimeout(() => { window.isSubmittingStock = false; }, 5000); // Reset after 5 seconds
    
    // Check connection first
    const isConnected = await checkSupabaseConnection();
    if (!isConnected) {
        showNotification('No internet connection. Please check your connection and try again.', 'error');
        window.isSubmittingStock = false;
        return;
    }
    
    try {
        const adjustmentType = document.getElementById('adjustmentType').value;
        const quantity = parseInt(document.getElementById('adjustmentQuantity').value);
        const reason = document.getElementById('adjustmentReason').value;
        
        if (!quantity || quantity <= 0) {
            throw new Error('Please enter a valid quantity');
        }
        
        const item = inventory.find(inv => inv.item_id === currentStockItemId);
        if (!item) throw new Error('Item not found');
        
        let newQuantity = item.quantity;
        let quantityChange = 0;
        let action = '';
        
        if (adjustmentType === 'remove') {
            if (quantity > item.quantity) {
                throw new Error('Cannot remove more than available stock');
            }
            newQuantity = item.quantity - quantity;
            quantityChange = -quantity;
            action = 'stock_remove';
        } else if (adjustmentType === 'add') {
            newQuantity = item.quantity + quantity;
            quantityChange = quantity;
            action = 'stock_add';
        }
        
        // Update in Supabase
        const { error } = await supabase
            .from('inventory')
            .update({ 
                quantity: newQuantity,
                last_updated: new Date().toISOString(),
                last_updated_by: currentUser.name
            })
            .eq('item_id', currentStockItemId);
        
        if (error) {
            throw new Error(`Failed to update stock: ${error.message}`);
        }
        
        // Update local array
        const index = inventory.findIndex(inv => inv.item_id === currentStockItemId);
        if (index !== -1) {
            inventory[index].quantity = newQuantity;
            inventory[index].last_updated = new Date().toISOString();
        }
        
        // Add transaction history
        await addTransactionHistory({
            action: action,
            item: item.item,
            type: item.type,
            quantity: newQuantity,
            location: item.location,
            user_name: currentUser.name,
            remarks: reason || `Stock ${adjustmentType}`
        });
        
        updateInventoryDisplay();
        updateStats();
        closeModal('stockModal');
        showNotification(`Stock ${adjustmentType} successful`, 'success');
        
    } catch (error) {
        console.error('Stock adjustment error:', error);
        showNotification(error.message || 'Failed to adjust stock', 'error');
    } finally {
        window.isSubmittingStock = false;
    }
}

async function addTransactionHistory(transaction) {
    try {
        const historyData = {
            timestamp: new Date().toISOString(),
            action: transaction.action,
            item: transaction.item,
            type: transaction.type,
            quantity: transaction.quantity,
            location: transaction.location,
            user_name: transaction.user_name,
            remarks: transaction.remarks
        };
        
        // Add relocation specific fields if this is a relocation action
        if (transaction.action === 'relocate') {
            historyData.old_location = transaction.old_location;
            historyData.new_location = transaction.new_location;
        }
        
        // Save to Supabase only
        const { error } = await supabase
            .from('transaction_history')
            .insert([historyData]);
        
        if (error) {
            console.error('Transaction history save error:', error);
            // Don't fail the main operation if transaction history fails
        } else {
            // Add to local array for immediate display
            transactionHistory.unshift(historyData);
            
            // Keep only last 1000 transactions in memory
            if (transactionHistory.length > 1000) {
                transactionHistory = transactionHistory.slice(0, 1000);
            }
        }
        
    } catch (error) {
        console.error('Error adding transaction history:', error);
        // Transaction history failure shouldn't break the main operation
    }
}

// Database setup function
async function setupDatabase() {
    try {
        console.log('Setting up database tables...');
        
        // Create inventory table
        const inventoryTableSQL = `
            CREATE TABLE IF NOT EXISTS inventory (
                id SERIAL PRIMARY KEY,
                item_id VARCHAR(20) UNIQUE NOT NULL,
                item VARCHAR(255) NOT NULL,
                type VARCHAR(100) NOT NULL,
                description TEXT,
                quantity INTEGER NOT NULL DEFAULT 0,
                location VARCHAR(255) NOT NULL,
                remarks TEXT,
                user_id VARCHAR(50) NOT NULL,
                created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `;
        
        // Create transaction history table
        const historyTableSQL = `
            CREATE TABLE IF NOT EXISTS transaction_history (
                id SERIAL PRIMARY KEY,
                item_id VARCHAR(20) NOT NULL,
                action VARCHAR(20) NOT NULL,
                quantity_change INTEGER NOT NULL DEFAULT 0,
                new_location VARCHAR(255),
                user_name VARCHAR(255) NOT NULL,
                user_id VARCHAR(50) NOT NULL,
                timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                remarks TEXT
            );
        `;
        
        // Enable Row Level Security
        const enableRLSInventory = `ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;`;
        const enableRLSHistory = `ALTER TABLE transaction_history ENABLE ROW LEVEL SECURITY;`;
        
        // Create policies for user access
        const inventoryPolicy = `
            CREATE POLICY "Users can only access their own inventory" ON inventory
            FOR ALL USING (true);
        `;
        
        const historyPolicy = `
            CREATE POLICY "Users can only access their own history" ON transaction_history
            FOR ALL USING (true);
        `;
        
        // Try to execute the SQL (this might not work with the current setup)
        console.log('Database setup would require admin access. Tables need to be created manually.');
        
        return false; // Indicates manual setup needed
        
    } catch (error) {
        console.error('Database setup error:', error);
        return false;
    }
}

// Connection Status Management
function updateConnectionStatus(status) {
    const statusElement = document.getElementById('connectionStatus');
    const textElement = document.getElementById('connectionText');
    
    if (!statusElement || !textElement) return;
    
    // Remove all status classes
    statusElement.classList.remove('connected', 'disconnected', 'connecting');
    
    switch (status) {
        case 'connected':
            statusElement.classList.add('connected');
            textElement.textContent = 'Cloud Connected';
            statusElement.querySelector('i').className = 'fas fa-cloud-check';
            break;
        case 'disconnected':
            statusElement.classList.add('disconnected');
            textElement.textContent = 'Offline Mode';
            statusElement.querySelector('i').className = 'fas fa-cloud-slash';
            break;
        case 'connecting':
            statusElement.classList.add('connecting');
            textElement.textContent = 'Connecting...';
            statusElement.querySelector('i').className = 'fas fa-cloud';
            break;
    }
}

async function checkSupabaseConnection() {
    try {
        console.log('Testing Supabase connection...');
        
        // Use a simple REST API call to test connection
        const response = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_CONFIG.key,
                'Authorization': `Bearer ${SUPABASE_CONFIG.key}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Connection response status:', response.status);
        
        if (response.ok || response.status === 404 || response.status === 401) {
            // 404 and 401 are OK - means the API is responding
            console.log('Supabase connection successful');
            updateConnectionStatus('connected');
            return true;
        } else {
            console.error('Supabase connection failed:', response.status, response.statusText);
            updateConnectionStatus('disconnected');
            return false;
        }
        
    } catch (error) {
        console.error('Connection check error:', error);
        // Don't block on network errors - might be CORS or other issues
        console.log('Network error detected, but allowing connection attempt');
        updateConnectionStatus('connected'); // Assume connected for now
        return true;
    }
}

// Diagnostic function to help troubleshoot connection issues
async function runDiagnostics() {
    console.log('=== SUPABASE DIAGNOSTICS ===');
    console.log('Supabase URL:', SUPABASE_CONFIG.url);
    console.log('API Key (first 20 chars):', SUPABASE_CONFIG.key.substring(0, 20) + '...');
    
    // Test 1: Basic API endpoint
    try {
        console.log('Test 1: Basic API endpoint...');
        const response = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_CONFIG.key,
                'Authorization': `Bearer ${SUPABASE_CONFIG.key}`
            }
        });
        console.log('API endpoint response:', response.status, response.statusText);
    } catch (error) {
        console.error('API endpoint test failed:', error);
    }
    
    // Test 2: Check if tables exist
    try {
        console.log('Test 2: Checking inventory table...');
        const { data, error } = await supabase
            .from('inventory')
            .select('*')
            .limit(1);
        
        if (error) {
            console.error('Inventory table error:', error);
            if (error.code === 'PGRST116') {
                console.log('DIAGNOSIS: Tables need to be created in Supabase');
            }
        } else {
            console.log('Inventory table accessible, sample data:', data);
        }
    } catch (error) {
        console.error('Table check failed:', error);
    }
    
    // Test 3: Network connectivity
    try {
        console.log('Test 3: Network connectivity...');
        const response = await fetch('https://httpbin.org/get');
        console.log('Network test:', response.ok ? 'PASS' : 'FAIL');
    } catch (error) {
        console.error('Network test failed:', error);
    }
    
    console.log('=== END DIAGNOSTICS ===');
}

// Notification Functions
function showNotification(message, type = 'info', duration = 5000) {
    const container = document.getElementById('notificationContainer');
    if (!container) return;
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas ${getNotificationIcon(type)}"></i>
            <span>${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    container.appendChild(notification);
    
    // Auto-remove after duration
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, duration);
}

function getNotificationIcon(type) {
    switch (type) {
        case 'success': return 'fa-check-circle';
        case 'error': return 'fa-exclamation-circle';
        case 'warning': return 'fa-exclamation-triangle';
        case 'info': return 'fa-info-circle';
        default: return 'fa-info-circle';
    }
}

// Manual sync function
async function handleManualSync() {
    if (!currentUser) return;
    
    try {
        showNotification('Syncing with cloud...', 'info');
        await loadInventoryData();
        showNotification('Sync completed successfully', 'success');
    } catch (error) {
        console.error('Sync error:', error);
        showNotification('Sync failed: ' + error.message, 'error');
    }
}

// Stock adjustment helper functions
function addStock(itemId) {
    showStockModal(itemId, 'add');
}

function takeStock(itemId) {
    showStockModal(itemId, 'take');
}

// Relocation functions
function relocateItem(itemId) {
    const item = inventory.find(inv => inv.item_id === itemId);
    if (!item) return;
    
    document.getElementById('relocationItemName').value = item.item;
    document.getElementById('currentLocation').value = item.location;
    document.getElementById('newLocation').value = '';
    document.getElementById('relocationReason').value = '';
    
    // Store the current item ID for the relocation
    window.currentRelocationItemId = itemId;
    
    // Populate existing locations datalist for suggestions
    populateLocationSuggestions(item.location);
    
    document.getElementById('relocationModal').style.display = 'block';
}

// Get unique locations from inventory for suggestions
function populateLocationSuggestions(currentLocation) {
    // Get the datalist element
    const datalist = document.getElementById('existingLocations');
    if (!datalist) return;
    
    // Clear existing options
    datalist.innerHTML = '';
    
    // Get unique locations from inventory excluding the current location
    const uniqueLocations = [...new Set(inventory.map(item => item.location))];
    
    // Add options to datalist
    uniqueLocations.forEach(location => {
        if (location !== currentLocation) { // Don't suggest current location
            const option = document.createElement('option');
            option.value = location;
            datalist.appendChild(option);
        }
    });
}

async function processRelocation(formData) {
    if (!currentUser || !window.currentRelocationItemId) {
        showNotification('Invalid operation or user not logged in', 'error');
        return;
    }
    
    // Check connection first
    const isConnected = await checkSupabaseConnection();
    if (!isConnected) {
        showNotification('No internet connection. Please check your connection and try again.', 'error');
        return;
    }
    
    try {
        const itemId = window.currentRelocationItemId;
        let newLocation = formData.get('newLocation');
        const reason = formData.get('relocationReason');

        // Trim newLocation before checking
        newLocation = newLocation ? newLocation.trim() : '';
        if (!newLocation) {
            throw new Error('Please enter a new location');
        }
        
        const item = inventory.find(inv => inv.item_id === itemId);
        if (!item) throw new Error('Item not found');
        
        // Don't update if location is the same
        if (item.location === newLocation) {
            showNotification('The new location is the same as the current location', 'warning');
            return;
        }
        
        // Clean up the location name - trim whitespace
        newLocation = newLocation.trim();
        
        const oldLocation = item.location;
        
        // Update in Supabase
        const { error } = await supabase
            .from('inventory')
            .update({ 
                location: newLocation,
                last_updated: new Date().toISOString(),
                last_updated_by: currentUser.name
            })
            .eq('item_id', itemId);
        
        if (error) {
            throw new Error(`Failed to update location: ${error.message}`);
        }
        
        // Update local array
        const index = inventory.findIndex(inv => inv.item_id === itemId);
        if (index !== -1) {
            inventory[index].location = newLocation;
            inventory[index].last_updated = new Date().toISOString();
        }
        
        // Add transaction history
        await addTransactionHistory({
            action: 'relocate',
            item: item.item,
            type: item.type,
            quantity: item.quantity,
            location: newLocation,
            user_name: currentUser.name,
            remarks: reason || `Relocated from ${oldLocation} to ${newLocation}`,
            old_location: oldLocation,
            new_location: newLocation
        });
        
        updateInventoryDisplay();
        updateStats();
        closeModal('relocationModal');
        
        // Check if there are other items in the same location
        const itemsAtSameLocation = inventory.filter(
            inv => inv.location === newLocation && inv.item_id !== itemId
        );
        
        if (itemsAtSameLocation.length > 0) {
            const otherItems = itemsAtSameLocation.slice(0, 3).map(i => i.item).join(', ');
            const extraCount = itemsAtSameLocation.length > 3 ? ` and ${itemsAtSameLocation.length - 3} more` : '';
            
            showNotification(`Item relocated successfully to ${newLocation}. Also in this location: ${otherItems}${extraCount}`, 'success');
        } else {
            showNotification(`Item relocated successfully to ${newLocation}`, 'success');
        }
        
    } catch (error) {
        console.error('Relocation error:', error);
        showNotification(error.message || 'Failed to relocate item', 'error');
    }
}

// Transaction History View
function showHistoryModal() {
    populateHistoryFilters();
    updateTransactionHistory();
    document.getElementById('historyModal').style.display = 'block';
}

function populateHistoryFilters() {
    const itemFilter = document.getElementById('historyItemFilter');
    if (!itemFilter) return;
    
    // Clear existing options except "All Items"
    itemFilter.innerHTML = '<option value="">All Items</option>';
    
    // Get unique items from inventory
    const uniqueItems = [...new Set(inventory.map(item => item.item))];
    
    // Add unique items
    uniqueItems.sort().forEach(itemName => {
        const option = document.createElement('option');
        option.value = itemName;
        option.textContent = itemName;
        itemFilter.appendChild(option);
    });
}

function updateTransactionHistory() {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;
    // Clear the table before rendering
    tbody.innerHTML = '';
    const itemFilter = document.getElementById('historyItemFilter').value;
    const actionFilter = document.getElementById('historyActionFilter').value;
    
    // Apply filters
    const filteredHistory = transactionHistory.filter(record => {
        const matchesItem = !itemFilter || record.item === itemFilter;
        
        // Match the action filter with the actual action
        let matchesAction = !actionFilter;
        if (actionFilter) {
            if (actionFilter === 'add' && record.action === 'add') matchesAction = true;
            if (actionFilter === 'edit' && record.action === 'edit') matchesAction = true;
            if (actionFilter === 'delete' && record.action === 'delete') matchesAction = true;
            if (actionFilter === 'stock_add' && (record.action === 'stock_add' || record.action === 'add_stock')) matchesAction = true;
            if (actionFilter === 'stock_remove' && (record.action === 'stock_remove' || record.action === 'take')) matchesAction = true;
            if (actionFilter === 'relocate' && record.action === 'relocate') matchesAction = true;
        }
        
        return matchesItem && matchesAction;
    });
    
    if (filteredHistory.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <i class="fas fa-history"></i>
                    <h3>No transaction history</h3>
                    <p>No records match your filter criteria</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = filteredHistory.map(record => {
        let details = '';
        let actionName = '';
        
        switch (record.action) {
            case 'add':
                details = `Added new item (Qty: ${record.quantity})`;
                actionName = 'Add Item';
                break;
            case 'edit':
                details = `Updated item details`;
                actionName = 'Edit Item';
                break;
            case 'delete':
                details = `Deleted item`;
                actionName = 'Delete Item';
                break;
            case 'take': 
                details = `Removed stock (New Qty: ${record.quantity})`;
                actionName = 'Remove Stock';
                break;
            case 'stock_add':
            case 'add_stock':
                details = `Added stock (New Qty: ${record.quantity})`;
                actionName = 'Add Stock';
                break;
            case 'stock_remove':
                details = `Removed stock (New Qty: ${record.quantity})`;
                actionName = 'Remove Stock';
                break;
            case 'relocate':
                details = `Moved from ${record.old_location || 'unknown'} to ${record.new_location || record.location}`;
                actionName = 'Relocate';
                break;
            default:
                details = record.remarks || 'No details';
                actionName = record.action.charAt(0).toUpperCase() + record.action.slice(1);
        }
        
        // Add remarks if available
        if (record.remarks && record.action !== 'relocate') {
            details += ` (${record.remarks})`;
        }
        
        // Find the current item in inventory
        const itemInInventory = inventory.find(item => item.item === record.item);
        const itemId = itemInInventory ? itemInInventory.item_id : '';
        
        // Only show edit button if item exists in inventory
        const editButton = itemInInventory ? 
            `<button class="btn btn-sm btn-primary" onclick="editItem('${itemId}')" title="Edit Item">
                <i class="fas fa-edit"></i>
            </button>` : '';
        
        return `
            <tr>
                <td>${new Date(record.timestamp).toLocaleString()}</td>
                <td><span class="history-action action-${record.action}">${actionName}</span></td>
                <td>${record.item}</td>
                <td>${details}</td>
                <td>${record.user_name}</td>
                <td class="actions">
                    ${editButton}
                </td>
            </tr>
        `;
    }).join('');
}

// Item Details Modal Functions
function showItemDetails(itemId) {
    const item = inventory.find(inv => inv.item_id === itemId);
    if (!item) {
        showNotification('Item not found', 'error');
        return;
    }
    
    // Populate the modal with item data
    document.getElementById('itemDetailsTitle').textContent = `Item Details - ${item.item}`;
    document.getElementById('detailItemId').textContent = item.item_id;
    document.getElementById('detailItemName').textContent = item.item;
    document.getElementById('detailItemType').textContent = item.type;
    
    // Set quantity with low stock indicator
    const quantityElement = document.getElementById('detailItemQuantity');
    quantityElement.textContent = item.quantity;
    if (item.quantity <= 5) {
        quantityElement.classList.add('low-stock');
    } else {
        quantityElement.classList.remove('low-stock');
    }
    
    document.getElementById('detailItemLocation').textContent = item.location;
    document.getElementById('detailItemDescription').textContent = item.description || 'No description provided';
    document.getElementById('detailItemRemarks').textContent = item.remarks || 'No remarks';
    
    // Format dates
    const createdDate = item.created_date ? new Date(item.created_date).toLocaleString() : 'Not available';
    const lastUpdated = item.last_updated ? new Date(item.last_updated).toLocaleString() : 'Not available';
    
    document.getElementById('detailCreatedDate').textContent = createdDate;
    document.getElementById('detailLastUpdated').textContent = lastUpdated;
    document.getElementById('detailCreatedBy').textContent = item.created_by || 'Unknown';
    document.getElementById('detailLastUpdatedBy').textContent = item.last_updated_by || 'Unknown';
    
    // Set up action buttons
    setupItemDetailsActions(itemId);
    
    // Show the modal
    document.getElementById('itemDetailsModal').style.display = 'block';
}

function setupItemDetailsActions(itemId) {
    // Clear any existing event listeners by cloning elements
    const editBtn = document.getElementById('detailEditBtn');
    const addStockBtn = document.getElementById('detailAddStockBtn');
    const removeStockBtn = document.getElementById('detailRemoveStockBtn');
    const relocateBtn = document.getElementById('detailRelocateBtn');
    const deleteBtn = document.getElementById('detailDeleteBtn');
    const addToWishlistBtn = document.getElementById('detailAddToWishlistBtn');
    
    // Clone to remove old event listeners
    const newEditBtn = editBtn.cloneNode(true);
    const newAddStockBtn = addStockBtn.cloneNode(true);
    const newRemoveStockBtn = removeStockBtn.cloneNode(true);
    const newRelocateBtn = relocateBtn.cloneNode(true);
    const newDeleteBtn = deleteBtn.cloneNode(true);
    const newAddToWishlistBtn = addToWishlistBtn.cloneNode(true);
    
    editBtn.parentNode.replaceChild(newEditBtn, editBtn);
    addStockBtn.parentNode.replaceChild(newAddStockBtn, addStockBtn);
    removeStockBtn.parentNode.replaceChild(newRemoveStockBtn, removeStockBtn);
    relocateBtn.parentNode.replaceChild(newRelocateBtn, relocateBtn);
    deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
    addToWishlistBtn.parentNode.replaceChild(newAddToWishlistBtn, addToWishlistBtn);
    
    // Add new event listeners
    newEditBtn.onclick = () => {
        closeModal('itemDetailsModal');
        editItem(itemId);
    };
    
    newAddStockBtn.onclick = () => {
        closeModal('itemDetailsModal');
        addStock(itemId);
    };
    
    newRemoveStockBtn.onclick = () => {
        closeModal('itemDetailsModal');
        takeStock(itemId);
    };
    
    newRelocateBtn.onclick = () => {
        closeModal('itemDetailsModal');
        relocateItem(itemId);
    };
    
    newDeleteBtn.onclick = () => {
        closeModal('itemDetailsModal');
        deleteItem(itemId);
    };

    newAddToWishlistBtn.onclick = () => {
        closeModal('itemDetailsModal');
        addToWishlistFromInventory(itemId);
    };
}

// Backup form login handler
window.handleFormLogin = function(event) {
    console.log('Direct form login triggered');
    event.preventDefault();
    event.stopPropagation();
    
    const userName = document.getElementById('userName').value.trim();
    if (!userName) {
        alert('Please enter your name');
        return;
    }
    
    console.log('Processing login for:', userName);
    
    currentUser = {
        name: userName,
        id: btoa(userName.toLowerCase()).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20),
        loginTime: new Date().toISOString()
    };
    
    console.log('User created:', currentUser);
    
    // Show dashboard
    document.getElementById('loginPage').classList.remove('active');
    document.getElementById('dashboardPage').classList.add('active');
    
    // Update user display
    const userElement = document.getElementById('currentUser');
    if (userElement) {
        userElement.textContent = `Welcome, ${userName}!`;
    }
    
    // Set up everything
    setTimeout(() => {
        setupModalEventListeners();
        updateInventoryDisplay();
        updateStats();
        
        // Set connection to connected initially
        updateConnectionStatus('connected');
        
        // Try to load data and check connection
        loadInventoryData().catch(error => {
            console.error('Data load failed:', error);
            // If data load fails, still keep as connected but show warning
            showNotification('Connected to cloud but unable to load existing data. You can still add new items.', 'warning');
        });
    }, 100);
    
    console.log('Direct form login complete');
};

// Emergency login function - direct access
window.emergencyLogin = function() {
    console.log('Emergency login triggered');
    
    // Set a test user FIRST
    window.currentUser = {
        name: 'Emergency User',
        id: 'emergency123',
        loginTime: new Date().toISOString()
    };
    
    // Also set the global currentUser variable
    currentUser = window.currentUser;
    
    // Show dashboard
    document.getElementById('loginPage').classList.remove('active');
    document.getElementById('dashboardPage').classList.add('active');
    
    // Update user display
    const userElement = document.getElementById('currentUser');
    if (userElement) {
        userElement.textContent = `Welcome, Emergency User!`;
    }
    
    // Set up event listeners for dashboard (in case they weren't set up)
    setTimeout(() => {
        setupModalEventListeners();
        
        // Manually set up the add inventory button
        const addBtn = document.getElementById('addInventoryBtn');
        if (addBtn) {
            addBtn.addEventListener('click', showAddInventoryModal);
            console.log('Add inventory button event listener added');
        }
        
        // Initialize empty inventory display
        updateInventoryDisplay();
        updateStats();
        
        // Set connection status
        updateConnectionStatus('connected');
        
    }, 100);
    
    alert('Emergency login successful! Try adding inventory now.');
    console.log('Emergency login complete');
};

// Test login function for debugging
function testLogin() {
    console.log('Test login triggered');
    const userName = document.getElementById('userName').value.trim() || 'Test User';
    console.log('Using username:', userName);
    
    currentUser = {
        name: userName,
        id: btoa(userName.toLowerCase()).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20),
        loginTime: new Date().toISOString()
    };
    
    console.log('Test user created:', currentUser);
    showNotification(`Test login: Welcome, ${userName}!`, 'success');
    showDashboard();
    
    // Try to load data
    loadInventoryData().catch(error => {
        console.error('Data load failed in test:', error);
        showNotification('Test login successful, but data load failed', 'warning');
    });
}

// Make test function global
window.testLogin = testLogin;

// Add a test function for wishlist functionality
window.testWishlistFunction = function() {
    console.log('Testing wishlist function...');
    console.log('addToWishlistFromInventory function exists:', typeof window.addToWishlistFromInventory);
    console.log('Current inventory length:', inventory.length);
    if (inventory.length > 0) {
        console.log('Testing with first item:', inventory[0].item_id);
        window.addToWishlistFromInventory(inventory[0].item_id);
    } else {
        console.log('No inventory items to test with');
    }
};

// Additional debugging for login issues
function testSaveItem() {
    console.log('Test save item function called');
    
    // Create test form data
    const testData = new FormData();
    testData.append('itemName', 'Test Item');
    testData.append('itemType', 'Electronics');
    testData.append('itemDescription', 'Test description');
    testData.append('itemQuantity', '5');
    testData.append('itemLocation', 'Test Location');
    testData.append('itemRemarks', 'Test remarks');
    
    // Set up a test user if not logged in
    if (!currentUser) {
        currentUser = {
            name: 'Test User',
            id: 'test123',
            loginTime: new Date().toISOString()
        };
        console.log('Test user created:', currentUser);
    }
    
    saveInventoryItem(testData);
}

// Make test function global
window.testSaveItem = testSaveItem;

// Additional debugging for login issues
function debugLogin() {
    console.log('=== LOGIN DEBUG ===');
    console.log('nameForm element:', document.getElementById('nameForm'));
    console.log('userName input:', document.getElementById('userName'));
    console.log('Current page visible:', document.querySelector('.page.active'));
    console.log('=== END LOGIN DEBUG ===');
}

// Run diagnostics and debug login on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded');
    runDiagnostics();
    debugLogin();
    initializeApp();
});