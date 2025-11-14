import { useState, useEffect, useCallback } from 'react';
import { 
  getUserSubscription, 
  getUserPlanLimits, 
  checkPlanLimit,
  cancelSubscription,
  getSubscriptionStatus,
  refreshSubscriptionData,
  clearUserCache
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
      console.log('🔄 Loading subscription data for:', user.email);
      
      // Use the updated service to get subscription and plan limits
      const result = await getUserPlanLimits(user.email);
      
      if (result) {
        setSubscription(result.subscription);
        setPlanLimits(result.planLimits);
        
        console.log('✅ Subscription loaded:', {
          currentPlan: result.currentPlan,
          planName: result.planName,
          hasSubscription: !!result.subscription
        });
      } else {
        setSubscription(null);
        setPlanLimits(null);
        console.log('ℹ️ No subscription data found');
      }
      
    } catch (err) {
      console.error('❌ Error loading subscription:', err);
      setError(err.message);
      
      // Set default state on error
      setSubscription(null);
      setPlanLimits(null);
    } finally {
      setLoading(false);
    }
  }, [user?.email]);

  // Initial load
  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  // Listen for subscription updates with enhanced event handling
  useEffect(() => {
    if (!user?.email) return;

    const eventTypes = [
      'subscriptionUpdated',
      'refreshFeatureAccess',
      'planChanged',
      'userUpgraded',
      'paymentSuccessful',
      'forceSubscriptionSync',
      'globalDataRefresh'
    ];

    const handleSubscriptionUpdate = (event) => {
      const eventUserEmail = event.detail?.userEmail;
      const shouldUpdate = eventUserEmail === user.email || 
                          event.detail?.force || 
                          event.detail?.immediate;
      
      if (shouldUpdate) {
        console.log(`🔄 ${event.type} event detected, reloading subscription...`, event.detail);
        
        // Clear user cache
        clearUserCache(user.email);
        
        // Reload with appropriate delay
        const delay = event.detail?.immediate ? 100 : 1000;
        setTimeout(() => {
          loadSubscription();
        }, delay);
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

  // Cancel subscription
  const cancelUserSubscription = async () => {
    if (!user?.email) throw new Error('User not authenticated');
    
    try {
      setError(null);
      console.log('🚫 Canceling subscription for:', user.email);
      
      await cancelSubscription(user.email);
      
      // Log security event
      await logSecurityEvent('subscription_canceled', {
        userEmail: user.email,
        timestamp: new Date().toISOString()
      });
      
      // Reload subscription and limits
      await loadSubscription();
      
      return true;
    } catch (err) {
      console.error('❌ Error canceling subscription:', err);
      setError(err.message);
      throw err;
    }
  };

  // Force refresh subscription data
  const forceRefresh = async () => {
    if (!user?.email) return;
    
    try {
      setError(null);
      setLoading(true);
      console.log('🔄 Force refreshing subscription data...');
      
      const result = await refreshSubscriptionData(user.email);
      
      if (result) {
        setSubscription(result.subscription);
        setPlanLimits(result.planLimits);
      }
      
    } catch (err) {
      console.error('❌ Error force refreshing subscription:', err);
      setError(err.message);
    } finally {
      setLoading(false);
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
    
    // Extract plan from planId (e.g., "price_professional" -> "professional")
    if (subscription.planId.includes('professional')) {
      return 'professional';
    }
    return 'free';
  };

  // Get subscription status details
  const getStatusDetails = async () => {
    if (!user?.email) return null;
    
    try {
      return await getSubscriptionStatus(user.email);
    } catch (err) {
      console.error('Error getting subscription status:', err);
      return null;
    }
  };

  // Computed properties
  const isActive = subscription?.status === 'active';
  const isCanceled = subscription?.status === 'canceled';
  const willCancelAtPeriodEnd = subscription?.cancelAtPeriodEnd && isActive;
  const isProfessional = getCurrentPlan() === 'professional' && isActive;
  const hasActiveSubscription = isActive && subscription;
  const currentPlan = getCurrentPlan();

  // Plan limit helpers
  const getPlanLimit = (limitType) => {
    if (!planLimits) return 0;
    return planLimits[limitType] || 0;
  };

  const isUnlimited = (limitType) => {
    const limit = getPlanLimit(limitType);
    return limit === -1;
  };

  const hasFeature = (featureName) => {
    if (isProfessional) return true;
    
    // Check specific free plan features
    const freeFeatures = ['purchaseEntries', 'receiptScans', 'excelImports', 'vatExports'];
    return freeFeatures.includes(featureName);
  };

  return {
    // Data
    subscription,
    planLimits,
    loading,
    error,
    
    // Status
    isActive,
    isCanceled,
    willCancelAtPeriodEnd,
    isProfessional,
    hasActiveSubscription,
    currentPlan,
    
    // Actions
    loadSubscription,
    forceRefresh,
    cancelSubscription: cancelUserSubscription,
    canPerformAction,
    getStatusDetails,
    
    // Helpers
    getPlanLimit,
    isUnlimited,
    hasFeature
  };
};

export default useSubscription;