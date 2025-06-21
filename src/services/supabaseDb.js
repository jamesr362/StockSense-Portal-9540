// Supabase database functions with safe imports
let supabase = null;

// Initialize Supabase only if available
const initSupabase = async () => {
  try {
    const SUPABASE_URL = 'https://<PROJECT-ID>.supabase.co';
    const SUPABASE_ANON_KEY = '<ANON_KEY>';

    if (SUPABASE_URL !== 'https://<PROJECT-ID>.supabase.co' && SUPABASE_ANON_KEY !== '<ANON_KEY>') {
      const { createClient } = await import('@supabase/supabase-js');
      supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true
        }
      });
      return true;
    }
    return false;
  } catch (error) {
    console.warn('Supabase initialization failed:', error);
    return false;
  }
};

export const supabaseAvailable = () => {
  return supabase !== null;
};

// Initialize on first use
let initPromise = null;
const ensureSupabase = async () => {
  if (!initPromise) {
    initPromise = initSupabase();
  }
  return await initPromise;
};

// Users table operations
export const createUserSupabase = async (userData) => {
  await ensureSupabase();
  if (!supabaseAvailable()) {
    throw new Error('Supabase not available');
  }

  try {
    // Determine user role based on email
    let role = 'user';
    const email = userData.email.toLowerCase();
    
    if (email === 'platformadmin@trackio.com') {
      role = 'platformadmin';
    } else if (email.endsWith('@admin')) {
      role = 'admin';
    }

    const { data, error } = await supabase
      .from('users_tb2k4x9p1m')
      .insert([
        {
          email: email,
          password: userData.password,
          business_name: userData.businessName,
          role: role,
          created_at: new Date().toISOString(),
          last_login: null
        }
      ])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error('An account with this email already exists');
      }
      throw error;
    }

    return {
      email: data.email,
      businessName: data.business_name,
      role: data.role,
      createdAt: data.created_at,
      lastLogin: data.last_login
    };
  } catch (error) {
    console.error('Error creating user in Supabase:', error);
    throw error;
  }
};

export const getUserByEmailSupabase = async (email) => {
  await ensureSupabase();
  if (!supabaseAvailable()) {
    throw new Error('Supabase not available');
  }

  try {
    const { data, error } = await supabase
      .from('users_tb2k4x9p1m')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return {
      email: data.email,
      password: data.password,
      businessName: data.business_name,
      role: data.role,
      createdAt: data.created_at,
      lastLogin: data.last_login
    };
  } catch (error) {
    console.error('Error getting user from Supabase:', error);
    throw error;
  }
};

export const getAllUsersSupabase = async () => {
  await ensureSupabase();
  if (!supabaseAvailable()) {
    throw new Error('Supabase not available');
  }

  try {
    const { data, error } = await supabase
      .from('users_tb2k4x9p1m')
      .select('email, business_name, role, created_at, last_login')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map(user => ({
      email: user.email,
      businessName: user.business_name,
      role: user.role,
      createdAt: user.created_at,
      lastLogin: user.last_login
    }));
  } catch (error) {
    console.error('Error getting all users from Supabase:', error);
    throw error;
  }
};

export const deleteUserSupabase = async (email) => {
  await ensureSupabase();
  if (!supabaseAvailable()) {
    throw new Error('Supabase not available');
  }

  if (email.toLowerCase() === 'platformadmin@trackio.com') {
    throw new Error('Platform admin account cannot be deleted');
  }

  try {
    const { error: inventoryError } = await supabase
      .from('inventory_tb2k4x9p1m')
      .delete()
      .eq('user_email', email.toLowerCase());

    if (inventoryError) throw inventoryError;

    const { error: userError } = await supabase
      .from('users_tb2k4x9p1m')
      .delete()
      .eq('email', email.toLowerCase());

    if (userError) throw userError;

    return true;
  } catch (error) {
    console.error('Error deleting user from Supabase:', error);
    throw error;
  }
};

export const updateUserRoleSupabase = async (email, newRole) => {
  await ensureSupabase();
  if (!supabaseAvailable()) {
    throw new Error('Supabase not available');
  }

  if (email.toLowerCase() === 'platformadmin@trackio.com') {
    throw new Error('Platform admin role cannot be changed');
  }

  if (newRole === 'admin' && !email.toLowerCase().endsWith('@admin')) {
    throw new Error('Only users with @admin email addresses can be granted administrator privileges');
  }

  if (newRole === 'platformadmin') {
    throw new Error('Platform admin role cannot be assigned');
  }

  try {
    const { data, error } = await supabase
      .from('users_tb2k4x9p1m')
      .update({ 
        role: newRole,
        updated_at: new Date().toISOString()
      })
      .eq('email', email.toLowerCase())
      .select()
      .single();

    if (error) throw error;

    return {
      email: data.email,
      businessName: data.business_name,
      role: data.role,
      createdAt: data.created_at,
      lastLogin: data.last_login
    };
  } catch (error) {
    console.error('Error updating user role in Supabase:', error);
    throw error;
  }
};

