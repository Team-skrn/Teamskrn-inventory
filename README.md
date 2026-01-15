# Inventory Management System with Supabase

A modern, cloud-enabled inventory management system that combines simple name-based authentication with powerful Supabase cloud storage.

## 🚀 Features

### **🔐 Simple Authentication**
- No passwords or complex registration required
- Just enter your name to get started
- Automatic user identification and data isolation

### **☁️ Cloud Storage with Local Backup**
- All data synced to Supabase cloud database
- Automatic local storage backup for offline use
- Works even when internet connection is poor
- Real-time sync across multiple devices

### **📦 Complete Inventory Management**
- Add, edit, delete inventory items
- Unique item IDs (INV-0001, INV-0002, etc.)
- Stock level tracking with add/remove operations
- Location management and descriptions
- Low stock warnings and statistics

### **🔍 Advanced Features**
- Search and filter inventory
- Transaction history tracking
- Mobile-friendly responsive design
- Export/import capabilities
- Real-time statistics dashboard

## 🛠️ Technology Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Supabase (PostgreSQL database)
- **Storage**: Cloud + Local Storage hybrid
- **Authentication**: Simple name-based with user isolation

## 📱 User Experience

1. **Enter Name**: Type any name you want to use
2. **Start Managing**: System creates your isolated workspace
3. **Add Items**: Create inventory items with all details
4. **Track Changes**: All operations logged with timestamps
5. **Sync Everywhere**: Access your data from any device

## 🔧 Setup

### Quick Start (Use Existing Database)
1. Download/clone the files
2. Open `index.html` in a web browser
3. Enter your name and start using immediately!

### Custom Setup (Your Own Supabase)
1. Create a Supabase project
2. Run the SQL commands from `SUPABASE_SETUP.md`
3. Update the Supabase credentials in `script-supabase-simple.js`
4. Deploy to any web host

## 🗄️ Database Structure

The system uses three main tables:
- **inventory**: Stores all inventory items with user isolation
- **transaction_history**: Tracks all changes and operations
- **user_profiles**: Optional user information storage

See `SUPABASE_SETUP.md` for complete database setup instructions.

## 🌐 Deployment

Deploy to any static web host:
- **GitHub Pages**: Push to GitHub and enable Pages
- **Netlify**: Drag and drop the files
- **Vercel**: Connect your repository
- **Any Web Host**: Upload files to public folder

No server-side configuration required!

## 💾 Data Management

### **Hybrid Storage Approach**
- **Primary**: Supabase cloud database for persistence and sync
- **Backup**: Browser localStorage for offline functionality
- **Fallback**: System gracefully degrades if cloud is unavailable

### **Data Privacy**
- Each user's data is completely isolated
- No data sharing between users
- User identification based on name + timestamp
- All data encrypted in transit via HTTPS

## 🔒 Security

- Row Level Security (RLS) enabled on all tables
- User data isolation at database level
- No sensitive data stored in frontend code
- Secure API communication via Supabase

## 📊 Statistics

The dashboard shows:
- Total number of items
- Total quantity across all items
- Number of low-stock items (≤5 quantity)
- Recent transaction activity

## 🎯 Use Cases

Perfect for:
- Personal inventory tracking
- Small business stock management
- Warehouse organization
- Equipment tracking
- Home inventory management
- Asset management

## 🔄 Sync Behavior

- **Online**: All changes immediately sync to cloud
- **Offline**: Changes saved locally, sync when online
- **Multi-device**: Real-time updates across all devices
- **Conflict Resolution**: Latest timestamp wins

Your inventory management system is now ready for production use with enterprise-grade cloud storage!
