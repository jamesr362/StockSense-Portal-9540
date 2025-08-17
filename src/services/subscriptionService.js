import {supabase} from '../lib/supabase';
import {logSecurityEvent} from '../utils/security';
import {SUBSCRIPTION_PLANS} from '../lib/stripe';

// Create or update subscription
export const createOrUpdateSubscription = async (userEmail, subscriptionData) => {
  try {
    logSecurityEvent('SUBSCRIPTION_CREATE_UPDATE_ATTEMPT', {
      userEmail,
      planId: subscriptionData.planId
    });

    // Check if subscription exists
    const {data: existingSubscription, error: fetchError} = await supabase
      .from('subscriptions_tb2k4x9p1m')
      .select('*')
      .eq('user_email', userEmail.toLowerCase())
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    const subscriptionRecord = {
      user_email: userEmail.toLowerCase(),
      stripe_customer_id: subscriptionData.stripeCustomerId || `cus_${Math.random().toString(36).substring(2, 15)}`,
      stripe_subscription_id: subscriptionData.stripeSubscriptionId || `sub_${Math.random().toString(36).substring(2, 15)}`,
      plan_id: subscriptionData.planId,
      status: subscriptionData.status || 'active',
      current_period_start: subscriptionData.currentPeriodStart || new Date().toISOString(),
      current_period_end: subscriptionData.currentPeriodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString()
    };

    let result;
    if (existingSubscription) {
      // Update existing subscription
      const {data, error} = await supabase
        .from('subscriptions_tb2k4x9p1m')
        .update(subscriptionRecord)
        .eq('user_email', userEmail.toLowerCase())
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Create new subscription
      subscriptionRecord.created_at = new Date().toISOString();
      const {data, error} = await supabase
        .from('subscriptions_tb2k4x9p1m')
        .insert([subscriptionRecord])
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    logSecurityEvent('SUBSCRIPTION_CREATE_UPDATE_SUCCESS', {
      userEmail,
      planId: subscriptionData.planId,
      subscriptionId: result.id
    });

    return transformSubscriptionData(result);
  } catch (error) {
    logSecurityEvent('SUBSCRIPTION_CREATE_UPDATE_ERROR', {
      userEmail,
      error: error.message
    });
    throw error;
  }
};

// Get user subscription
export const getUserSubscription = async (userEmail) => {
  try {
    const {data, error} = await supabase
      .from('subscriptions_tb2k4x9p1m')
      .select('*')
      .eq('user_email', userEmail.toLowerCase())
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No subscription found
      }
      throw error;
    }

    return transformSubscriptionData(data);
  } catch (error) {
    console.error('Error getting user subscription:', error);
    throw error;
  }
};

// Update subscription status
export const updateSubscriptionStatus = async (userEmail, status, endDate = null) => {
  try {
    logSecurityEvent('SUBSCRIPTION_STATUS_UPDATE_ATTEMPT', {
      userEmail,
      status
    });

    const updateData = {
      status,
      updated_at: new Date().toISOString()
    };

    if (endDate) {
      updateData.current_period_end = endDate;
    }

    const {data, error} = await supabase
      .from('subscriptions_tb2k4x9p1m')
      .update(updateData)
      .eq('user_email', userEmail.toLowerCase())
      .select()
      .single();

    if (error) throw error;

    logSecurityEvent('SUBSCRIPTION_STATUS_UPDATE_SUCCESS', {
      userEmail,
      status,
      subscriptionId: data.id
    });

    return transformSubscriptionData(data);
  } catch (error) {
    logSecurityEvent('SUBSCRIPTION_STATUS_UPDATE_ERROR', {
      userEmail,
      error: error.message
    });
    throw error;
  }
};

// Cancel subscription
export const cancelSubscription = async (userEmail, cancelAtPeriodEnd = true) => {
  try {
    logSecurityEvent('SUBSCRIPTION_CANCEL_ATTEMPT', {
      userEmail,
      cancelAtPeriodEnd
    });

    const status = cancelAtPeriodEnd ? 'active' : 'canceled';
    const canceledAt = new Date().toISOString();

    const updateData = {
      status,
      canceled_at: canceledAt,
      cancel_at_period_end: cancelAtPeriodEnd,
      updated_at: new Date().toISOString()
    };

    // If canceling immediately, set end date to now
    if (!cancelAtPeriodEnd) {
      updateData.current_period_end = canceledAt;
    }

    const {data, error} = await supabase
      .from('subscriptions_tb2k4x9p1m')
      .update(updateData)
      .eq('user_email', userEmail.toLowerCase())
      .select()
      .single();

    if (error) throw error;

    logSecurityEvent('SUBSCRIPTION_CANCEL_SUCCESS', {
      userEmail,
      subscriptionId: data.id,
      cancelAtPeriodEnd
    });

    return transformSubscriptionData(data);
  } catch (error) {
    logSecurityEvent('SUBSCRIPTION_CANCEL_ERROR', {
      userEmail,
      error: error.message
    });
    throw error;
  }
};

