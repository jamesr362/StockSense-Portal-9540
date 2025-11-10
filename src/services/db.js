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
import { secureLog } from '../utils/secureLogging';

const DB_NAME = 'trackio_db';
const DB_VERSION = 2;
const USERS_STORE = 'users';
const PURCHASES_STORE = 'purchases';

let dbInstance = null;

async function initDB() {
  if (dbInstance) return dbInstance;

  try {
    dbInstance = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        secureLog.info(`Upgrading database from version ${oldVersion} to ${newVersion}`);
        
        if (!db.objectStoreNames.contains(USERS_STORE)) {
          const userStore = db.createObjectStore(USERS_STORE, { keyPath: 'email' });
          userStore.createIndex('role', 'role');
          userStore.createIndex('createdAt', 'createdAt');
          secureLog.info('Created users store');
        }

        if (!db.objectStoreNames.contains(PURCHASES_STORE)) {
          const purchasesStore = db.createObjectStore(PURCHASES_STORE, { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          purchasesStore.createIndex('userEmail', 'userEmail');
          secureLog.info('Created purchases store');
        }

        if (db.objectStoreNames.contains('inventory')) {
          secureLog.info('Migrating from old inventory store to purchases store...');
        }
      },
      blocked() {
        secureLog.warn('Database upgrade blocked');
      },
      blocking() {
        secureLog.warn('Database blocking');
      }
    });

    secureLog.info('Database initialized successfully');
    await createDefaultPlatformAdmin();
    return dbInstance;
  } catch (error) {
    secureLog.error('Error initializing database:', error);
    throw error;
  }
}

const createDefaultPlatformAdmin = async () => {
  try {
    const platformAdminEmail = 'platformadmin@trackio.com';
    
    if (supabaseAvailable()) {
      try {
        const existingAdmin = await getUserByEmailSupabase(platformAdminEmail);
        
        if (!existingAdmin) {
          await createUserSupabase({
            email: platformAdminEmail,
            password: 'admin123',
            businessName: 'Trackio Platform'
          });
          secureLog.info('Created default platform admin account in Supabase');
        } else {
          secureLog.info('Platform admin already exists in Supabase');
          const { supabase } = await import('../lib/supabase');
          if (supabase) {
            try {
              const { error: updateError } = await supabase
                .from('users_tb2k4x9p1m')
                .update({
                  password: 'admin123',
                  business_name: 'Trackio Platform',
                  role: 'platformadmin'
                })
                .eq('email', platformAdminEmail);

              if (!updateError) {
                secureLog.info('Updated platform admin credentials');
              }
            } catch (updateErr) {
              secureLog.error('Could not update platform admin in Supabase:', updateErr);
            }
          }
        }
        return;
      } catch (error) {
        secureLog.info('Supabase not available, falling back to IndexedDB:', error.message);
      }
    }

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
      secureLog.info('Created default platform admin account in IndexedDB');
    } else {
      existingAdmin.password = 'admin123';
      existingAdmin.role = 'platformadmin';
      existingAdmin.businessName = 'Trackio Platform';
      await store.put(existingAdmin);
      secureLog.info('Updated existing platform admin account');
    }
    
    await tx.done;
  } catch (error) {
    secureLog.error('Error creating default platform admin:', error);
  }
};

export const getAllUsers = async () => {
  try {
    if (supabaseAvailable()) {
      const users = await getAllUsersSupabase();
      secureLog.debug('Retrieved users from Supabase:', users?.length, 'users found');
      return users;
    }
  } catch (error) {
    secureLog.info('Supabase failed, falling back to IndexedDB:', error.message);
  }

  try {
    const db = await initDB();
    
    if (!db.objectStoreNames.contains(USERS_STORE)) {
      secureLog.info('Users store does not exist');
      return [];
    }
    
    const tx = db.transaction(USERS_STORE, 'readonly');
    const store = tx.objectStore(USERS_STORE);
    const users = await store.getAll();
    await tx.done;
    
    secureLog.debug('Retrieved users from IndexedDB:', users?.length, 'users found');
    return users || [];
  } catch (error) {
    secureLog.error('Error getting all users from IndexedDB:', error);
    return [];
  }
};

