import { openDB } from 'idb';
import {
  supabaseAvailable,
  createUserSupabase,
  getUserByEmailSupabase,
  getAllUsersSupabase,
  deleteUserSupabase,
  updateUserRoleSupabase,
  updateUserLastLoginSupabase,
  getPurchaseItemsSupabase,
  addPurchaseItemSupabase,
  updatePurchaseItemSupabase,
  deletePurchaseItemSupabase,
  searchPurchaseItemsSupabase,
  getPlatformStatsSupabase
} from './supabaseDb';

const DB_NAME = 'trackio_db';
const DB_VERSION = 2;
const USERS_STORE = 'users';
const PURCHASES_STORE = 'purchases'; // Changed from INVENTORY_STORE

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

        // Create purchases store (previously inventory)
        if (!db.objectStoreNames.contains(PURCHASES_STORE)) {
          const purchasesStore = db.createObjectStore(PURCHASES_STORE, { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          purchasesStore.createIndex('userEmail', 'userEmail');
          console.log('Created purchases store');
        }

        // Migrate from old inventory store if it exists
        if (db.objectStoreNames.contains('inventory')) {
          console.log('Migrating from old inventory store to purchases store...');
          // This would handle migration if needed
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
    return dbInstance;
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

// Hybrid functions that try Supabase first, then fallback to IndexedDB
export const getAllUsers = async () => {
  try {
    // Try Supabase first
    if (supabaseAvailable()) {
      const users = await getAllUsersSupabase();
      console.log('Retrieved users from Supabase:', users?.length, 'users found');
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
    return users || [];
  } catch (error) {
    console.error('Error getting all users from IndexedDB:', error);
    return [];
  }
};

export const getUserByEmail = async (email) => {
  console.log('===getUserByEmail called===');
  console.log('Looking for email:', email);
  
  try {
    // Try Supabase first
    if (supabaseAvailable()) {
      console.log('Trying Supabase...');
      const user = await getUserByEmailSupabase(email);
      console.log('Supabase result:', user ? 'USER FOUND' : 'USER NOT FOUND');
      if (user) {
        console.log('Supabase user data:', {
          email: user.email,
          businessName: user.businessName,
          role: user.role,
          hasPassword: !!user.password,
          hasSalt: !!user.salt
        });
      }
      return user;
    }
  } catch (error) {
    console.log('Supabase failed, falling back to IndexedDB:', error.message);
  }

  // Fallback to IndexedDB
  try {
    console.log('Trying IndexedDB...');
    const db = await initDB();
    const tx = db.transaction(USERS_STORE, 'readonly');
    const store = tx.objectStore(USERS_STORE);
    const user = await store.get(email.toLowerCase());
    await tx.done;
    
    console.log('IndexedDB result:', user ? 'USER FOUND' : 'USER NOT FOUND');
    if (user) {
      console.log('IndexedDB user data:', {
        email: user.email,
        businessName: user.businessName,
        role: user.role,
        hasPassword: !!user.password,
        hasSalt: !!user.salt
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

  console.log('===DB Service: Creating user===');
  console.log('User data:', { ...userData, password: '[HIDDEN]' });

  try {
    // Try Supabase first
    if (supabaseAvailable()) {
      console.log('Using Supabase for user creation');
      const result = await createUserSupabase(userData);
      console.log('Supabase user creation successful:', { ...result });
      return result;
    }
  } catch (error) {
    console.log('Supabase failed, falling back to IndexedDB:', error.message);
  }

  // Fallback to IndexedDB
  try {
    console.log('Using IndexedDB for user creation');
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
    if (email.endsWith('@admin')) {
      role = 'admin';
    }

    const newUser = {
      email,
      password: userData.password,
      salt: userData.salt,
      businessName: userData.businessName,
      role: role,
      createdAt: new Date().toISOString(),
      lastLogin: null
    };

    console.log('Creating user in IndexedDB:', { ...newUser, password: '[HIDDEN]' });
    await store.add(newUser);
    await tx.done;

    // Return user data without password
    const { password, salt, ...userWithoutPassword } = newUser;
    console.log('IndexedDB user creation successful:', userWithoutPassword);
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
      return await deleteUserSupabase(email);
    }
  } catch (error) {
    console.log('Supabase failed, falling back to IndexedDB:', error.message);
  }

  // Fallback to IndexedDB
  try {
    const db = await initDB();
    
    // Start transactions for both stores
    const userTx = db.transaction(USERS_STORE, 'readwrite');
    const purchasesTx = db.transaction(PURCHASES_STORE, 'readwrite');
    
    const userStore = userTx.objectStore(USERS_STORE);
    const purchasesStore = purchasesTx.objectStore(PURCHASES_STORE);

    // Delete user from users store
    await userStore.delete(email.toLowerCase());

    // Delete all purchase items for this user
    const purchasesIndex = purchasesStore.index('userEmail');
    const userItems = await purchasesIndex.getAll(email.toLowerCase());
    
    // Delete each purchase item
    for (const item of userItems) {
      await purchasesStore.delete(item.id);
    }

    // Wait for both transactions to complete
    await userTx.done;
    await purchasesTx.done;

    console.log('Deleted user and all associated purchase data from IndexedDB:', email);
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
      return await updateUserRoleSupabase(email, newRole);
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
    if (!user) {
      throw new Error('User not found');
    }

    // STRICT ADMIN CONTROL - Only @admin emails can be admins
    if (newRole === 'admin' && !email.toLowerCase().endsWith('@admin')) {
      throw new Error('Only users with @admin email addresses can be granted administrator privileges');
    }

    user.role = newRole;
    user.updatedAt = new Date().toISOString();

    await store.put(user);
    await tx.done;

    console.log('Updated user role in IndexedDB:', email, newRole);
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
    }
    
    await tx.done;
  } catch (error) {
    console.error('Error updating last login in IndexedDB:', error);
  }
};

// Purchase tracking functions (renamed from inventory functions)
export const getPurchaseItems = async (userEmail) => {
  try {
    // Try Supabase first
    if (supabaseAvailable()) {
      const items = await getPurchaseItemsSupabase(userEmail);
      console.log('Got purchase items from Supabase:', items?.length);
      return items;
    }
  } catch (error) {
    console.log('Supabase failed, falling back to IndexedDB:', error.message);
  }

  // Fallback to IndexedDB
  try {
    const db = await initDB();
    const tx = db.transaction(PURCHASES_STORE, 'readonly');
    const store = tx.objectStore(PURCHASES_STORE);
    const index = store.index('userEmail');
    const items = await index.getAll(userEmail.toLowerCase());
    await tx.done;
    
    console.log('Got purchase items from IndexedDB:', items?.length);
    return items;
  } catch (error) {
    console.error('Error getting purchase items from IndexedDB:', error);
    return [];
  }
};

export const addPurchaseItem = async (itemData, userEmail) => {
  console.log('===addPurchaseItem called===');
  console.log('itemData:', itemData);
  console.log('userEmail:', userEmail);

  if (!itemData || !userEmail) {
    throw new Error('Missing required data for purchase item');
  }

  // Validate required fields
  if (!itemData.name || !itemData.category || itemData.quantity === undefined || itemData.unitPrice === undefined) {
    throw new Error('Missing required fields: name, category, quantity, and unitPrice are required');
  }

  try {
    // Try Supabase first
    if (supabaseAvailable()) {
      console.log('Attempting to add purchase item to Supabase...');
      const result = await addPurchaseItemSupabase(itemData, userEmail);
      console.log('Successfully added purchase item to Supabase:', result);
      return result;
    }
  } catch (error) {
    console.log('Supabase failed, falling back to IndexedDB:', error.message);
  }

  // Fallback to IndexedDB
  try {
    console.log('Adding purchase item to IndexedDB...');
    const db = await initDB();
    const tx = db.transaction(PURCHASES_STORE, 'readwrite');
    const store = tx.objectStore(PURCHASES_STORE);

    const newItem = {
      name: itemData.name,
      category: itemData.category,
      quantity: parseInt(itemData.quantity),
      unitPrice: parseFloat(itemData.unitPrice),
      description: itemData.description || '',
      dateAdded: itemData.dateAdded || new Date().toISOString().split('T')[0],
      userEmail: userEmail.toLowerCase(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // Add VAT fields if provided
      vatIncluded: itemData.vatIncluded || false,
      vatPercentage: parseFloat(itemData.vatPercentage) || 0
    };

    console.log('Adding purchase item to IndexedDB:', newItem);
    const id = await store.add(newItem);
    await tx.done;

    const result = { ...newItem, id };
    console.log('Successfully added purchase item to IndexedDB:', result);
    return result;
  } catch (error) {
    console.error('Error adding purchase item to IndexedDB:', error);
    throw error;
  }
};

export const updatePurchaseItem = async (itemData, userEmail) => {
  try {
    // Try Supabase first
    if (supabaseAvailable()) {
      return await updatePurchaseItemSupabase(itemData, userEmail);
    }
  } catch (error) {
    console.log('Supabase failed, falling back to IndexedDB:', error.message);
  }

  // Fallback to IndexedDB
  try {
    const db = await initDB();
    const tx = db.transaction(PURCHASES_STORE, 'readwrite');
    const store = tx.objectStore(PURCHASES_STORE);

    const updatedItem = {
      ...itemData,
      userEmail: userEmail.toLowerCase(),
      updatedAt: new Date().toISOString()
    };

    await store.put(updatedItem);
    await tx.done;

    return updatedItem;
  } catch (error) {
    console.error('Error updating purchase item in IndexedDB:', error);
    throw error;
  }
};

export const deletePurchaseItem = async (itemId, userEmail) => {
  try {
    // Try Supabase first
    if (supabaseAvailable()) {
      return await deletePurchaseItemSupabase(itemId, userEmail);
    }
  } catch (error) {
    console.log('Supabase failed, falling back to IndexedDB:', error.message);
  }

  // Fallback to IndexedDB
  try {
    const db = await initDB();
    const tx = db.transaction(PURCHASES_STORE, 'readwrite');
    const store = tx.objectStore(PURCHASES_STORE);

    // First verify the item belongs to the user
    const item = await store.get(itemId);
    if (!item) {
      throw new Error('Purchase item not found');
    }

    if (item.userEmail !== userEmail.toLowerCase()) {
      throw new Error('You do not have permission to delete this purchase item');
    }

    await store.delete(itemId);
    await tx.done;

    console.log('Deleted purchase item from IndexedDB:', itemId);
    return true;
  } catch (error) {
    console.error('Error deleting purchase item from IndexedDB:', error);
    throw error;
  }
};

export const searchPurchaseItems = async (searchTerm, userEmail) => {
  try {
    // Try Supabase first
    if (supabaseAvailable()) {
      return await searchPurchaseItemsSupabase(searchTerm, userEmail);
    }
  } catch (error) {
    console.log('Supabase failed, falling back to IndexedDB:', error.message);
  }

  // Fallback to IndexedDB
  try {
    const items = await getPurchaseItems(userEmail);
    
    if (!searchTerm) return items;

    const lowerSearchTerm = searchTerm.toLowerCase();
    return items.filter(item =>
      item.name.toLowerCase().includes(lowerSearchTerm) ||
      item.category.toLowerCase().includes(lowerSearchTerm) ||
      item.description?.toLowerCase().includes(lowerSearchTerm)
    );
  } catch (error) {
    console.error('Error searching purchase items in IndexedDB:', error);
    return [];
  }
};

// Legacy function names for backward compatibility
export const getInventoryItems = getPurchaseItems;
export const addInventoryItem = addPurchaseItem;
export const updateInventoryItem = updatePurchaseItem;
export const deleteInventoryItem = deletePurchaseItem;
export const searchInventoryItems = searchPurchaseItems;

// Admin specific functions
export const getPlatformStats = async () => {
  try {
    // Try Supabase first
    if (supabaseAvailable()) {
      return await getPlatformStatsSupabase();
    }
  } catch (error) {
    console.log('Supabase failed, falling back to IndexedDB:', error.message);
  }

  // Fallback to IndexedDB
  try {
    const db = await initDB();
    
    const userTx = db.transaction(USERS_STORE, 'readonly');
    const purchasesTx = db.transaction(PURCHASES_STORE, 'readonly');
    
    const userStore = userTx.objectStore(USERS_STORE);
    const purchasesStore = purchasesTx.objectStore(PURCHASES_STORE);
    
    const allUsers = await userStore.getAll();
    const allPurchaseItems = await purchasesStore.getAll();
    
    await userTx.done;
    await purchasesTx.done;

    const stats = {
      totalUsers: allUsers.length,
      totalAdmins: allUsers.filter(u => u.role === 'admin').length,
      totalRegularUsers: allUsers.filter(u => u.role === 'user').length,
      totalPurchaseItems: allPurchaseItems.length,
      recentUsers: allUsers
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5)
    };

    console.log('Platform stats generated from IndexedDB:', {
      totalUsers: stats.totalUsers,
      recentUsersCount: stats.recentUsers.length
    });

    return stats;
  } catch (error) {
    console.error('Error getting platform stats from IndexedDB:', error);
    return null;
  }
};

// Initialize database on module load
initDB().catch(console.error);