import { openDB } from 'idb';
import { supabaseAvailable, createUserSupabase, getUserByEmailSupabase, getAllUsersSupabase, deleteUserSupabase, updateUserRoleSupabase, updateUserLastLoginSupabase, getInventoryItemsSupabase, addInventoryItemSupabase, updateInventoryItemSupabase, deleteInventoryItemSupabase, searchInventoryItemsSupabase, getPlatformStatsSupabase } from './supabaseDb';
import { DatabaseSync } from './databaseSync';
import { logSecurityEvent } from '../utils/security';

const DB_NAME = 'trackio_db';
const DB_VERSION = 2;
const USERS_STORE = 'users';
const INVENTORY_STORE = 'inventory';

let dbInstance = null;

async function initDB() {
  if (dbInstance) return dbInstance;

  try {
    dbInstance = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        console.log(`Upgrading database from version ${oldVersion} to ${newVersion}`);

        // Create users store
        if (!db.objectStoreNames.contains(USERS_STORE)) {
          const userStore = db.createObjectStore(USERS_STORE, { keyPath: 'email' });
          userStore.createIndex('role', 'role');
          userStore.createIndex('createdAt', 'createdAt');
          console.log('Created users store');
        }

        // Create inventory store
        if (!db.objectStoreNames.contains(INVENTORY_STORE)) {
          const inventoryStore = db.createObjectStore(INVENTORY_STORE, { keyPath: 'id', autoIncrement: true });
          inventoryStore.createIndex('userEmail', 'userEmail');
          inventoryStore.createIndex('status', 'status');
          console.log('Created inventory store');
        }
      },
      blocked() {
        console.warn('Database upgrade blocked');
      },
      blocking() {
        console.warn('Database blocking');
      }
    });

    console.log('Database initialized successfully');

    // Create default platform admin if it doesn't exist
    await createDefaultPlatformAdmin();

    // Check and ensure Supabase tables exist
    await DatabaseSync.ensureTablesExist();

    return dbInstance;
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

const createDefaultPlatformAdmin = async () => {
  try {
    const platformAdminEmail = 'platformadmin@trackio.com';

    // Try Supabase first
    if (supabaseAvailable()) {
      try {
        const existingAdmin = await getUserByEmailSupabase(platformAdminEmail);
        if (!existingAdmin) {
          await createUserSupabase({
            email: platformAdminEmail,
            password: 'admin123',
            businessName: 'Trackio Platform'
          });
          console.log('Created default platform admin account in Supabase');
        }
        return;
      } catch (error) {
        console.log('Supabase not available, falling back to IndexedDB');
      }
    }

    // Fallback to IndexedDB
    const db = await dbInstance;
    const tx = db.transaction(USERS_STORE, 'readwrite');
    const store = tx.objectStore(USERS_STORE);
    const existingAdmin = await store.get(platformAdminEmail);

    if (!existingAdmin) {
      const platformAdmin = {
        email: platformAdminEmail,
        password: 'admin123',
        businessName: 'Trackio Platform',
        role: 'platformadmin',
        createdAt: new Date().toISOString(),
        lastLogin: null
      };

      await store.add(platformAdmin);
      console.log('Created default platform admin account in IndexedDB');
    }

    await tx.done;
  } catch (error) {
    console.error('Error creating default platform admin:', error);
  }
};

