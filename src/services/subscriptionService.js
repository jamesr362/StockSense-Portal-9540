import { supabase } from '../lib/supabase';
import { SUBSCRIPTION_PLANS } from '../lib/stripe';

/**
 * Subscription Service - Enhanced to use stripe_subscription_id as primary identifier
 * Handles subscription management and plan limits with improved security
 */

// Cache for subscription data (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;
const subscriptionCache = new Map();

// Helper to get cache key
const getCacheKey = (identifier, type = 'email') => `subscription_${type}_${identifier.toLowerCase()}`;

// Helper to check if cache is valid
const isCacheValid = (cacheEntry) => {
  if (!cacheEntry) return false;
  return Date.now() - cacheEntry.timestamp < CACHE_DURATION;
};

// Clear cache for user
export const clearUserCache = (userEmail) => {
  const emailCacheKey = getCacheKey(userEmail, 'email');
  subscriptionCache.delete(emailCacheKey);
  
  // Also clear any subscription ID based cache
  const subscription = subscriptionCache.get(emailCacheKey);
  if (subscription?.data?.stripeSubscriptionId) {
    const subIdCacheKey = getCacheKey(subscription.data.stripeSubscriptionId, 'subscription_id');
    subscriptionCache.delete(subIdCacheKey);
  }
  
  // Also clear localStorage cache
  try {
    localStorage.removeItem(`subscriptionCache_${userEmail}`);
    localStorage.removeItem(`subscriptionCache_${userEmail}_time`);
  } catch (error) {
    console.warn('Error clearing localStorage cache:', error);
  }
};

// Get subscription by Stripe Subscription ID (primary method)
export const getSubscriptionByStripeId = async (stripeSubscriptionId) => {
  if (!stripeSubscriptionId || !supabase) {
    console.log('No stripe subscription ID or Supabase not available');
    return null;
  }

  const cacheKey = getCacheKey(stripeSubscriptionId, 'subscription_id');
  
  // Check memory cache first
  const cached = subscriptionCache.get(cacheKey);
  if (isCacheValid(cached)) {
    console.log('📋 Using cached subscription data (by Stripe ID)');
    return cached.data;
  }

  try {
    console.log('🔍 Fetching subscription from Supabase by Stripe ID:', stripeSubscriptionId);

    // Query subscriptions table by stripe_subscription_id
    const { data, error } = await supabase
      .from('subscriptions_tb2k4x9p1m')
      .select('*')
      .eq('stripe_subscription_id', stripeSubscriptionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        console.log('ℹ️ No subscription found for Stripe ID:', stripeSubscriptionId);
        return null;
      }
      throw error;
    }

    // Transform Supabase data to our format
    const subscription = {
      id: data.id,
      userEmail: data.user_email,
      stripeCustomerId: data.stripe_customer_id,
      stripeSubscriptionId: data.stripe_subscription_id,
      planId: data.plan_id,
      status: data.status,
      currentPeriodStart: data.current_period_start,
      currentPeriodEnd: data.current_period_end,
      cancelAtPeriodEnd: data.cancel_at_period_end,
      canceledAt: data.canceled_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };

    console.log('✅ Found subscription by Stripe ID:', subscription);

    // Cache the result (both by subscription ID and email)
    subscriptionCache.set(cacheKey, {
      data: subscription,
      timestamp: Date.now()
    });
    
    // Also cache by email for backward compatibility
    const emailCacheKey = getCacheKey(subscription.userEmail, 'email');
    subscriptionCache.set(emailCacheKey, {
      data: subscription,
      timestamp: Date.now()
    });

    return subscription;

  } catch (error) {
    console.error('❌ Error fetching subscription by Stripe ID:', error);
    return null;
  }
};

// Get subscription from Supabase with caching (by email - fallback method)
export const getUserSubscription = async (userEmail) => {
  if (!userEmail || !supabase) {
    console.log('No user email or Supabase not available');
    return null;
  }

  const cacheKey = getCacheKey(userEmail, 'email');
  
  // Check memory cache first
  const cached = subscriptionCache.get(cacheKey);
  if (isCacheValid(cached)) {
    console.log('📋 Using cached subscription data (by email)');
    return cached.data;
  }

  try {
    console.log('🔍 Fetching subscription from Supabase for:', userEmail);

    // Query subscriptions table by user_email
    const { data, error } = await supabase
      .from('subscriptions_tb2k4x9p1m')
      .select('*')
      .eq('user_email', userEmail.toLowerCase())
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No subscription found - user is on free plan
        console.log('ℹ️ No subscription found, user is on free plan');
        const freeSubscription = null;
        
        // Cache the null result
        subscriptionCache.set(cacheKey, {
          data: freeSubscription,
          timestamp: Date.now()
        });
        
        return freeSubscription;
      }
      throw error;
    }

    // Transform Supabase data to our format
    const subscription = {
      id: data.id,
      userEmail: data.user_email,
      stripeCustomerId: data.stripe_customer_id,
      stripeSubscriptionId: data.stripe_subscription_id,
      planId: data.plan_id,
      status: data.status,
      currentPeriodStart: data.current_period_start,
      currentPeriodEnd: data.current_period_end,
      cancelAtPeriodEnd: data.cancel_at_period_end,
      canceledAt: data.canceled_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };

    console.log('✅ Found subscription by email:', subscription);

    // Cache the result (both by email and subscription ID)
    subscriptionCache.set(cacheKey, {
      data: subscription,
      timestamp: Date.now()
    });
    
    // Also cache by subscription ID for faster lookups
    const subIdCacheKey = getCacheKey(subscription.stripeSubscriptionId, 'subscription_id');
    subscriptionCache.set(subIdCacheKey, {
      data: subscription,
      timestamp: Date.now()
    });

    return subscription;

  } catch (error) {
    console.error('❌ Error fetching subscription by email:', error);
    return null;
  }
};

