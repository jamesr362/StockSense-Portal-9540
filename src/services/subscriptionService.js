import { supabase } from '../lib/supabase';
import { logSecurityEvent } from '../utils/security';
import { STRIPE_PLANS } from '../lib/stripe';

/**
 * Get user subscription and plan limits
 */
export const getUserPlanLimits = async (userEmail) => {
  try {
    if (!userEmail) {
      return {
        subscription: null,
        planLimits: getFreePlanLimits()
      };
    }

    console.log('🔍 Getting plan limits for:', userEmail);

    // Try to get subscription from Supabase first
    let subscription = null;
    
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('subscriptions_tb2k4x9p1m')
          .select('*')
          .eq('user_email', userEmail.toLowerCase())
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching subscription:', error);
        } else if (data) {
          subscription = data;
          console.log('✅ Found subscription:', subscription);
        }
      } catch (error) {
        console.error('Error querying subscription:', error);
      }
    }

    // Determine plan limits based on subscription
    let planLimits;
    
    if (subscription && subscription.status === 'active') {
      // Extract plan type from plan_id
      if (subscription.plan_id && subscription.plan_id.includes('professional')) {
        planLimits = getProfessionalPlanLimits();
      } else {
        planLimits = getFreePlanLimits();
      }
    } else {
      planLimits = getFreePlanLimits();
    }

    console.log('📊 Plan limits:', planLimits);

    return {
      subscription,
      planLimits
    };

  } catch (error) {
    console.error('❌ Error getting user plan limits:', error);
    
    // Fallback to free plan
    return {
      subscription: null,
      planLimits: getFreePlanLimits()
    };
  }
};

/**
 * Get free plan limits
 */
export const getFreePlanLimits = () => ({
  inventoryItems: 100,
  receiptScans: 1,
  excelImports: 1,
  taxExports: false,
  features: ['inventory', 'dashboard', 'settings']
});

/**
 * Get professional plan limits
 */
export const getProfessionalPlanLimits = () => ({
  inventoryItems: -1, // unlimited
  receiptScans: -1,   // unlimited
  excelImports: -1,   // unlimited
  taxExports: true,
  features: ['inventory', 'dashboard', 'settings', 'receiptScanner', 'excelImporter', 'taxExports']
});

/**
 * Check if user has reached a specific limit
 */
export const checkPlanLimit = async (userEmail, limitType, currentUsage) => {
  try {
    const { planLimits } = await getUserPlanLimits(userEmail);
    const limit = planLimits[limitType];
    
    if (limit === -1) return false; // unlimited
    if (limit === 0) return true;   // not available
    
    return currentUsage >= limit;
  } catch (error) {
    console.error('Error checking plan limit:', error);
    return true; // Err on the side of caution
  }
};

/**
 * Get user subscription
 */
export const getUserSubscription = async (userEmail) => {
  if (!userEmail || !supabase) {
    console.log('No user email or Supabase not available');
    return null;
  }

  try {
    console.log('🔍 Fetching subscription for user:', userEmail);

    const { data, error } = await supabase
      .from('subscriptions_tb2k4x9p1m')
      .select('*')
      .eq('user_email', userEmail.toLowerCase())
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        console.log('No subscription found for user');
        return null;
      }
      console.error('Error fetching subscription:', error);
      return null;
    }

    console.log('✅ Found subscription:', data);
    return data;

  } catch (error) {
    console.error('❌ Error in getUserSubscription:', error);
    return null;
  }
};

/**
 * Update user subscription - Main function used by PaymentSuccess
 */
export const updateUserSubscription = async (userEmail, planId, sessionId = null) => {
  if (!userEmail || !planId) {
    throw new Error('User email and plan ID are required');
  }

  if (!supabase) {
    throw new Error('Database not available');
  }

  try {
    console.log('🔄 Updating user subscription:', { userEmail, planId, sessionId });

    // Clean duplicate subscriptions first
    await cleanupDuplicateSubscriptions(userEmail);

    // Prepare subscription data
    const subscriptionData = {
      user_email: userEmail.toLowerCase(),
      plan_id: planId.startsWith('price_') ? planId : `price_${planId}`,
      status: 'active',
      stripe_customer_id: null,
      stripe_subscription_id: sessionId || `manual_${Date.now()}`,
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
      updated_at: new Date().toISOString()
    };

    // Create or update subscription
    const result = await createOrUpdateSubscription(subscriptionData);
    
    console.log('✅ Subscription updated successfully:', result);
    
    // Log security event
    logSecurityEvent('SUBSCRIPTION_UPDATED_VIA_PAYMENT', {
      userEmail,
      planId: subscriptionData.plan_id,
      sessionId,
      subscriptionId: result.id
    });

    return result;

  } catch (error) {
    console.error('❌ Error updating user subscription:', error);
    throw error;
  }
};

/**
 * Clean up duplicate subscriptions for a user
 */
