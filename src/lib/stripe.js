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

// **CRITICAL FIX**: Get the current app URL for redirect configuration
export const getAppBaseUrl = () => {
  return window.location.origin;
};

// **FIXED**: Build proper redirect URLs for Stripe Payment Links
export const buildStripeReturnUrls = (planId) => {
  const baseUrl = getAppBaseUrl();
  
  // **IMPORTANT**: These URLs need to be configured in your Stripe Payment Link settings
  const successUrl = `${baseUrl}/#/payment-success?payment_status=success&plan=${planId}&session_id={CHECKOUT_SESSION_ID}&timestamp=${Date.now()}`;
  const cancelUrl = `${baseUrl}/#/pricing?payment_status=canceled&plan=${planId}&timestamp=${Date.now()}`;
  
  console.log('🔗 Built Stripe return URLs for Payment Links:', { successUrl, cancelUrl });
  
  return {
    success_url: successUrl,
    cancel_url: cancelUrl
  };
};

// Function to create webhook endpoint URL (for server-side webhook handling)
export const getWebhookEndpointUrl = () => {
  const baseUrl = getAppBaseUrl();
  // Point to your Netlify function
  return `${baseUrl}/.netlify/functions/stripe-webhook`;
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
    // **NEW**: Dynamic payment link with proper redirect URLs
    dynamicPaymentLink: null, // Will be built dynamically
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

// **ENHANCED**: Payment return detection with improved reliability
export const detectPaymentReturn = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const referrer = document.referrer || '';
  const currentUrl = window.location.href;
  
  // Multiple detection methods with enhanced logic
  const indicators = {
    hasStripeParams: urlParams.has('session_id') || hashParams.has('session_id'),
    hasPaymentStatus: urlParams.get('payment_status') === 'success' || hashParams.get('payment_status') === 'success',
    isFromStripe: referrer.includes('stripe.com') || referrer.includes('buy.stripe.com') || referrer.includes('checkout.stripe.com'),
    hasSessionStorage: sessionStorage.getItem('stripePaymentAttempt') === 'true',
    hasPendingPayment: localStorage.getItem('pendingPayment') !== null,
    isPaymentSuccessPage: currentUrl.includes('payment-success'),
    hasReturnTimestamp: urlParams.has('timestamp') || hashParams.has('timestamp'),
    recentReturn: (() => {
      const timestamp = urlParams.get('timestamp') || hashParams.get('timestamp');
      if (timestamp) {
        const timeDiff = Date.now() - parseInt(timestamp);
        return timeDiff < 5 * 60 * 1000; // Within 5 minutes
      }
      return false;
    })()
  };
  
  const isPaymentReturn = Object.values(indicators).some(Boolean);
  
  console.log('🔍 Enhanced payment return detection:', {
    indicators,
    isPaymentReturn,
    currentUrl,
    referrer,
    urlParams: Object.fromEntries(urlParams.entries()),
    hashParams: Object.fromEntries(hashParams.entries())
  });
  
  return {
    isPaymentReturn,
    indicators,
    sessionId: urlParams.get('session_id') || hashParams.get('session_id'),
    planId: urlParams.get('plan') || hashParams.get('plan'),
    paymentStatus: urlParams.get('payment_status') || hashParams.get('payment_status'),
    source: urlParams.get('source') || hashParams.get('source'),
    timestamp: urlParams.get('timestamp') || hashParams.get('timestamp')
  };
};

