import { useState, useEffect, useCallback } from 'react';
import { 
  getUserSubscription, 
  createOrUpdateSubscription, 
  cancelSubscription, 
  reactivateSubscription, 
  updateSubscriptionStatus, 
  getUserPlanLimits, 
  checkPlanLimit 
} from '../services/subscriptionService';
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
      
      // **ENHANCED**: Try to load directly from Supabase with retry logic
      if (supabase) {
        let attempts = 0;
        const maxAttempts = 3;
        
        while (attempts < maxAttempts) {
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
                stripeSessionId: data.stripe_session_id,
                planId: data.plan_id,
                status: data.status,
                currentPeriodStart: data.current_period_start,
                currentPeriodEnd: data.current_period_end,
                cancelAtPeriodEnd: data.cancel_at_period_end,
                canceledAt: data.canceled_at,
                createdAt: data.created_at,
                updatedAt: data.updated_at
              };
              
              console.log('✅ Subscription loaded from Supabase:', {
                planId: subscriptionData.planId,
                status: subscriptionData.status,
                userEmail: subscriptionData.userEmail
              });
              
              setSubscription(subscriptionData);
              
              // Get plan limits based on the subscription
              const limits = await getUserPlanLimits(user.email);
              setPlanLimits(limits);
              setLoading(false);
              return;
            } else if (error && error.code !== 'PGRST116') {
              console.warn(`⚠️ Subscription load attempt ${attempts + 1} failed:`, error);
              attempts++;
              if (attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
              }
            } else {
              // No subscription found (PGRST116 = no rows returned)
              break;
            }
          } catch (err) {
            console.warn(`⚠️ Subscription load attempt ${attempts + 1} error:`, err);
            attempts++;
            if (attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
            }
          }
        }
      }
      
      // Fallback to service method
      console.log('🔄 Falling back to service method for subscription loading...');
      const [subscriptionData, limits] = await Promise.all([
        getUserSubscription(user.email),
        getUserPlanLimits(user.email)
      ]);
      
      if (subscriptionData) {
        const formattedSubscription = {
          id: subscriptionData.id,
          userEmail: subscriptionData.user_email,
          stripeCustomerId: subscriptionData.stripe_customer_id,
          stripeSubscriptionId: subscriptionData.stripe_subscription_id,
          stripeSessionId: subscriptionData.stripe_session_id,
          planId: subscriptionData.plan_id,
          status: subscriptionData.status,
          currentPeriodStart: subscriptionData.current_period_start,
          currentPeriodEnd: subscriptionData.current_period_end,
          cancelAtPeriodEnd: subscriptionData.cancel_at_period_end,
          canceledAt: subscriptionData.canceled_at,
          createdAt: subscriptionData.created_at,
          updatedAt: subscriptionData.updated_at
        };
        setSubscription(formattedSubscription);
        
        console.log('✅ Subscription loaded via service:', {
          planId: formattedSubscription.planId,
          status: formattedSubscription.status
        });
      } else {
        setSubscription(null);
        console.log('ℹ️ No subscription found, user is on free plan');
      }
      
      setPlanLimits(limits);
    } catch (err) {
      console.error('❌ Error loading subscription:', err);
      setError(err.message);
      
      // Set default free plan limits on error
      const freeLimits = await getUserPlanLimits(user.email);
      setPlanLimits(freeLimits);
    } finally {
      setLoading(false);
    }
  }, [user?.email]);

  // Initial load
  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  // **ENHANCED**: Listen for subscription updates with more event types
  useEffect(() => {
    const eventTypes = [
      'subscriptionUpdated',
      'refreshFeatureAccess',
      'planChanged',
      'userUpgraded',
      'paymentSuccessful'
    ];

    const handleSubscriptionUpdate = (event) => {
      const eventUserEmail = event.detail?.userEmail;
      if (eventUserEmail === user?.email || event.detail?.force) {
        console.log(`🔄 ${event.type} event detected, reloading subscription...`, event.detail);
        
        // Clear caches
        localStorage.removeItem(`featureCache_${user?.email}`);
        localStorage.removeItem(`subscriptionCache_${user?.email}`);
        localStorage.removeItem(`planLimits_${user?.email}`);
        
        // Reload with slight delay to ensure database is updated
        setTimeout(() => {
          loadSubscription();
        }, event.detail?.immediate ? 100 : 1000);
      }
    };

    // Add listeners for all event types
    eventTypes.forEach(eventType => {
      window.addEventListener(eventType, handleSubscriptionUpdate);
    });

    return () => {
      eventTypes.forEach(eventType => {
        window.removeEventListener(eventType, handleSubscriptionUpdate);
      });
    };
  }, [user?.email, loadSubscription]);

  // Create or update subscription
  const updateSubscription = async (subscriptionData) => {
    if (!user?.email) throw new Error('User not authenticated');
    
    try {
      setError(null);
      
      const updatedSubscription = await createOrUpdateSubscription(user.email, subscriptionData);
      
      // Reload subscription and limits
      await loadSubscription();
      
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
      
      const canceledSubscription = await cancelSubscription(user.email, cancelAtPeriodEnd);
      
      // Reload subscription and limits
      await loadSubscription();
      
      return canceledSubscription;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Reactivate subscription
  const reactivateUserSubscription = async (planId = 'professional') => {
    if (!user?.email) throw new Error('User not authenticated');
    
    try {
      setError(null);
      
      const reactivatedSubscription = await reactivateSubscription(user.email, planId);
      
      // Reload subscription and limits
      await loadSubscription();
      
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
      
      // Reload subscription and limits
      await loadSubscription();
      
      return updatedSubscription;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Check if user can perform an action
  const canPerformAction = async (limitType, currentUsage = 0) => {
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
    if (!subscription?.planId) return 'free';
    const parts = subscription.planId.split('_');
    return parts.length > 1 ? parts[1] : 'free';
  };

  // Check if subscription is active
  const isActive = subscription?.status === 'active';
  const isCanceled = subscription?.status === 'canceled';
  const willCancelAtPeriodEnd = subscription?.cancelAtPeriodEnd && isActive;

  // **NEW**: Enhanced subscription status
  const isProfessional = getCurrentPlan() === 'professional' && isActive;
  const hasActiveSubscription = isActive && subscription;

  return {
    subscription,
    planLimits,
    loading,
    error,
    isActive,
    isCanceled,
    willCancelAtPeriodEnd,
    isProfessional,
    hasActiveSubscription,
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