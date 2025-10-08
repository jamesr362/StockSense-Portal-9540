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

// Helper function to build return URLs for Stripe with proper routing and webhook parameters
export const buildStripeReturnUrls = (planId) => {
  const baseUrl = window.location.origin;
  const basePath = window.location.pathname;
  
  // Enhanced return URLs with webhook simulation parameters
  const successUrl = `${baseUrl}${basePath}#/payment-success?payment_status=success&plan=${planId}&session_id={CHECKOUT_SESSION_ID}&timestamp=${Date.now()}&webhook_trigger=true`;
  const cancelUrl = `${baseUrl}${basePath}#/pricing?payment_status=canceled&plan=${planId}&timestamp=${Date.now()}`;
  
  console.log('Built Stripe return URLs:', { successUrl, cancelUrl });
  
  return {
    success_url: successUrl,
    cancel_url: cancelUrl
  };
};

// Function to create webhook endpoint URL (for server-side webhook handling)
export const getWebhookEndpointUrl = () => {
  const baseUrl = window.location.origin;
  // In production, this would point to your server-side webhook endpoint
  return `${baseUrl}/api/webhooks/stripe`;
};

// Subscription plans configuration - STRICT FREE PLAN LIMITS
export const SUBSCRIPTION_PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    priceId: 'price_free',
    paymentLink: null,
    features: [
      'Up to 100 manual inventory entries',
      'Basic dashboard',
      '1 receipt scan per month',
      '1 Excel import per month',
      'Manual item entry',
      'Basic reporting'
    ],
    limits: {
      inventoryItems: 100, // STRICT LIMIT: 100 manual entries maximum
      receiptScans: 1, // 1 receipt scan per month
      excelImport: 1, // 1 Excel import per month
      teamMembers: 1,
      features: ['basic_dashboard', 'manual_entry', 'receipt_scanner_limited', 'excel_importer_limited']
    }
  },
  professional: {
    id: 'professional',
    name: 'Professional',
    price: 9.99,
    priceId: 'price_1RxEcJEw1FLYKy8h3FDMZ6QP',
    paymentLink: 'https://buy.stripe.com/test_9B6fZh4xneOXcdN4zCcjS07',
    features: [
      'Unlimited inventory items',
      'Unlimited receipt scans',
      'Unlimited Excel imports',
      'Professional tax export reports',
      'Priority support',
      'Advanced analytics'
    ],
    limits: {
      inventoryItems: -1, // unlimited
      receiptScans: -1, // unlimited
      excelImport: -1, // unlimited
      teamMembers: 1,
      features: [
        'receipt_scanner',
        'excel_importer',
        'tax_exports',
        'unlimited_items',
        'priority_support',
        'advanced_analytics'
      ]
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
      return getUserPlanLimits(userPlan).excelImport > 0 || getUserPlanLimits(userPlan).excelImport === -1;
    case 'receiptScanner':
      return getUserPlanLimits(userPlan).receiptScans > 0;
    case 'taxExports':
      return userPlan === 'professional';
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

// Webhook signature verification helper (for server-side use)
export const verifyWebhookSignature = (payload, signature, secret) => {
  // This would typically be done server-side with the Stripe library
  // For demo purposes, we'll simulate verification
  console.log('Webhook signature verification (simulated):', {
    payloadLength: payload.length,
    signature: signature.substring(0, 20) + '...',
    secretLength: secret.length
  });
  
  // In production, use: stripe.webhooks.constructEvent(payload, signature, secret)
  return true; // Simulated success
};

// Enhanced Stripe checkout session creation
export const createEnhancedCheckoutSession = async (planId, userEmail, options = {}) => {
  const plan = getPlanById(planId);
  if (!plan || !plan.paymentLink) {
    throw new Error('Invalid plan or missing payment link');
  }

  // Build enhanced payment URL with webhook parameters
  const returnUrls = buildStripeReturnUrls(planId);
  const enhancedPaymentUrl = new URL(plan.paymentLink);
  
  // Add return URLs
  enhancedPaymentUrl.searchParams.set('success_url', returnUrls.success_url);
  enhancedPaymentUrl.searchParams.set('cancel_url', returnUrls.cancel_url);
  
  // Add customer metadata
  enhancedPaymentUrl.searchParams.set('client_reference_id', userEmail);
  enhancedPaymentUrl.searchParams.set('customer_email', userEmail);
  
  // Add plan metadata
  enhancedPaymentUrl.searchParams.set('metadata[plan_id]', planId);
  enhancedPaymentUrl.searchParams.set('metadata[customer_email]', userEmail);
  enhancedPaymentUrl.searchParams.set('metadata[webhook_enabled]', 'true');
  
  // Add webhook endpoint if available
  const webhookUrl = getWebhookEndpointUrl();
  if (webhookUrl) {
    enhancedPaymentUrl.searchParams.set('metadata[webhook_url]', webhookUrl);
  }

  console.log('Enhanced checkout session URL:', enhancedPaymentUrl.toString());
  
  return {
    url: enhancedPaymentUrl.toString(),
    planId,
    userEmail,
    returnUrls
  };
};