// Reactivate subscription
export const reactivateSubscription = async (userEmail, planId = null) => {
  try {
    logSecurityEvent('SUBSCRIPTION_REACTIVATE_ATTEMPT', {
      userEmail,
      planId
    });

    const updateData = {
      status: 'active',
      canceled_at: null,
      cancel_at_period_end: false,
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString()
    };

    if (planId) {
      updateData.plan_id = planId;
    }

    const {data, error} = await supabase
      .from('subscriptions_tb2k4x9p1m')
      .update(updateData)
      .eq('user_email', userEmail.toLowerCase())
      .select()
      .single();

    if (error) throw error;

    logSecurityEvent('SUBSCRIPTION_REACTIVATE_SUCCESS', {
      userEmail,
      subscriptionId: data.id
    });

    return transformSubscriptionData(data);
  } catch (error) {
    logSecurityEvent('SUBSCRIPTION_REACTIVATE_ERROR', {
      userEmail,
      error: error.message
    });
    throw error;
  }
};

// Get subscription analytics
export const getSubscriptionAnalytics = async () => {
  try {
    const {data, error} = await supabase
      .from('subscriptions_tb2k4x9p1m')
      .select('*');

    if (error) throw error;

    const analytics = {
      totalSubscriptions: data.length,
      activeSubscriptions: data.filter(s => s.status === 'active').length,
      canceledSubscriptions: data.filter(s => s.status === 'canceled').length,
      trialSubscriptions: data.filter(s => s.status === 'trialing').length,
      pastDueSubscriptions: data.filter(s => s.status === 'past_due').length,
      planDistribution: {},
      monthlyRecurringRevenue: 0,
      churnRate: 0
    };

    // Calculate plan distribution and MRR
    data.forEach(subscription => {
      const planName = getPlanNameFromId(subscription.plan_id);
      analytics.planDistribution[planName] = (analytics.planDistribution[planName] || 0) + 1;

      // Calculate MRR for active subscriptions
      if (subscription.status === 'active') {
        const plan = Object.values(SUBSCRIPTION_PLANS).find(p => p.priceId === subscription.plan_id);
        if (plan && plan.price > 0) {
          analytics.monthlyRecurringRevenue += plan.price;
        }
      }
    });

    // Calculate churn rate (simplified)
    const totalActive = analytics.activeSubscriptions;
    const totalCanceled = analytics.canceledSubscriptions;
    analytics.churnRate = totalActive > 0 ? (totalCanceled / (totalActive + totalCanceled)) * 100 : 0;

    return analytics;
  } catch (error) {
    console.error('Error getting subscription analytics:', error);
    throw error;
  }
};

// Get user's plan limits
export const getUserPlanLimits = async (userEmail) => {
  try {
    const subscription = await getUserSubscription(userEmail);
    
    if (!subscription) {
      return SUBSCRIPTION_PLANS.free.limits;
    }

    const planName = getPlanNameFromId(subscription.planId);
    const plan = SUBSCRIPTION_PLANS[planName];
    
    return plan ? plan.limits : SUBSCRIPTION_PLANS.free.limits;
  } catch (error) {
    console.error('Error getting user plan limits:', error);
    return SUBSCRIPTION_PLANS.free.limits;
  }
};

// Check if user can perform action based on plan limits
export const checkPlanLimit = async (userEmail, limitType, currentUsage) => {
  try {
    const limits = await getUserPlanLimits(userEmail);
    const limit = limits[limitType];

    if (limit === -1) return { allowed: true, unlimited: true };
    if (limit === 0) return { allowed: false, reason: 'Feature not available on current plan' };
    
    const allowed = currentUsage < limit;
    return { 
      allowed, 
      limit, 
      currentUsage,
      remaining: limit - currentUsage,
      reason: allowed ? null : 'Plan limit reached'
    };
  } catch (error) {
    console.error('Error checking plan limit:', error);
    return { allowed: false, reason: 'Error checking plan limits' };
  }
};

// Transform subscription data from database format
const transformSubscriptionData = (data) => {
  if (!data) return null;

  return {
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
};

// Helper function to get plan name from price ID
const getPlanNameFromId = (priceId) => {
  if (!priceId) return 'free';
  
  // Extract plan name from price ID (e.g., "price_professional" -> "professional")
  const parts = priceId.split('_');
  return parts.length > 1 ? parts[1] : 'free';
};

// Validate subscription data
export const validateSubscriptionData = (subscriptionData) => {
  const errors = [];

  if (!subscriptionData.planId) {
    errors.push('Plan ID is required');
  }

  if (!subscriptionData.status) {
    errors.push('Status is required');
  }

  const validStatuses = ['active', 'canceled', 'trialing', 'past_due', 'unpaid'];
  if (subscriptionData.status && !validStatuses.includes(subscriptionData.status)) {
    errors.push('Invalid subscription status');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export default {
  createOrUpdateSubscription,
  getUserSubscription,
  updateSubscriptionStatus,
  cancelSubscription,
  reactivateSubscription,
  getSubscriptionAnalytics,
  getUserPlanLimits,
  checkPlanLimit,
  validateSubscriptionData
};