import { supabase } from '../lib/supabase';
import { logSecurityEvent } from '../utils/security';
import { SUBSCRIPTION_PLANS } from '../lib/stripe';

// Create or update subscription
export const createOrUpdateSubscription = async (userEmail, subscriptionData) => {
  try {
    logSecurityEvent('SUBSCRIPTION_CREATE_UPDATE_ATTEMPT', {
      userEmail,
      planId: subscriptionData.planId
    });

    // Check if we're using Supabase
    if (supabase) {
      // First get the plan ID from the plan name or price ID
      let planId = subscriptionData.planId;
      
      // If we have a price ID like "price_professional", extract the plan name
      if (planId && planId.startsWith('price_')) {
        const planName = planId.split('_')[1];
        
        // Get the plan ID from the name
        const { data: planData } = await supabase
          .from('subscription_plans_p3k7j2l')
          .select('id')
          .ilike('name', planName)
          .single();
          
        if (planData) {
          planId = planData.id;
        }
      }

      // Check if subscription exists
      const { data: existingSubscription } = await supabase
        .from('user_subscriptions_p3k7j2l')
        .select('*')
        .eq('user_email', userEmail.toLowerCase())
        .single();

      const subscriptionRecord = {
        user_email: userEmail.toLowerCase(),
        plan_id: planId,
        status: subscriptionData.status || 'active',
        start_date: subscriptionData.currentPeriodStart || new Date().toISOString(),
        end_date: subscriptionData.currentPeriodEnd || null,
        updated_at: new Date().toISOString()
      };

      let result;
      if (existingSubscription) {
        // Update existing subscription
        const { data, error } = await supabase
          .from('user_subscriptions_p3k7j2l')
          .update(subscriptionRecord)
          .eq('user_email', userEmail.toLowerCase())
          .select()
          .single();

        if (error) throw error;
        result = data;
      } else {
        // Create new subscription
        subscriptionRecord.created_at = new Date().toISOString();
        const { data, error } = await supabase
          .from('user_subscriptions_p3k7j2l')
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

      // Get plan details to return
      const { data: planDetails } = await supabase
        .from('subscription_plans_p3k7j2l')
        .select('name, limits')
        .eq('id', result.plan_id)
        .single();

      return {
        id: result.id,
        userEmail: result.user_email,
        planId: result.plan_id,
        planName: planDetails?.name || 'Unknown',
        limits: planDetails?.limits || {},
        status: result.status,
        startDate: result.start_date,
        endDate: result.end_date,
        createdAt: result.created_at,
        updatedAt: result.updated_at
      };
    }

    // Fallback to mock implementation if Supabase is not available
    const mockResult = {
      id: `sub_${Math.random().toString(36).substring(2, 15)}`,
      userEmail: userEmail,
      planId: subscriptionData.planId,
      planName: subscriptionData.planId.split('_')[1] || 'Free',
      status: subscriptionData.status || 'active',
      startDate: subscriptionData.currentPeriodStart || new Date().toISOString(),
      endDate: subscriptionData.currentPeriodEnd || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    logSecurityEvent('SUBSCRIPTION_CREATE_UPDATE_SUCCESS_MOCK', {
      userEmail,
      planId: subscriptionData.planId
    });

    return mockResult;
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
    // Check if we're using Supabase
    if (supabase) {
      const { data, error } = await supabase
        .from('user_subscriptions_p3k7j2l')
        .select(`
          id,
          user_email,
          plan_id,
          status,
          start_date,
          end_date,
          created_at,
          updated_at,
          subscription_plans_p3k7j2l (
            name,
            price,
            limits
          )
        `)
        .eq('user_email', userEmail.toLowerCase())
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No subscription found, return null
          return null;
        }
        throw error;
      }

      if (!data) return null;

      // Format the subscription data
      return {
        id: data.id,
        userEmail: data.user_email,
        planId: data.plan_id,
        planName: data.subscription_plans_p3k7j2l?.name || 'Unknown',
        price: data.subscription_plans_p3k7j2l?.price || 0,
        limits: data.subscription_plans_p3k7j2l?.limits || {},
        status: data.status,
        startDate: data.start_date,
        endDate: data.end_date,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    }

    // Fallback to mock implementation
    const planName = 'Professional'; // Default to Professional for mock data
    const plan = SUBSCRIPTION_PLANS[planName.toLowerCase()] || SUBSCRIPTION_PLANS.free;

    return {
      id: `sub_${Math.random().toString(36).substring(2, 15)}`,
      userEmail: userEmail,
      planId: `price_${planName.toLowerCase()}`,
      planName: planName,
      price: plan.price,
      limits: plan.limits,
      status: 'active',
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString()
    };
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

    // Check if we're using Supabase
    if (supabase) {
      const updateData = {
        status,
        updated_at: new Date().toISOString()
      };

      if (endDate) {
        updateData.end_date = endDate;
      }

      const { data, error } = await supabase
        .from('user_subscriptions_p3k7j2l')
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

      // Get plan details
      const { data: planDetails } = await supabase
        .from('subscription_plans_p3k7j2l')
        .select('name, limits')
        .eq('id', data.plan_id)
        .single();

      return {
        id: data.id,
        userEmail: data.user_email,
        planId: data.plan_id,
        planName: planDetails?.name || 'Unknown',
        limits: planDetails?.limits || {},
        status: data.status,
        startDate: data.start_date,
        endDate: data.end_date,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    }

    // Fallback to mock implementation
    logSecurityEvent('SUBSCRIPTION_STATUS_UPDATE_SUCCESS_MOCK', {
      userEmail,
      status
    });

    const planName = 'Professional'; // Default to Professional for mock data
    const plan = SUBSCRIPTION_PLANS[planName.toLowerCase()] || SUBSCRIPTION_PLANS.free;

    return {
      id: `sub_${Math.random().toString(36).substring(2, 15)}`,
      userEmail: userEmail,
      planId: `price_${planName.toLowerCase()}`,
      planName: planName,
      price: plan.price,
      limits: plan.limits,
      status: status,
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString()
    };
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

    // Check if we're using Supabase
    if (supabase) {
      const status = cancelAtPeriodEnd ? 'active' : 'canceled';
      const canceledAt = new Date().toISOString();

      const updateData = {
        status,
        canceled_at: canceledAt,
        updated_at: new Date().toISOString()
      };

      // If canceling immediately, set end date to now
      if (!cancelAtPeriodEnd) {
        updateData.end_date = canceledAt;
      }

      const { data, error } = await supabase
        .from('user_subscriptions_p3k7j2l')
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

      // Get plan details
      const { data: planDetails } = await supabase
        .from('subscription_plans_p3k7j2l')
        .select('name, limits')
        .eq('id', data.plan_id)
        .single();

      return {
        id: data.id,
        userEmail: data.user_email,
        planId: data.plan_id,
        planName: planDetails?.name || 'Unknown',
        limits: planDetails?.limits || {},
        status: data.status,
        startDate: data.start_date,
        endDate: data.end_date,
        canceledAt: canceledAt,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    }

    // Fallback to mock implementation
    logSecurityEvent('SUBSCRIPTION_CANCEL_SUCCESS_MOCK', {
      userEmail,
      cancelAtPeriodEnd
    });

    const planName = 'Professional'; // Default to Professional for mock data
    const plan = SUBSCRIPTION_PLANS[planName.toLowerCase()] || SUBSCRIPTION_PLANS.free;

    return {
      id: `sub_${Math.random().toString(36).substring(2, 15)}`,
      userEmail: userEmail,
      planId: `price_${planName.toLowerCase()}`,
      planName: planName,
      price: plan.price,
      limits: plan.limits,
      status: cancelAtPeriodEnd ? 'active' : 'canceled',
      canceledAt: new Date().toISOString(),
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: cancelAtPeriodEnd
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        : new Date().toISOString(),
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString()
    };
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

    // Check if we're using Supabase
    if (supabase) {
      let updateData = {
        status: 'active',
        canceled_at: null,
        end_date: null,
        updated_at: new Date().toISOString()
      };

      // If a plan ID is provided, update it
      if (planId) {
        // If we have a price ID like "price_professional", extract the plan name
        if (planId.startsWith('price_')) {
          const planName = planId.split('_')[1];
          
          // Get the plan ID from the name
          const { data: planData } = await supabase
            .from('subscription_plans_p3k7j2l')
            .select('id')
            .ilike('name', planName)
            .single();
            
          if (planData) {
            updateData.plan_id = planData.id;
          }
        } else {
          updateData.plan_id = planId;
        }
      }

      const { data, error } = await supabase
        .from('user_subscriptions_p3k7j2l')
        .update(updateData)
        .eq('user_email', userEmail.toLowerCase())
        .select()
        .single();

      if (error) throw error;

      logSecurityEvent('SUBSCRIPTION_REACTIVATE_SUCCESS', {
        userEmail,
        subscriptionId: data.id
      });

      // Get plan details
      const { data: planDetails } = await supabase
        .from('subscription_plans_p3k7j2l')
        .select('name, limits')
        .eq('id', data.plan_id)
        .single();

      return {
        id: data.id,
        userEmail: data.user_email,
        planId: data.plan_id,
        planName: planDetails?.name || 'Unknown',
        limits: planDetails?.limits || {},
        status: data.status,
        startDate: data.start_date,
        endDate: null,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    }

    // Fallback to mock implementation
    logSecurityEvent('SUBSCRIPTION_REACTIVATE_SUCCESS_MOCK', {
      userEmail,
      planId
    });

    // Use the provided plan ID or default to Professional
    const providedPlanName = planId ? planId.split('_')[1] : 'Professional';
    const planName = providedPlanName || 'Professional';
    const plan = SUBSCRIPTION_PLANS[planName.toLowerCase()] || SUBSCRIPTION_PLANS.professional;

    return {
      id: `sub_${Math.random().toString(36).substring(2, 15)}`,
      userEmail: userEmail,
      planId: `price_${planName.toLowerCase()}`,
      planName: planName,
      price: plan.price,
      limits: plan.limits,
      status: 'active',
      startDate: new Date().toISOString(),
      endDate: null,
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString()
    };
  } catch (error) {
    logSecurityEvent('SUBSCRIPTION_REACTIVATE_ERROR', {
      userEmail,
      error: error.message
    });
    throw error;
  }
};

// Get user's plan limits
export const getUserPlanLimits = async (userEmail) => {
  try {
    // Check if we're using Supabase
    if (supabase) {
      const { data, error } = await supabase
        .from('user_subscriptions_p3k7j2l')
        .select(`
          subscription_plans_p3k7j2l (
            name,
            limits
          )
        `)
        .eq('user_email', userEmail.toLowerCase())
        .eq('status', 'active')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No subscription found, return Free plan limits
          return SUBSCRIPTION_PLANS.free.limits;
        }
        throw error;
      }

      return data?.subscription_plans_p3k7j2l?.limits || SUBSCRIPTION_PLANS.free.limits;
    }

    // Fallback to mock implementation
    return SUBSCRIPTION_PLANS.professional.limits;
  } catch (error) {
    console.error('Error getting user plan limits:', error);
    return SUBSCRIPTION_PLANS.free.limits;
  }
};

// Check if user can perform action based on plan limits
export const checkPlanLimit = async (userEmail, limitType, currentUsage) => {
  try {
    // Check if we're using Supabase
    if (supabase) {
      // Call the database function to check access
      const { data, error } = await supabase.rpc('check_feature_access', {
        user_email: userEmail,
        feature_name: limitType
      });
      
      if (error) throw error;
      
      // If access is denied, get the reason from the logs
      if (!data) {
        const { data: logData } = await supabase
          .from('feature_access_logs_p3k7j2l')
          .select('reason')
          .eq('user_email', userEmail)
          .eq('feature_name', limitType)
          .eq('access_granted', false)
          .order('timestamp', { ascending: false })
          .limit(1);
          
        return {
          allowed: false,
          reason: logData?.[0]?.reason || 'Feature not available on current plan'
        };
      }
      
      return { allowed: true };
    }

    // Fallback to client-side check
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
  getUserPlanLimits,
  checkPlanLimit,
  validateSubscriptionData
};