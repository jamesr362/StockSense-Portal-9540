import { supabase } from '../lib/supabase';
import { logSecurityEvent } from '../utils/security';
import { SUBSCRIPTION_PLANS } from '../lib/stripe';

/**
 * Complete subscription management service
 * Handles all subscription operations with proper error handling
 */

/**
 * Update user subscription directly in the database
 */
export const updateUserSubscription = async (userEmail, planId, sessionId = null) => {
  try {
    console.log('📝 Updating user subscription directly:', { userEmail, planId, sessionId });

    if (!userEmail || !planId) {
      throw new Error('User email and plan ID are required');
    }

    const subscriptionData = {
      user_email: userEmail.toLowerCase(),
      stripe_customer_id: sessionId ? `cus_${sessionId.substring(3, 13)}` : `cus_${Math.random().toString(36).substring(2, 15)}`,
      stripe_subscription_id: sessionId ? `sub_${sessionId.substring(3, 13)}` : `sub_${Math.random().toString(36).substring(2, 15)}`,
      stripe_session_id: sessionId,
      plan_id: `price_${planId}`,
      status: 'active',
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      cancel_at_period_end: false,
      canceled_at: null,
      updated_at: new Date().toISOString()
    };

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('subscriptions_tb2k4x9p1m')
          .upsert(subscriptionData, { 
            onConflict: 'user_email',
            ignoreDuplicates: false 
          })
          .select();

        if (error) {
          console.error('❌ Error upserting subscription:', error);
          
          if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
            console.log('🔧 Table does not exist, initializing database...');
            
            const { initializeDatabase } = await import('./supabaseSetup');
            const initialized = await initializeDatabase();
            
            if (initialized) {
              const { data: retryData, error: retryError } = await supabase
                .from('subscriptions_tb2k4x9p1m')
                .upsert(subscriptionData, { 
                  onConflict: 'user_email',
                  ignoreDuplicates: false 
                })
                .select();

              if (retryError) throw retryError;
              
              console.log('✅ Subscription updated after database initialization');
              return retryData;
            }
          }
          
          throw error;
        }

        console.log('✅ Subscription updated successfully:', data);

        // Clear caches
        localStorage.removeItem(`featureCache_${userEmail}`);
        localStorage.removeItem(`subscriptionCache_${userEmail}`);

        // Dispatch update event
        window.dispatchEvent(new CustomEvent('subscriptionUpdated', {
          detail: { 
            userEmail, 
            planId, 
            sessionId,
            immediate: true,
            source: 'direct_service'
          }
        }));

        logSecurityEvent('DIRECT_SUBSCRIPTION_UPDATE', {
          userEmail,
          planId,
          sessionId
        });

        return data;

      } catch (supabaseError) {
        console.error('❌ Supabase error in direct subscription update:', supabaseError);
        throw supabaseError;
      }
    } else {
      console.warn('⚠️ Supabase not available, using local storage fallback');
      
      const localSubscriptions = JSON.parse(localStorage.getItem('localSubscriptions') || '{}');
      localSubscriptions[userEmail] = subscriptionData;
      localStorage.setItem('localSubscriptions', JSON.stringify(localSubscriptions));
      
      return [subscriptionData];
    }

  } catch (error) {
    console.error('❌ Error in direct subscription update:', error);
    logSecurityEvent('DIRECT_SUBSCRIPTION_UPDATE_ERROR', {
      error: error.message,
      userEmail,
      planId
    });
    throw error;
  }
};

/**
 * Get user subscription from database
 */
export const getUserSubscription = async (userEmail) => {
  try {
    if (!userEmail) {
      throw new Error('User email is required');
    }

    console.log('🔍 Fetching subscription for:', userEmail);

    if (supabase) {
      const { data, error } = await supabase
        .from('subscriptions_tb2k4x9p1m')
        .select('*')
        .eq('user_email', userEmail.toLowerCase())
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('❌ Error fetching subscription:', error);
        
        if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
          console.log('ℹ️ Subscriptions table does not exist, user is on free plan');
          return null;
        }
        
        throw error;
      }

      console.log('📊 Subscription data:', data);
      return data;

    } else {
      console.warn('⚠️ Supabase not available, checking local storage');
      
      const localSubscriptions = JSON.parse(localStorage.getItem('localSubscriptions') || '{}');
      return localSubscriptions[userEmail] || null;
    }

  } catch (error) {
    console.error('❌ Error fetching user subscription:', error);
    return null;
  }
};

