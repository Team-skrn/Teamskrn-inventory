// Supabase Configuration
const SUPABASE_CONFIG = {
    url: 'https://bhaexzjmspamqxcszkgm.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoYWV4emptc3BhbXF4Y3N6a2dtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE1NjQ3MjEsImV4cCI6MjA2NzE0MDcyMX0.vCYNKtOp6phSWEK36XYNqL6DznS5pw_49QduBfUvckk'
};

// Initialize Supabase
const supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);

// Global variables for inventory
let inventory = [];
let transactionHistory = [];
let itemCounter = 1;
let currentUser = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    // Check if user is already logged in
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user) {
        currentUser = session.user;
        showDashboard();
        loadInventoryData();
    } else {
        showLoginPage();
    }
    
    // Listen for auth state changes
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
            currentUser = session.user;
            showDashboard();
            loadInventoryData();
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            showLoginPage();
            clearInventoryData();
        }
    });
    
    setupEventListeners();
    setupModalEventListeners();
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
        const displayName = currentUser.user_metadata?.full_name || 
                           currentUser.user_metadata?.name || 
                           currentUser.email;
        document.getElementById('currentUser').textContent = `Welcome, ${displayName}!`;
    }
    updateInventoryDisplay();
    updateStats();
}

// Event Listeners Setup
function setupEventListeners() {
    // Google login button
    document.getElementById('googleLoginBtn')?.addEventListener('click', handleGoogleLogin);
    
    // Guest login button
    document.getElementById('guestLoginBtn')?.addEventListener('click', handleGuestLogin);
    
    // Dashboard actions
    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
    document.getElementById('addInventoryBtn')?.addEventListener('click', showAddInventoryModal);
    
    // Search and filter
    document.getElementById('searchInput')?.addEventListener('input', filterInventory);
    document.getElementById('typeFilter')?.addEventListener('change', filterInventory);
    
    // Setup modal event listeners
    setupModalEventListeners();
}

// Modal Event Listeners Setup
function setupModalEventListeners() {
    // Inventory modal
    document.getElementById('inventoryForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        saveInventoryItem(formData);
    });
    
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
}

// Authentication Functions
async function handleGoogleLogin() {
    try {
        showNotification('Redirecting to Google...', 'info');
        
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        });
        
        if (error) throw error;
        
        // The redirect will handle the rest
        
    } catch (error) {
        console.error('Google login error:', error);
        showNotification(error.message || 'Google login failed', 'error');
    }
}

async function handleGuestLogin() {
    try {
        showNotification('Signing in as guest...', 'info');
        
        // For guest mode, we'll use anonymous auth or create a temporary user
        const guestEmail = `guest_${Date.now()}@temp.local`;
        const guestPassword = Math.random().toString(36).substring(2, 15);
        
        const { data, error } = await supabase.auth.signUp({
            email: guestEmail,
            password: guestPassword,
            options: {
                data: {
                    username: 'Guest User',
                    is_guest: true
                }
            }
        });
        
        if (error) throw error;
        
        showNotification('Welcome, Guest User!', 'success');
        
    } catch (error) {
        console.error('Guest login error:', error);
        showNotification(error.message || 'Guest login failed', 'error');
    }
}

async function handleLogout() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        showNotification('Logged out successfully', 'success');
        
    } catch (error) {
        console.error('Logout error:', error);
        showNotification('Logout failed', 'error');
    }
}