export const cleanupDuplicateSubscriptions = async (userEmail) => {
  if (!userEmail || !supabase) {
    return;
  }

  try {
    console.log('🧹 Cleaning up duplicate subscriptions for:', userEmail);

    // Get all subscriptions for the user
    const { data: subscriptions, error } = await supabase
      .from('subscriptions_tb2k4x9p1m')
      .select('*')
      .eq('user_email', userEmail.toLowerCase())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching subscriptions for cleanup:', error);
      return;
    }

    if (!subscriptions || subscriptions.length <= 1) {
      console.log('No duplicate subscriptions found');
      return;
    }

    // Keep the most recent subscription, delete the rest
    const [keepSubscription, ...duplicates] = subscriptions;
    
    if (duplicates.length > 0) {
      console.log(`🗑️ Removing ${duplicates.length} duplicate subscriptions`);
      
      const duplicateIds = duplicates.map(sub => sub.id);
      
      const { error: deleteError } = await supabase
        .from('subscriptions_tb2k4x9p1m')
        .delete()
        .in('id', duplicateIds);

      if (deleteError) {
        console.error('Error deleting duplicate subscriptions:', deleteError);
      } else {
        console.log('✅ Duplicate subscriptions cleaned up');
        
        logSecurityEvent('DUPLICATE_SUBSCRIPTIONS_CLEANED', {
          userEmail,
          keptSubscriptionId: keepSubscription.id,
          deletedCount: duplicates.length,
          deletedIds: duplicateIds
        });
      }
    }

  } catch (error) {
    console.error('❌ Error cleaning up duplicate subscriptions:', error);
  }
};

/**
 * Create or update subscription
 */
export const createOrUpdateSubscription = async (subscriptionData) => {
  if (!supabase) {
    console.error('Supabase not available');
    throw new Error('Database not available');
  }

  try {
    console.log('💾 Creating/updating subscription:', subscriptionData);

    const userEmail = subscriptionData.user_email?.toLowerCase();
    if (!userEmail) {
      throw new Error('User email is required');
    }

    // Check for existing subscription
    const { data: existingData } = await supabase
      .from('subscriptions_tb2k4x9p1m')
      .select('*')
      .eq('user_email', userEmail)
      .limit(1);

    if (existingData && existingData.length > 0) {
      // Update existing subscription
      const { data, error } = await supabase
        .from('subscriptions_tb2k4x9p1m')
        .update({
          ...subscriptionData,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingData[0].id)
        .select()
        .single();

      if (error) throw error;
      
      console.log('✅ Updated subscription:', data);
      
      // Log security event
      logSecurityEvent('SUBSCRIPTION_UPDATED', {
        userEmail,
        subscriptionId: data.id,
        planId: subscriptionData.plan_id
      });

      return data;
    } else {
      // Create new subscription
      const { data, error } = await supabase
        .from('subscriptions_tb2k4x9p1m')
        .insert([{
          ...subscriptionData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      
      console.log('✅ Created subscription:', data);
      
      // Log security event
      logSecurityEvent('SUBSCRIPTION_CREATED', {
        userEmail,
        subscriptionId: data.id,
        planId: subscriptionData.plan_id
      });

      return data;
    }

  } catch (error) {
    console.error('❌ Error creating/updating subscription:', error);
    throw error;
  }
};

/**
 * Cancel subscription with REAL Stripe integration
 */
export const cancelSubscription = async (userEmail, cancelAtPeriodEnd = true) => {
  if (!userEmail || !supabase) {
    throw new Error('User email and database connection required');
  }

  try {
    console.log('❌ Canceling subscription for user:', userEmail, { cancelAtPeriodEnd });

    // Get current subscription first
    const { data: currentSub, error: fetchError } = await supabase
      .from('subscriptions_tb2k4x9p1m')
      .select('*')
      .eq('user_email', userEmail.toLowerCase())
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        throw new Error('No subscription found to cancel');
      }
      throw fetchError;
    }

    // **NEW: Cancel in Stripe if we have a Stripe subscription ID**
    if (currentSub.stripe_subscription_id && !currentSub.stripe_subscription_id.startsWith('manual_')) {
      try {
        console.log('🔄 Cancelling subscription in Stripe:', currentSub.stripe_subscription_id);
        
        // Call Netlify function to cancel in Stripe
        const response = await fetch('/.netlify/functions/cancel-subscription', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            subscriptionId: currentSub.stripe_subscription_id,
            cancelAtPeriodEnd: cancelAtPeriodEnd
          })
        });

        if (!response.ok) {
          const errorData = await response.text();
          console.error('Stripe cancellation failed:', errorData);
          throw new Error(`Failed to cancel in Stripe: ${errorData}`);
        }

        const stripeResult = await response.json();
        console.log('✅ Stripe cancellation successful:', stripeResult);
        
        // Log security event for Stripe cancellation
        logSecurityEvent('STRIPE_SUBSCRIPTION_CANCELED', {
          userEmail,
          stripeSubscriptionId: currentSub.stripe_subscription_id,
          cancelAtPeriodEnd
        });

      } catch (stripeError) {
        console.error('❌ Error cancelling in Stripe:', stripeError);
        // Continue with local cancellation even if Stripe fails
        // In production, you might want to handle this differently
      }
    }

    // **Update local database**
    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (cancelAtPeriodEnd) {
      // Cancel at period end - keep active until period ends
      updateData.cancel_at_period_end = true;
      updateData.canceled_at = new Date().toISOString();
      // Status remains 'active' until period end
    } else {
      // Cancel immediately
      updateData.status = 'canceled';
      updateData.cancel_at_period_end = false;
      updateData.canceled_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('subscriptions_tb2k4x9p1m')
      .update(updateData)
      .eq('user_email', userEmail.toLowerCase())
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Canceled subscription in database:', data);
    
    // Log security event
    logSecurityEvent('SUBSCRIPTION_CANCELED', {
      userEmail,
      subscriptionId: data.id,
      cancelAtPeriodEnd,
      immediateCancel: !cancelAtPeriodEnd
    });

    // Dispatch events to update UI
    window.dispatchEvent(new CustomEvent('subscriptionUpdated', {
      detail: { userEmail, force: true, immediate: true }
    }));

    window.dispatchEvent(new CustomEvent('refreshFeatureAccess', {
      detail: { userEmail, force: true }
    }));

    return data;

  } catch (error) {
    console.error('❌ Error canceling subscription:', error);
    throw error;
  }
};

