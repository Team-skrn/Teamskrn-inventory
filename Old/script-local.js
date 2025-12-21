// Local Storage Inventory Management System

// Global variables
let inventory = [];
let transactionHistory = [];
let itemCounter = 1;
let currentUser = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Check if user name is stored
    const storedUser = localStorage.getItem('currentUser');
    
    if (storedUser) {
        currentUser = JSON.parse(storedUser);
        showDashboard();
        loadInventoryData();
    } else {
        showLoginPage();
    }
    
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
        document.getElementById('currentUser').textContent = `Welcome, ${currentUser.name}!`;
    }
    updateInventoryDisplay();
    updateStats();
}

// Event Listeners Setup
function setupEventListeners() {
    // Name form submission
    document.getElementById('nameForm')?.addEventListener('submit', handleNameSubmit);
    
    // Dashboard actions
    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
    document.getElementById('addInventoryBtn')?.addEventListener('click', showAddInventoryModal);
    
    // Search and filter
    document.getElementById('searchInput')?.addEventListener('input', filterInventory);
    document.getElementById('typeFilter')?.addEventListener('change', filterInventory);
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

// Authentication Functions
function handleNameSubmit(e) {
    e.preventDefault();
    
    const userName = document.getElementById('userName').value.trim();
    
    if (userName) {
        currentUser = {
            name: userName,
            id: 'user_' + Date.now(),
            loginTime: new Date().toISOString()
        };
        
        // Store user in localStorage
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        showNotification(`Welcome, ${userName}!`, 'success');
        showDashboard();
        loadInventoryData();
    }
}

function handleLogout() {
    // Clear user data
    localStorage.removeItem('currentUser');
    currentUser = null;
    
    // Clear inventory data from memory
    clearInventoryData();
    
    showNotification('Logged out successfully', 'success');
    showLoginPage();
}

// Data Management Functions
function loadInventoryData() {
    if (!currentUser) return;
    
    try {
        // Load inventory for current user
        const inventoryKey = `inventory_${currentUser.id}`;
        const historyKey = `history_${currentUser.id}`;
        const counterKey = `counter_${currentUser.id}`;
        
        const storedInventory = localStorage.getItem(inventoryKey);
        const storedHistory = localStorage.getItem(historyKey);
        const storedCounter = localStorage.getItem(counterKey);
        
        inventory = storedInventory ? JSON.parse(storedInventory) : [];
        transactionHistory = storedHistory ? JSON.parse(storedHistory) : [];
        itemCounter = storedCounter ? parseInt(storedCounter) : 1;
        
        updateInventoryDisplay();
        updateStats();
        populateFilters();
        
    } catch (error) {
        console.error('Error loading inventory:', error);
        showNotification('Failed to load inventory data', 'error');
    }
}

function saveInventoryData() {
    if (!currentUser) return;
    
    try {
        const inventoryKey = `inventory_${currentUser.id}`;
        const historyKey = `history_${currentUser.id}`;
        const counterKey = `counter_${currentUser.id}`;
        
        localStorage.setItem(inventoryKey, JSON.stringify(inventory));
        localStorage.setItem(historyKey, JSON.stringify(transactionHistory));
        localStorage.setItem(counterKey, itemCounter.toString());
        
    } catch (error) {
        console.error('Error saving inventory:', error);
        showNotification('Failed to save inventory data', 'error');
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

function saveInventoryItem(formData) {
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
            last_updated: new Date().toISOString()
        };
        
        if (isEditMode && currentEditItemId) {
            // Update existing item
            const index = inventory.findIndex(item => item.item_id === currentEditItemId);
            if (index !== -1) {
                inventory[index] = { ...inventory[index], ...itemData };
            }
            
            // Add transaction history
            addTransactionHistory({
                item_id: currentEditItemId,
                action: 'edit',
                quantity_change: 0,
                new_location: itemData.location,
                user_name: currentUser.name,
                remarks: 'Item updated'
            });
            
            showNotification('Item updated successfully', 'success');
        } else {
            // Create new item
            const itemId = `INV-${String(itemCounter).padStart(4, '0')}`;
            itemData.item_id = itemId;
            itemData.created_date = new Date().toISOString();
            
            // Add to inventory
            inventory.unshift(itemData);
            itemCounter++;
            
            // Add transaction history
            addTransactionHistory({
                item_id: itemId,
                action: 'add',
                quantity_change: itemData.quantity,
                new_location: itemData.location,
                user_name: currentUser.name,
                remarks: 'Item created'
            });
            
            showNotification('Item added successfully', 'success');
        }
        
        saveInventoryData();
        updateInventoryDisplay();
        updateStats();
        populateFilters();
        closeModal('inventoryModal');
        
    } catch (error) {
        console.error('Save error:', error);
        showNotification(error.message || 'Failed to save item', 'error');
    }
}

function editItem(itemId) {
    showEditInventoryModal(itemId);
}

function deleteItem(itemId) {
    if (!confirm('Are you sure you want to delete this item?')) return;
    
    try {
        // Find and remove item
        const deletedItem = inventory.find(item => item.item_id === itemId);
        inventory = inventory.filter(item => item.item_id !== itemId);
        
        // Add transaction history
        if (deletedItem) {
            addTransactionHistory({
                item_id: itemId,
                action: 'delete',
                quantity_change: -deletedItem.quantity,
                new_location: '',
                user_name: currentUser.name,
                remarks: 'Item deleted'
            });
        }
        
        saveInventoryData();
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

function adjustStock(formData) {
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
        
        // Update item
        const index = inventory.findIndex(inv => inv.item_id === currentStockItemId);
        if (index !== -1) {
            inventory[index].quantity = newQuantity;
            inventory[index].last_updated = new Date().toISOString();
        }
        
        // Add transaction history
        addTransactionHistory({
            item_id: currentStockItemId,
            action: action,
            quantity_change: quantityChange,
            new_location: item.location,
            user_name: currentUser.name,
            remarks: reason || `Stock ${adjustmentType}ed`
        });
        
        saveInventoryData();
        updateInventoryDisplay();
        updateStats();
        closeModal('stockModal');
        showNotification(`Stock ${adjustmentType}ed successfully`, 'success');
        
    } catch (error) {
        console.error('Stock adjustment error:', error);
        showNotification(error.message || 'Failed to adjust stock', 'error');
    }
}

function addTransactionHistory(transaction) {
    try {
        const historyData = {
            ...transaction,
            timestamp: new Date().toISOString()
        };
        
        // Add to local array
        transactionHistory.unshift(historyData);
        
        // Keep only last 1000 transactions
        if (transactionHistory.length > 1000) {
            transactionHistory = transactionHistory.slice(0, 1000);
        }
        
    } catch (error) {
        console.error('Error adding transaction history:', error);
    }
}

// Global functions for buttons in table
window.editItem = editItem;
window.deleteItem = deleteItem;
window.takeStock = (itemId) => showStockModal(itemId, 'take');
window.addStock = (itemId) => showStockModal(itemId, 'add');

// Utility Functions
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
