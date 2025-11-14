// ============================================================================
// SECURE FRONTEND STRIPE HELPER - READ-ONLY VERSION
// ============================================================================
// 
// SECURITY PRINCIPLES:
// 1. Frontend CANNOT activate/change subscription status
// 2. Frontend CANNOT trust URL parameters as proof of payment
// 3. Frontend CANNOT generate fake session IDs for activation
// 4. Only backend webhook can modify subscription state
// 5. Frontend only reads subscription state from backend
//
// REMOVED UNSAFE FUNCTIONS:
// - detectPaymentReturn (client-side payment detection)
// - createEnhancedCheckoutSession (fake session ID generation)
// - setupPaymentReturnMonitoring (client-side activation monitoring)
// - processSuccessfulPayment (client-side subscription activation)
// - handlePostPaymentReturn (client-side subscription updates)
// - handlePaymentLinkReturn (auto-redirect with activation)
// - verifyWebhookSignature (frontend webhook verification)
//
// ============================================================================

// Replace with your actual Stripe publishable key
const STRIPE_PUBLISHABLE_KEY = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || 'pk_test_51NRLFoEw1FLYKy8hTsUx1GNUX0cUQ3Fgqf4nXJVwxmNILOAF5SaAOaLYMDjfLXQxfUTYMvhUzNFWPTtQW5jXgdHU00Qv5s0uK5';

// Stripe configuration - display only
export const STRIPE_CONFIG = {
  currency: 'gbp',
  country: 'GB',
  locale: 'en-GB'
};

// Stripe keys configuration - publishable key only for frontend
let stripeKeys = {
  publishableKey: STRIPE_PUBLISHABLE_KEY,
  // SECURITY: Secret key and webhook secret are NEVER exposed to frontend
  secretKey: null,
  webhookSecret: null
};

// Function to update Stripe configuration (for platform admin) - display only
export const updateStripeConfig = (config) => {
  // SECURITY: Frontend can only update publishable key for display purposes
  if (config && config.publishableKey) {
    stripeKeys.publishableKey = config.publishableKey;
  }
  return stripeKeys;
};

// Function to get current Stripe configuration - display only
export const getStripeConfig = () => {
  return {
    publishableKey: stripeKeys.publishableKey,
    testMode: stripeKeys.publishableKey.startsWith('pk_test_')
  };
};

// ============================================================================
// URL HELPERS - FOR STRIPE PAYMENT LINK CONFIGURATION ONLY
// ============================================================================

// Get the current app URL for redirect configuration
export const getAppBaseUrl = () => {
  return window.location.origin;
};

// Build redirect URLs for Stripe Payment Links configuration
// SECURITY NOTE: These URLs are for Payment Link setup only.
// The presence of query parameters does NOT prove payment success.
export const buildStripeReturnUrls = (planId) => {
  const baseUrl = getAppBaseUrl();
  
  // These URLs are used to configure Stripe Payment Links
  // Query parameters are for UX only - NOT for payment verification
  const successUrl = `${baseUrl}/#/payment-success?plan=${planId}&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${baseUrl}/#/pricing?canceled=true&plan=${planId}`;
  
  if (process.env.NODE_ENV !== 'production') {
    console.log('🔗 Built Stripe return URLs for Payment Links:', { successUrl, cancelUrl });
  }
  
  return {
    success_url: successUrl,
    cancel_url: cancelUrl
  };
};

// Function to create webhook endpoint URL - for server-side webhook handling
export const getWebhookEndpointUrl = () => {
  const baseUrl = getAppBaseUrl();
  return `${baseUrl}/.netlify/functions/stripe-webhook`;
};

// ============================================================================
// SUBSCRIPTION PLANS CONFIGURATION - UI/UX DISPLAY ONLY
// ============================================================================
// SECURITY NOTE: These limits are for frontend display only.
// Actual enforcement MUST be done on the backend/server side.

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
      '3 receipt scans per month',
      '1 Excel import per month',
      'Manual item entry',
      'Basic reporting'
    ],
    limits: {
      inventoryItems: 100,
      receiptScans: 3,
      excelImport: 1,
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

// ============================================================================
// PLAN HELPER FUNCTIONS - UI/UX DISPLAY ONLY
// ============================================================================
// SECURITY NOTE: These functions are for frontend display and UX only.
// They should NOT be used for security decisions or access control.

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

// Plan comparison helper - UI display only
export const comparePlans = (currentPlan, targetPlan) => {
  const current = getPlanById(currentPlan);
  const target = getPlanById(targetPlan);
  
  if (current.price === 'Custom' || target.price === 'Custom') {
    return 'contact';
  }
  
  if (current.price < target.price) {
    return 'upgrade';
  } else if (current.price > target.price) {
    return 'downgrade';
  } else {
    return 'same';
  }
};

// Subscription management helpers - UI display only
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
    return null;
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

// ============================================================================
// SAFE PAYMENT LINK REDIRECT HELPER
// ============================================================================
// SECURITY NOTE: This function only redirects to Stripe Payment Links.
// It does NOT activate subscriptions or change user state.

export const redirectToPaymentLink = (planId) => {
  const plan = getPlanById(planId);
  
  if (!plan || !plan.paymentLink) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('❌ Invalid plan or missing payment link:', { planId, plan });
    }
    // Fallback to pricing page
    window.location.href = '/#/pricing';
    return;
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log('🚀 Redirecting to Stripe Payment Link:', {
      planId,
      paymentLink: plan.paymentLink
    });
  }
  
  // Simple redirect to Stripe Payment Link
  // No client-side tracking or session generation
  window.location.href = plan.paymentLink;
};

