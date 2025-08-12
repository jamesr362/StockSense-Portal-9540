import {useState, useEffect, useCallback} from 'react';
import {
  getUserSubscription,
  createOrUpdateSubscription,
  cancelSubscription,
  reactivateSubscription,
  updateSubscriptionStatus,
  getUserPlanLimits,
  checkPlanLimit
} from '../services/subscriptionService';
import {useAuth} from '../context/AuthContext';
import {logSecurityEvent} from '../utils/security';

export const useSubscription = () => {
  const [subscription, setSubscription] = useState(null);
  const [planLimits, setPlanLimits] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const {user} = useAuth();

  // Load subscription data
  const loadSubscription = useCallback(async () => {
    if (!user?.email) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
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