import { openDB } from 'idb';
import { 
  supabaseAvailable,
  createUserSupabase,
  getUserByEmailSupabase,
  getAllUsersSupabase,
  deleteUserSupabase,
  updateUserRoleSupabase,
  updateUserLastLoginSupabase,
  getInventoryItemsSupabase,
  addInventoryItemSupabase,
  updateInventoryItemSupabase,
  deleteInventoryItemSupabase,
  searchInventoryItemsSupabase,
  getPlatformStatsSupabase
} from './supabaseDb';

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

// Hybrid functions that try Supabase first, then fallback to IndexedDB

export const getAllUsers = async () => {
  try {
    // Try Supabase first
    if (supabaseAvailable()) {
      return await getAllUsersSupabase();
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
  try {
    // Try Supabase first
    if (supabaseAvailable()) {
      return await getUserByEmailSupabase(email);
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
    // Try Supabase first
    if (supabaseAvailable()) {
      return await createUserSupabase(userData);
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
      return await deleteUserSupabase(email);
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

export const getInventoryItems = async (userEmail) => {
  try {
    // Try Supabase first
    if (supabaseAvailable()) {
      return await getInventoryItemsSupabase(userEmail);
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
    return items;
  } catch (error) {
    console.error('Error getting inventory items from IndexedDB:', error);
    return [];
  }
};

export const addInventoryItem = async (itemData, userEmail) => {
  try {
    // Try Supabase first
    if (supabaseAvailable()) {
      return await addInventoryItemSupabase(itemData, userEmail);
    }
  } catch (error) {
    console.log('Supabase failed, falling back to IndexedDB:', error.message);
  }

  // Fallback to IndexedDB
  try {
    const db = await initDB();
    const tx = db.transaction(INVENTORY_STORE, 'readwrite');
    const store = tx.objectStore(INVENTORY_STORE);
    
    const newItem = {
      ...itemData,
      userEmail: userEmail.toLowerCase(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const id = await store.add(newItem);
    await tx.done;
    
    return { ...newItem, id };
  } catch (error) {
    console.error('Error adding inventory item to IndexedDB:', error);
    throw error;
  }
};

export const updateInventoryItem = async (itemData, userEmail) => {
  try {
    // Try Supabase first
    if (supabaseAvailable()) {
      return await updateInventoryItemSupabase(itemData, userEmail);
    }
  } catch (error) {
    console.log('Supabase failed, falling back to IndexedDB:', error.message);
  }

  // Fallback to IndexedDB
  try {
    const db = await initDB();
    const tx = db.transaction(INVENTORY_STORE, 'readwrite');
    const store = tx.objectStore(INVENTORY_STORE);
    
    const updatedItem = {
      ...itemData,
      userEmail: userEmail.toLowerCase(),
      updatedAt: new Date().toISOString()
    };
    
    await store.put(updatedItem);
    await tx.done;
    
    return updatedItem;
  } catch (error) {
    console.error('Error updating inventory item in IndexedDB:', error);
    throw error;
  }
};

export const deleteInventoryItem = async (itemId, userEmail) => {
  try {
    // Try Supabase first
    if (supabaseAvailable()) {
      return await deleteInventoryItemSupabase(itemId, userEmail);
    }
  } catch (error) {
    console.log('Supabase failed, falling back to IndexedDB:', error.message);
  }

  // Fallback to IndexedDB
  try {
    const db = await initDB();
    const tx = db.transaction(INVENTORY_STORE, 'readwrite');
    const store = tx.objectStore(INVENTORY_STORE);

    // First verify the item belongs to the user
    const item = await store.get(itemId);
    if (!item) {
      throw new Error('Item not found');
    }

    if (item.userEmail !== userEmail.toLowerCase()) {
      throw new Error('You do not have permission to delete this item');
    }

    await store.delete(itemId);
    await tx.done;

    console.log('Deleted inventory item from IndexedDB:', itemId);
    return true;
  } catch (error) {
    console.error('Error deleting inventory item from IndexedDB:', error);
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

// Platform admin specific functions
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

    return stats;
  } catch (error) {
    console.error('Error getting platform stats from IndexedDB:', error);
    return null;
  }
};

// Initialize database on module load
initDB().catch(console.error);