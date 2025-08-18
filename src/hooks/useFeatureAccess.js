import {useState, useEffect} from 'react';
import {useAuth} from '../context/AuthContext';
import {supabase} from '../lib/supabase';
import {SUBSCRIPTION_PLANS} from '../lib/stripe';

export const useFeatureAccess = () => {
  const [subscription, setSubscription] = useState(null);
  const [planLimits, setPlanLimits] = useState(null);
  const [loading, setLoading] = useState(true);
  const {user} = useAuth();

  useEffect(() => {
    loadSubscriptionData();
  }, [user?.email]);

  const loadSubscriptionData = async () => {
    if (!user?.email) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Try to get subscription from Supabase
      if (supabase) {
        try {
          const {data, error} = await supabase
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

  // Feature access checkers
  const canUseFeature = (featureName) => {
    if (!planLimits) return false;

    switch (featureName) {
      case 'receiptScanner':
        return planLimits.receiptScans > 0 || planLimits.receiptScans === -1;
      case 'excelImporter':
        return planLimits.excelImport === true || planLimits.excelImport === -1;
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

  // Usage limit checkers
  const canAddInventoryItem = (currentCount) => {
    if (!planLimits) return {allowed: false, reason: 'Plan not loaded'};

    if (planLimits.inventoryItems === -1) return {allowed: true, unlimited: true};
    if (planLimits.inventoryItems === 0) return {allowed: false, reason: 'Inventory items not available on this plan'};

    const allowed = currentCount < planLimits.inventoryItems;
    return {
      allowed,
      limit: planLimits.inventoryItems,
      remaining: planLimits.inventoryItems - currentCount,
      reason: allowed ? null : 'You have reached your inventory item limit'
    };
  };

  const canScanReceipt = (currentScans) => {
    if (!planLimits) return {allowed: false, reason: 'Plan not loaded'};

    if (planLimits.receiptScans === -1) return {allowed: true, unlimited: true};
    if (planLimits.receiptScans === 0) return {allowed: false, reason: 'Receipt scanning not available on this plan'};

    const allowed = currentScans < planLimits.receiptScans;
    return {
      allowed,
      limit: planLimits.receiptScans,
      remaining: planLimits.receiptScans - currentScans,
      reason: allowed ? null : 'You have reached your monthly receipt scan limit'
    };
  };

  const canAddTeamMember = (currentMembers) => {
    if (!planLimits) return {allowed: false, reason: 'Plan not loaded'};

    if (planLimits.teamMembers === -1) return {allowed: true, unlimited: true};
    if (planLimits.teamMembers === 0) return {allowed: false, reason: 'Team members not available on this plan'};

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

  return {
    subscription,
    planLimits,
    loading,
    currentPlan: getCurrentPlan(),
    planInfo: getPlanInfo(),
    
    // Feature checkers
    canUseFeature,
    canAddInventoryItem,
    canScanReceipt,
    canAddTeamMember,
    
    // Refresh function
    refresh: loadSubscriptionData
  };
};

export default useFeatureAccess;