// **COMPLETELY REWRITTEN**: Simpler, more reliable approach
export const createEnhancedCheckoutSession = async (planId, userEmail, options = {}) => {
  const plan = getPlanById(planId);
  if (!plan || !plan.paymentLink) {
    throw new Error('Invalid plan or missing payment link');
  }

  console.log('🚀 Creating enhanced checkout session for Payment Link...', {
    planId,
    userEmail,
    paymentLink: plan.paymentLink
  });
  
  // **SIMPLIFIED APPROACH**: Store minimal tracking data
  const paymentData = {
    planId,
    userEmail,
    timestamp: Date.now(),
    sessionId: `pl_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    source: 'payment_link'
  };
  
  // Store tracking data
  sessionStorage.setItem('paymentTracking', JSON.stringify(paymentData));
  sessionStorage.setItem('awaitingPayment', 'true');
  
  console.log('💾 Stored payment tracking data:', paymentData);
  
  // **NEW**: Set up comprehensive return monitoring
  setupPaymentReturnMonitoring(paymentData);
  
  // Return the payment link
  return {
    url: plan.paymentLink,
    sessionId: paymentData.sessionId,
    planId,
    userEmail,
    paymentData
  };
};

// **NEW**: Comprehensive payment return monitoring system
const setupPaymentReturnMonitoring = (paymentData) => {
  console.log('🎯 Setting up payment return monitoring...');
  
  // **METHOD 1**: Window focus monitoring (most reliable)
  const handleFocus = () => {
    console.log('👁️ Window focused - checking payment status...');
    
    setTimeout(() => {
      const tracking = JSON.parse(sessionStorage.getItem('paymentTracking') || 'null');
      const awaitingPayment = sessionStorage.getItem('awaitingPayment') === 'true';
      
      if (tracking && awaitingPayment) {
        console.log('💡 Payment tracking found, checking with user...');
        
        // **SIMPLE USER CONFIRMATION**
        const userConfirmed = confirm(
          `🔔 Payment Confirmation\n\n` +
          `Did you successfully complete your payment for the ${tracking.planId.toUpperCase()} plan?\n\n` +
          `✅ Click OK if payment was successful\n` +
          `❌ Click Cancel if you didn't complete payment or had issues`
        );
        
        if (userConfirmed) {
          console.log('✅ User confirmed payment success');
          processSuccessfulPayment(tracking);
        } else {
          console.log('❌ User indicated payment was not successful');
          clearPaymentTracking();
        }
      }
    }, 1500); // Give page time to load
  };
  
  // **METHOD 2**: Page visibility monitoring
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      console.log('👀 Page became visible - checking payment...');
      setTimeout(handleFocus, 1000);
    }
  };
  
  // **METHOD 3**: Periodic background checking
  let checkCount = 0;
  const maxChecks = 20; // Check for 10 minutes (30s intervals)
  
  const periodicCheck = () => {
    checkCount++;
    const tracking = JSON.parse(sessionStorage.getItem('paymentTracking') || 'null');
    const awaitingPayment = sessionStorage.getItem('awaitingPayment') === 'true';
    
    console.log(`🔄 Periodic check ${checkCount}/${maxChecks}`, { tracking: !!tracking, awaitingPayment });
    
    if (!tracking || !awaitingPayment || checkCount >= maxChecks) {
      console.log('🛑 Stopping periodic checks');
      return;
    }
    
    // Check if we're back from Stripe based on referrer
    const referrer = document.referrer || '';
    if (referrer.includes('stripe.com') || referrer.includes('buy.stripe.com')) {
      console.log('🎯 Detected return from Stripe!');
      setTimeout(() => {
        handleFocus(); // Trigger the confirmation dialog
      }, 2000);
      return;
    }
    
    // Continue checking
    setTimeout(periodicCheck, 30000); // Check every 30 seconds
  };
  
  // Start monitoring
  window.addEventListener('focus', handleFocus);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  // Start periodic checking after initial delay
  setTimeout(periodicCheck, 10000); // Start checking after 10 seconds
  
  // Cleanup after 30 minutes
  setTimeout(() => {
    window.removeEventListener('focus', handleFocus);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    console.log('🧹 Payment monitoring cleanup completed');
  }, 30 * 60 * 1000);
};

