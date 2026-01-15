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

// Test function to check if the save button works
function testSaveItem() {
    console.log('Test save item function called');
    
    // Create test form data with unique name
    const testData = new FormData();
    const timestamp = Date.now();
    testData.append('itemName', `Test Item ${timestamp}`);
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

// Initialize the application
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
    
    // Initialize item counter if connected
    if (isConnected) {
        await initializeItemCounter();
    }
    
    // Always show login page - connection issues won't block login
    showLoginPage();
    
    setupEventListeners();
    setupModalEventListeners();
    
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
    
    // Update displays with error handling
    try {
        updateInventoryDisplay();
        updateStats();
    } catch (error) {
        console.error('Error updating dashboard displays:', error);
        showNotification('Dashboard loaded with some display issues', 'warning');
    }
}

// Event Listeners Setup
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Name form submission
    const nameForm = document.getElementById('nameForm');
    if (nameForm) {
        console.log('Found nameForm, adding event listener');
        nameForm.addEventListener('submit', function(e) {
            console.log('Form submit event triggered');
            handleNameSubmit(e);
        });
    }
    
    // Dashboard actions
    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
    document.getElementById('addInventoryBtn')?.addEventListener('click', showAddInventoryModal);
    document.getElementById('syncBtn')?.addEventListener('click', handleManualSync);
    
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
        
        console.log('User logged in:', currentUser);
        showNotification(`Welcome, ${userName}!`, 'success');
        showDashboard();
        
        // Load inventory data
        await loadInventoryData();
    }
}

async function handleLogout() {
    currentUser = null;
    inventory = [];
    transactionHistory = [];
    showLoginPage();
    showNotification('Logged out successfully', 'info');
}

// Connection Management
async function checkSupabaseConnection() {
    try {
        const { data, error } = await supabase.from('inventory').select('item_id').limit(1);
        updateConnectionStatus(error ? 'disconnected' : 'connected');
        return !error;
    } catch (error) {
        console.error('Connection check failed:', error);
        updateConnectionStatus('disconnected');
        return false;
    }
}

function updateConnectionStatus(status) {
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
        statusElement.textContent = status === 'connected' ? 'Cloud Connected' : 
                                   status === 'connecting' ? 'Connecting...' : 'Offline';
        statusElement.className = `connection-status ${status}`;
    }
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
    
    if (!currentUser) {
        console.error('No current user logged in');
        showNotification('You must be logged in to save items', 'error');
        return;
    }
    
    console.log('Current user:', currentUser);
    
    // Check connection first
    const isConnected = await checkSupabaseConnection();
    console.log('Connection status:', isConnected);
    
    if (!isConnected) {
        showNotification('No internet connection. Please check your connection and try again.', 'error');
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
        
        console.log('Item data to save:', itemData);
        
        if (isEditMode && currentEditItemId) {
            // Update existing item in Supabase
            const { error } = await supabase
                .from('inventory')
                .update(itemData)
                .eq('item_id', currentEditItemId)
                .eq('created_by', currentUser.name);
            
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
            // Create new item in Supabase with guaranteed unique ID
            const itemId = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
            itemData.item_id = itemId;
            itemData.created_date = new Date().toISOString();
            
            console.log('Creating new item with unique ID:', itemId);
            console.log('Item data:', itemData);
            
            const { error } = await supabase
                .from('inventory')
                .insert([itemData]);
            
            if (error) {
                console.error('Supabase insert error:', error);
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
            console.log('Item created successfully');
        }
        
        // Close modal and refresh display
        closeModal('inventoryModal');
        updateInventoryDisplay();
        updateStats();
        
    } catch (error) {
        console.error('Error saving item:', error);
        showNotification(`Failed to save item: ${error.message}`, 'error');
    }
}

async function addTransactionHistory(transaction) {
    try {
        const transactionData = {
            transaction_id: `TXN-${Date.now()}`,
            action: transaction.action,
            item: transaction.item,
            type: transaction.type,
            quantity: transaction.quantity,
            location: transaction.location,
            user_name: transaction.user_name,
            remarks: transaction.remarks,
            timestamp: new Date().toISOString()
        };

        const { error } = await supabase
            .from('transaction_history')
            .insert([transactionData]);

        if (error) {
            console.error('Failed to add transaction history:', error);
        } else {
            transactionHistory.unshift(transactionData);
        }
    } catch (error) {
        console.error('Error adding transaction history:', error);
    }
}

// Data Loading Functions
async function loadInventoryData() {
    try {
        console.log('Loading inventory data...');
        const { data, error } = await supabase
            .from('inventory')
            .select('*')
            .order('created_date', { ascending: false });

        if (error) {
            throw new Error(`Failed to load inventory: ${error.message}`);
        }

        inventory = data || [];
        console.log('Loaded inventory:', inventory);
        updateInventoryDisplay();
        updateStats();
        
    } catch (error) {
        console.error('Error loading inventory:', error);
        showNotification(`Failed to load inventory: ${error.message}`, 'error');
    }
}

