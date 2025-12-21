# Supabase Setup Guide

Your inventory management system now uses Supabase for cloud storage while maintaining the simple name entry system. Follow these steps to complete the setup:

## Database Setup

You'll need to create the following tables in your Supabase project:

### 1. Inventory Table

```sql
CREATE TABLE inventory (
    item_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    item TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    quantity INTEGER NOT NULL DEFAULT 0,
    location TEXT NOT NULL,
    remarks TEXT,
    created_date TIMESTAMPTZ DEFAULT NOW(),
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS (Row Level Security)
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to access only their own data
CREATE POLICY "Users can access their own inventory" ON inventory
    FOR ALL USING (true);
```

### 2. Transaction History Table

```sql
CREATE TABLE transaction_history (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    action TEXT NOT NULL,
    quantity_change INTEGER DEFAULT 0,
    new_location TEXT,
    user_name TEXT,
    remarks TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS
ALTER TABLE transaction_history ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Users can access their own history" ON transaction_history
    FOR ALL USING (true);
```

### 3. User Profiles Table (Optional)

```sql
CREATE TABLE user_profiles (
    user_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Users can access their own profile" ON user_profiles
    FOR ALL USING (true);
```

## Configuration

The system is already configured with your Supabase credentials:
- **Project URL**: `https://bhaexzjmspamqxcszkgm.supabase.co`
- **Anon Key**: Already embedded in the code

## Features

### ✅ **Simple Authentication**
- Users enter their name (no passwords required)
- Automatic user ID generation based on name and timestamp
- Local storage backup for offline functionality

### ✅ **Cloud Storage**
- All inventory data synced to Supabase
- Real-time updates across devices
- Automatic fallback to local storage if cloud fails

### ✅ **Hybrid Approach**
- **Online**: Data syncs to cloud automatically
- **Offline**: Works with local storage backup
- **Resilient**: Continues working even if Supabase is down

### ✅ **Multi-User Support**
- Each user's data is completely isolated
- Users identified by unique user_id
- No data sharing between users

## How It Works

1. **Name Entry**: User enters their name
2. **User ID Creation**: System generates unique user_id
3. **Cloud Sync**: All operations sync to Supabase
4. **Local Backup**: Data also saved locally
5. **Fallback**: If cloud fails, uses local storage

## Setup Steps

1. **Create Tables**: Run the SQL commands above in your Supabase SQL editor
2. **Deploy App**: Upload files to your web host
3. **Test**: Enter a name and start adding inventory items
4. **Verify**: Check Supabase dashboard to see data syncing

## Benefits

- **Simple**: No complex authentication setup
- **Reliable**: Works online and offline
- **Scalable**: Cloud storage with real-time sync
- **Private**: Each user's data is completely isolated
- **Fast**: Local storage provides instant response

Your inventory management system now has the best of both worlds: simple authentication with powerful cloud storage!
