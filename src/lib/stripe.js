// Frontend Stripe configuration - READ-ONLY and SECURE
// This module provides plan information and UI helpers only.
// All subscription modifications must go through backend APIs.

// Stripe configuration
export const STRIPE_PUBLISHABLE_KEY = 'pk_test_51NRLFoEw1FLYKy8hTsUx1GNUX0cUQ3Fgqf4nXJVwxmNILOAF5SaAOaLYMDjfLXQxfUTYMvhUzNFWPTtQW5jXgdHU00Qv5s0uK5';

export const STRIPE_CONFIG = {
  publishableKey: STRIPE_PUBLISHABLE_KEY,
  // SECURITY: Secret keys are NEVER exposed to the frontend
  apiVersion: '2023-10-16',
  locale: 'en'
};

// ENHANCED: Plan definitions with CORRECT plan IDs
export const SUBSCRIPTION_PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    currency: 'GBP',
    interval: 'month',
    stripePriceId: null, // No Stripe price for free plan
    paymentLink: null, // No payment needed for free plan
    features: [
      'Up to 50 purchase items',
      'Basic receipt scanning',
      'CSV export',
      'Email support'
    ],
    limits: {
      inventoryItems: 50,
      receiptScans: 10,
      csvExports: 5,
      apiCalls: 100
    },
    popular: false,
    description: 'Perfect for getting started with basic purchase tracking'
  },
  professional: {
    id: 'professional',
    name: 'Professional',
    price: 29.99,
    currency: 'GBP',
    interval: 'month',
    stripePriceId: 'price_1RxEcJEw1FLYKy8h3FDMZ6QP', // Replace with your actual Stripe price ID
    paymentLink: 'https://buy.stripe.com/test_28o6s1fCy2Mq9EI000', // Replace with your actual payment link
    features: [
      'Unlimited purchase items',
      'Advanced receipt scanning with AI',
      'Multiple export formats (CSV, Excel, PDF)',
      'VAT calculation & reporting',
      'Priority email support',
      'Data backup & sync',
      'Advanced analytics'
    ],
    limits: {
      inventoryItems: -1, // Unlimited
      receiptScans: -1, // Unlimited
      csvExports: -1, // Unlimited
      apiCalls: -1 // Unlimited
    },
    popular: true,
    description: 'Full-featured solution for professional purchase management'
  }
};

// SECURITY NOTE: All functions below are for UI/UX purposes only.
// They do NOT control actual access - that's enforced on the backend.

/**
 * Get plan by ID - UI helper only
 */
export const getPlanById = (planId) => {
  // ENHANCED: Handle both 'professional' and 'price_professional' formats
  const normalizedPlanId = planId?.replace('price_', '') || 'free';
  return SUBSCRIPTION_PLANS[normalizedPlanId] || SUBSCRIPTION_PLANS.free;
};

/**
 * Format price for display - UI helper only
 */
export const formatPrice = (price, currency = 'GBP') => {
  if (price === 0) return 'Free';
  
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  }).format(price);
};

/**
 * Get user plan limits - UI helper only (actual enforcement is backend)
 */
export const getUserPlanLimits = (planId) => {
  const plan = getPlanById(planId);
  return plan.limits;
};

/**
 * Check if user can access feature - UI helper only
 */
export const canUserAccessFeature = (planId, feature) => {
  const plan = getPlanById(planId);
  
  const featureMap = {
    'advanced_scanning': planId === 'professional',
    'unlimited_items': planId === 'professional',
    'vat_reports': planId === 'professional',
    'priority_support': planId === 'professional',
    'data_backup': planId === 'professional',
    'analytics': planId === 'professional',
    'pdf_export': planId === 'professional',
    'excel_export': planId === 'professional'
  };
  
  return featureMap[feature] || false;
};

/**
 * Check if within limit - UI helper only
 */
export const isWithinLimit = (planId, limitType, currentUsage) => {
  const limits = getUserPlanLimits(planId);
  const limit = limits[limitType];
  
  if (limit === -1) return true; // Unlimited
  return currentUsage < limit;
};

/**
 * Check if feature is available - UI helper only
 */
export const isFeatureAvailable = (planId, feature) => {
  return canUserAccessFeature(planId, feature);
};

/**
 * Check if user has reached limit - UI helper only
 */
export const hasReachedLimit = (planId, limitType, currentUsage) => {
  return !isWithinLimit(planId, limitType, currentUsage);
};

/**
 * Compare plans - UI helper only
 */
export const comparePlans = (planId1, planId2) => {
  const planOrder = { free: 0, professional: 1 };
  const plan1Order = planOrder[planId1] || 0;
  const plan2Order = planOrder[planId2] || 0;
  
  return plan1Order - plan2Order;
};

/**
 * Get next billing date - UI helper only
 */
export const getNextBillingDate = (currentPeriodEnd) => {
  if (!currentPeriodEnd) return null;
  return new Date(currentPeriodEnd);
};