/**
 * Create or update subscription (alias for updateUserSubscription)
 */
export const createOrUpdateSubscription = async (userEmail, subscriptionData) => {
  try {
    const planId = subscriptionData.planId || 'professional';
    const sessionId = subscriptionData.stripeSessionId || subscriptionData.sessionId;
    
    return await updateUserSubscription(userEmail, planId, sessionId);
  } catch (error) {
    console.error('❌ Error creating/updating subscription:', error);
    throw error;
  }
};

/**
 * Cancel user subscription
 */
export const cancelSubscription = async (userEmail, cancelAtPeriodEnd = true) => {
  try {
    console.log('🗑️ Canceling subscription for:', userEmail, { cancelAtPeriodEnd });

    if (supabase) {
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

      const { data, error } = await supabase
        .from('subscriptions_tb2k4x9p1m')
        .update(updateData)
        .eq('user_email', userEmail.toLowerCase())
        .select();

      if (error) {
        console.error('❌ Error canceling subscription:', error);
        throw error;
      }

      // Clear caches
      localStorage.removeItem(`featureCache_${userEmail}`);
      localStorage.removeItem(`subscriptionCache_${userEmail}`);

      // Dispatch update event
      window.dispatchEvent(new CustomEvent('subscriptionUpdated', {
        detail: { 
          userEmail, 
          planId: cancelAtPeriodEnd ? null : 'free',
          source: 'cancellation'
        }
      }));

      logSecurityEvent('SUBSCRIPTION_CANCELED', {
        userEmail,
        cancelAtPeriodEnd
      });

      console.log('✅ Subscription canceled successfully');
      return data;

    } else {
      // Fallback to local storage
      const localSubscriptions = JSON.parse(localStorage.getItem('localSubscriptions') || '{}');
      if (localSubscriptions[userEmail]) {
        localSubscriptions[userEmail].status = cancelAtPeriodEnd ? 'active' : 'canceled';
        localSubscriptions[userEmail].canceled_at = new Date().toISOString();
        localSubscriptions[userEmail].cancel_at_period_end = cancelAtPeriodEnd;
        localStorage.setItem('localSubscriptions', JSON.stringify(localSubscriptions));
      }
      
      return localSubscriptions[userEmail];
    }

  } catch (error) {
    console.error('❌ Error canceling subscription:', error);
    throw error;
  }
};

/**
 * Reactivate a canceled subscription
 */
