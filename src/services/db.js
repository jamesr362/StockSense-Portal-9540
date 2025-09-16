import {openDB} from 'idb';
import {supabaseAvailable,createUserSupabase,getUserByEmailSupabase,getAllUsersSupabase,deleteUserSupabase,updateUserRoleSupabase,updateUserLastLoginSupabase,getInventoryItemsSupabase,addInventoryItemSupabase,updateInventoryItemSupabase,deleteInventoryItemSupabase,searchInventoryItemsSupabase,getPlatformStatsSupabase} from './supabaseDb';

const DB_NAME='trackio_db';
const DB_VERSION=2;
const USERS_STORE='users';
const INVENTORY_STORE='inventory';

let dbInstance=null;

async function initDB() {
  if (dbInstance) return dbInstance;

  try {
    dbInstance=await openDB(DB_NAME,DB_VERSION,{
      upgrade(db,oldVersion,newVersion,transaction) {
        console.log(`Upgrading database from version ${oldVersion} to ${newVersion}`);

        // Create users store
        if (!db.objectStoreNames.contains(USERS_STORE)) {
          const userStore=db.createObjectStore(USERS_STORE,{keyPath: 'email'});
          userStore.createIndex('role','role');
          userStore.createIndex('createdAt','createdAt');
          console.log('Created users store');
        }

        // Create inventory store
        if (!db.objectStoreNames.contains(INVENTORY_STORE)) {
          const inventoryStore=db.createObjectStore(INVENTORY_STORE,{keyPath: 'id',autoIncrement: true});
          inventoryStore.createIndex('userEmail','userEmail');
          inventoryStore.createIndex('status','status');
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
    console.error('Error initializing database:',error);
    throw error;
  }
}

const createDefaultPlatformAdmin=async ()=> {
  try {
    const platformAdminEmail='platformadmin@trackio.com';
    
    console.log('Creating/checking platform admin account...');
    
    // Try Supabase first
    if (supabaseAvailable()) {
      try {
        console.log('Checking for platform admin in Supabase...');
        const existingAdmin=await getUserByEmailSupabase(platformAdminEmail);
        
        if (!existingAdmin) {
          console.log('Creating platform admin in Supabase...');
          await createUserSupabase({
            email: platformAdminEmail,
            password: 'admin123', // Plain text password for platform admin
            businessName: 'Trackio Platform'
          });
          console.log('✅ Created default platform admin account in Supabase');
        } else {
          console.log('✅ Platform admin already exists in Supabase');
        }
        return;
      } catch (error) {
        console.log('Supabase not available, falling back to IndexedDB:', error.message);
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
        password: 'admin123', // Plain text password for platform admin
        businessName: 'Trackio Platform',
        role: 'platformadmin',
        createdAt: new Date().toISOString(),
        lastLogin: null
      };
      
      await store.add(platformAdmin);
      console.log('✅ Created default platform admin account in IndexedDB');
    } else {
      // Update existing admin to ensure correct password and role
      existingAdmin.password = 'admin123';
      existingAdmin.role = 'platformadmin';
      existingAdmin.businessName = 'Trackio Platform';
      await store.put(existingAdmin);
      console.log('✅ Updated existing platform admin account');
    }
    
    await tx.done;
  } catch (error) {
    console.error('Error creating default platform admin:', error);
  }
};

// Hybrid functions that try Supabase first, then fallback to IndexedDB
export const getAllUsers=async ()=> {
  try {
    // Try Supabase first
    if (supabaseAvailable()) {
      const users=await getAllUsersSupabase();
      console.log('Retrieved users from Supabase:',users?.length,'users found');
      return users;
    }
  } catch (error) {
    console.log('Supabase failed, falling back to IndexedDB:',error.message);
  }

  // Fallback to IndexedDB
  try {
    console.log('Getting all users from IndexedDB...');
    const db=await initDB();
    
    if (!db.objectStoreNames.contains(USERS_STORE)) {
      console.log('Users store does not exist');
      return [];
    }
    
    const tx=db.transaction(USERS_STORE,'readonly');
    const store=tx.objectStore(USERS_STORE);
    const users=await store.getAll();
    await tx.done;
    
    console.log('Retrieved users from IndexedDB:',users?.length,'users found');
    return users || [];
  } catch (error) {
    console.error('Error getting all users from IndexedDB:',error);
    return [];
  }
};

export const getUserByEmail=async (email)=> {
  console.log('===getUserByEmail called===');
  console.log('Looking for email:',email);
  
  try {
    // Try Supabase first
    if (supabaseAvailable()) {
      console.log('Trying Supabase...');
      const user=await getUserByEmailSupabase(email);
      console.log('Supabase result:',user ? 'USER FOUND' : 'USER NOT FOUND');
      
      if (user) {
        console.log('Supabase user data:',{
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
    console.log('Supabase failed, falling back to IndexedDB:',error.message);
  }

  // Fallback to IndexedDB
  try {
    console.log('Trying IndexedDB...');
    const db=await initDB();
    const tx=db.transaction(USERS_STORE,'readonly');
    const store=tx.objectStore(USERS_STORE);
    const user=await store.get(email.toLowerCase());
    await tx.done;
    
    console.log('IndexedDB result:',user ? 'USER FOUND' : 'USER NOT FOUND');
    
    if (user) {
      console.log('IndexedDB user data:',{
        email: user.email,
        businessName: user.businessName,
        role: user.role,
        hasPassword: !!user.password,
        hasSalt: !!user.salt
      });
    }
    
    return user;
  } catch (error) {
    console.error('Error getting user from IndexedDB:',error);
    return null;
  }
};

export const createUser=async (userData)=> {
  if (!userData.email || !userData.password || !userData.businessName) {
    throw new Error('Missing required user data');
  }

  console.log('===DB Service: Creating user===');
  console.log('User data:',{...userData,password: '[HIDDEN]'});

  try {
    // Try Supabase first
    if (supabaseAvailable()) {
      console.log('Using Supabase for user creation');
      const result=await createUserSupabase(userData);
      console.log('Supabase user creation successful:',{...result});
      return result;
    }
  } catch (error) {
    console.log('Supabase failed, falling back to IndexedDB:',error.message);
  }

  // Fallback to IndexedDB
  try {
    console.log('Using IndexedDB for user creation');
    const db=await initDB();
    const tx=db.transaction(USERS_STORE,'readwrite');
    const store=tx.objectStore(USERS_STORE);
    
    const email=userData.email.toLowerCase();
    
    // Check if email already exists
    const existingUser=await store.get(email);
    if (existingUser) {
      throw new Error('An account with this email already exists');
    }

    // Determine user role based on email
    let role='user';
    if (email==='platformadmin@trackio.com') {
      role='platformadmin';
    } else if (email.endsWith('@admin')) {
      role='admin';
    }

    const newUser={
      email,
      password: userData.password,
      salt: userData.salt,
      businessName: userData.businessName,
      role: role,
      createdAt: new Date().toISOString(),
      lastLogin: null
    };

    console.log('Creating user in IndexedDB:',{...newUser,password: '[HIDDEN]'});
    
    await store.add(newUser);
    await tx.done;

    // Return user data without password
    const {password,salt,...userWithoutPassword}=newUser;
    console.log('IndexedDB user creation successful:',userWithoutPassword);
    return userWithoutPassword;
  } catch (error) {
    console.error('Error creating user in IndexedDB:',error);
    throw error;
  }
};

export const deleteUser=async (email)=> {
  try {
    // Try Supabase first
    if (supabaseAvailable()) {
      return await deleteUserSupabase(email);
    }
  } catch (error) {
    console.log('Supabase failed, falling back to IndexedDB:',error.message);
  }

  // Fallback to IndexedDB
  try {
    // Prevent deletion of platform admin
    if (email.toLowerCase()==='platformadmin@trackio.com') {
      throw new Error('Platform admin account cannot be deleted');
    }

    const db=await initDB();
    
    // Start transactions for both stores
    const userTx=db.transaction(USERS_STORE,'readwrite');
    const inventoryTx=db.transaction(INVENTORY_STORE,'readwrite');
    
    const userStore=userTx.objectStore(USERS_STORE);
    const inventoryStore=inventoryTx.objectStore(INVENTORY_STORE);

    // Delete user from users store
    await userStore.delete(email.toLowerCase());

    // Delete all inventory items for this user
    const inventoryIndex=inventoryStore.index('userEmail');
    const userItems=await inventoryIndex.getAll(email.toLowerCase());

    // Delete each inventory item
    for (const item of userItems) {
      await inventoryStore.delete(item.id);
    }

    // Wait for both transactions to complete
    await userTx.done;
    await inventoryTx.done;

    console.log('Deleted user and all associated data from IndexedDB:',email);
    return true;
  } catch (error) {
    console.error('Error deleting user from IndexedDB:',error);
    throw error;
  }
};

export const updateUserRole=async (email,newRole)=> {
  try {
    // Try Supabase first
    if (supabaseAvailable()) {
      return await updateUserRoleSupabase(email,newRole);
    }
  } catch (error) {
    console.log('Supabase failed, falling back to IndexedDB:',error.message);
  }

  // Fallback to IndexedDB
  try {
    // Prevent role changes for platform admin
    if (email.toLowerCase()==='platformadmin@trackio.com') {
      throw new Error('Platform admin role cannot be changed');
    }

    const db=await initDB();
    const tx=db.transaction(USERS_STORE,'readwrite');
    const store=tx.objectStore(USERS_STORE);
    
    const user=await store.get(email.toLowerCase());
    if (!user) {
      throw new Error('User not found');
    }

    // STRICT ADMIN CONTROL - Only @admin emails can be admins
    if (newRole==='admin' && !email.toLowerCase().endsWith('@admin')) {
      throw new Error('Only users with @admin email addresses can be granted administrator privileges');
    }

    // Prevent setting platformadmin role
    if (newRole==='platformadmin') {
      throw new Error('Platform admin role cannot be assigned');
    }

    user.role=newRole;
    user.updatedAt=new Date().toISOString();
    
    await store.put(user);
    await tx.done;

    console.log('Updated user role in IndexedDB:',email,newRole);
    
    const {password,...userWithoutPassword}=user;
    return userWithoutPassword;
  } catch (error) {
    console.error('Error updating user role in IndexedDB:',error);
    throw error;
  }
};

export const updateUserLastLogin=async (email)=> {
  try {
    // Try Supabase first
    if (supabaseAvailable()) {
      await updateUserLastLoginSupabase(email);
      return;
    }
  } catch (error) {
    console.log('Supabase failed, falling back to IndexedDB:',error.message);
  }

  // Fallback to IndexedDB
  try {
    const db=await initDB();
    const tx=db.transaction(USERS_STORE,'readwrite');
    const store=tx.objectStore(USERS_STORE);
    
    const user=await store.get(email.toLowerCase());
    if (user) {
      user.lastLogin=new Date().toISOString();
      await store.put(user);
    }
    
    await tx.done;
  } catch (error) {
    console.error('Error updating last login in IndexedDB:',error);
  }
};

export const getInventoryItems=async (userEmail)=> {
  try {
    // Try Supabase first
    if (supabaseAvailable()) {
      const items=await getInventoryItemsSupabase(userEmail);
      console.log('Got inventory items from Supabase:',items?.length);
      return items;
    }
  } catch (error) {
    console.log('Supabase failed, falling back to IndexedDB:',error.message);
  }

  // Fallback to IndexedDB
  try {
    const db=await initDB();
    const tx=db.transaction(INVENTORY_STORE,'readonly');
    const store=tx.objectStore(INVENTORY_STORE);
    const index=store.index('userEmail');
    const items=await index.getAll(userEmail.toLowerCase());
    await tx.done;
    
    console.log('Got inventory items from IndexedDB:',items?.length);
    return items;
  } catch (error) {
    console.error('Error getting inventory items from IndexedDB:',error);
    return [];
  }
};

export const addInventoryItem=async (itemData,userEmail)=> {
  console.log('===addInventoryItem called===');
  console.log('itemData:',itemData);
  console.log('userEmail:',userEmail);

  if (!itemData || !userEmail) {
    throw new Error('Missing required data for inventory item');
  }

  // Validate required fields
  if (!itemData.name || !itemData.category || itemData.quantity===undefined || itemData.unitPrice===undefined) {
    throw new Error('Missing required fields: name, category, quantity, and unitPrice are required');
  }

  try {
    // Try Supabase first
    if (supabaseAvailable()) {
      console.log('Attempting to add item to Supabase...');
      const result=await addInventoryItemSupabase(itemData,userEmail);
      console.log('Successfully added item to Supabase:',result);
      return result;
    }
  } catch (error) {
    console.log('Supabase failed, falling back to IndexedDB:',error.message);
  }

  // Fallback to IndexedDB
  try {
    console.log('Adding item to IndexedDB...');
    const db=await initDB();
    const tx=db.transaction(INVENTORY_STORE,'readwrite');
    const store=tx.objectStore(INVENTORY_STORE);

    const newItem={
      name: itemData.name,
      category: itemData.category,
      quantity: parseInt(itemData.quantity),
      unitPrice: parseFloat(itemData.unitPrice),
      description: itemData.description || '',
      status: itemData.status || 'In Stock',
      dateAdded: itemData.dateAdded || new Date().toISOString().split('T')[0],
      userEmail: userEmail.toLowerCase(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    console.log('Adding item to IndexedDB:',newItem);
    
    const id=await store.add(newItem);
    await tx.done;

    const result={...newItem,id};
    console.log('Successfully added item to IndexedDB:',result);
    return result;
  } catch (error) {
    console.error('Error adding inventory item to IndexedDB:',error);
    throw error;
  }
};

export const updateInventoryItem=async (itemData,userEmail)=> {
  try {
    // Try Supabase first
    if (supabaseAvailable()) {
      return await updateInventoryItemSupabase(itemData,userEmail);
    }
  } catch (error) {
    console.log('Supabase failed, falling back to IndexedDB:',error.message);
  }

  // Fallback to IndexedDB
  try {
    const db=await initDB();
    const tx=db.transaction(INVENTORY_STORE,'readwrite');
    const store=tx.objectStore(INVENTORY_STORE);

    const updatedItem={
      ...itemData,
      userEmail: userEmail.toLowerCase(),
      updatedAt: new Date().toISOString()
    };

    await store.put(updatedItem);
    await tx.done;

    return updatedItem;
  } catch (error) {
    console.error('Error updating inventory item in IndexedDB:',error);
    throw error;
  }
};

export const deleteInventoryItem=async (itemId,userEmail)=> {
  try {
    // Try Supabase first
    if (supabaseAvailable()) {
      return await deleteInventoryItemSupabase(itemId,userEmail);
    }
  } catch (error) {
    console.log('Supabase failed, falling back to IndexedDB:',error.message);
  }

  // Fallback to IndexedDB
  try {
    const db=await initDB();
    const tx=db.transaction(INVENTORY_STORE,'readwrite');
    const store=tx.objectStore(INVENTORY_STORE);

    // First verify the item belongs to the user
    const item=await store.get(itemId);
    if (!item) {
      throw new Error('Item not found');
    }

    if (item.userEmail !== userEmail.toLowerCase()) {
      throw new Error('You do not have permission to delete this item');
    }

    await store.delete(itemId);
    await tx.done;

    console.log('Deleted inventory item from IndexedDB:',itemId);
    return true;
  } catch (error) {
    console.error('Error deleting inventory item from IndexedDB:',error);
    throw error;
  }
};

export const searchInventoryItems=async (searchTerm,userEmail)=> {
  try {
    // Try Supabase first
    if (supabaseAvailable()) {
      return await searchInventoryItemsSupabase(searchTerm,userEmail);
    }
  } catch (error) {
    console.log('Supabase failed, falling back to IndexedDB:',error.message);
  }

  // Fallback to IndexedDB
  try {
    const items=await getInventoryItems(userEmail);
    
    if (!searchTerm) return items;

    const lowerSearchTerm=searchTerm.toLowerCase();
    return items.filter(item=>
      item.name.toLowerCase().includes(lowerSearchTerm) ||
      item.category.toLowerCase().includes(lowerSearchTerm) ||
      item.description?.toLowerCase().includes(lowerSearchTerm)
    );
  } catch (error) {
    console.error('Error searching inventory items in IndexedDB:',error);
    return [];
  }
};

// Platform admin specific functions
export const getPlatformStats=async ()=> {
  try {
    // Try Supabase first
    if (supabaseAvailable()) {
      return await getPlatformStatsSupabase();
    }
  } catch (error) {
    console.log('Supabase failed, falling back to IndexedDB:',error.message);
  }

  // Fallback to IndexedDB
  try {
    const db=await initDB();
    
    const userTx=db.transaction(USERS_STORE,'readonly');
    const inventoryTx=db.transaction(INVENTORY_STORE,'readonly');
    
    const userStore=userTx.objectStore(USERS_STORE);
    const inventoryStore=inventoryTx.objectStore(INVENTORY_STORE);

    const allUsers=await userStore.getAll();
    const allInventoryItems=await inventoryStore.getAll();

    await userTx.done;
    await inventoryTx.done;

    const stats={
      totalUsers: allUsers.length,
      totalAdmins: allUsers.filter(u=> u.role==='admin').length,
      totalRegularUsers: allUsers.filter(u=> u.role==='user').length,
      totalPlatformAdmins: allUsers.filter(u=> u.role==='platformadmin').length,
      totalInventoryItems: allInventoryItems.length,
      recentUsers: allUsers
        .sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0,5)
    };

    console.log('Platform stats generated from IndexedDB:',{
      totalUsers: stats.totalUsers,
      recentUsersCount: stats.recentUsers.length
    });

    return stats;
  } catch (error) {
    console.error('Error getting platform stats from IndexedDB:',error);
    return null;
  }
};

// Initialize database on module load
initDB().catch(console.error);