// Initialize item counter based on existing data
async function initializeItemCounter() {
    try {
        const { data, error } = await supabase
            .from('inventory')
            .select('item_id')
            .order('created_date', { ascending: false })
            .limit(1);

        if (error) {
            console.error('Error getting latest item:', error);
            return;
        }

        if (data && data.length > 0) {
            const latestId = data[0].item_id;
            console.log('Latest item ID:', latestId);
            
            // Extract number from ID if it follows INV-XXXX pattern
            const match = latestId.match(/INV-(\d+)/);
            if (match) {
                itemCounter = parseInt(match[1]) + 1;
                console.log('Item counter initialized to:', itemCounter);
            }
        }
    } catch (error) {
        console.error('Error initializing item counter:', error);
    }
}

// UI Update Functions
function updateInventoryDisplay() {
    const inventoryTableBody = document.getElementById('inventoryTableBody');
    if (!inventoryTableBody) {
        console.log('inventoryTableBody element not found');
        return;
    }

    if (inventory.length === 0) {
        inventoryTableBody.innerHTML = '<tr><td colspan="8">No items in inventory</td></tr>';
        return;
    }

    inventoryTableBody.innerHTML = inventory.map(item => {
        return `
            <tr>
                <td>${item.item_id}</td>
                <td>${item.item}</td>
                <td>${item.type}</td>
                <td>${item.description || ''}</td>
                <td>${item.quantity}</td>
                <td>${item.location}</td>
                <td>${item.last_updated ? new Date(item.last_updated).toLocaleDateString() : 'N/A'}</td>
                <td>
                    <button onclick="showEditInventoryModal('${item.item_id}')" class="btn btn-sm btn-primary">Edit</button>
                    <button onclick="deleteInventoryItem('${item.item_id}')" class="btn btn-sm btn-danger">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
    
    console.log(`Inventory display updated with ${inventory.length} items`);
}

function updateStats() {
    const totalItems = inventory.length;
    const totalQuantity = inventory.reduce((sum, item) => sum + item.quantity, 0);
    const lowStockItems = inventory.filter(item => item.quantity < 5).length;

    // Update elements that exist in the HTML
    const totalItemsElement = document.getElementById('totalItems');
    const lowStockItemsElement = document.getElementById('lowStockItems');
    
    if (totalItemsElement) {
        totalItemsElement.textContent = totalItems;
    }
    
    if (lowStockItemsElement) {
        lowStockItemsElement.textContent = lowStockItems;
    }
    
    // Log stats for debugging
    console.log(`Stats updated: ${totalItems} items, ${totalQuantity} total quantity, ${lowStockItems} low stock`);
}

// Utility Functions
function showNotification(message, type = 'info') {
    console.log(`Notification (${type}): ${message}`);
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 4px;
        color: white;
        font-weight: bold;
        z-index: 10000;
        max-width: 400px;
    `;
    
    // Set background color based on type
    switch (type) {
        case 'success':
            notification.style.backgroundColor = '#28a745';
            break;
        case 'error':
            notification.style.backgroundColor = '#dc3545';
            break;
        case 'warning':
            notification.style.backgroundColor = '#ffc107';
            notification.style.color = '#212529';
            break;
        default:
            notification.style.backgroundColor = '#17a2b8';
    }
    
    document.body.appendChild(notification);
    
    // Remove notification after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}

// Placeholder functions for features not yet implemented
function handleManualSync() {
    console.log('Manual sync requested');
    loadInventoryData();
}

function filterInventory() {
    console.log('Filter inventory requested');
    // Implementation would go here
}

async function deleteInventoryItem(itemId) {
    console.log('Delete item requested:', itemId);
    
    // Find the item to get its details for confirmation
    const item = inventory.find(inv => inv.item_id === itemId);
    if (!item) {
        showNotification('Item not found', 'error');
        return;
    }
    
    // Confirm deletion
    if (!confirm(`Are you sure you want to delete "${item.item}"?\n\nThis action cannot be undone.`)) {
        return;
    }
    
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
        console.log('Deleting item from Supabase:', itemId);
        
        // Delete from Supabase
        const { error } = await supabase
            .from('inventory')
            .delete()
            .eq('item_id', itemId)
            .eq('created_by', currentUser.name);
        
        if (error) {
            console.error('Supabase delete error:', error);
            throw new Error(`Failed to delete item: ${error.message}`);
        }
        
        // Remove from local array
        const index = inventory.findIndex(inv => inv.item_id === itemId);
        if (index !== -1) {
            inventory.splice(index, 1);
        }
        
        // Add transaction history
        await addTransactionHistory({
            action: 'delete',
            item: item.item,
            type: item.type,
            quantity: item.quantity,
            location: item.location,
            user_name: currentUser.name,
            remarks: 'Item deleted'
        });
        
        // Update display
        updateInventoryDisplay();
        updateStats();
        
        showNotification(`Item "${item.item}" deleted successfully`, 'success');
        console.log('Item deleted successfully');
        
    } catch (error) {
        console.error('Error deleting item:', error);
        showNotification(`Failed to delete item: ${error.message}`, 'error');
    }
}

// Run initialization when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded');
    initializeApp();
});
