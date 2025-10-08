import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { getUserPlanLimits, hasReachedLimit } from '../lib/stripe';

/**
 * Hook for managing feature access and subscription limits
 * Provides real-time feature access based on user's subscription plan
 */
export const useFeatureAccess = () => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [usage, setUsage] = useState({});
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  // Fetch subscription data
  const fetchSubscription = useCallback(async () => {
    if (!user?.email || !supabase) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    try {
      console.log('🔍 Fetching subscription for:', user.email);

      // Check cache first (but refresh every 5 minutes)
      const cacheKey = `subscriptionCache_${user.email}`;
      const cached = localStorage.getItem(cacheKey);
      const now = Date.now();
      
      if (cached && (now - lastRefresh) < 300000) { // 5 minutes
        const cachedData = JSON.parse(cached);
        if (cachedData.timestamp && (now - cachedData.timestamp) < 300000) {
          setSubscription(cachedData.subscription);
          setLoading(false);
          return;
        }
      }

      // Fetch from database
      const { data, error } = await supabase
        .from('subscriptions_tb2k4x9p1m')
        .select('*')
        .eq('user_email', user.email.toLowerCase())
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('❌ Error fetching subscription:', error);
        setSubscription(null);
      } else if (data) {
        console.log('✅ Found subscription:', data);
        setSubscription(data);
        
        // Cache the result
        localStorage.setItem(cacheKey, JSON.stringify({
          subscription: data,
          timestamp: now
        }));
      } else {
        console.log('ℹ️ No subscription found, using free plan');
        setSubscription(null);
      }
    } catch (error) {
      console.error('❌ Error in fetchSubscription:', error);
      setSubscription(null);
    } finally {
      setLoading(false);
      setLastRefresh(Date.now());
    }
  }, [user?.email, lastRefresh]);

  // Fetch usage statistics
  const fetchUsage = useCallback(async () => {
    if (!user?.email || !supabase) {
      setUsage({});
      return;
    }

    try {
      console.log('📊 Fetching usage statistics for:', user.email);

      // Get current month's usage
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      // Fetch inventory count
      const { count: inventoryCount, error: inventoryError } = await supabase
        .from('inventory_tb2k4x9p1m')
        .select('*', { count: 'exact', head: true })
        .eq('user_email', user.email.toLowerCase());

      if (inventoryError) {
        console.warn('⚠️ Error fetching inventory count:', inventoryError);
      }

      // Fetch receipt scans count for current month
      const { count: receiptScansCount, error: scansError } = await supabase
        .from('receipt_scans_tb2k4x9p1m')
        .select('*', { count: 'exact', head: true })
        .eq('user_email', user.email.toLowerCase())
        .gte('created_at', startOfMonth.toISOString());

      if (scansError) {
        console.warn('⚠️ Error fetching receipt scans count:', scansError);
      }

      // Fetch Excel imports count for current month
      const { count: excelImportsCount, error: importsError } = await supabase
        .from('excel_imports_tb2k4x9p1m')
        .select('*', { count: 'exact', head: true })
        .eq('user_email', user.email.toLowerCase())
        .gte('created_at', startOfMonth.toISOString());

      if (importsError) {
        console.warn('⚠️ Error fetching Excel imports count:', importsError);
      }

      const usageData = {
        inventoryItems: inventoryCount || 0,
        receiptScans: receiptScansCount || 0,
        excelImports: excelImportsCount || 0,
        lastUpdated: Date.now()
      };

      console.log('📈 Usage statistics:', usageData);
      setUsage(usageData);

      // Cache usage data
      localStorage.setItem(`usageCache_${user.email}`, JSON.stringify(usageData));

    } catch (error) {
      console.error('❌ Error fetching usage:', error);
      setUsage({});
    }
  }, [user?.email]);

  // Get current plan ID
  const getCurrentPlan = useCallback(() => {
    if (!subscription || subscription.status !== 'active') {
      return 'free';
    }

    // Extract plan from plan_id
    if (subscription.plan_id) {
      if (subscription.plan_id.includes('professional')) return 'professional';
      if (subscription.plan_id.includes('free')) return 'free';
    }

    // Default based on subscription existence
    return subscription ? 'professional' : 'free';
  }, [subscription]);

  // Check if user can access a feature
  const canUseFeature = useCallback((feature) => {
    const currentPlan = getCurrentPlan();
    const limits = getUserPlanLimits(currentPlan);
    
    if (!limits) return false;

    switch (feature) {
      case 'receiptScanner':
        if (currentPlan === 'free') {
          return !hasReachedLimit(currentPlan, 'receiptScans', usage.receiptScans || 0);
        }
        return true;

      case 'excelImporter':
        if (currentPlan === 'free') {
          return !hasReachedLimit(currentPlan, 'excelImport', usage.excelImports || 0);
        }
        return true;

      case 'taxExports':
        return currentPlan === 'professional';

      case 'unlimitedInventory':
        return currentPlan === 'professional';

      case 'addInventoryItem':
        if (currentPlan === 'free') {
          return !hasReachedLimit(currentPlan, 'inventoryItems', usage.inventoryItems || 0);
        }
        return true;

      default:
        return limits.features.includes(feature);
    }
  }, [getCurrentPlan, usage]);

  // Check if user has reached a specific limit
  const isAtLimit = useCallback((limitType) => {
    const currentPlan = getCurrentPlan();
    const currentUsage = usage[limitType] || 0;
    return hasReachedLimit(currentPlan, limitType, currentUsage);
  }, [getCurrentPlan, usage]);

  // Get remaining quota for a feature
  const getRemainingQuota = useCallback((limitType) => {
    const currentPlan = getCurrentPlan();
    const limits = getUserPlanLimits(currentPlan);
    const currentUsage = usage[limitType] || 0;
    
    if (!limits) return 0;
    
    const limit = limits[limitType];
    if (limit === -1) return Infinity; // unlimited
    if (limit === 0) return 0; // not available
    
    return Math.max(0, limit - currentUsage);
  }, [getCurrentPlan, usage]);

  // Refresh feature access data
  const refresh = useCallback(async () => {
    console.log('🔄 Refreshing feature access data...');
    setLoading(true);
    
    // Clear caches
    if (user?.email) {
      localStorage.removeItem(`subscriptionCache_${user.email}`);
      localStorage.removeItem(`usageCache_${user.email}`);
      localStorage.removeItem(`featureCache_${user.email}`);
    }
    
    await Promise.all([fetchSubscription(), fetchUsage()]);
    setLoading(false);
  }, [fetchSubscription, fetchUsage, user?.email]);

  // Initial data fetch
  useEffect(() => {
    if (user?.email) {
      fetchSubscription();
      fetchUsage();
    } else {
      setSubscription(null);
      setUsage({});
      setLoading(false);
    }
  }, [user?.email, fetchSubscription, fetchUsage]);

  // Listen for subscription updates
  useEffect(() => {
    const handleSubscriptionUpdate = async (event) => {
      console.log('📱 Handling subscription update:', event.detail);
      
      if (event.detail.userEmail === user?.email) {
        // Wait a moment for database to be updated
        setTimeout(async () => {
          await refresh();
        }, 1000);
      }
    };

    const handleRefreshRequest = async () => {
      console.log('🔄 Refresh requested');
      await refresh();
    };

    window.addEventListener('subscriptionUpdated', handleSubscriptionUpdate);
    window.addEventListener('refreshFeatureAccess', handleRefreshRequest);

    return () => {
      window.removeEventListener('subscriptionUpdated', handleSubscriptionUpdate);
      window.removeEventListener('refreshFeatureAccess', handleRefreshRequest);
    };
  }, [user?.email, refresh]);

  return {
    subscription,
    usage,
    loading,
    currentPlan: getCurrentPlan(),
    canUseFeature,
    isAtLimit,
    getRemainingQuota,
    refresh,
    limits: getUserPlanLimits(getCurrentPlan())
  };
};

export default useFeatureAccess;