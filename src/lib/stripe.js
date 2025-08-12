// Replace with your actual Stripe publishable key
const STRIPE_PUBLISHABLE_KEY = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || 'pk_test_51NRLFoEw1FLYKy8hTsUx1GNUX0cUQ3Fgqf4nXJVwxmNILOAF5SaAOaLYMDjfLXQxfUTYMvhUzNFWPTtQW5jXgdHU00Qv5s0uK5';

// Stripe configuration
export const STRIPE_CONFIG = {
  currency: 'gbp',
  country: 'GB',
  locale: 'en-GB'
};

// Function to get Stripe API keys - can be overridden by platform admin
let stripeKeys = {
  publishableKey: STRIPE_PUBLISHABLE_KEY,
  secretKey: null, // Never expose in client-side code
  webhookSecret: null
};

// Function to update Stripe configuration (for platform admin)
export const updateStripeConfig = (config) => {
  // In a real application, this would make a server call to update the configuration
  // For client-side, we only update the publishable key
  if (config && config.publishableKey) {
    stripeKeys.publishableKey = config.publishableKey;
  }
  return stripeKeys;
};

// Function to get current Stripe configuration
export const getStripeConfig = () => {
  return {
    publishableKey: stripeKeys.publishableKey,
    testMode: stripeKeys.publishableKey.startsWith('pk_test_')
  };
};

// Subscription plans configuration with comprehensive features
export const SUBSCRIPTION_PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    priceId: 'price_free',
    paymentLink: null,
    features: [
      'Up to 100 inventory items',
      'Basic dashboard',
      'Manual item entry'
    ],
    limits: {
      inventoryItems: 100,
      receiptScans: 0,
      excelImport: false,
      teamMembers: 1,
      features: ['basic_dashboard', 'manual_entry']
    }
  },
  basic: {
    id: 'basic',
    name: 'Basic',
    price: 9.99,
    priceId: 'price_1RvPHREw1FLYKy8hmTH0P890',
    paymentLink: 'https://buy.stripe.com/test_28EbJ15Br8qzelVfegcjS06',
    features: [
      'Up to 1,000 inventory items',
      'Excel importer',
      'Receipt scanner (50 scans/month)'
    ],
    limits: {
      inventoryItems: 1000,
      receiptScans: 50,
      excelImport: true,
      teamMembers: 3,
      features: ['basic_dashboard', 'excel_import', 'receipt_scanner']
    }
  },
  professional: {
    id: 'professional',
    name: 'Professional',
    price: 14.99,
    priceId: 'price_1RvPHREw1FLYKy8hXCRwsIi2',
    paymentLink: 'https://buy.stripe.com/test_4gMbJ1fc1ayHdhRc24cjS05',
    features: [
      'Unlimited inventory items',
      'Unlimited receipt scans',
      'Unlimited Excel imports'
    ],
    limits: {
      inventoryItems: -1, // unlimited
      receiptScans: -1, // unlimited
      excelImport: -1, // unlimited
      teamMembers: 10,
      features: ['advanced_analytics', 'priority_support', 'multiple_locations', 'api_access', 'bulk_operations', 'custom_integrations', 'custom_categories']
    },
    highlighted: true
  }
};

// Helper functions
export const formatPrice = (amount, currency = 'gbp') => {
  if (typeof amount === 'string') return amount;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
};

export const getPlanById = (planId) => {
  return SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS.free;
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

export const isFeatureAvailable = (userPlan, feature) => {
  switch (feature) {
    case 'excelImport':
      return getUserPlanLimits(userPlan).excelImport;
    case 'receiptScanner':
      return getUserPlanLimits(userPlan).receiptScans > 0;
    default:
      return canUserAccessFeature(userPlan, feature);
  }
};

export const hasReachedLimit = (userPlan, limitType, currentUsage) => {
  const limits = getUserPlanLimits(userPlan);
  if (!limits) return true;
  const limit = limits[limitType];
  if (limit === -1) return false; // unlimited
  if (limit === 0) return true; // not available on this plan
  return currentUsage >= limit;
};

// Plan comparison helper
export const comparePlans = (currentPlan, targetPlan) => {
  const current = getPlanById(currentPlan);
  const target = getPlanById(targetPlan);
  
  if (current.price === 'Custom' || target.price === 'Custom') {
    return 'contact'; // Need to contact for custom plans
  }
  
  if (current.price < target.price) {
    return 'upgrade';
  } else if (current.price > target.price) {
    return 'downgrade';
  } else {
    return 'same';
  }
};

// Subscription management helpers
export const getNextBillingDate = (subscriptionData) => {
  if (!subscriptionData || !subscriptionData.current_period_end) {
    return null;
  }
  return new Date(subscriptionData.current_period_end * 1000);
};

export const getDaysUntilRenewal = (subscriptionData) => {
  const nextBilling = getNextBillingDate(subscriptionData);
  if (!nextBilling) return null;
  
  const now = new Date();
  const diffTime = nextBilling - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

export const calculateProration = (currentPlan, newPlan, daysRemaining) => {
  if (typeof currentPlan.price === 'string' || typeof newPlan.price === 'string') {
    return null; // Cannot calculate for custom plans
  }
  
  const dailyCurrentCost = currentPlan.price / 30;
  const dailyNewCost = newPlan.price / 30;
  
  const refund = dailyCurrentCost * daysRemaining;
  const newCharge = dailyNewCost * daysRemaining;
  
  return {
    refund: refund,
    newCharge: newCharge,
    difference: newCharge - refund
  };
};