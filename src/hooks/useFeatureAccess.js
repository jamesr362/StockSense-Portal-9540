import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserPlanLimits, checkPlanLimit } from '../services/subscriptionService';

/**
 * Hook for managing feature access and subscription limits
 * Provides real-time feature access based on user's subscription plan
 */
export const useFeatureAccess = () => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [planLimits, setPlanLimits] = useState(null);
  const [usage, setUsage] = useState({
    inventoryItems: 0,
    receiptScans: 0,
    excelImports: 0
  });
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  // Fetch subscription data
  const fetchSubscription = useCallback(async () => {
    if (!user?.email) {
      setSubscription(null);
      setPlanLimits(null);
      setLoading(false);
      return;
    }

    try {
      console.log('🔍 Fetching subscription for:', user.email);

      // Get user subscription and plan limits
      const { subscription: userSubscription, planLimits: limits } = await getUserPlanLimits(user.email);
      
      console.log('✅ Found subscription:', userSubscription);
      console.log('✅ Plan limits:', limits);
      
      setSubscription(userSubscription);
      setPlanLimits(limits);

    } catch (error) {
      console.error('❌ Error fetching subscription:', error);
      setSubscription(null);
      setPlanLimits({
        inventoryItems: 100,
        receiptScans: 1,
        excelImports: 1,
        taxExports: false,
        features: ['inventory']
      });
    } finally {
      setLoading(false);
      setLastRefresh(Date.now());
    }
  }, [user?.email]);

  // Fetch usage statistics
  const fetchUsage = useCallback(async () => {
    if (!user?.email) {
      setUsage({ inventoryItems: 0, receiptScans: 0, excelImports: 0 });
      return;
    }

    try {
      console.log('📊 Fetching usage statistics for:', user.email);

      // Get current usage from various sources
      const inventoryCount = await getCurrentInventoryCount();
      const monthlyScans = await getCurrentMonthScans();
      const monthlyImports = await getCurrentMonthImports();

      const usageData = {
        inventoryItems: inventoryCount,
        receiptScans: monthlyScans,
        excelImports: monthlyImports,
        lastUpdated: Date.now()
      };

      console.log('📈 Usage statistics:', usageData);
      setUsage(usageData);

    } catch (error) {
      console.error('❌ Error fetching usage:', error);
      setUsage({ inventoryItems: 0, receiptScans: 0, excelImports: 0 });
    }
  }, [user?.email]);

  // Helper functions to get current usage
  const getCurrentInventoryCount = async () => {
    try {
      const { getInventoryItems } = await import('../services/db');
      const items = await getInventoryItems(user.email);
      return items.length;
    } catch (error) {
      console.error('Error getting inventory count:', error);
      return 0;
    }
  };

  const getCurrentMonthScans = async () => {
    try {
      const stored = localStorage.getItem(`scanHistory_${user.email}`);
      if (!stored) return 0;
      
      const history = JSON.parse(stored);
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      return history.filter(scan => 
        new Date(scan.timestamp) >= startOfMonth
      ).length;
    } catch (error) {
      console.error('Error getting scan count:', error);
      return 0;
    }
  };

  const getCurrentMonthImports = async () => {
    try {
      const stored = localStorage.getItem(`importHistory_${user.email}`);
      if (!stored) return 0;
      
      const history = JSON.parse(stored);
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      return history.filter(imp => 
        new Date(imp.timestamp) >= startOfMonth
      ).length;
    } catch (error) {
      console.error('Error getting import count:', error);
      return 0;
    }
  };

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

  // Get plan info
  const getPlanInfo = useCallback(() => {
    const currentPlan = getCurrentPlan();
    const planInfoMap = {
      free: { name: 'Free Plan', color: 'gray' },
      professional: { name: 'Professional Plan', color: 'green' }
    };
    return planInfoMap[currentPlan] || planInfoMap.free;
  }, [getCurrentPlan]);

  // Check if user can access a feature
  const canUseFeature = useCallback((feature) => {
    const currentPlan = getCurrentPlan();
    
    switch (feature) {
      case 'receiptScanner':
        if (currentPlan === 'free') {
          return usage.receiptScans < (planLimits?.receiptScans || 1);
        }
        return true;

      case 'excelImporter':
        if (currentPlan === 'free') {
          return usage.excelImports < (planLimits?.excelImports || 1);
        }
        return true;

      case 'taxExports':
        return currentPlan === 'professional';

      case 'unlimitedInventory':
        return currentPlan === 'professional';

      default:
        return planLimits?.features?.includes(feature) || false;
    }
  }, [getCurrentPlan, usage, planLimits]);

  // Check if user can add inventory item
  const canAddInventoryItem = useCallback((currentCount = null) => {
    const currentPlan = getCurrentPlan();
    const count = currentCount !== null ? currentCount : usage.inventoryItems;
    
    if (currentPlan === 'professional') {
      return { allowed: true, limit: -1, remaining: Infinity };
    }
    
    const limit = planLimits?.inventoryItems || 100;
    const allowed = count < limit;
    const remaining = Math.max(0, limit - count);
    
    return {
      allowed,
      limit,
      remaining,
      reason: allowed ? null : `You have reached your inventory limit of ${limit} items. Upgrade to Professional for unlimited items.`
    };
  }, [getCurrentPlan, usage.inventoryItems, planLimits]);

  // Check if user can scan receipt
  const canScanReceipt = useCallback(() => {
    const currentPlan = getCurrentPlan();
    
    if (currentPlan === 'professional') {
      return { allowed: true, limit: -1, remaining: Infinity };
    }
    
    const limit = planLimits?.receiptScans || 1;
    const used = usage.receiptScans;
    const allowed = used < limit;
    const remaining = Math.max(0, limit - used);
    
    return {
      allowed,
      limit,
      used,
      remaining,
      reason: allowed ? null : `You have used all ${limit} receipt scans for this month. Upgrade to Professional for unlimited scans.`
    };
  }, [getCurrentPlan, usage.receiptScans, planLimits]);

  // Check if user can import Excel
  const canImportExcel = useCallback(() => {
    const currentPlan = getCurrentPlan();
    
    if (currentPlan === 'professional') {
      return { allowed: true, limit: -1, remaining: Infinity };
    }
    
    const limit = planLimits?.excelImports || 1;
    const used = usage.excelImports;
    const allowed = used < limit;
    const remaining = Math.max(0, limit - used);
    
    return {
      allowed,
      limit,
      used,
      remaining,
      reason: allowed ? null : `You have used all ${limit} Excel imports for this month. Upgrade to Professional for unlimited imports.`
    };
  }, [getCurrentPlan, usage.excelImports, planLimits]);

  // Increment usage counter
  const incrementUsage = useCallback((type) => {
    setUsage(prev => ({
      ...prev,
      [type]: (prev[type] || 0) + 1
    }));
    
    // Update localStorage for persistence
    if (user?.email) {
      const key = type === 'receiptScan' ? `scanHistory_${user.email}` : 
                   type === 'excelImport' ? `importHistory_${user.email}` : null;
      
      if (key) {
        try {
          const stored = localStorage.getItem(key);
          const history = stored ? JSON.parse(stored) : [];
          // The actual history update happens in the respective components
          // This is just for immediate UI feedback
        } catch (error) {
          console.error('Error updating usage counter:', error);
        }
      }
    }
  }, [user?.email]);

  // Refresh feature access data
  const refresh = useCallback(async () => {
    console.log('🔄 Refreshing feature access data...');
    setLoading(true);
    
    await Promise.all([fetchSubscription(), fetchUsage()]);
    setLoading(false);
  }, [fetchSubscription, fetchUsage]);

  // Initial data fetch
  useEffect(() => {
    if (user?.email) {
      fetchSubscription();
      fetchUsage();
    } else {
      setSubscription(null);
      setPlanLimits(null);
      setUsage({ inventoryItems: 0, receiptScans: 0, excelImports: 0 });
      setLoading(false);
    }
  }, [user?.email, fetchSubscription, fetchUsage]);

  // Listen for subscription updates
  useEffect(() => {
    const handleSubscriptionUpdate = async (event) => {
      console.log('📱 Handling subscription update:', event.detail);
      
      if (event.detail.userEmail === user?.email) {
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
    planLimits,
    usage,
    usageStats: usage, // Alias for backward compatibility
    loading,
    currentPlan: getCurrentPlan(),
    planInfo: getPlanInfo(),
    canUseFeature,
    canAddInventoryItem,
    canScanReceipt,
    canImportExcel,
    incrementUsage,
    refresh
  };
};

export default useFeatureAccess;