// Inventory Management Functions
async function loadInventoryData() {
    if (!currentUser) return;
    
    try {
        // Load inventory items for the current user
        const { data: inventoryData, error: invError } = await supabase
            .from('inventory')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_date', { ascending: false });
        
        if (invError) throw invError;
        
        // Load transaction history for the current user
        const { data: historyData, error: histError } = await supabase
            .from('transaction_history')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('timestamp', { ascending: false })
            .limit(1000);
        
        if (histError) throw histError;
        
        inventory = inventoryData || [];
        transactionHistory = historyData || [];
        
        // Calculate next item counter
        if (inventory.length > 0) {
            const maxId = Math.max(...inventory.map(item => {
                const num = item.item_id.replace('INV-', '');
                return parseInt(num) || 0;
            }));
            itemCounter = maxId + 1;
        }
        
        updateInventoryDisplay();
        updateStats();
        populateFilters();
        
    } catch (error) {
        console.error('Error loading inventory:', error);
        showNotification('Failed to load inventory data', 'error');
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
                <td><span class="item-id">${item.item_id}</span></td>
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
                    <button class="btn btn-sm btn-primary" onclick="editItem('${item.item_id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteItem('${item.item_id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function updateStats() {
    const totalItems = inventory.length;
    const totalQuantity = inventory.reduce((sum, item) => sum + item.quantity, 0);
    const lowStockItems = inventory.filter(item => item.quantity <= 5).length;
    
    document.getElementById('totalItems').textContent = totalItems;
    document.getElementById('totalQuantity').textContent = totalQuantity;
    document.getElementById('lowStockItems').textContent = lowStockItems;
}

function populateFilters() {
    const typeFilter = document.getElementById('typeFilter');
    if (!typeFilter) return;
    
    const types = [...new Set(inventory.map(item => item.type))];
    
    // Keep existing options and add new ones
    const existingOptions = Array.from(typeFilter.options).map(opt => opt.value);
    
    types.forEach(type => {
        if (!existingOptions.includes(type)) {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            typeFilter.appendChild(option);
        }
    });
}

function filterInventory() {
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const typeFilter = document.getElementById('typeFilter')?.value || '';
    
    const filteredInventory = inventory.filter(item => {
        const matchesSearch = !searchTerm || 
            item.item.toLowerCase().includes(searchTerm) ||
            item.type.toLowerCase().includes(searchTerm) ||
            item.description?.toLowerCase().includes(searchTerm) ||
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
                <td><span class="item-id">${item.item_id}</span></td>
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
                    <button class="btn btn-sm btn-primary" onclick="editItem('${item.item_id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteItem('${item.item_id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Inventory CRUD Operations
let isEditMode = false;
let currentEditItemId = null;

function showAddInventoryModal() {
    isEditMode = false;
    currentEditItemId = null;
    document.getElementById('modalTitle').textContent = 'Add New Item';
    document.getElementById('inventoryForm').reset();
    document.getElementById('inventoryModal').style.display = 'block';
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
    if (!currentUser) {
        showNotification('You must be logged in to save items', 'error');
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
            user_id: currentUser.id,
            last_updated: new Date().toISOString()
        };
        
        if (isEditMode && currentEditItemId) {
            // Update existing item
            const { error } = await supabase
                .from('inventory')
                .update(itemData)
                .eq('item_id', currentEditItemId)
                .eq('user_id', currentUser.id);
            
            if (error) throw error;
            
            // Update local array
            const index = inventory.findIndex(item => item.item_id === currentEditItemId);
            if (index !== -1) {
                inventory[index] = { ...inventory[index], ...itemData };
            }
            
            // Add transaction history
            await addTransactionHistory({
                item_id: currentEditItemId,
                action: 'edit',
                quantity_change: 0,
                new_location: itemData.location,
                user_name: currentUser.email,
                remarks: 'Item updated'
            });
            
            showNotification('Item updated successfully', 'success');
        } else {
            // Create new item
            const itemId = `INV-${String(itemCounter).padStart(4, '0')}`;
            itemData.item_id = itemId;
            itemData.created_date = new Date().toISOString();
            
            const { error } = await supabase
                .from('inventory')
                .insert([itemData]);
            
            if (error) throw error;
            
            // Add to local array
            inventory.unshift(itemData);
            itemCounter++;
            
            // Add transaction history
            await addTransactionHistory({
                item_id: itemId,
                action: 'add',
                quantity_change: itemData.quantity,
                new_location: itemData.location,
                user_name: currentUser.email,
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
    }
}

async function editItem(itemId) {
    showEditInventoryModal(itemId);
}

async function deleteItem(itemId) {
    if (!confirm('Are you sure you want to delete this item?')) return;
    
    try {
        const { error } = await supabase
            .from('inventory')
            .delete()
            .eq('item_id', itemId)
            .eq('user_id', currentUser.id);
        
        if (error) throw error;
        
        // Remove from local array
        const deletedItem = inventory.find(item => item.item_id === itemId);
        inventory = inventory.filter(item => item.item_id !== itemId);
        
        // Add transaction history
        if (deletedItem) {
            await addTransactionHistory({
                item_id: itemId,
                action: 'delete',
                quantity_change: -deletedItem.quantity,
                new_location: '',
                user_name: currentUser.email,
                remarks: 'Item deleted'
            });
        }
        
        updateInventoryDisplay();
        updateStats();
        showNotification('Item deleted successfully', 'success');
        
    } catch (error) {
        console.error('Delete error:', error);
        showNotification('Failed to delete item', 'error');
    }
}

// Stock adjustment functions
let currentStockItemId = null;

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
    if (!currentStockItemId || !currentUser) return;
    
    try {
        const adjustmentType = document.getElementById('adjustmentType').value;
        const quantity = parseInt(document.getElementById('adjustmentQuantity').value);
        const reason = document.getElementById('adjustmentReason').value;
        
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
            action = 'take';
        } else if (adjustmentType === 'add') {
            newQuantity = item.quantity + quantity;
            quantityChange = quantity;
            action = 'add';
        }
        
        // Update in database
        const { error } = await supabase
            .from('inventory')
            .update({ 
                quantity: newQuantity,
                last_updated: new Date().toISOString()
            })
            .eq('item_id', currentStockItemId)
            .eq('user_id', currentUser.id);
        
        if (error) throw error;
        
        // Update local array
        const index = inventory.findIndex(inv => inv.item_id === currentStockItemId);
        if (index !== -1) {
            inventory[index].quantity = newQuantity;
            inventory[index].last_updated = new Date().toISOString();
        }
        
        // Add transaction history
        await addTransactionHistory({
            item_id: currentStockItemId,
            action: action,
            quantity_change: quantityChange,
            new_location: item.location,
            user_name: currentUser.email,
            remarks: reason || `Stock ${adjustmentType}ed`
        });
        
        updateInventoryDisplay();
        updateStats();
        closeModal('stockModal');
        showNotification(`Stock ${adjustmentType}ed successfully`, 'success');
        
    } catch (error) {
        console.error('Stock adjustment error:', error);
        showNotification(error.message || 'Failed to adjust stock', 'error');
    }
}

async function addTransactionHistory(transaction) {
    try {
        const historyData = {
            ...transaction,
            timestamp: new Date().toISOString(),
            user_id: currentUser.id
        };
        
        const { error } = await supabase
            .from('transaction_history')
            .insert([historyData]);
        
        if (error) throw error;
        
        // Add to local array
        transactionHistory.unshift(historyData);
        
    } catch (error) {
        console.error('Error adding transaction history:', error);
    }
}

// Utility Functions
function showLoading(formId) {
    const form = document.getElementById(formId);
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
}

function hideLoading(formId) {
    const form = document.getElementById(formId);
    const button = form.querySelector('button[type="submit"]');
    button.disabled = false;
    
    // Restore original button text
    if (formId === 'loginForm') {
        button.innerHTML = 'Login';
    } else if (formId === 'registerForm') {
        button.innerHTML = 'Create Account';
    } else if (formId === 'forgotPasswordForm') {
        button.innerHTML = 'Send Reset Email';
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation-triangle' : 'info'}"></i>
        ${message}
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
        notification.remove();
    }, 4000);
    
    // Click to remove
    notification.addEventListener('click', () => {
        notification.remove();
    });
}

// Email validation helper
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
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
    }
}

// Global functions for buttons in table
window.editItem = editItem;
window.deleteItem = deleteItem;
window.takeStock = (itemId) => showStockModal(itemId, 'take');
window.addStock = (itemId) => showStockModal(itemId, 'add');