// Enhanced hybrid functions with forced database sync
export const getAllUsers = async () => {
  try {
    // Always try Supabase first for admin operations
    if (supabaseAvailable()) {
      const users = await getAllUsersSupabase();
      logSecurityEvent('USERS_LOADED_FROM_DATABASE', { 
        source: 'supabase', 
        count: users?.length 
      });
      return users;
    }
  } catch (error) {
    console.log('Supabase failed, falling back to IndexedDB:', error.message);
  }

  // Fallback to IndexedDB
  try {
    console.log('Getting all users from IndexedDB...');
    const db = await initDB();
    if (!db.objectStoreNames.contains(USERS_STORE)) {
      console.log('Users store does not exist');
      return [];
    }

    const tx = db.transaction(USERS_STORE, 'readonly');
    const store = tx.objectStore(USERS_STORE);
    const users = await store.getAll();
    await tx.done;

    console.log('Retrieved users from IndexedDB:', users?.length, 'users found');
    logSecurityEvent('USERS_LOADED_FROM_DATABASE', { 
      source: 'indexeddb', 
      count: users?.length 
    });
    return users || [];
  } catch (error) {
    console.error('Error getting all users from IndexedDB:', error);
    return [];
  }
};

export const getUserByEmail = async (email) => {
  try {
    // Try Supabase first
    if (supabaseAvailable()) {
      const user = await getUserByEmailSupabase(email);
      if (user) {
        logSecurityEvent('USER_LOADED_FROM_DATABASE', { 
          email, 
          source: 'supabase' 
        });
      }
      return user;
    }
  } catch (error) {
    console.log('Supabase failed, falling back to IndexedDB:', error.message);
  }

  // Fallback to IndexedDB
  try {
    const db = await initDB();
    const tx = db.transaction(USERS_STORE, 'readonly');
    const store = tx.objectStore(USERS_STORE);
    const user = await store.get(email.toLowerCase());
    await tx.done;

    if (user) {
      logSecurityEvent('USER_LOADED_FROM_DATABASE', { 
        email, 
        source: 'indexeddb' 
      });
    }
    return user;
  } catch (error) {
    console.error('Error getting user from IndexedDB:', error);
    return null;
  }
};

export const createUser = async (userData) => {
  if (!userData.email || !userData.password || !userData.businessName) {
    throw new Error('Missing required user data');
  }

  try {
    // Always try Supabase first for user creation
    if (supabaseAvailable()) {
      const newUser = await createUserSupabase(userData);
      logSecurityEvent('USER_CREATED_IN_DATABASE', { 
        email: newUser.email, 
        source: 'supabase',
        role: newUser.role 
      });
      return newUser;
    }
  } catch (error) {
    console.log('Supabase failed, falling back to IndexedDB:', error.message);
  }

  // Fallback to IndexedDB
  try {
    const db = await initDB();
    const tx = db.transaction(USERS_STORE, 'readwrite');
    const store = tx.objectStore(USERS_STORE);
    const email = userData.email.toLowerCase();

    // Check if email already exists
    const existingUser = await store.get(email);
    if (existingUser) {
      throw new Error('An account with this email already exists');
    }

    // Determine user role based on email
    let role = 'user';
    if (email === 'platformadmin@trackio.com') {
      role = 'platformadmin';
    } else if (email.endsWith('@admin')) {
      role = 'admin';
    }

    const newUser = {
      email,
      password: userData.password,
      businessName: userData.businessName,
      role: role,
      createdAt: new Date().toISOString(),
      lastLogin: null
    };

    console.log('Creating user in IndexedDB:', { ...newUser, password: '[HIDDEN]' });
    await store.add(newUser);
    await tx.done;

    logSecurityEvent('USER_CREATED_IN_DATABASE', { 
      email: newUser.email, 
      source: 'indexeddb',
      role: newUser.role 
    });

    // Return user data without password
    const { password, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  } catch (error) {
    console.error('Error creating user in IndexedDB:', error);
    throw error;
  }
};

export const deleteUser = async (email) => {
  try {
    // Try Supabase first
    if (supabaseAvailable()) {
      const result = await deleteUserSupabase(email);
      logSecurityEvent('USER_DELETED_FROM_DATABASE', { 
        email, 
        source: 'supabase' 
      });
      return result;
    }
  } catch (error) {
    console.log('Supabase failed, falling back to IndexedDB:', error.message);
  }

  // Fallback to IndexedDB
  try {
    // Prevent deletion of platform admin
    if (email.toLowerCase() === 'platformadmin@trackio.com') {
      throw new Error('Platform admin account cannot be deleted');
    }

    const db = await initDB();

    // Start transactions for both stores
    const userTx = db.transaction(USERS_STORE, 'readwrite');
    const inventoryTx = db.transaction(INVENTORY_STORE, 'readwrite');

    const userStore = userTx.objectStore(USERS_STORE);
    const inventoryStore = inventoryTx.objectStore(INVENTORY_STORE);

    // Delete user from users store
    await userStore.delete(email.toLowerCase());

    // Delete all inventory items for this user
    const inventoryIndex = inventoryStore.index('userEmail');
    const userItems = await inventoryIndex.getAll(email.toLowerCase());

    // Delete each inventory item
    for (const item of userItems) {
      await inventoryStore.delete(item.id);
    }

    // Wait for both transactions to complete
    await userTx.done;
    await inventoryTx.done;

    console.log('Deleted user and all associated data from IndexedDB:', email);
    logSecurityEvent('USER_DELETED_FROM_DATABASE', { 
      email, 
      source: 'indexeddb' 
    });

    // Also clear localStorage data for this user
    const keysToRemove = [
      `taxExportHistory_${email}`,
      `scanHistory_${email}`,
      `importHistory_${email}`,
      `inventory_${email}`
    ];

    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });

    return true;
  } catch (error) {
    console.error('Error deleting user from IndexedDB:', error);
    throw error;
  }
};

