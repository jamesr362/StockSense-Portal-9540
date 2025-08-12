// Supabase database functions with safe imports
import {supabase} from '../lib/supabase';

export const supabaseAvailable=()=> {
  return supabase !==null;
};

// Users table operations
export const createUserSupabase=async (userData)=> {
  if (!supabaseAvailable()) {
    throw new Error('Supabase not available');
  } 
  try {
    // Determine user role based on email 
    let role='user';
    const email=userData.email.toLowerCase();
    if (email==='platformadmin@trackio.com') {
      role='platformadmin';
    } else if (email.endsWith('@admin')) {
      role='admin';
    } 

    const {data,error}=await supabase
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
      if (error.code==='23505') {
        throw new Error('An account with this email already exists');
      }
      throw error;
    }

    // Create a default subscription for new users
    await createDefaultSubscription(email);

    return {
      email: data.email,
      businessName: data.business_name,
      role: data.role,
      createdAt: data.created_at,
      lastLogin: data.last_login
    };
  } catch (error) {
    console.error('Error creating user in Supabase:',error);
    throw error;
  }
};

// Create a default Professional subscription for new users
export const createDefaultSubscription=async (userEmail)=> {
  if (!supabaseAvailable()) {
    return;
  } 
  try {
    const {error}=await supabase
      .from('subscriptions_tb2k4x9p1m')
      .insert([
        {
          user_email: userEmail,
          stripe_customer_id: `cus_${Math.random().toString(36).substring(2,15)}`,
          stripe_subscription_id: `sub_${Math.random().toString(36).substring(2,15)}`,
          plan_id: 'price_1RtpsuEw1FLYKy8hvxTrRpwe',// Professional plan
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30*24*60*60*1000).toISOString(),// 30 days from now
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]);

    if (error) {
      console.error('Error creating default subscription:',error);
    }
  } catch (error) {
    console.error('Error creating default subscription:',error);
  }
};

