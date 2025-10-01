import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { SUBSCRIPTION_PLANS, checkInventoryLimit } from '../lib/stripe';

export const useFeatureAccess = () => {
  const [subscription, setSubscription] = useState(null);
  const [planLimits, setPlanLimits] = useState(null);
  const [loading, setLoading] = useState(true);
  const [usageStats, setUsageStats] = useState({
    receiptScans: 0,
    excelImports: 0
  });
  const { user } = useAuth();

  const loadSubscriptionData = async () => {
    if (!user?.email) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Load usage statistics
      await loadUsageStats();

      // Try to get subscription from Supabase
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('subscriptions_tb2k4x9p1m')
            .select('*')
            .eq('user_email', user.email.toLowerCase())
            .single();

          if (!error && data) {
            setSubscription(data);
            // Get plan limits based on subscription
            const planName = data.plan_id ? data.plan_id.split('_')[1] : 'free';
            const plan = SUBSCRIPTION_PLANS[planName] || SUBSCRIPTION_PLANS.free;
            setPlanLimits(plan.limits);
            setLoading(false);
            return;
          }
        } catch (err) {
          console.log('Error fetching subscription from Supabase:', err);
        }
      }

      // Fallback to free plan
      setPlanLimits(SUBSCRIPTION_PLANS.free.limits);
      setSubscription(null);
    } catch (error) {
      console.error('Error loading subscription data:', error);
      setPlanLimits(SUBSCRIPTION_PLANS.free.limits);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  };

  const loadUsageStats = async () => {
    if (!user?.email) return;

    try {
      // Get current month's usage from localStorage
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();

      // Load receipt scan history
      const receiptHistory = JSON.parse(localStorage.getItem(`scanHistory_${user.email}`) || '[]');
      const monthlyReceiptScans = receiptHistory.filter(scan => {
        const scanDate = new Date(scan.timestamp);
        return scanDate.getMonth() === currentMonth && scanDate.getFullYear() === currentYear;
      }).length;

      // Load Excel import history
      const importHistory = JSON.parse(localStorage.getItem(`importHistory_${user.email}`) || '[]');
      const monthlyExcelImports = importHistory.filter(imp => {
        const importDate = new Date(imp.timestamp);
        return importDate.getMonth() === currentMonth && importDate.getFullYear() === currentYear;
      }).length;

      setUsageStats({
        receiptScans: monthlyReceiptScans,
        excelImports: monthlyExcelImports
      });

      console.log('Usage stats loaded:', { receiptScans: monthlyReceiptScans, excelImports: monthlyExcelImports });
    } catch (error) {
      console.error('Error loading usage stats:', error);
    }
  };

  useEffect(() => {
    loadSubscriptionData();
  }, [user?.email]);

  // Feature access checkers
  const canUseFeature = (featureName) => {
    if (!planLimits) return false;

    switch (featureName) {
      case 'receiptScanner':
        return canScanReceipt(usageStats.receiptScans).allowed;
      case 'excelImporter':
        return canImportExcel(usageStats.excelImports).allowed;
      case 'taxExports':
        // Tax exports only available for Professional plan
        const currentPlan = getCurrentPlan();
        return currentPlan === 'professional';
      case 'advancedAnalytics':
        return planLimits.features.includes('advanced_analytics');
      case 'customCategories':
        return planLimits.features.includes('custom_categories');
      case 'multipleLocations':
        return planLimits.features.includes('multiple_locations');
      case 'apiAccess':
        return planLimits.features.includes('api_access');
      case 'bulkOperations':
        return planLimits.features.includes('bulk_operations');
      case 'prioritySupport':
        return planLimits.features.includes('priority_support');
      default:
        return true;
    }
  };

  // STRICT INVENTORY LIMIT CHECKER
  const canAddInventoryItem = (currentCount) => {
    if (!planLimits) return { allowed: false, reason: 'Plan not loaded' };
    
    const currentPlan = getCurrentPlan();
    return checkInventoryLimit(currentPlan, currentCount);
  };

  const canScanReceipt = (currentScans = null) => {
    if (!planLimits) return { allowed: false, reason: 'Plan not loaded' };

    // Use provided currentScans or fallback to stored usage stats
    const scansUsed = currentScans !== null ? currentScans : usageStats.receiptScans;

    if (planLimits.receiptScans === -1) return { allowed: true, unlimited: true };
    if (planLimits.receiptScans === 0) return { allowed: false, reason: 'Receipt scanning not available on this plan' };

    const allowed = scansUsed < planLimits.receiptScans;
    return {
      allowed,
      limit: planLimits.receiptScans,
      remaining: planLimits.receiptScans - scansUsed,
      used: scansUsed,
      reason: allowed ? null : 'You have reached your monthly receipt scan limit'
    };
  };

  const canImportExcel = (currentImports = null) => {
    if (!planLimits) return { allowed: false, reason: 'Plan not loaded' };

    // Use provided currentImports or fallback to stored usage stats
    const importsUsed = currentImports !== null ? currentImports : usageStats.excelImports;

    if (planLimits.excelImport === -1) return { allowed: true, unlimited: true };
    if (planLimits.excelImport === 0 || !planLimits.excelImport) return { allowed: false, reason: 'Excel import not available on this plan' };

    const allowed = importsUsed < planLimits.excelImport;
    return {
      allowed,
      limit: planLimits.excelImport,
      remaining: planLimits.excelImport - importsUsed,
      used: importsUsed,
      reason: allowed ? null : 'You have reached your monthly Excel import limit'
    };
  };

  const canAddTeamMember = (currentMembers) => {
    if (!planLimits) return { allowed: false, reason: 'Plan not loaded' };

    if (planLimits.teamMembers === -1) return { allowed: true, unlimited: true };
    if (planLimits.teamMembers === 0) return { allowed: false, reason: 'Team members not available on this plan' };

    const allowed = currentMembers < planLimits.teamMembers;
    return {
      allowed,
      limit: planLimits.teamMembers,
      remaining: planLimits.teamMembers - currentMembers,
      reason: allowed ? null : 'You have reached your team member limit'
    };
  };

  // Get current plan name
  const getCurrentPlan = () => {
    if (!subscription?.plan_id) return 'free';
    const parts = subscription.plan_id.split('_');
    return parts.length > 1 ? parts[1] : 'free';
  };

  // Get plan display info
  const getPlanInfo = () => {
    const planName = getCurrentPlan();
    const plan = SUBSCRIPTION_PLANS[planName] || SUBSCRIPTION_PLANS.free;
    return {
      name: plan.name,
      price: plan.price,
      features: plan.features,
      limits: plan.limits
    };
  };

  // Function to increment usage count (call this after successful scan/import)
  const incrementUsage = (type) => {
    if (type === 'receiptScan') {
      setUsageStats(prev => ({ ...prev, receiptScans: prev.receiptScans + 1 }));
    } else if (type === 'excelImport') {
      setUsageStats(prev => ({ ...prev, excelImports: prev.excelImports + 1 }));
    }
  };

  // Refresh function to reload subscription data
  const refresh = async () => {
    await loadSubscriptionData();
  };

  return {
    subscription,
    planLimits,
    loading,
    usageStats,
    currentPlan: getCurrentPlan(),
    planInfo: getPlanInfo(),
    
    // Feature checkers
    canUseFeature,
    canAddInventoryItem, // STRICT 100-item limit for free users
    canScanReceipt,
    canImportExcel,
    canAddTeamMember,
    
    // Usage tracking
    incrementUsage,
    
    // Refresh function
    refresh
  };
};

export default useFeatureAccess;