export const updateUserRole = async (email, newRole) => {
  try {
    // Try Supabase first
    if (supabaseAvailable()) {
      const result = await updateUserRoleSupabase(email, newRole);
      logSecurityEvent('USER_ROLE_UPDATED_IN_DATABASE', { 
        email, 
        newRole, 
        source: 'supabase' 
      });
      return result;
    }
  } catch (error) {
    console.log('Supabase failed, falling back to IndexedDB:', error.message);
  }

  // Fallback to IndexedDB
  try {
    // Prevent role changes for platform admin
    if (email.toLowerCase() === 'platformadmin@trackio.com') {
      throw new Error('Platform admin role cannot be changed');
    }

    const db = await initDB();
    const tx = db.transaction(USERS_STORE, 'readwrite');
    const store = tx.objectStore(USERS_STORE);

    const user = await store.get(email.toLowerCase());
    if (!user) {
      throw new Error('User not found');
    }

    // STRICT ADMIN CONTROL - Only @admin emails can be admins
    if (newRole === 'admin' && !email.toLowerCase().endsWith('@admin')) {
      throw new Error('Only users with @admin email addresses can be granted administrator privileges');
    }

    // Prevent setting platformadmin role
    if (newRole === 'platformadmin') {
      throw new Error('Platform admin role cannot be assigned');
    }

    user.role = newRole;
    user.updatedAt = new Date().toISOString();

    await store.put(user);
    await tx.done;

    console.log('Updated user role in IndexedDB:', email, newRole);
    logSecurityEvent('USER_ROLE_UPDATED_IN_DATABASE', { 
      email, 
      newRole, 
      source: 'indexeddb' 
    });

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  } catch (error) {
    console.error('Error updating user role in IndexedDB:', error);
    throw error;
  }
};

export const updateUserLastLogin = async (email) => {
  try {
    // Try Supabase first
    if (supabaseAvailable()) {
      await updateUserLastLoginSupabase(email);
      logSecurityEvent('USER_LAST_LOGIN_UPDATED', { 
        email, 
        source: 'supabase' 
      });
      return;
    }
  } catch (error) {
    console.log('Supabase failed, falling back to IndexedDB:', error.message);
  }

  // Fallback to IndexedDB
  try {
    const db = await initDB();
    const tx = db.transaction(USERS_STORE, 'readwrite');
    const store = tx.objectStore(USERS_STORE);

    const user = await store.get(email.toLowerCase());
    if (user) {
      user.lastLogin = new Date().toISOString();
      await store.put(user);
      logSecurityEvent('USER_LAST_LOGIN_UPDATED', { 
        email, 
        source: 'indexeddb' 
      });
    }

    await tx.done;
  } catch (error) {
    console.error('Error updating last login in IndexedDB:', error);
  }
};