// ============================================================================
// BACKEND SUBSCRIPTION READER HELPER
// ============================================================================
// SECURITY NOTE: This is the ONLY way frontend should get subscription state.
// It reads from backend, never modifies subscription status.

export const fetchUserSubscriptionFromBackend = async (userEmail) => {
  try {
    if (!userEmail) {
      throw new Error('User email required to fetch subscription');
    }

    // Call your backend endpoint that reads from Supabase
    // This endpoint should return whatever the webhook wrote to the database
    const response = await fetch('/.netlify/functions/get-user-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userEmail })
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch subscription: ${response.status}`);
    }

    const data = await response.json();
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('📖 Fetched subscription from backend:', data);
    }

    // Map backend response to frontend plan structure
    if (data.subscription) {
      const planId = data.subscription.plan_id || 'free';
      const plan = getPlanById(planId);
      
      return {
        ...data.subscription,
        plan: plan,
        planId: planId,
        isActive: data.subscription.status === 'active',
        source: 'backend'
      };
    }

    // Default to free plan if no subscription found
    return {
      plan: getPlanById('free'),
      planId: 'free',
      isActive: true,
      status: 'active',
      source: 'default'
    };

  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('❌ Error fetching subscription from backend:', error);
    }
    
    // Fallback to free plan on error
    return {
      plan: getPlanById('free'),
      planId: 'free',
      isActive: true,
      status: 'active',
      source: 'fallback',
      error: error.message
    };
  }
};

// ============================================================================
// PAYMENT SUCCESS PAGE HELPER
// ============================================================================
// SECURITY NOTE: This helper is for the /payment-success page.
// It does NOT activate subscriptions - it only reads current state from backend.

export const handlePaymentSuccessPage = async (userEmail, maxRetries = 12, retryDelay = 5000) => {
  if (!userEmail) {
    return {
      success: false,
      error: 'User email required',
      plan: getPlanById('free')
    };
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log('🎉 Payment success page - checking subscription status...', {
      userEmail,
      maxRetries,
      retryDelay
    });
  }

  // Poll backend for updated subscription (webhook might take time to process)
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const subscription = await fetchUserSubscriptionFromBackend(userEmail);
      
      // Check if subscription was updated (not free plan)
      if (subscription.planId !== 'free' && subscription.isActive) {
        if (process.env.NODE_ENV !== 'production') {
          console.log(`✅ Subscription found on attempt ${attempt}:`, subscription);
        }
        
        return {
          success: true,
          subscription: subscription,
          plan: subscription.plan,
          attempt: attempt
        };
      }

      // If not the last attempt, wait before retrying
      if (attempt < maxRetries) {
        if (process.env.NODE_ENV !== 'production') {
          console.log(`⏳ Attempt ${attempt}/${maxRetries}: Subscription not yet updated, retrying in ${retryDelay/1000}s...`);
        }
        
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }

    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error(`❌ Attempt ${attempt} failed:`, error);
      }
      
      // If not the last attempt, continue trying
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  // If we get here, webhook hasn't updated the subscription yet
  if (process.env.NODE_ENV !== 'production') {
    console.log('⏰ Webhook processing may still be in progress...');
  }

  return {
    success: false,
    pending: true,
    message: 'Payment received! Your subscription is being activated...',
    plan: getPlanById('free'),
    maxRetriesReached: true
  };
};

// ============================================================================
// REMOVED UNSAFE FUNCTIONS - SECURITY NOTES
// ============================================================================
//
// The following functions were REMOVED because they allowed client-side
// subscription activation, which is a security vulnerability:
//
// ❌ detectPaymentReturn() - Allowed client to "detect" payment success from URL
// ❌ createEnhancedCheckoutSession() - Generated fake session IDs on client
// ❌ setupPaymentReturnMonitoring() - Monitored for payment returns to activate
// ❌ processSuccessfulPayment() - Activated subscriptions on client side
// ❌ handlePostPaymentReturn() - Updated subscriptions based on URL params
// ❌ handlePaymentLinkReturn() - Auto-redirected and activated based on URL
// ❌ verifyWebhookSignature() - Frontend webhook verification (impossible)
//
// SECURITY PRINCIPLE: Only the backend webhook can modify subscription state.
// The frontend can only READ subscription state from the backend.
//
// ============================================================================