/**
 * Reactivate subscription - FIXED VERSION
 */
export const reactivateSubscription = async (userEmail, planId = 'price_professional') => {
  if (!userEmail || !supabase) {
    throw new Error('User email and database connection required');
  }

  try {
    console.log('🔄 Reactivating subscription for user:', userEmail, { planId });

    // Get current subscription first
    const { data: currentSub, error: fetchError } = await supabase
      .from('subscriptions_tb2k4x9p1m')
      .select('*')
      .eq('user_email', userEmail.toLowerCase())
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        throw new Error('No subscription found to reactivate');
      }
      throw fetchError;
    }

    // **NEW: Reactivate in Stripe if we have a Stripe subscription ID**
    if (currentSub.stripe_subscription_id && !currentSub.stripe_subscription_id.startsWith('manual_')) {
      try {
        console.log('🔄 Reactivating subscription in Stripe:', currentSub.stripe_subscription_id);
        
        // Call Netlify function to reactivate in Stripe
        const response = await fetch('/.netlify/functions/reactivate-subscription', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            subscriptionId: currentSub.stripe_subscription_id
          })
        });

        if (!response.ok) {
          const errorData = await response.text();
          console.error('Stripe reactivation failed:', errorData);
          throw new Error(`Failed to reactivate in Stripe: ${errorData}`);
        }

        const stripeResult = await response.json();
        console.log('✅ Stripe reactivation successful:', stripeResult);
        
        // Log security event for Stripe reactivation
        logSecurityEvent('STRIPE_SUBSCRIPTION_REACTIVATED', {
          userEmail,
          stripeSubscriptionId: currentSub.stripe_subscription_id
        });

      } catch (stripeError) {
        console.error('❌ Error reactivating in Stripe:', stripeError);
        // Continue with local reactivation even if Stripe fails
      }
    }

    // **Update local database**
    const updateData = {
      status: 'active',
      cancel_at_period_end: false,
      canceled_at: null,
      plan_id: planId.startsWith('price_') ? planId : `price_${planId}`,
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('subscriptions_tb2k4x9p1m')
      .update(updateData)
      .eq('user_email', userEmail.toLowerCase())
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Reactivated subscription:', data);
    
    // Log security event
    logSecurityEvent('SUBSCRIPTION_REACTIVATED', {
      userEmail,
      subscriptionId: data.id,
      planId: updateData.plan_id
    });

    // Dispatch events to update UI
    window.dispatchEvent(new CustomEvent('subscriptionUpdated', {
      detail: { userEmail, force: true, immediate: true }
    }));

    window.dispatchEvent(new CustomEvent('refreshFeatureAccess', {
      detail: { userEmail, force: true }
    }));

    return data;

  } catch (error) {
    console.error('❌ Error reactivating subscription:', error);
    throw error;
  }
};

/**
 * Update subscription status
 */
export const updateSubscriptionStatus = async (userEmail, status, metadata = {}) => {
  if (!userEmail || !supabase) {
    throw new Error('User email and database connection required');
  }

  try {
    console.log(`📊 Updating subscription status to ${status} for user:`, userEmail);

    const updateData = {
      status,
      updated_at: new Date().toISOString(),
      ...metadata
    };

    const { data, error } = await supabase
      .from('subscriptions_tb2k4x9p1m')
      .update(updateData)
      .eq('user_email', userEmail.toLowerCase())
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Updated subscription status:', data);
    
    // Log security event
    logSecurityEvent('SUBSCRIPTION_STATUS_UPDATED', {
      userEmail,
      subscriptionId: data.id,
      status,
      metadata
    });

    return data;

  } catch (error) {
    console.error('❌ Error updating subscription status:', error);
    throw error;
  }
};

export default {
  getUserPlanLimits,
  getFreePlanLimits,
  getProfessionalPlanLimits,
  checkPlanLimit,
  getUserSubscription,
  updateUserSubscription,
  cleanupDuplicateSubscriptions,
  createOrUpdateSubscription,
  cancelSubscription,
  reactivateSubscription,
  updateSubscriptionStatus
};