// Enhanced inventory operations with forced database sync
export const getInventoryItems = async (userEmail) => {
  try {
    // Always try database first for inventory
    if (supabaseAvailable()) {
      const items = await getInventoryItemsSupabase(userEmail);
      
      // Sync to localStorage as backup
      if (items && items.length > 0) {
        localStorage.setItem(`inventory_${userEmail}`, JSON.stringify(items));
      }
      
      logSecurityEvent('INVENTORY_LOADED_FROM_DATABASE', { 
        userEmail, 
        source: 'supabase',
        count: items?.length 
      });
      return items;
    }
  } catch (error) {
    console.log('Supabase failed, falling back to IndexedDB:', error.message);
  }

  // Fallback to IndexedDB
  try {
    const db = await initDB();
    const tx = db.transaction(INVENTORY_STORE, 'readonly');
    const store = tx.objectStore(INVENTORY_STORE);
    const index = store.index('userEmail');
    const items = await index.getAll(userEmail.toLowerCase());
    await tx.done;

    logSecurityEvent('INVENTORY_LOADED_FROM_DATABASE', { 
      userEmail, 
      source: 'indexeddb',
      count: items?.length 
    });
    return items;
  } catch (error) {
    console.error('Error getting inventory items from IndexedDB:', error);
    return [];
  }
};

export const addInventoryItem = async (itemData, userEmail) => {
  try {
    // Force save to database first
    const result = await DatabaseSync.saveInventoryItem(itemData, userEmail, true);
    
    // Trigger immediate sync to localStorage
    const allItems = await getInventoryItems(userEmail);
    localStorage.setItem(`inventory_${userEmail}`, JSON.stringify(allItems));
    
    logSecurityEvent('INVENTORY_ITEM_ADDED_WITH_SYNC', {
      userEmail,
      itemName: itemData.name,
      syncedToDatabase: true
    });

    return result;
  } catch (error) {
    console.error('Error adding inventory item with sync:', error);
    throw error;
  }
};

export const updateInventoryItem = async (itemData, userEmail) => {
  try {
    // Force update to database first
    const result = await DatabaseSync.updateInventoryItem(itemData, userEmail, true);
    
    // Trigger immediate sync to localStorage
    const allItems = await getInventoryItems(userEmail);
    localStorage.setItem(`inventory_${userEmail}`, JSON.stringify(allItems));
    
    logSecurityEvent('INVENTORY_ITEM_UPDATED_WITH_SYNC', {
      userEmail,
      itemId: itemData.id,
      itemName: itemData.name,
      syncedToDatabase: true
    });

    return result;
  } catch (error) {
    console.error('Error updating inventory item with sync:', error);
    throw error;
  }
};

export const deleteInventoryItem = async (itemId, userEmail) => {
  try {
    // Force delete from database first
    const result = await DatabaseSync.deleteInventoryItem(itemId, userEmail, true);
    
    // Trigger immediate sync to localStorage
    const allItems = await getInventoryItems(userEmail);
    localStorage.setItem(`inventory_${userEmail}`, JSON.stringify(allItems));
    
    logSecurityEvent('INVENTORY_ITEM_DELETED_WITH_SYNC', {
      userEmail,
      itemId,
      syncedToDatabase: true
    });

    return result;
  } catch (error) {
    console.error('Error deleting inventory item with sync:', error);
    throw error;
  }
};

