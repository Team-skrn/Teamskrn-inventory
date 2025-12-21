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
            // Create new item in Supabase
            const itemId = `INV-${String(itemCounter).padStart(4, '0')}`;
            itemData.item_id = itemId;
            itemData.created_date = new Date().toISOString();
            
            console.log('Creating new item with data:', itemData);
            
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

function showNotification(message, type = 'info') {
    console.log(`Notification (${type}): ${message}`);
    alert(message); // Simple alert for now, can be replaced with better UI
}

async function checkSupabaseConnection() {
    try {
        const { data, error } = await supabase.from('inventory').select('item_id').limit(1);
        if (error) {
            console.error('Supabase connection error:', error);
            return false;
        }
        console.log('Supabase connection successful');
        return true;
    } catch (error) {
        console.error('Supabase connection failed:', error);
        return false;
    }
}

function updateInventoryDisplay() {
    console.log('updateInventoryDisplay called');
    // Implementation would go here
}

function updateStats() {
    console.log('updateStats called');
    // Implementation would go here
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        console.log(`Modal ${modalId} closed`);
    }
    
    // Reset forms when closing
    if (modalId === 'inventoryModal') {
        const form = document.getElementById('inventoryForm');
        if (form) form.reset();
        isEditMode = false;
        currentEditItemId = null;
    }
}

// Setup modal event listeners
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
    
    console.log('Modal event listeners setup complete');
}

// Simple login function
function simpleLogin() {
    const userName = prompt('Enter your name:') || 'Test User';
    
    currentUser = {
        name: userName,
        id: btoa(userName.toLowerCase()).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20),
        loginTime: new Date().toISOString()
    };
    
    console.log('User logged in:', currentUser);
    showNotification(`Welcome, ${userName}!`, 'success');
    
    // Show dashboard if it exists
    const dashboardPage = document.getElementById('dashboardPage');
    const loginPage = document.getElementById('loginPage');
    
    if (loginPage) loginPage.classList.remove('active');
    if (dashboardPage) dashboardPage.classList.add('active');
    
    // Update user display
    const userElement = document.getElementById('currentUser');
    if (userElement) {
        userElement.textContent = `Welcome, ${userName}!`;
    }
}

// Show add inventory modal
function showAddInventoryModal() {
    console.log('showAddInventoryModal called');
    isEditMode = false;
    currentEditItemId = null;
    
    const modalTitle = document.getElementById('modalTitle');
    const inventoryForm = document.getElementById('inventoryForm');
    const inventoryModal = document.getElementById('inventoryModal');
    
    if (modalTitle) modalTitle.textContent = 'Add New Item';
    if (inventoryForm) inventoryForm.reset();
    if (inventoryModal) {
        inventoryModal.style.display = 'block';
        console.log('Modal should now be visible');
    } else {
        console.error('inventoryModal not found!');
    }
}

// Make functions global for easy testing
window.simpleLogin = simpleLogin;
window.showAddInventoryModal = showAddInventoryModal;
window.setupModalEventListeners = setupModalEventListeners;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded - Simple Script');
    
    // Check if elements exist
    console.log('loginPage exists:', !!document.getElementById('loginPage'));
    console.log('dashboardPage exists:', !!document.getElementById('dashboardPage'));
    console.log('inventoryForm exists:', !!document.getElementById('inventoryForm'));
    console.log('inventoryModal exists:', !!document.getElementById('inventoryModal'));
    
    // Setup modal event listeners
    setupModalEventListeners();
    
    // Auto-login for testing
    setTimeout(() => {
        simpleLogin();
    }, 1000);
    
    console.log('Simple script initialization complete');
});