export const getUserByEmail = async (email) => {
  try {
    if (supabaseAvailable()) {
      const user = await getUserByEmailSupabase(email);
      return user;
    }
  } catch (error) {
    secureLog.info('Supabase failed, falling back to IndexedDB:', error.message);
  }

  try {
    const db = await initDB();
    const tx = db.transaction(USERS_STORE, 'readonly');
    const store = tx.objectStore(USERS_STORE);
    const user = await store.get(email.toLowerCase());
    await tx.done;
    
    return user;
  } catch (error) {
    secureLog.error('Error getting user from IndexedDB:', error);
    return null;
  }
};

export const createUser = async (userData) => {
  if (!userData.email || !userData.password || !userData.businessName) {
    throw new Error('Missing required user data');
  }

  try {
    if (supabaseAvailable()) {
      const result = await createUserSupabase(userData);
      return result;
    }
  } catch (error) {
    secureLog.info('Supabase failed, falling back to IndexedDB:', error.message);
  }

  try {
    const db = await initDB();
    const tx = db.transaction(USERS_STORE, 'readwrite');
    const store = tx.objectStore(USERS_STORE);
    
    const email = userData.email.toLowerCase();
    
    const existingUser = await store.get(email);
    if (existingUser) {
      throw new Error('An account with this email already exists');
    }

    let role = 'user';
    if (email === 'platformadmin@trackio.com') {
      role = 'platformadmin';
    } else if (email.endsWith('@admin')) {
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

    await store.add(newUser);
    await tx.done;

    const { password, salt, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  } catch (error) {
    secureLog.error('Error creating user in IndexedDB:', error);
    throw error;
  }
};

export const deleteUser = async (email) => {
  try {
    if (supabaseAvailable()) {
      return await deleteUserSupabase(email);
    }
  } catch (error) {
    secureLog.info('Supabase failed, falling back to IndexedDB:', error.message);
  }

  try {
    if (email.toLowerCase() === 'platformadmin@trackio.com') {
      throw new Error('Platform admin account cannot be deleted');
    }

    const db = await initDB();
    
    const userTx = db.transaction(USERS_STORE, 'readwrite');
    const purchasesTx = db.transaction(PURCHASES_STORE, 'readwrite');
    
    const userStore = userTx.objectStore(USERS_STORE);
    const purchasesStore = purchasesTx.objectStore(PURCHASES_STORE);

    await userStore.delete(email.toLowerCase());

    const purchasesIndex = purchasesStore.index('userEmail');
    const userItems = await purchasesIndex.getAll(email.toLowerCase());
    
    for (const item of userItems) {
      await purchasesStore.delete(item.id);
    }

    await userTx.done;
    await purchasesTx.done;

    secureLog.info('Deleted user and all associated purchase data from IndexedDB');
    return true;
  } catch (error) {
    secureLog.error('Error deleting user from IndexedDB:', error);
    throw error;
  }
};

export const updateUserRole = async (email, newRole) => {
  try {
    if (supabaseAvailable()) {
      return await updateUserRoleSupabase(email, newRole);
    }
  } catch (error) {
    secureLog.info('Supabase failed, falling back to IndexedDB:', error.message);
  }

  try {
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

    if (newRole === 'admin' && !email.toLowerCase().endsWith('@admin')) {
      throw new Error('Only users with @admin email addresses can be granted administrator privileges');
    }

    if (newRole === 'platformadmin') {
      throw new Error('Platform admin role cannot be assigned');
    }

    user.role = newRole;
    user.updatedAt = new Date().toISOString();

    await store.put(user);
    await tx.done;

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  } catch (error) {
    secureLog.error('Error updating user role in IndexedDB:', error);
    throw error;
  }
};

export const updateUserLastLogin = async (email) => {
  try {
    if (supabaseAvailable()) {
      await updateUserLastLoginSupabase(email);
      return;
    }
  } catch (error) {
    secureLog.info('Supabase failed, falling back to IndexedDB:', error.message);
  }

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
    secureLog.error('Error updating last login in IndexedDB:', error);
  }
};

export const getPurchaseItems = async (userEmail) => {
  try {
    if (supabaseAvailable()) {
      const items = await getPurchaseItemsSupabase(userEmail);
      secureLog.debug('Got purchase items from Supabase:', items?.length);
      return items;
    }
  } catch (error) {
    secureLog.info('Supabase failed, falling back to IndexedDB:', error.message);
  }

  try {
    const db = await initDB();
    const tx = db.transaction(PURCHASES_STORE, 'readonly');
    const store = tx.objectStore(PURCHASES_STORE);
    const index = store.index('userEmail');
    const items = await index.getAll(userEmail.toLowerCase());
    await tx.done;
    
    secureLog.debug('Got purchase items from IndexedDB:', items?.length);
    return items;
  } catch (error) {
    secureLog.error('Error getting purchase items from IndexedDB:', error);
    return [];
  }
};

export const addPurchaseItem = async (itemData, userEmail) => {
  if (!itemData || !userEmail) {
    throw new Error('Missing required data for purchase item');
  }

  if (!itemData.name || !itemData.category || itemData.quantity === undefined || itemData.unitPrice === undefined) {
    throw new Error('Missing required fields: name, category, quantity, and unitPrice are required');
  }

  try {
    if (supabaseAvailable()) {
      const result = await addPurchaseItemSupabase(itemData, userEmail);
      secureLog.debug('Successfully added purchase item to Supabase');
      return result;
    }
  } catch (error) {
    secureLog.info('Supabase failed, falling back to IndexedDB:', error.message);
  }

  try {
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
      vatIncluded: itemData.vatIncluded || false,
      vatPercentage: parseFloat(itemData.vatPercentage) || 0
    };

    const id = await store.add(newItem);
    await tx.done;

    const result = { ...newItem, id };
    secureLog.debug('Successfully added purchase item to IndexedDB');
    return result;
  } catch (error) {
    secureLog.error('Error adding purchase item to IndexedDB:', error);
    throw error;
  }
};

