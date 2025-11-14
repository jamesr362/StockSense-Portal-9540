// Supabase database functions with safe imports
import {supabase} from '../lib/supabase';

export const supabaseAvailable = () => {
  return supabase !== null;
};

// Users table operations
export const createUserSupabase = async (userData) => {
  if (!supabaseAvailable()) {
    throw new Error('Supabase not available');
  }

  try {
    console.log('===Creating user in Supabase===');
    console.log('User data:', {...userData, password: '[HIDDEN]'});

    // Determine user role based on email
    const role = determineUserRole(userData.email);
    console.log('Determined role:', role);

    // First, create the user record in our custom table
    const userRecord = {
      email: userData.email.toLowerCase(),
      password: userData.password, // This should be the hashed password
      salt: userData.salt,
      business_name: userData.businessName,
      role: role,
      created_at: new Date().toISOString(),
      last_login: null
    };

    console.log('Inserting user record:', {...userRecord, password: '[HIDDEN]', salt: '[HIDDEN]'});

    const {data, error} = await supabase
      .from('users_tb2k4x9p1m')
      .insert([userRecord])
      .select()
      .single();

    if (error) {
      console.error('Error inserting user:', error);
      if (error.code === '23505') {
        throw new Error('An account with this email already exists');
      }
      throw error;
    }

    console.log('User created successfully:', {...data, password: '[HIDDEN]', salt: '[HIDDEN]'});

    // Create a default FREE subscription for new users
    await createDefaultSubscription(userData.email.toLowerCase());

    // Then try to register with Supabase Auth (optional - don't fail if this doesn't work)
    try {
      const {data: authData, error: authError} = await supabase.auth.signUp({
        email: userData.email.toLowerCase(),
        password: userData.password, // Use the original password for Auth
        options: {
          data: {
            business_name: userData.businessName,
            role: role
          },
          emailRedirectTo: undefined // Disable email confirmation
        }
      });

      if (authError) {
        console.log('Supabase Auth registration failed (non-critical):', authError.message);
        // Don't throw error - we already created the user in our custom table
      } else {
        console.log('Supabase Auth registration successful');
      }
    } catch (authErr) {
      console.log('Error during Supabase Auth registration (non-critical):', authErr);
      // Continue - we already created the user in our DB
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

// Determine user role based on email
function determineUserRole(email) {
  const lowerEmail = email.toLowerCase();
  if (lowerEmail === 'platformadmin@trackio.com') {
    return 'platformadmin';
  } else if (lowerEmail.endsWith('@admin')) {
    return 'admin';
  }
  return 'user';
}

// FIXED: Create a default FREE subscription for new users
export const createDefaultSubscription = async (userEmail) => {
  if (!supabaseAvailable()) {
    return;
  }

  try {
    console.log('Creating default FREE subscription for:', userEmail);

    const subscriptionData = {
      user_email: userEmail,
      stripe_customer_id: null, // No Stripe customer for free plan
      stripe_subscription_id: null, // No Stripe subscription for free plan
      stripe_session_id: null, // No session for default subscription
      plan_id: 'free', // CORRECT: Use 'free' not 'price_free'
      stripe_price_id: null, // No Stripe price for free plan
      status: 'active',
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 365*24*60*60*1000).toISOString(), // 1 year for free plan
      cancel_at_period_end: false,
      canceled_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('💾 Creating default FREE subscription:', {
      userEmail: subscriptionData.user_email,
      planId: subscriptionData.plan_id,
      status: subscriptionData.status
    });

    const {error} = await supabase
      .from('subscriptions_tb2k4x9p1m')
      .insert([subscriptionData]);

    if (error) {
      console.error('Error creating default subscription:', error);
    } else {
      console.log('✅ Default FREE subscription created successfully');
    }
  } catch (error) {
    console.error('Error creating default subscription:', error);
  }
};

export const getUserByEmailSupabase = async (email) => {
  if (!supabaseAvailable()) {
    throw new Error('Supabase not available');
  }

  try {
    // Get the user from our custom table
    const {data, error} = await supabase
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
      salt: data.salt,
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
  if (!supabaseAvailable()) {
    throw new Error('Supabase not available');
  }

  try {
    console.log('Getting all users from Supabase...');

    const {data, error} = await supabase
      .from('users_tb2k4x9p1m')
      .select('email, business_name, role, created_at, last_login')
      .order('created_at', {ascending: false});

    if (error) {
      console.error('Supabase query error:', error);
      throw error;
    }

    console.log('Retrieved users from Supabase:', data?.length, 'users');
    console.log('Raw user data:', data);

    if (!data || data.length === 0) {
      console.log('No users found in Supabase - this might be the issue');
      return [];
    }

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
  if (!supabaseAvailable()) {
    throw new Error('Supabase not available');
  }

  if (email.toLowerCase() === 'platformadmin@trackio.com') {
    throw new Error('Platform admin account cannot be deleted');
  }

  try {
    console.log('Deleting user from Supabase:', email);

    // Delete subscriptions first
    const {error: subscriptionError} = await supabase
      .from('subscriptions_tb2k4x9p1m')
      .delete()
      .eq('user_email', email.toLowerCase());

    if (subscriptionError) throw subscriptionError;

    // Delete purchase items (previously inventory items)
    const {error: purchaseError} = await supabase
      .from('inventory_tb2k4x9p1m') // Table name stays the same for database compatibility
      .delete()
      .eq('user_email', email.toLowerCase());

    if (purchaseError) throw purchaseError;

    // Delete user from our custom table
    const {error: userError} = await supabase
      .from('users_tb2k4x9p1m')
      .delete()
      .eq('email', email.toLowerCase());

    if (userError) throw userError;

    console.log('User deleted successfully from database');
    return true;

  } catch (error) {
    console.error('Error deleting user from Supabase:', error);
    throw error;
  }
};

export const updateUserRoleSupabase = async (email, newRole) => {
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
    console.log('Updating user role in Supabase:', email, newRole);

    const {data, error} = await supabase
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
  if (!supabaseAvailable()) {
    return;
  }

  try {
    const {error} = await supabase
      .from('users_tb2k4x9p1m')
      .update({
        last_login: new Date().toISOString()
      })
      .eq('email', email.toLowerCase());

    if (error) throw error;

  } catch (error) {
    console.error('Error updating last login in Supabase:', error);
  }
};

// Purchase tracking operations (renamed from inventory operations)
export const getPurchaseItemsSupabase = async (userEmail) => {
  if (!supabaseAvailable()) {
    throw new Error('Supabase not available');
  }

  try {
    const {data, error} = await supabase
      .from('inventory_tb2k4x9p1m') // Table name stays the same for database compatibility
      .select('*')
      .eq('user_email', userEmail.toLowerCase())
      .order('created_at', {ascending: false});

    if (error) throw error;

    return data.map(item => ({
      id: item.id,
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      description: item.description,
      unitPrice: item.unit_price,
      dateAdded: item.date_added,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      vatIncluded: item.vat_included || false,
      vatPercentage: item.vat_percentage || 20.00,
      vatAmount: item.vat_amount || 0.00,
      priceExcludingVat: item.price_excluding_vat || item.unit_price
    }));

  } catch (error) {
    console.error('Error getting purchase items from Supabase:', error);
    throw error;
  }
};

export const addPurchaseItemSupabase = async (itemData, userEmail) => {
  if (!supabaseAvailable()) {
    throw new Error('Supabase not available');
  }

  try {
    const {data, error} = await supabase
      .from('inventory_tb2k4x9p1m') // Table name stays the same for database compatibility
      .insert([
        {
          name: itemData.name,
          category: itemData.category,
          quantity: itemData.quantity,
          description: itemData.description,
          unit_price: itemData.unitPrice,
          date_added: itemData.dateAdded,
          user_email: userEmail.toLowerCase(),
          vat_included: itemData.vatIncluded || false,
          vat_percentage: itemData.vatPercentage || 20.00,
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
      dateAdded: data.date_added,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      vatIncluded: data.vat_included,
      vatPercentage: data.vat_percentage,
      vatAmount: data.vat_amount,
      priceExcludingVat: data.price_excluding_vat
    };

  } catch (error) {
    console.error('Error adding purchase item to Supabase:', error);
    throw error;
  }
};

export const updatePurchaseItemSupabase = async (itemData, userEmail) => {
  if (!supabaseAvailable()) {
    throw new Error('Supabase not available');
  }

  try {
    const {data, error} = await supabase
      .from('inventory_tb2k4x9p1m') // Table name stays the same for database compatibility
      .update({
        name: itemData.name,
        category: itemData.category,
        quantity: itemData.quantity,
        description: itemData.description,
        unit_price: itemData.unitPrice,
        date_added: itemData.dateAdded,
        vat_included: itemData.vatIncluded || false,
        vat_percentage: itemData.vatPercentage || 20.00,
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
      dateAdded: data.date_added,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      vatIncluded: data.vat_included,
      vatPercentage: data.vat_percentage,
      vatAmount: data.vat_amount,
      priceExcludingVat: data.price_excluding_vat
    };

  } catch (error) {
    console.error('Error updating purchase item in Supabase:', error);
    throw error;
  }
};

export const deletePurchaseItemSupabase = async (itemId, userEmail) => {
  if (!supabaseAvailable()) {
    throw new Error('Supabase not available');
  }

  try {
    const {error} = await supabase
      .from('inventory_tb2k4x9p1m') // Table name stays the same for database compatibility
      .delete()
      .eq('id', itemId)
      .eq('user_email', userEmail.toLowerCase());

    if (error) throw error;

    return true;

  } catch (error) {
    console.error('Error deleting purchase item from Supabase:', error);
    throw error;
  }
};

export const searchPurchaseItemsSupabase = async (searchTerm, userEmail) => {
  if (!supabaseAvailable()) {
    throw new Error('Supabase not available');
  }

  try {
    let query = supabase
      .from('inventory_tb2k4x9p1m') // Table name stays the same for database compatibility
      .select('*')
      .eq('user_email', userEmail.toLowerCase());

    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      query = query.or(`name.ilike.%${lowerSearchTerm}%,category.ilike.%${lowerSearchTerm}%,description.ilike.%${lowerSearchTerm}%`);
    }

    const {data, error} = await query.order('created_at', {ascending: false});

    if (error) throw error;

    return data.map(item => ({
      id: item.id,
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      description: item.description,
      unitPrice: item.unit_price,
      dateAdded: item.date_added,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      vatIncluded: item.vat_included || false,
      vatPercentage: item.vat_percentage || 20.00,
      vatAmount: item.vat_amount || 0.00,
      priceExcludingVat: item.price_excluding_vat || item.unit_price
    }));

  } catch (error) {
    console.error('Error searching purchase items in Supabase:', error);
    throw error;
  }
};

// Legacy function names for backward compatibility
export const getInventoryItemsSupabase = getPurchaseItemsSupabase;
export const addInventoryItemSupabase = addPurchaseItemSupabase;
export const updateInventoryItemSupabase = updatePurchaseItemSupabase;
export const deleteInventoryItemSupabase = deletePurchaseItemSupabase;
export const searchInventoryItemsSupabase = searchPurchaseItemsSupabase;

// ENHANCED: Subscription operations with correct plan ID handling
export const getUserSubscriptionSupabase = async (userEmail) => {
  if (!supabaseAvailable()) {
    throw new Error('Supabase not available');
  }

  try {
    console.log('🔍 Getting subscription for user:', userEmail);

    const {data, error} = await supabase
      .from('subscriptions_tb2k4x9p1m')
      .select('*')
      .eq('user_email', userEmail.toLowerCase())
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        console.log('ℹ️ No subscription found for user:', userEmail);
        return null;
      }
      throw error;
    }

    console.log('✅ Subscription found:', {
      planId: data.plan_id,
      status: data.status,
      customerId: data.stripe_customer_id,
      subscriptionId: data.stripe_subscription_id
    });

    // ENHANCED: Return properly formatted subscription data
    return {
      id: data.id,
      stripeCustomerId: data.stripe_customer_id,
      stripeSubscriptionId: data.stripe_subscription_id,
      stripeSessionId: data.stripe_session_id,
      planId: data.plan_id, // This should be 'professional' or 'free'
      stripePriceId: data.stripe_price_id,
      status: data.status,
      currentPeriodStart: data.current_period_start,
      currentPeriodEnd: data.current_period_end,
      cancelAtPeriodEnd: data.cancel_at_period_end,
      canceledAt: data.canceled_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };

  } catch (error) {
    console.error('Error getting subscription from Supabase:', error);
    throw error;
  }
};

export const getPlatformStatsSupabase = async () => {
  if (!supabaseAvailable()) {
    throw new Error('Supabase not available');
  }

  try {
    console.log('Getting platform stats from Supabase...');

    // Get users with enhanced error handling
    const {data: users, error: usersError} = await supabase
      .from('users_tb2k4x9p1m')
      .select('email, business_name, role, created_at, last_login');

    if (usersError) {
      console.error('Error fetching users:', usersError);
      throw usersError;
    }

    console.log('Users fetched successfully:', users?.length);

    // Get purchase items (previously inventory items)
    const {data: purchaseItems, error: purchaseError} = await supabase
      .from('inventory_tb2k4x9p1m') // Table name stays the same for database compatibility
      .select('id');

    if (purchaseError) {
      console.error('Error fetching purchase items:', purchaseError);
      // Don't throw, just set to empty array
    }

    // ENHANCED: Get subscriptions with plan breakdown
    const {data: subscriptions, error: subscriptionsError} = await supabase
      .from('subscriptions_tb2k4x9p1m')
      .select('*');

    if (subscriptionsError) {
      console.error('Error fetching subscriptions:', subscriptionsError);
      // Don't throw, just set to empty array
    }

    // ENHANCED: Count subscriptions by plan
    const subscriptionStats = {
      total: subscriptions?.length || 0,
      active: subscriptions?.filter(s => s.status === 'active').length || 0,
      professional: subscriptions?.filter(s => s.plan_id === 'professional' && s.status === 'active').length || 0,
      free: subscriptions?.filter(s => s.plan_id === 'free' || !s.plan_id).length || 0,
      canceled: subscriptions?.filter(s => s.status === 'canceled').length || 0
    };

    const stats = {
      totalUsers: users?.length || 0,
      totalAdmins: users?.filter(u => u.role === 'admin').length || 0,
      totalRegularUsers: users?.filter(u => u.role === 'user').length || 0,
      totalPlatformAdmins: users?.filter(u => u.role === 'platformadmin').length || 0,
      totalPurchaseItems: purchaseItems?.length || 0,
      totalActiveSubscriptions: subscriptionStats.active,
      totalProfessionalSubscriptions: subscriptionStats.professional,
      totalFreeSubscriptions: subscriptionStats.free,
      subscriptionStats: subscriptionStats,
      recentUsers: (users || [])
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 5)
        .map(user => ({
          email: user.email,
          businessName: user.business_name,
          role: user.role,
          createdAt: user.created_at
        }))
    };

    console.log('Platform stats retrieved:', {
      totalUsers: stats.totalUsers,
      recentUsers: stats.recentUsers.length,
      totalAdmins: stats.totalAdmins,
      totalRegularUsers: stats.totalRegularUsers,
      totalPurchaseItems: stats.totalPurchaseItems,
      subscriptionStats: stats.subscriptionStats
    });

    return stats;

  } catch (error) {
    console.error('Error getting platform stats from Supabase:', error);
    throw error;
  }
};

// Stripe configuration operations
export const getStripeConfigSupabase = async () => {
  if (!supabaseAvailable()) {
    throw new Error('Supabase not available');
  }

  try {
    const {data, error} = await supabase
      .from('stripe_config_tb2k4x9p1m')
      .select('*')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No configuration found, return default
        return {
          publishable_key: 'pk_test_51NRLFoEw1FLYKy8hTsUx1GNUX0cUQ3Fgqf4nXJVwxmNILOAF5SaAOaLYMDjfLXQxfUTYMvhUzNFWPTtQW5jXgdHU00Qv5s0uK5',
          secret_key: null, // Never expose in client
          webhook_secret: null,
          test_mode: true,
          payment_methods: {
            card: true,
            sepa: false,
            bacs: false,
            ideal: false
          }
        };
      }
      throw error;
    }

    return {
      publishable_key: data.publishable_key,
      secret_key: data.secret_key ? '••••••••••••••••••••••••••••' : null,
      webhook_secret: data.webhook_secret ? '••••••••••••••••••••••' : null,
      test_mode: data.test_mode,
      payment_methods: data.payment_methods || {card: true}
    };

  } catch (error) {
    console.error('Error getting Stripe config from Supabase:', error);
    throw error;
  }
};

export const updateStripeConfigSupabase = async (config) => {
  if (!supabaseAvailable()) {
    throw new Error('Supabase not available');
  }

  try {
    // First check if config exists
    const {data: existingConfig, error: checkError} = await supabase
      .from('stripe_config_tb2k4x9p1m')
      .select('id')
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    const configData = {
      publishable_key: config.publishableKey,
      test_mode: config.testMode,
      payment_methods: config.paymentMethods,
      updated_at: new Date().toISOString()
    };

    // Only update secret values if they've been changed (not masked)
    if (config.secretKey && !config.secretKey.includes('•')) {
      configData.secret_key = config.secretKey;
    }

    if (config.webhookSecret && !config.webhookSecret.includes('•')) {
      configData.webhook_secret = config.webhookSecret;
    }

    let result;
    if (existingConfig) {
      // Update existing config
      const {data, error} = await supabase
        .from('stripe_config_tb2k4x9p1m')
        .update(configData)
        .eq('id', existingConfig.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Create new config
      configData.created_at = new Date().toISOString();
      const {data, error} = await supabase
        .from('stripe_config_tb2k4x9p1m')
        .insert([configData])
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    return {
      publishableKey: result.publishable_key,
      testMode: result.test_mode,
      paymentMethods: result.payment_methods
    };

  } catch (error) {
    console.error('Error updating Stripe config in Supabase:', error);
    throw error;
  }
};