export const getUserByEmailSupabase=async (email)=> {
  if (!supabaseAvailable()) {
    throw new Error('Supabase not available');
  }
  try {
    const {data,error}=await supabase
      .from('users_tb2k4x9p1m')
      .select('*')
      .eq('email',email.toLowerCase())
      .single();

    if (error) {
      if (error.code==='PGRST116') {
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
    console.error('Error getting user from Supabase:',error);
    throw error;
  }
};

export const getAllUsersSupabase=async ()=> {
  if (!supabaseAvailable()) {
    throw new Error('Supabase not available');
  }
  try {
    const {data,error}=await supabase
      .from('users_tb2k4x9p1m')
      .select('email,business_name,role,created_at,last_login')
      .order('created_at',{ascending: false});

    if (error) throw error;

    return data.map(user=> ({
      email: user.email,
      businessName: user.business_name,
      role: user.role,
      createdAt: user.created_at,
      lastLogin: user.last_login
    }));
  } catch (error) {
    console.error('Error getting all users from Supabase:',error);
    throw error;
  }
};

export const deleteUserSupabase=async (email)=> {
  if (!supabaseAvailable()) {
    throw new Error('Supabase not available');
  }

  if (email.toLowerCase()==='platformadmin@trackio.com') {
    throw new Error('Platform admin account cannot be deleted');
  }

  try {
    // Delete subscriptions first
    const {error: subscriptionError}=await supabase
      .from('subscriptions_tb2k4x9p1m')
      .delete()
      .eq('user_email',email.toLowerCase());

    if (subscriptionError) throw subscriptionError;

    // Delete inventory items
    const {error: inventoryError}=await supabase
      .from('inventory_tb2k4x9p1m')
      .delete()
      .eq('user_email',email.toLowerCase());

    if (inventoryError) throw inventoryError;

    // Delete user
    const {error: userError}=await supabase
      .from('users_tb2k4x9p1m')
      .delete()
      .eq('email',email.toLowerCase());

    if (userError) throw userError;

    return true;
  } catch (error) {
    console.error('Error deleting user from Supabase:',error);
    throw error;
  }
};

export const updateUserRoleSupabase=async (email,newRole)=> {
  if (!supabaseAvailable()) {
    throw new Error('Supabase not available');
  }

  if (email.toLowerCase()==='platformadmin@trackio.com') {
    throw new Error('Platform admin role cannot be changed');
  }

  if (newRole==='admin' && !email.toLowerCase().endsWith('@admin')) {
    throw new Error('Only users with @admin email addresses can be granted administrator privileges');
  }

  if (newRole==='platformadmin') {
    throw new Error('Platform admin role cannot be assigned');
  }

  try {
    const {data,error}=await supabase
      .from('users_tb2k4x9p1m')
      .update({role: newRole,updated_at: new Date().toISOString()})
      .eq('email',email.toLowerCase())
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
    console.error('Error updating user role in Supabase:',error);
    throw error;
  }
};

export const updateUserLastLoginSupabase=async (email)=> {
  if (!supabaseAvailable()) {
    return;
  }
  try {
    const {error}=await supabase
      .from('users_tb2k4x9p1m')
      .update({last_login: new Date().toISOString()})
      .eq('email',email.toLowerCase());

    if (error) throw error;
  } catch (error) {
    console.error('Error updating last login in Supabase:',error);
  }
};

// Inventory table operations
export const getInventoryItemsSupabase=async (userEmail)=> {
  if (!supabaseAvailable()) {
    throw new Error('Supabase not available');
  }
  try {
    const {data,error}=await supabase
      .from('inventory_tb2k4x9p1m')
      .select('*')
      .eq('user_email',userEmail.toLowerCase())
      .order('created_at',{ascending: false});

    if (error) throw error;

    return data.map(item=> ({
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
    console.error('Error getting inventory items from Supabase:',error);
    throw error;
  }
};

export const addInventoryItemSupabase=async (itemData,userEmail)=> {
  if (!supabaseAvailable()) {
    throw new Error('Supabase not available');
  }
  try {
    const {data,error}=await supabase
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
    console.error('Error adding inventory item to Supabase:',error);
    throw error;
  }
};

export const updateInventoryItemSupabase=async (itemData,userEmail)=> {
  if (!supabaseAvailable()) {
    throw new Error('Supabase not available');
  }
  try {
    const {data,error}=await supabase
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
      .eq('id',itemData.id)
      .eq('user_email',userEmail.toLowerCase())
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
    console.error('Error updating inventory item in Supabase:',error);
    throw error;
  }
};

export const deleteInventoryItemSupabase=async (itemId,userEmail)=> {
  if (!supabaseAvailable()) {
    throw new Error('Supabase not available');
  }
  try {
    const {error}=await supabase
      .from('inventory_tb2k4x9p1m')
      .delete()
      .eq('id',itemId)
      .eq('user_email',userEmail.toLowerCase());

    if (error) throw error;

    return true;
  } catch (error) {
    console.error('Error deleting inventory item from Supabase:',error);
    throw error;
  }
};

export const searchInventoryItemsSupabase=async (searchTerm,userEmail)=> {
  if (!supabaseAvailable()) {
    throw new Error('Supabase not available');
  }
  try {
    let query=supabase
      .from('inventory_tb2k4x9p1m')
      .select('*')
      .eq('user_email',userEmail.toLowerCase());

    if (searchTerm) {
      const lowerSearchTerm=searchTerm.toLowerCase();
      query=query.or(`name.ilike.%${lowerSearchTerm}%,category.ilike.%${lowerSearchTerm}%,description.ilike.%${lowerSearchTerm}%`);
    }

    const {data,error}=await query.order('created_at',{ascending: false});

    if (error) throw error;

    return data.map(item=> ({
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
    console.error('Error searching inventory items in Supabase:',error);
    throw error;
  }
};

// Subscription operations
export const getUserSubscriptionSupabase=async (userEmail)=> {
  if (!supabaseAvailable()) {
    throw new Error('Supabase not available');
  }
  try {
    const {data,error}=await supabase
      .from('subscriptions_tb2k4x9p1m')
      .select('*')
      .eq('user_email',userEmail.toLowerCase())
      .single();

    if (error) {
      if (error.code==='PGRST116') {
        return null;
      }
      throw error;
    }

    return {
      id: data.id,
      stripeCustomerId: data.stripe_customer_id,
      stripeSubscriptionId: data.stripe_subscription_id,
      planId: data.plan_id,
      status: data.status,
      currentPeriodStart: data.current_period_start,
      currentPeriodEnd: data.current_period_end,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  } catch (error) {
    console.error('Error getting subscription from Supabase:',error);
    throw error;
  }
};

export const updateUserSubscriptionSupabase=async (userEmail,subscriptionData)=> {
  if (!supabaseAvailable()) {
    throw new Error('Supabase not available');
  }
  try {
    const {data,error}=await supabase
      .from('subscriptions_tb2k4x9p1m')
      .update({
        plan_id: subscriptionData.planId,
        status: subscriptionData.status,
        stripe_subscription_id: subscriptionData.stripeSubscriptionId,
        current_period_end: subscriptionData.currentPeriodEnd,
        updated_at: new Date().toISOString()
      })
      .eq('user_email',userEmail.toLowerCase())
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      stripeCustomerId: data.stripe_customer_id,
      stripeSubscriptionId: data.stripe_subscription_id,
      planId: data.plan_id,
      status: data.status,
      currentPeriodStart: data.current_period_start,
      currentPeriodEnd: data.current_period_end,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  } catch (error) {
    console.error('Error updating subscription in Supabase:',error);
    throw error;
  }
};

export const getPlatformStatsSupabase=async ()=> {
  if (!supabaseAvailable()) {
    throw new Error('Supabase not available');
  }
  try {
    const {data: users,error: usersError}=await supabase
      .from('users_tb2k4x9p1m')
      .select('email,business_name,role,created_at,last_login');

    if (usersError) throw usersError;

    const {data: inventoryItems,error: inventoryError}=await supabase
      .from('inventory_tb2k4x9p1m')
      .select('id');

    if (inventoryError) throw inventoryError;

    const {data: subscriptions,error: subscriptionsError}=await supabase
      .from('subscriptions_tb2k4x9p1m')
      .select('*');

    if (subscriptionsError) throw subscriptionsError;

    const stats={
      totalUsers: users.length,
      totalAdmins: users.filter(u=> u.role==='admin').length,
      totalRegularUsers: users.filter(u=> u.role==='user').length,
      totalPlatformAdmins: users.filter(u=> u.role==='platformadmin').length,
      totalInventoryItems: inventoryItems.length,
      totalActiveSubscriptions: subscriptions.filter(s=> s.status==='active').length,
      recentUsers: users
        .sort((a,b)=> new Date(b.created_at) - new Date(a.created_at))
        .slice(0,5)
        .map(user=> ({
          email: user.email,
          businessName: user.business_name,
          role: user.role,
          createdAt: user.created_at
        }))
    };

    return stats;
  } catch (error) {
    console.error('Error getting platform stats from Supabase:',error);
    throw error;
  }
};

// Stripe configuration operations
export const getStripeConfigSupabase = async () => {
  if (!supabaseAvailable()) {
    throw new Error('Supabase not available');
  }
  
  try {
    const { data, error } = await supabase
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
          payment_methods: { card: true, sepa: false, bacs: false, ideal: false }
        };
      }
      throw error;
    }
    
    return {
      publishable_key: data.publishable_key,
      secret_key: data.secret_key ? '••••••••••••••••••••••••••••' : null,
      webhook_secret: data.webhook_secret ? '••••••••••••••••••••••' : null,
      test_mode: data.test_mode,
      payment_methods: data.payment_methods || { card: true }
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
    const { data: existingConfig, error: checkError } = await supabase
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
      const { data, error } = await supabase
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
      
      const { data, error } = await supabase
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