export const updatePurchaseItem = async (itemData, userEmail) => {
  try {
    if (supabaseAvailable()) {
      return await updatePurchaseItemSupabase(itemData, userEmail);
    }
  } catch (error) {
    secureLog.info('Supabase failed, falling back to IndexedDB:', error.message);
  }

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
    secureLog.error('Error updating purchase item in IndexedDB:', error);
    throw error;
  }
};

export const deletePurchaseItem = async (itemId, userEmail) => {
  try {
    if (supabaseAvailable()) {
      return await deletePurchaseItemSupabase(itemId, userEmail);
    }
  } catch (error) {
    secureLog.info('Supabase failed, falling back to IndexedDB:', error.message);
  }

  try {
    const db = await initDB();
    const tx = db.transaction(PURCHASES_STORE, 'readwrite');
    const store = tx.objectStore(PURCHASES_STORE);

    const item = await store.get(itemId);
    if (!item) {
      throw new Error('Purchase item not found');
    }

    if (item.userEmail !== userEmail.toLowerCase()) {
      throw new Error('You do not have permission to delete this purchase item');
    }

    await store.delete(itemId);
    await tx.done;

    secureLog.debug('Deleted purchase item from IndexedDB');
    return true;
  } catch (error) {
    secureLog.error('Error deleting purchase item from IndexedDB:', error);
    throw error;
  }
};

export const searchPurchaseItems = async (searchTerm, userEmail) => {
  try {
    if (supabaseAvailable()) {
      return await searchPurchaseItemsSupabase(searchTerm, userEmail);
    }
  } catch (error) {
    secureLog.info('Supabase failed, falling back to IndexedDB:', error.message);
  }

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
    secureLog.error('Error searching purchase items in IndexedDB:', error);
    return [];
  }
};

export const getInventoryItems = getPurchaseItems;
export const addInventoryItem = addPurchaseItem;
export const updateInventoryItem = updatePurchaseItem;
export const deleteInventoryItem = deletePurchaseItem;
export const searchInventoryItems = searchPurchaseItems;

export const getPlatformStats = async () => {
  try {
    if (supabaseAvailable()) {
      return await getPlatformStatsSupabase();
    }
  } catch (error) {
    secureLog.info('Supabase failed, falling back to IndexedDB:', error.message);
  }

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
      totalPlatformAdmins: allUsers.filter(u => u.role === 'platformadmin').length,
      totalPurchaseItems: allPurchaseItems.length,
      recentUsers: allUsers
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5)
    };

    secureLog.debug('Platform stats generated from IndexedDB');
    return stats;
  } catch (error) {
    secureLog.error('Error getting platform stats from IndexedDB:', error);
    return null;
  }
};

initDB().catch(error => secureLog.error('Failed to initialize database:', error));