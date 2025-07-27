// Stripe configuration and helper functions
let stripePromise = null;

export const STRIPE_CONFIG = {
  currency: 'gbp',
  country: 'GB',
  locale: 'en-GB'
};

// Load Stripe only when needed
export const getStripe = () => {
  if (!stripePromise) {
    // In production, use your actual Stripe publishable key
    const publishableKey = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || 'pk_test_demo';
    
    if (publishableKey !== 'pk_test_demo') {
      stripePromise = import('@stripe/stripe-js').then(({ loadStripe }) => 
        loadStripe(publishableKey)
      );
    } else {
      // Demo mode - return null for mock functionality
      stripePromise = Promise.resolve(null);
    }
  }
  return stripePromise;
};

// Updated subscription plans with Stripe price IDs
export const SUBSCRIPTION_PLANS = {
  free: {
    id: 'free',
    name: 'Free Trial',
    price: 0,
    priceId: null,
    description: 'Perfect for getting started',
    features: [
      'Up to 10 inventory items',
      '3 receipt scans per month',
      '1 Excel import (lifetime)',
      'Basic manual entry',
      'Email support'
    ],
    limits: {
      inventoryItems: 10,
      receiptScans: 3,
      excelImports: 1,
      teamMembers: 1,
      features: ['manual_entry'],
      restrictions: ['no_exports', 'no_reports', 'no_analytics']
    },
    ctaText: 'Start Free Trial'
  },
  pro: {
    id: 'pro',
    name: 'Professional',
    price: 12,
    yearlyPrice: 120, // 2 months free
    priceId: 'price_pro_monthly',
    yearlyPriceId: 'price_pro_yearly',
    description: 'For growing businesses',
    features: [
      'Up to 2,500 inventory items',
      'Unlimited manual entries',
      '100 receipt scans/month',
      '10 Excel imports/month',
      'Advanced analytics',
      'Export capabilities',
      'Priority support'
    ],
    limits: {
      inventoryItems: 2500,
      receiptScans: 100,
      excelImports: 10,
      teamMembers: 3,
      features: [
        'unlimited_manual_entry',
        'exports',
        'basic_reports',
        'analytics'
      ]
    },
    highlighted: true,
    ctaText: 'Upgrade Now',
    badge: 'MOST POPULAR',
    savings: 'Save £24/year'
  },
  power: {
    id: 'power',
    name: 'Power',
    price: 25,
    yearlyPrice: 250, // 2 months free
    priceId: 'price_power_monthly',
    yearlyPriceId: 'price_power_yearly',
    description: 'For large operations',
    features: [
      'Unlimited inventory items',
      'Unlimited receipt scans',
      'Unlimited Excel imports',
      'Unlimited team members',
      'Advanced analytics',
      'Custom reports',
      'Priority support',
      'API access'
    ],
    limits: {
      inventoryItems: -1, // Unlimited
      receiptScans: -1, // Unlimited
      excelImports: -1, // Unlimited
      teamMembers: -1, // Unlimited
      features: [
        'unlimited_everything',
        'advanced_analytics',
        'priority_support',
        'custom_reports',
        'api_access'
      ]
    },
    ctaText: 'Go Unlimited',
    badge: 'UNLIMITED',
    savings: 'Save £50/year'
  }
};

// Helper functions
export const formatPrice = (amount, currency = 'gbp') => {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
};

export const getPlanById = (planId) => {
  return SUBSCRIPTION_PLANS[planId] || null;
};

export const getUserPlanLimits = (planId) => {
  const plan = getPlanById(planId);
  return plan ? plan.limits : SUBSCRIPTION_PLANS.free.limits;
};

export const canUserAccessFeature = (userPlan, feature) => {
  const limits = getUserPlanLimits(userPlan);
  return limits ? limits.features.includes(feature) : false;
};

export const isWithinLimit = (userPlan, limitType, currentCount) => {
  const limits = getUserPlanLimits(userPlan);
  if (!limits) return false;
  
  const limit = limits[limitType];
  if (limit === -1) return true; // unlimited
  return currentCount < limit;
};

export const hasRestriction = (userPlan, restriction) => {
  const limits = getUserPlanLimits(userPlan);
  return limits?.restrictions?.includes(restriction) || false;
};

// Usage tracking helpers
export const getUsageStats = (userPlan) => {
  const limits = getUserPlanLimits(userPlan);
  
  // Get current usage from localStorage with proper error handling
  const getCurrentUsage = (key, defaultValue = 0) => {
    try {
      const value = localStorage.getItem(key);
      return value ? parseInt(value, 10) : defaultValue;
    } catch (error) {
      console.error(`Error reading ${key} from localStorage:`, error);
      return defaultValue;
    }
  };

  const currentUsage = {
    inventoryItems: getCurrentUsage('usage_inventory_items', 0),
    receiptScans: getCurrentUsage('usage_receipt_scans_month', 0),
    excelImports: getCurrentUsage('usage_excel_imports_month', 0)
  };

  // Calculate percentages safely
  const calculatePercentage = (current, limit) => {
    if (limit === -1) return 0; // unlimited
    if (limit === 0) return 100; // no limit means 100%
    return Math.min((current / limit) * 100, 100);
  };

  return {
    inventoryItems: {
      current: currentUsage.inventoryItems,
      limit: limits.inventoryItems,
      percentage: calculatePercentage(currentUsage.inventoryItems, limits.inventoryItems)
    },
    receiptScans: {
      current: currentUsage.receiptScans,
      limit: limits.receiptScans,
      percentage: calculatePercentage(currentUsage.receiptScans, limits.receiptScans)
    },
    excelImports: {
      current: currentUsage.excelImports,
      limit: limits.excelImports,
      percentage: calculatePercentage(currentUsage.excelImports, limits.excelImports)
    }
  };
};

// Track usage with error handling
export const trackUsage = (type, increment = 1) => {
  try {
    const key = `usage_${type}`;
    const current = parseInt(localStorage.getItem(key) || '0', 10);
    const newValue = current + increment;
    localStorage.setItem(key, newValue.toString());
    return newValue;
  } catch (error) {
    console.error(`Error tracking usage for ${type}:`, error);
    return 0;
  }
};

// Reset monthly usage (call this at the beginning of each month)
export const resetMonthlyUsage = () => {
  try {
    localStorage.removeItem('usage_receipt_scans_month');
    localStorage.removeItem('usage_excel_imports_month');
  } catch (error) {
    console.error('Error resetting monthly usage:', error);
  }
};

// Function to check if a user is at or over their limit
export const isAtOrOverLimit = (userPlan, limitType) => {
  const usage = getUsageStats(userPlan);
  if (!usage[limitType]) return false;
  return usage[limitType].percentage >= 100;
};

// Check if user can perform a specific action based on their plan
export const canPerformAction = (userPlan, action) => {
  switch (action) {
    case 'add_inventory_item':
      return !isAtOrOverLimit(userPlan, 'inventoryItems');
    case 'scan_receipt':
      return !isAtOrOverLimit(userPlan, 'receiptScans');
    case 'import_excel':
      return !isAtOrOverLimit(userPlan, 'excelImports');
    case 'export_data':
      return !hasRestriction(userPlan, 'no_exports');
    case 'view_reports':
      return !hasRestriction(userPlan, 'no_reports');
    case 'view_analytics':
      return !hasRestriction(userPlan, 'no_analytics');
    default:
      return true;
  }
};

export default getStripe;