/**
 * Get days until renewal - UI helper only
 */
export const getDaysUntilRenewal = (currentPeriodEnd) => {
  if (!currentPeriodEnd) return null;
  
  const renewalDate = new Date(currentPeriodEnd);
  const today = new Date();
  const diffTime = renewalDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays > 0 ? diffDays : 0;
};

/**
 * Calculate proration - UI helper only
 */
export const calculateProration = (oldPrice, newPrice, daysRemaining, totalDays) => {
  if (!daysRemaining || !totalDays) return 0;
  
  const dailyOldPrice = oldPrice / totalDays;
  const dailyNewPrice = newPrice / totalDays;
  const refund = dailyOldPrice * daysRemaining;
  const charge = dailyNewPrice * daysRemaining;
  
  return charge - refund;
};

/**
 * Get app base URL for redirects
 */
export const getAppBaseUrl = () => {
  // Use custom domain in production
  if (window.location.hostname === 'gotrackio.co.uk') {
    return 'https://gotrackio.co.uk';
  }
  
  // Development/preview URLs
  return window.location.origin;
};

/**
 * Build Stripe return URLs for checkout
 */
export const buildStripeReturnUrls = () => {
  const baseUrl = getAppBaseUrl();
  
  return {
    success_url: `${baseUrl}/#/payment-success?session_id={CHECKOUT_SESSION_ID}&plan=professional`,
    cancel_url: `${baseUrl}/#/pricing?canceled=true`
  };
};

/**
 * SECURE: Get subscription status from backend API
 * This is the ONLY way the frontend should check subscription status
 */
export const fetchSubscriptionFromBackend = async (userEmail) => {
  try {
    console.log('🔍 Fetching subscription from backend for:', userEmail);
    
    const response = await fetch('/.netlify/functions/get-customer-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: userEmail })
    });

    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Backend subscription data:', data);

    if (data.subscription) {
      // ENHANCED: Map backend data to frontend format
      return {
        id: data.subscription.id,
        customerId: data.customer?.id,
        subscriptionId: data.subscription.id,
        planId: mapStripePlanToInternal(data.subscription),
        status: data.subscription.status,
        currentPeriodStart: data.subscription.current_period_start ? 
          new Date(data.subscription.current_period_start * 1000).toISOString() : null,
        currentPeriodEnd: data.subscription.current_period_end ? 
          new Date(data.subscription.current_period_end * 1000).toISOString() : null,
        cancelAtPeriodEnd: data.subscription.cancel_at_period_end,
        canceledAt: data.subscription.canceled_at ? 
          new Date(data.subscription.canceled_at * 1000).toISOString() : null
      };
    }

    return null;
  } catch (error) {
    console.error('❌ Error fetching subscription from backend:', error);
    throw error;
  }
};

/**
 * ENHANCED: Map Stripe subscription data to internal plan ID
 */
const mapStripePlanToInternal = (subscription) => {
  if (!subscription || !subscription.items || !subscription.items.data || subscription.items.data.length === 0) {
    return 'free';
  }

  const priceId = subscription.items.data[0].price?.id;
  const lookupKey = subscription.items.data[0].price?.lookup_key;

  // Use lookup key first if available
  if (lookupKey) {
    if (lookupKey.includes('professional') || lookupKey.includes('pro')) {
      return 'professional';
    }
    if (lookupKey.includes('free') || lookupKey.includes('basic')) {
      return 'free';
    }
  }

  // Fallback to price ID mapping
  if (priceId) {
    // Map your actual Stripe price IDs here
    const priceIdMap = {
      'price_1RxEcJEw1FLYKy8h3FDMZ6QP': 'professional',
      'price_professional': 'professional',
      'price_free': 'free'
    };

    if (priceIdMap[priceId]) {
      return priceIdMap[priceId];
    }

    // Pattern matching
    if (priceId.includes('professional') || priceId.includes('pro')) {
      return 'professional';
    }
  }

  // Default for active subscriptions
  return subscription.status === 'active' ? 'professional' : 'free';
};

// Export the plans and utilities
export default {
  SUBSCRIPTION_PLANS,
  STRIPE_CONFIG,
  getPlanById,
  formatPrice,
  getUserPlanLimits,
  canUserAccessFeature,
  isWithinLimit,
  isFeatureAvailable,
  hasReachedLimit,
  comparePlans,
  getNextBillingDate,
  getDaysUntilRenewal,
  calculateProration,
  buildStripeReturnUrls,
  fetchSubscriptionFromBackend
};

// SECURITY NOTES:
// 1. This module is READ-ONLY for subscription state
// 2. All plan checks are for UI/UX only - backend enforces actual limits
// 3. No client-side subscription activation or modification
// 4. URL parameters are never trusted for subscription status
// 5. Only backend APIs determine actual subscription state