// Get plan limits based on subscription
export const getUserPlanLimits = async (userEmail) => {
  try {
    console.log('🔍 Getting plan limits for:', userEmail);

    const subscription = await getUserSubscription(userEmail);
    
    let planId = 'free';
    
    if (subscription && subscription.status === 'active') {
      // Extract plan name from plan_id (e.g., "price_professional" -> "professional")
      if (subscription.planId && subscription.planId.includes('professional')) {
        planId = 'professional';
      } else if (subscription.planId && subscription.planId.includes('free')) {
        planId = 'free';
      } else if (subscription.planId && !subscription.planId.includes('free')) {
        // If it's not free and not explicitly professional, assume it's professional
        planId = 'professional';
      }
    }

    console.log('📋 Determined plan:', planId);

    // Get plan configuration from SUBSCRIPTION_PLANS
    const plan = SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS.free;
    const limits = plan.limits;

    console.log('📊 Plan limits:', limits);

    return {
      subscription,
      planLimits: limits,
      currentPlan: planId,
      planName: plan.name
    };

  } catch (error) {
    console.error('❌ Error getting plan limits:', error);
    
    // Return free plan limits as fallback
    return {
      subscription: null,
      planLimits: SUBSCRIPTION_PLANS.free.limits,
      currentPlan: 'free',
      planName: 'Free'
    };
  }
};

// Check if user can perform action based on limits
export const checkPlanLimit = async (userEmail, limitType, currentUsage) => {
  try {
    const { planLimits, currentPlan } = await getUserPlanLimits(userEmail);
    
    if (!planLimits) {
      return { allowed: false, reason: 'Unable to determine plan limits' };
    }

    const limit = planLimits[limitType];
    
    // -1 means unlimited (professional plan)
    if (limit === -1) {
      return { 
        allowed: true, 
        limit: -1, 
        remaining: Infinity,
        plan: currentPlan
      };
    }
    
    // 0 means feature not available
    if (limit === 0) {
      return { 
        allowed: false, 
        reason: `${limitType} is not available on your current plan`,
        limit: 0,
        remaining: 0,
        plan: currentPlan
      };
    }
    
    // Check against limit
    const allowed = currentUsage < limit;
    const remaining = Math.max(0, limit - currentUsage);
    
    return {
      allowed,
      limit,
      used: currentUsage,
      remaining,
      plan: currentPlan,
      reason: allowed ? null : `You have reached your ${limitType} limit of ${limit}. Upgrade to Professional for unlimited access.`
    };

  } catch (error) {
    console.error('❌ Error checking plan limit:', error);
    return { 
      allowed: false, 
      reason: 'Error checking plan limits',
      plan: 'unknown'
    };
  }
};

// Update subscription in Supabase (called by webhooks) - Now uses stripe_subscription_id
export const updateSubscriptionByStripeId = async (stripeSubscriptionId, subscriptionData) => {
  if (!supabase) {
    throw new Error('Supabase not available');
  }

  try {
    console.log('📝 Updating subscription in Supabase by Stripe ID:', stripeSubscriptionId, subscriptionData);

    const { error } = await supabase
      .from('subscriptions_tb2k4x9p1m')
      .update({
        ...subscriptionData,
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', stripeSubscriptionId);

    if (error) throw error;

    // Clear cache for this subscription
    const subIdCacheKey = getCacheKey(stripeSubscriptionId, 'subscription_id');
    subscriptionCache.delete(subIdCacheKey);
    
    // Also clear email-based cache if we can determine the email
    if (subscriptionData.user_email) {
      clearUserCache(subscriptionData.user_email);
    }

    console.log('✅ Subscription updated successfully by Stripe ID');
    return true;

  } catch (error) {
    console.error('❌ Error updating subscription by Stripe ID:', error);
    throw error;
  }
};

// Legacy update function for backward compatibility
export const updateSubscription = async (subscriptionData) => {
  if (!supabase) {
    throw new Error('Supabase not available');
  }

  try {
    console.log('📝 Updating subscription in Supabase (legacy method):', subscriptionData);

    const { error } = await supabase
      .from('subscriptions_tb2k4x9p1m')
      .upsert(subscriptionData, {
        onConflict: 'user_email'
      });

    if (error) throw error;

    // Clear cache for this user
    if (subscriptionData.user_email) {
      clearUserCache(subscriptionData.user_email);
    }

    console.log('✅ Subscription updated successfully (legacy method)');
    return true;

  } catch (error) {
    console.error('❌ Error updating subscription (legacy method):', error);
    throw error;
  }
};

// Cancel subscription using Stripe Subscription ID
export const cancelSubscriptionByStripeId = async (stripeSubscriptionId) => {
  if (!supabase) {
    throw new Error('Supabase not available');
  }

  try {
    console.log('🚫 Canceling subscription by Stripe ID:', stripeSubscriptionId);

    // Call backend to cancel with Stripe
    const response = await fetch('/.netlify/functions/cancel-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscriptionId: stripeSubscriptionId
      })
    });

    if (!response.ok) {
      throw new Error('Failed to cancel subscription with Stripe');
    }

    // Clear cache
    const subIdCacheKey = getCacheKey(stripeSubscriptionId, 'subscription_id');
    subscriptionCache.delete(subIdCacheKey);

    console.log('✅ Subscription cancellation initiated by Stripe ID');
    return true;

  } catch (error) {
    console.error('❌ Error canceling subscription by Stripe ID:', error);
    throw error;
  }
};