export const searchInventoryItems = async (searchTerm, userEmail) => {
  try {
    // Try Supabase first
    if (supabaseAvailable()) {
      return await searchInventoryItemsSupabase(searchTerm, userEmail);
    }
  } catch (error) {
    console.log('Supabase failed, falling back to IndexedDB:', error.message);
  }

  // Fallback to IndexedDB
  try {
    const items = await getInventoryItems(userEmail);
    if (!searchTerm) return items;

    const lowerSearchTerm = searchTerm.toLowerCase();
    return items.filter(item =>
      item.name.toLowerCase().includes(lowerSearchTerm) ||
      item.category.toLowerCase().includes(lowerSearchTerm) ||
      item.description?.toLowerCase().includes(lowerSearchTerm)
    );
  } catch (error) {
    console.error('Error searching inventory items in IndexedDB:', error);
    return [];
  }
};

// Enhanced history operations with database sync
export const saveExportHistory = async (exportRecord, userEmail) => {
  try {
    // Save to database first
    await DatabaseSync.saveToHistory('export_history', exportRecord, userEmail);
    
    // Update localStorage
    const existingHistory = JSON.parse(localStorage.getItem(`taxExportHistory_${userEmail}`) || '[]');
    const newHistory = [exportRecord, ...existingHistory].slice(0, 50);
    localStorage.setItem(`taxExportHistory_${userEmail}`, JSON.stringify(newHistory));
    
    logSecurityEvent('EXPORT_HISTORY_SAVED_WITH_SYNC', {
      userEmail,
      recordId: exportRecord.id,
      syncedToDatabase: true
    });

    return newHistory;
  } catch (error) {
    console.error('Error saving export history with sync:', error);
    throw error;
  }
};

export const saveScanHistory = async (scanRecord, userEmail) => {
  try {
    // Save to database first
    await DatabaseSync.saveToHistory('scan_history', scanRecord, userEmail);
    
    // Update localStorage
    const existingHistory = JSON.parse(localStorage.getItem(`scanHistory_${userEmail}`) || '[]');
    const newHistory = [scanRecord, ...existingHistory].slice(0, 50);
    localStorage.setItem(`scanHistory_${userEmail}`, JSON.stringify(newHistory));
    
    logSecurityEvent('SCAN_HISTORY_SAVED_WITH_SYNC', {
      userEmail,
      recordId: scanRecord.id,
      syncedToDatabase: true
    });

    return newHistory;
  } catch (error) {
    console.error('Error saving scan history with sync:', error);
    throw error;
  }
};

export const saveImportHistory = async (importRecord, userEmail) => {
  try {
    // Save to database first
    await DatabaseSync.saveToHistory('import_history', importRecord, userEmail);
    
    // Update localStorage
    const existingHistory = JSON.parse(localStorage.getItem(`importHistory_${userEmail}`) || '[]');
    const newHistory = [importRecord, ...existingHistory].slice(0, 50);
    localStorage.setItem(`importHistory_${userEmail}`, JSON.stringify(newHistory));
    
    logSecurityEvent('IMPORT_HISTORY_SAVED_WITH_SYNC', {
      userEmail,
      recordId: importRecord.id,
      syncedToDatabase: true
    });

    return newHistory;
  } catch (error) {
    console.error('Error saving import history with sync:', error);
    throw error;
  }
};

// Load history with database priority
export const loadExportHistory = async (userEmail) => {
  try {
    // Try database first
    const dbHistory = await DatabaseSync.loadFromDatabase('export_history', userEmail);
    if (dbHistory && dbHistory.length > 0) {
      // Sync to localStorage
      localStorage.setItem(`taxExportHistory_${userEmail}`, JSON.stringify(dbHistory));
      return dbHistory;
    }
  } catch (error) {
    console.error('Error loading export history from database:', error);
  }

  // Fallback to localStorage
  try {
    return JSON.parse(localStorage.getItem(`taxExportHistory_${userEmail}`) || '[]');
  } catch (error) {
    console.error('Error loading export history from localStorage:', error);
    return [];
  }
};

