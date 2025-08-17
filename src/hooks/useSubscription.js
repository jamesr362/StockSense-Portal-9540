import { useState, useEffect, useCallback } from 'react';
import { getUserSubscription, createOrUpdateSubscription, cancelSubscription, reactivateSubscription, updateSubscriptionStatus, getUserPlanLimits, checkPlanLimit } from '../services/subscriptionService';
import { useAuth } from '../context/AuthContext';
import { logSecurityEvent } from '../utils/security';
import { supabase } from '../lib/supabase';

export const useSubscription = () => {
  const [subscription, setSubscription] = useState(null);
  const [planLimits, setPlanLimits] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  // Load subscription data
  const loadSubscription = useCallback(async () => {
    if (!user?.email) {
      setLoading(false);
      return;
    }
    
    try {
      setError(null);
      
      // Try to load directly from Supabase if available
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('subscriptions_tb2k4x9p1m')
            .select('*')
            .eq('user_email', user.email.toLowerCase())
            .single();
            
          if (!error && data) {
            const subscriptionData = {
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
            
            setSubscription(subscriptionData);
            
            // Get plan limits based on the subscription
            const limits = await getUserPlanLimits(user.email);
            setPlanLimits(limits);
            setLoading(false);
            return;
          }
        } catch (err) {
          console.log('Error fetching directly from Supabase, falling back to service:', err);
        }
      }
      
      // Fallback to service method
      const [subscriptionData, limits] = await Promise.all([
        getUserSubscription(user.email),
        getUserPlanLimits(user.email)
      ]);
      
      setSubscription(subscriptionData);
      setPlanLimits(limits);
    } catch (err) {
      console.error('Error loading subscription:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.email]);

  // Initial load
  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  // Create or update subscription
  const updateSubscription = async (subscriptionData) => {
    if (!user?.email) throw new Error('User not authenticated');
    
    try {
      setError(null);
      
      // Try to update directly in Supabase if available
      if (supabase) {
        try {
          const { data: existingSubscription } = await supabase
            .from('subscriptions_tb2k4x9p1m')
            .select('id')
            .eq('user_email', user.email.toLowerCase())
            .single();
            
          const subscriptionRecord = {
            plan_id: subscriptionData.planId,
            status: subscriptionData.status || 'active',
            current_period_start: subscriptionData.currentPeriodStart || new Date().toISOString(),
            current_period_end: subscriptionData.currentPeriodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date().toISOString()
          };
            
          let result;
          if (existingSubscription) {
            // Update existing subscription
            const { data, error } = await supabase
              .from('subscriptions_tb2k4x9p1m')
              .update(subscriptionRecord)
              .eq('user_email', user.email.toLowerCase())
              .select()
              .single();
              
            if (!error) {
              result = {
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
            }
          }
          
          if (result) {
            setSubscription(result);
            // Reload plan limits as they might have changed
            const newLimits = await getUserPlanLimits(user.email);
            setPlanLimits(newLimits);
            return result;
          }
        } catch (err) {
          console.log('Error updating directly in Supabase, falling back to service:', err);
        }
      }
      
      // Fallback to service method
      const updatedSubscription = await createOrUpdateSubscription(user.email, subscriptionData);
      setSubscription(updatedSubscription);
      
      // Reload plan limits as they might have changed
      const newLimits = await getUserPlanLimits(user.email);
      setPlanLimits(newLimits);
      
      return updatedSubscription;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Cancel subscription
  const cancelUserSubscription = async (cancelAtPeriodEnd = true) => {
    if (!user?.email) throw new Error('User not authenticated');
    
    try {
      setError(null);
      
      // Try to cancel directly in Supabase if available
      if (supabase) {
        try {
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
            .eq('user_email', user.email.toLowerCase())
            .select()
            .single();
            
          if (!error) {
            const result = {
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
            
            setSubscription(result);
            return result;
          }
        } catch (err) {
          console.log('Error canceling directly in Supabase, falling back to service:', err);
        }
      }
      
      // Fallback to service method
      const canceledSubscription = await cancelSubscription(user.email, cancelAtPeriodEnd);
      setSubscription(canceledSubscription);
      
      return canceledSubscription;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Reactivate subscription
  const reactivateUserSubscription = async (planId = null) => {
    if (!user?.email) throw new Error('User not authenticated');
    
    try {
      setError(null);
      
      // Try to reactivate directly in Supabase if available
      if (supabase) {
        try {
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
          
          const { data, error } = await supabase
            .from('subscriptions_tb2k4x9p1m')
            .update(updateData)
            .eq('user_email', user.email.toLowerCase())
            .select()
            .single();
            
          if (!error) {
            const result = {
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
            
            setSubscription(result);
            
            // Reload plan limits
            const newLimits = await getUserPlanLimits(user.email);
            setPlanLimits(newLimits);
            
            return result;
          }
        } catch (err) {
          console.log('Error reactivating directly in Supabase, falling back to service:', err);
        }
      }
      
      // Fallback to service method
      const reactivatedSubscription = await reactivateSubscription(user.email, planId);
      setSubscription(reactivatedSubscription);
      
      // Reload plan limits
      const newLimits = await getUserPlanLimits(user.email);
      setPlanLimits(newLimits);
      
      return reactivatedSubscription;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Update subscription status
  const updateStatus = async (status, endDate = null) => {
    if (!user?.email) throw new Error('User not authenticated');
    
    try {
      setError(null);
      const updatedSubscription = await updateSubscriptionStatus(user.email, status, endDate);
      setSubscription(updatedSubscription);
      return updatedSubscription;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Check if user can perform an action
  const canPerformAction = async (limitType, currentUsage) => {
    if (!user?.email) return { allowed: false, reason: 'User not authenticated' };
    
    try {
      return await checkPlanLimit(user.email, limitType, currentUsage);
    } catch (err) {
      console.error('Error checking plan limit:', err);
      return { allowed: false, reason: 'Error checking limits' };
    }
  };

  // Get current plan info
  const getCurrentPlan = () => {
    if (!subscription) return 'free';
    const planId = subscription.planId;
    if (!planId) return 'free';
    const parts = planId.split('_');
    return parts.length > 1 ? parts[1] : 'free';
  };

  // Check if subscription is active
  const isActive = subscription?.status === 'active';
  const isCanceled = subscription?.status === 'canceled';
  const willCancelAtPeriodEnd = subscription?.cancelAtPeriodEnd && isActive;

  return {
    subscription,
    planLimits,
    loading,
    error,
    isActive,
    isCanceled,
    willCancelAtPeriodEnd,
    currentPlan: getCurrentPlan(),
    // Actions
    loadSubscription,
    updateSubscription,
    cancelSubscription: cancelUserSubscription,
    reactivateSubscription: reactivateUserSubscription,
    updateStatus,
    canPerformAction
  };
};

export default useSubscription;