// Cancel subscription (legacy method using email)
export const cancelSubscription = async (userEmail) => {
  if (!supabase) {
    throw new Error('Supabase not available');
  }

  try {
    const subscription = await getUserSubscription(userEmail);
    
    if (!subscription || !subscription.stripeSubscriptionId) {
      throw new Error('No active subscription found');
    }

    // Use the new Stripe ID based method
    return await cancelSubscriptionByStripeId(subscription.stripeSubscriptionId);

  } catch (error) {
    console.error('❌ Error canceling subscription (legacy method):', error);
    throw error;
  }
};

// Get subscription status for display
export const getSubscriptionStatus = async (userEmail) => {
  try {
    const { subscription, currentPlan, planName } = await getUserPlanLimits(userEmail);
    
    if (!subscription) {
      return {
        isActive: true, // Free plan is always "active"
        plan: 'free',
        planName: 'Free Plan',
        status: 'active',
        nextBillingDate: null,
        cancelAtPeriodEnd: false
      };
    }

    return {
      isActive: subscription.status === 'active',
      plan: currentPlan,
      planName: planName,
      status: subscription.status,
      nextBillingDate: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      stripeSubscriptionId: subscription.stripeSubscriptionId
    };

  } catch (error) {
    console.error('❌ Error getting subscription status:', error);
    return {
      isActive: true,
      plan: 'free',
      planName: 'Free Plan',
      status: 'active',
      nextBillingDate: null,
      cancelAtPeriodEnd: false
    };
  }
};

// Force refresh subscription data
export const refreshSubscriptionData = async (userEmail) => {
  console.log('🔄 Force refreshing subscription data for:', userEmail);
  
  // Clear all caches
  clearUserCache(userEmail);
  
  // Fetch fresh data
  const result = await getUserPlanLimits(userEmail);
  
  console.log('✅ Subscription data refreshed:', result);
  return result;
};

// Listen for subscription updates
export const setupSubscriptionListener = (userEmail, callback) => {
  if (!supabase) {
    console.warn('Supabase not available for real-time subscriptions');
    return null;
  }

  console.log('👂 Setting up subscription listener for:', userEmail);

  const subscription = supabase
    .channel(`subscription:${userEmail}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'subscriptions_tb2k4x9p1m',
        filter: `user_email=eq.${userEmail.toLowerCase()}`
      },
      (payload) => {
        console.log('🔔 Subscription change detected:', payload);
        
        // Clear cache
        clearUserCache(userEmail);
        
        // Call callback
        if (callback) {
          callback(payload);
        }
      }
    )
    .subscribe();

  return subscription;
};

// New function: Verify subscription by Stripe webhook data
export const verifySubscriptionUpdate = async (webhookData) => {
  try {
    console.log('🔍 Verifying subscription update from webhook:', webhookData);
    
    const { stripeSubscriptionId, userEmail, status } = webhookData;
    
    if (stripeSubscriptionId) {
      // Primary method: Use Stripe Subscription ID
      const subscription = await getSubscriptionByStripeId(stripeSubscriptionId);
      console.log('✅ Subscription verification by Stripe ID:', subscription);
      return subscription;
    } else if (userEmail) {
      // Fallback method: Use email
      const subscription = await getUserSubscription(userEmail);
      console.log('✅ Subscription verification by email:', subscription);
      return subscription;
    }
    
    console.warn('⚠️ No valid identifier provided for subscription verification');
    return null;
    
  } catch (error) {
    console.error('❌ Error verifying subscription update:', error);
    return null;
  }
};

export default {
  getUserSubscription,
  getSubscriptionByStripeId,
  getUserPlanLimits,
  checkPlanLimit,
  updateSubscription,
  updateSubscriptionByStripeId,
  cancelSubscription,
  cancelSubscriptionByStripeId,
  getSubscriptionStatus,
  refreshSubscriptionData,
  setupSubscriptionListener,
  clearUserCache,
  verifySubscriptionUpdate
};