export const updateUserLastLoginSupabase = async (email) => {
  await ensureSupabase();
  if (!supabaseAvailable()) {
    return;
  }

  try {
    const { error } = await supabase
      .from('users_tb2k4x9p1m')
      .update({ last_login: new Date().toISOString() })
      .eq('email', email.toLowerCase());

    if (error) throw error;
  } catch (error) {
    console.error('Error updating last login in Supabase:', error);
  }
};

// Inventory table operations
export const getInventoryItemsSupabase = async (userEmail) => {
  await ensureSupabase();
  if (!supabaseAvailable()) {
    throw new Error('Supabase not available');
  }

  try {
    const { data, error } = await supabase
      .from('inventory_tb2k4x9p1m')
      .select('*')
      .eq('user_email', userEmail.toLowerCase())
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map(item => ({
      id: item.id,
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      description: item.description,
      unitPrice: item.unit_price,
      status: item.status,
      dateAdded: item.date_added,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }));
  } catch (error) {
    console.error('Error getting inventory items from Supabase:', error);
    throw error;
  }
};

export const addInventoryItemSupabase = async (itemData, userEmail) => {
  await ensureSupabase();
  if (!supabaseAvailable()) {
    throw new Error('Supabase not available');
  }

  try {
    const { data, error } = await supabase
      .from('inventory_tb2k4x9p1m')
      .insert([
        {
          name: itemData.name,
          category: itemData.category,
          quantity: itemData.quantity,
          description: itemData.description,
          unit_price: itemData.unitPrice,
          status: itemData.status,
          date_added: itemData.dateAdded,
          user_email: userEmail.toLowerCase(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      name: data.name,
      category: data.category,
      quantity: data.quantity,
      description: data.description,
      unitPrice: data.unit_price,
      status: data.status,
      dateAdded: data.date_added,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  } catch (error) {
    console.error('Error adding inventory item to Supabase:', error);
    throw error;
  }
};

export const updateInventoryItemSupabase = async (itemData, userEmail) => {
  await ensureSupabase();
  if (!supabaseAvailable()) {
    throw new Error('Supabase not available');
  }

  try {
    const { data, error } = await supabase
      .from('inventory_tb2k4x9p1m')
      .update({
        name: itemData.name,
        category: itemData.category,
        quantity: itemData.quantity,
        description: itemData.description,
        unit_price: itemData.unitPrice,
        status: itemData.status,
        date_added: itemData.dateAdded,
        updated_at: new Date().toISOString()
      })
      .eq('id', itemData.id)
      .eq('user_email', userEmail.toLowerCase())
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      name: data.name,
      category: data.category,
      quantity: data.quantity,
      description: data.description,
      unitPrice: data.unit_price,
      status: data.status,
      dateAdded: data.date_added,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  } catch (error) {
    console.error('Error updating inventory item in Supabase:', error);
    throw error;
  }
};

export const deleteInventoryItemSupabase = async (itemId, userEmail) => {
  await ensureSupabase();
  if (!supabaseAvailable()) {
    throw new Error('Supabase not available');
  }

  try {
    const { error } = await supabase
      .from('inventory_tb2k4x9p1m')
      .delete()
      .eq('id', itemId)
      .eq('user_email', userEmail.toLowerCase());

    if (error) throw error;

    return true;
  } catch (error) {
    console.error('Error deleting inventory item from Supabase:', error);
    throw error;
  }
};

export const searchInventoryItemsSupabase = async (searchTerm, userEmail) => {
  await ensureSupabase();
  if (!supabaseAvailable()) {
    throw new Error('Supabase not available');
  }

  try {
    let query = supabase
      .from('inventory_tb2k4x9p1m')
      .select('*')
      .eq('user_email', userEmail.toLowerCase());

    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      query = query.or(`name.ilike.%${lowerSearchTerm}%,category.ilike.%${lowerSearchTerm}%,description.ilike.%${lowerSearchTerm}%`);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    return data.map(item => ({
      id: item.id,
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      description: item.description,
      unitPrice: item.unit_price,
      status: item.status,
      dateAdded: item.date_added,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }));
  } catch (error) {
    console.error('Error searching inventory items in Supabase:', error);
    throw error;
  }
};

export const getPlatformStatsSupabase = async () => {
  await ensureSupabase();
  if (!supabaseAvailable()) {
    throw new Error('Supabase not available');
  }

  try {
    const { data: users, error: usersError } = await supabase
      .from('users_tb2k4x9p1m')
      .select('email, business_name, role, created_at, last_login');

    if (usersError) throw usersError;

    const { data: inventoryItems, error: inventoryError } = await supabase
      .from('inventory_tb2k4x9p1m')
      .select('id');

    if (inventoryError) throw inventoryError;

    const stats = {
      totalUsers: users.length,
      totalAdmins: users.filter(u => u.role === 'admin').length,
      totalRegularUsers: users.filter(u => u.role === 'user').length,
      totalPlatformAdmins: users.filter(u => u.role === 'platformadmin').length,
      totalInventoryItems: inventoryItems.length,
      recentUsers: users
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 5)
        .map(user => ({
          email: user.email,
          businessName: user.business_name,
          role: user.role,
          createdAt: user.created_at
        }))
    };

    return stats;
  } catch (error) {
    console.error('Error getting platform stats from Supabase:', error);
    throw error;
  }
};