export const loadScanHistory = async (userEmail) => {
  try {
    // Try database first
    const dbHistory = await DatabaseSync.loadFromDatabase('scan_history', userEmail);
    if (dbHistory && dbHistory.length > 0) {
      // Sync to localStorage
      localStorage.setItem(`scanHistory_${userEmail}`, JSON.stringify(dbHistory));
      return dbHistory;
    }
  } catch (error) {
    console.error('Error loading scan history from database:', error);
  }

  // Fallback to localStorage
  try {
    return JSON.parse(localStorage.getItem(`scanHistory_${userEmail}`) || '[]');
  } catch (error) {
    console.error('Error loading scan history from localStorage:', error);
    return [];
  }
};

export const loadImportHistory = async (userEmail) => {
  try {
    // Try database first
    const dbHistory = await DatabaseSync.loadFromDatabase('import_history', userEmail);
    if (dbHistory && dbHistory.length > 0) {
      // Sync to localStorage
      localStorage.setItem(`importHistory_${userEmail}`, JSON.stringify(dbHistory));
      return dbHistory;
    }
  } catch (error) {
    console.error('Error loading import history from database:', error);
  }

  // Fallback to localStorage
  try {
    return JSON.parse(localStorage.getItem(`importHistory_${userEmail}`) || '[]');
  } catch (error) {
    console.error('Error loading import history from localStorage:', error);
    return [];
  }
};

// Platform admin specific functions with database sync
export const getPlatformStats = async () => {
  try {
    // Always try Supabase first for platform stats
    if (supabaseAvailable()) {
      const stats = await getPlatformStatsSupabase();
      logSecurityEvent('PLATFORM_STATS_LOADED_FROM_DATABASE', { 
        source: 'supabase',
        totalUsers: stats?.totalUsers 
      });
      return stats;
    }
  } catch (error) {
    console.log('Supabase failed, falling back to IndexedDB:', error.message);
  }

  // Fallback to IndexedDB
  try {
    const db = await initDB();
    const userTx = db.transaction(USERS_STORE, 'readonly');
    const inventoryTx = db.transaction(INVENTORY_STORE, 'readonly');

    const userStore = userTx.objectStore(USERS_STORE);
    const inventoryStore = inventoryTx.objectStore(INVENTORY_STORE);

    const allUsers = await userStore.getAll();
    const allInventoryItems = await inventoryStore.getAll();

    await userTx.done;
    await inventoryTx.done;

    const stats = {
      totalUsers: allUsers.length,
      totalAdmins: allUsers.filter(u => u.role === 'admin').length,
      totalRegularUsers: allUsers.filter(u => u.role === 'user').length,
      totalPlatformAdmins: allUsers.filter(u => u.role === 'platformadmin').length,
      totalInventoryItems: allInventoryItems.length,
      recentUsers: allUsers
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5)
    };

    console.log('Platform stats generated from IndexedDB:', {
      totalUsers: stats.totalUsers,
      recentUsersCount: stats.recentUsers.length
    });

    logSecurityEvent('PLATFORM_STATS_LOADED_FROM_DATABASE', { 
      source: 'indexeddb',
      totalUsers: stats.totalUsers 
    });

    return stats;
  } catch (error) {
    console.error('Error getting platform stats from IndexedDB:', error);
    return null;
  }
};

// Auto-sync function to be called periodically
export const performAutoSync = async (userEmail) => {
  if (!userEmail) return;

  try {
    logSecurityEvent('AUTO_SYNC_STARTED', { userEmail });

    // Perform full sync of all user data
    await DatabaseSync.performFullSync(userEmail);

    logSecurityEvent('AUTO_SYNC_COMPLETED', { userEmail });
    return true;
  } catch (error) {
    console.error('Auto-sync error:', error);
    logSecurityEvent('AUTO_SYNC_ERROR', { 
      userEmail, 
      error: error.message 
    });
    return false;
  }
};

// Initialize database on module load
initDB().catch(console.error);