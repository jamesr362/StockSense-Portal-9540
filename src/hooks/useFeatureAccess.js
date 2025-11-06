import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserPlanLimits, checkPlanLimit } from '../services/subscriptionService';

/**
 * Hook for managing feature access and subscription limits
 * Provides real-time feature access based on user's subscription plan
 * ENHANCED: Better cross-device sync and cache management
 */
export const useFeatureAccess = () => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [planLimits, setPlanLimits] = useState(null);
  const [usage, setUsage] = useState({
    purchaseItems: 0,
    receiptScans: 0,
    excelImports: 0
  });
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  // ENHANCED: Fetch subscription data with better error handling and caching
  const fetchSubscription = useCallback(async (forceRefresh = false) => {
    if (!user?.email) {
      setSubscription(null);
      setPlanLimits(null);
      setLoading(false);
      return;
    }

    // Check cache first (unless forced refresh)
    if (!forceRefresh) {
      try {
        const cacheKey = `subscriptionCache_${user.email}`;
        const cached = localStorage.getItem(cacheKey);
        const cacheTime = localStorage.getItem(`${cacheKey}_time`);
        
        if (cached && cacheTime) {
          const age = Date.now() - parseInt(cacheTime);
          // Use cache if less than 5 minutes old
          if (age < 5 * 60 * 1000) {
            const cachedData = JSON.parse(cached);
            console.log('📋 Using cached subscription data:', cachedData);
            setSubscription(cachedData.subscription);
            setPlanLimits(cachedData.planLimits);
            setLoading(false);
            return;
          }
        }
      } catch (cacheError) {
        console.warn('Error reading subscription cache:', cacheError);
      }
    }

    try {
      console.log('🔍 Fetching fresh subscription for:', user.email, forceRefresh ? '(forced)' : '');

      // Get user subscription and plan limits with retry logic
      let attempts = 0;
      const maxAttempts = 3;
      let result = null;
      
      while (attempts < maxAttempts && !result) {
        try {
          result = await getUserPlanLimits(user.email);
          break;
        } catch (error) {
          attempts++;
          console.warn(`Subscription fetch attempt ${attempts} failed:`, error);
          
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
          }
        }
      }
      
      if (!result) {
        throw new Error('Failed to fetch subscription after multiple attempts');
      }
      
      const { subscription: userSubscription, planLimits: limits } = result;
      
      console.log('✅ Found subscription:', userSubscription);
      console.log('✅ Plan limits:', limits);
      
      setSubscription(userSubscription);
      setPlanLimits(limits);

      // Cache the results
      try {
        const cacheKey = `subscriptionCache_${user.email}`;
        const cacheData = {
          subscription: userSubscription,
          planLimits: limits,
          timestamp: Date.now()
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        localStorage.setItem(`${cacheKey}_time`, Date.now().toString());
      } catch (cacheError) {
        console.warn('Error caching subscription data:', cacheError);
      }

    } catch (error) {
      console.error('❌ Error fetching subscription:', error);
      
      // Set fallback to free plan
      const freePlanLimits = {
        purchaseItems: 100,
        receiptScans: 1,
        excelImports: 1,
        taxExports: false,
        features: ['purchaseTracking']
      };
      
      setSubscription(null);
      setPlanLimits(freePlanLimits);
      
      // Cache the fallback
      try {
        const cacheKey = `subscriptionCache_${user.email}`;
        const cacheData = {
          subscription: null,
          planLimits: freePlanLimits,
          timestamp: Date.now()
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        localStorage.setItem(`${cacheKey}_time`, Date.now().toString());
      } catch (cacheError) {
        console.warn('Error caching fallback data:', cacheError);
      }
    } finally {
      setLoading(false);
      setLastRefresh(Date.now());
    }
  }, [user?.email]);

  // Fetch usage statistics
  const fetchUsage = useCallback(async () => {
    if (!user?.email) {
      setUsage({ purchaseItems: 0, receiptScans: 0, excelImports: 0 });
      return;
    }

    try {
      console.log('📊 Fetching usage statistics for:', user.email);

      // Get current usage from various sources
      const purchaseCount = await getCurrentPurchaseCount();
      const monthlyScans = await getCurrentMonthScans();
      const monthlyImports = await getCurrentMonthImports();

      const usageData = {
        purchaseItems: purchaseCount,
        receiptScans: monthlyScans,
        excelImports: monthlyImports,
        lastUpdated: Date.now()
      };

      console.log('📈 Usage statistics:', usageData);
      setUsage(usageData);

    } catch (error) {
      console.error('❌ Error fetching usage:', error);
      setUsage({ purchaseItems: 0, receiptScans: 0, excelImports: 0 });
    }
  }, [user?.email]);

  // Helper functions to get current usage
  const getCurrentPurchaseCount = async () => {
    try {
      const { getPurchaseItems } = await import('../services/db');
      const items = await getPurchaseItems(user.email);
      return items.length;
    } catch (error) {
      console.error('Error getting purchase count:', error);
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

      case 'unlimitedPurchases':
        return currentPlan === 'professional';

      default:
        return planLimits?.features?.includes(feature) || false;
    }
  }, [getCurrentPlan, usage, planLimits]);

  // Check if user can add purchase item
  const canAddPurchaseItem = useCallback((currentCount = null) => {
    const currentPlan = getCurrentPlan();
    const count = currentCount !== null ? currentCount : usage.purchaseItems;
    
    if (currentPlan === 'professional') {
      return { allowed: true, limit: -1, remaining: Infinity };
    }
    
    const limit = planLimits?.purchaseItems || 100;
    const allowed = count < limit;
    const remaining = Math.max(0, limit - count);
    
    return {
      allowed,
      limit,
      remaining,
      reason: allowed ? null : `You have reached your purchase tracking limit of ${limit} items. Upgrade to Professional for unlimited purchase tracking.`
    };
  }, [getCurrentPlan, usage.purchaseItems, planLimits]);

  // Legacy function name for backward compatibility
  const canAddInventoryItem = canAddPurchaseItem;

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

  // ENHANCED: Refresh feature access data with force option
  const refresh = useCallback(async (forceRefresh = false) => {
    console.log('🔄 Refreshing feature access data...', forceRefresh ? '(forced)' : '');
    setLoading(true);
    
    await Promise.all([fetchSubscription(forceRefresh), fetchUsage()]);
    setLoading(false);
  }, [fetchSubscription, fetchUsage]);

  // Initial data fetch
  useEffect(() => {
    if (user?.email) {
      fetchSubscription(false);
      fetchUsage();
    } else {
      setSubscription(null);
      setPlanLimits(null);
      setUsage({ purchaseItems: 0, receiptScans: 0, excelImports: 0 });
      setLoading(false);
    }
  }, [user?.email, fetchSubscription, fetchUsage]);

  // ENHANCED: Listen for subscription updates with more event types
  useEffect(() => {
    const eventTypes = [
      'subscriptionUpdated',
      'refreshFeatureAccess',
      'planChanged',
      'userUpgraded',
      'paymentSuccessful',
      'forceSubscriptionSync',
      'globalDataRefresh',
      'userLoggedIn'
    ];

    const handleSubscriptionUpdate = async (event) => {
      console.log('📱 Handling subscription update:', event.type, event.detail);
      
      const shouldRefresh = 
        event.detail?.userEmail === user?.email || 
        event.detail?.force || 
        event.type === 'globalDataRefresh' ||
        event.type === 'userLoggedIn';
      
      if (shouldRefresh) {
        const forceRefresh = event.detail?.force || event.detail?.immediate || event.type === 'forceSubscriptionSync';
        
        // Clear cache if forced
        if (forceRefresh) {
          try {
            const cacheKey = `subscriptionCache_${user?.email}`;
            localStorage.removeItem(cacheKey);
            localStorage.removeItem(`${cacheKey}_time`);
          } catch (error) {
            console.warn('Error clearing cache:', error);
          }
        }
        
        const delay = event.detail?.immediate ? 100 : (event.type === 'userLoggedIn' ? 2000 : 1000);
        
        setTimeout(async () => {
          await refresh(forceRefresh);
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
  }, [user?.email, refresh]);

  return {
    subscription,
    planLimits,
    usage,
    usageStats: usage, // Alias for backward compatibility
    loading,
    lastRefresh,
    currentPlan: getCurrentPlan(),
    planInfo: getPlanInfo(),
    canUseFeature,
    canAddPurchaseItem,
    canAddInventoryItem, // Legacy compatibility
    canScanReceipt,
    canImportExcel,
    incrementUsage,
    refresh
  };
};

export default useFeatureAccess;