// **NEW**: Process successful payment
const processSuccessfulPayment = async (tracking) => {
  try {
    console.log('🎉 Processing successful payment...', tracking);
    
    // Clear tracking
    clearPaymentTracking();
    
    // Build success URL with all necessary parameters
    const successUrl = `/#/payment-success?` + new URLSearchParams({
      payment_status: 'success',
      plan: tracking.planId,
      session_id: tracking.sessionId,
      user_email: tracking.userEmail,
      source: 'user_confirmation',
      timestamp: Date.now().toString()
    }).toString();
    
    console.log('🎯 Redirecting to success page:', successUrl);
    
    // Redirect to success page
    window.location.href = successUrl;
    
  } catch (error) {
    console.error('❌ Error processing successful payment:', error);
    alert('Payment confirmation successful, but there was an issue. Please refresh the page or contact support.');
  }
};

// **NEW**: Clear payment tracking
const clearPaymentTracking = () => {
  sessionStorage.removeItem('paymentTracking');
  sessionStorage.removeItem('awaitingPayment');
  console.log('🧹 Payment tracking cleared');
};

// **ENHANCED**: Handle post-payment processing
export const handlePostPaymentReturn = async (searchParams, userEmail) => {
  try {
    console.log('🔄 Processing post-payment return...', {
      searchParams: Object.fromEntries(searchParams.entries()),
      userEmail
    });

    const sessionId = searchParams.get('session_id');
    const paymentStatus = searchParams.get('payment_status');
    const planId = searchParams.get('plan');
    const source = searchParams.get('source');

    // Enhanced success detection
    const isSuccessfulPayment = (
      paymentStatus === 'success' ||
      source === 'user_confirmation' ||
      (sessionId && sessionId.startsWith('pl_'))
    );

    if (isSuccessfulPayment && userEmail) {
      console.log('✅ Valid payment return detected, activating subscription...');

      // Import subscription service
      const { updateUserSubscription } = await import('../services/subscriptionService');
      
      // Update subscription
      const finalSessionId = sessionId || `pl_manual_${Date.now()}`;
      const finalPlanId = planId || 'professional';
      
      await updateUserSubscription(userEmail, finalPlanId, finalSessionId);
      
      // Clear all relevant caches
      const cacheKeys = [
        `featureCache_${userEmail}`,
        `subscriptionCache_${userEmail}`,
        `planLimits_${userEmail}`,
        'paymentTracking',
        'awaitingPayment'
      ];
      
      cacheKeys.forEach(key => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });
      
      // Dispatch subscription update events
      const events = [
        'subscriptionUpdated',
        'refreshFeatureAccess',
        'planActivated'
      ];
      
      events.forEach((eventName, index) => {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent(eventName, {
            detail: {
              userEmail,
              planId: finalPlanId,
              sessionId: finalSessionId,
              immediate: true,
              source: 'post_payment_return'
            }
          }));
        }, index * 100);
      });

      return {
        success: true,
        planId: finalPlanId,
        sessionId: finalSessionId,
        activated: true,
        source: 'payment_link_confirmed'
      };
    }

    return {
      success: false,
      reason: 'Invalid payment return parameters'
    };

  } catch (error) {
    console.error('❌ Error processing post-payment return:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// **SIMPLIFIED**: Auto redirect handler
export const handlePaymentLinkReturn = () => {
  const detection = detectPaymentReturn();
  
  if (detection.isPaymentReturn && !window.location.href.includes('payment-success')) {
    console.log('🔄 Auto-handling payment return...');
    
    const sessionId = detection.sessionId || `pl_auto_${Date.now()}`;
    const planId = detection.planId || 'professional';
    const userEmail = sessionStorage.getItem('paymentUserEmail') || '';
    
    const successUrl = `/#/payment-success?` + new URLSearchParams({
      payment_status: 'success',
      plan: planId,
      session_id: sessionId,
      user_email: userEmail,
      source: 'auto_redirect',
      timestamp: Date.now().toString()
    }).toString();
    
    console.log('🎯 Auto-redirecting to:', successUrl);
    window.location.href = successUrl;
    
    return true;
  }
  
  return false;
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