export const reactivateSubscription = async (userEmail, planId = 'professional') => {
  try {
    console.log('🔄 Reactivating subscription for:', userEmail, { planId });

    if (supabase) {
      const updateData = {
        status: 'active',
        plan_id: `price_${planId}`,
        canceled_at: null,
        cancel_at_period_end: false,
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('subscriptions_tb2k4x9p1m')
        .update(updateData)
        .eq('user_email', userEmail.toLowerCase())
        .select();

      if (error) {
        console.error('❌ Error reactivating subscription:', error);
        throw error;
      }

      // Clear caches
      localStorage.removeItem(`featureCache_${userEmail}`);
      localStorage.removeItem(`subscriptionCache_${userEmail}`);

      // Dispatch update event
      window.dispatchEvent(new CustomEvent('subscriptionUpdated', {
        detail: { 
          userEmail, 
          planId,
          source: 'reactivation'
        }
      }));

      logSecurityEvent('SUBSCRIPTION_REACTIVATED', {
        userEmail,
        planId
      });

      console.log('✅ Subscription reactivated successfully');
      return data;

    } else {
      // Fallback to local storage
      const localSubscriptions = JSON.parse(localStorage.getItem('localSubscriptions') || '{}');
      if (localSubscriptions[userEmail]) {
        localSubscriptions[userEmail].status = 'active';
        localSubscriptions[userEmail].plan_id = `price_${planId}`;
        localSubscriptions[userEmail].canceled_at = null;
        localSubscriptions[userEmail].cancel_at_period_end = false;
        localStorage.setItem('localSubscriptions', JSON.stringify(localSubscriptions));
      }
      
      return localSubscriptions[userEmail];
    }

  } catch (error) {
    console.error('❌ Error reactivating subscription:', error);
    throw error;
  }
};

/**
 * Update subscription status
 */
export const updateSubscriptionStatus = async (userEmail, status, endDate = null) => {
  try {
    console.log('📊 Updating subscription status for:', userEmail, { status, endDate });

    if (supabase) {
      const updateData = {
        status,
        updated_at: new Date().toISOString()
      };

      if (endDate) {
        updateData.current_period_end = new Date(endDate).toISOString();
      }

      const { data, error } = await supabase
        .from('subscriptions_tb2k4x9p1m')
        .update(updateData)
        .eq('user_email', userEmail.toLowerCase())
        .select();

      if (error) {
        console.error('❌ Error updating subscription status:', error);
        throw error;
      }

      // Clear caches
      localStorage.removeItem(`featureCache_${userEmail}`);
      localStorage.removeItem(`subscriptionCache_${userEmail}`);

      logSecurityEvent('SUBSCRIPTION_STATUS_UPDATED', {
        userEmail,
        status,
        endDate
      });

      console.log('✅ Subscription status updated successfully');
      return data;

    } else {
      // Fallback to local storage
      const localSubscriptions = JSON.parse(localStorage.getItem('localSubscriptions') || '{}');
      if (localSubscriptions[userEmail]) {
        localSubscriptions[userEmail].status = status;
        if (endDate) {
          localSubscriptions[userEmail].current_period_end = new Date(endDate).toISOString();
        }
        localStorage.setItem('localSubscriptions', JSON.stringify(localSubscriptions));
      }
      
      return localSubscriptions[userEmail];
    }

  } catch (error) {
    console.error('❌ Error updating subscription status:', error);
    throw error;
  }
};

/**
 * Get user plan limits based on their subscription
 */
export const getUserPlanLimits = async (userEmail) => {
  try {
    console.log('📋 Getting plan limits for:', userEmail);

    const subscription = await getUserSubscription(userEmail);
    
    let planId = 'free';
    if (subscription?.plan_id) {
      // Extract plan from price_id (e.g., "price_professional" -> "professional")
      const parts = subscription.plan_id.split('_');
      planId = parts.length > 1 ? parts[1] : 'free';
    }

    // Get plan configuration from stripe.js
    const plan = SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS.free;
    
    console.log('📊 Plan limits for', planId, ':', plan.limits);
    
    return {
      planId,
      limits: plan.limits,
      features: plan.features,
      isActive: subscription?.status === 'active'
    };

  } catch (error) {
    console.error('❌ Error getting user plan limits:', error);
    
    // Return free plan limits as fallback
    return {
      planId: 'free',
      limits: SUBSCRIPTION_PLANS.free.limits,
      features: SUBSCRIPTION_PLANS.free.features,
      isActive: false
    };
  }
};

/**
 * Check if user can perform an action based on plan limits
 */
export const checkPlanLimit = async (userEmail, limitType, currentUsage = 0) => {
  try {
    console.log('🔍 Checking plan limit for:', userEmail, { limitType, currentUsage });

    const planLimits = await getUserPlanLimits(userEmail);
    
    if (!planLimits.isActive && limitType !== 'inventoryItems') {
      return {
        allowed: false,
        reason: 'Subscription not active',
        limit: 0,
        usage: currentUsage
      };
    }

    const limit = planLimits.limits[limitType];
    
    if (limit === -1) {
      // Unlimited
      return {
        allowed: true,
        reason: 'Unlimited',
        limit: -1,
        usage: currentUsage
      };
    }

    if (limit === 0) {
      // Not allowed
      return {
        allowed: false,
        reason: 'Feature not available in current plan',
        limit: 0,
        usage: currentUsage
      };
    }

    const allowed = currentUsage < limit;
    
    return {
      allowed,
      reason: allowed ? 'Within limits' : 'Limit exceeded',
      limit,
      usage: currentUsage,
      remaining: Math.max(0, limit - currentUsage)
    };

  } catch (error) {
    console.error('❌ Error checking plan limit:', error);
    
    // Conservative fallback - deny access
    return {
      allowed: false,
      reason: 'Error checking limits',
      limit: 0,
      usage: currentUsage
    };
  }
};

/**
 * Legacy alias for cancelUserSubscription (for backward compatibility)
 */
export const cancelUserSubscription = async (userEmail) => {
  return await cancelSubscription(userEmail, false); // Immediate cancellation
};

export default {
  updateUserSubscription,
  getUserSubscription,
  createOrUpdateSubscription,
  cancelSubscription,
  reactivateSubscription,
  updateSubscriptionStatus,
  getUserPlanLimits,
  checkPlanLimit,
  cancelUserSubscription
};