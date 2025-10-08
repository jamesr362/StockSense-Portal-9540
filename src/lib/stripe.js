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

// **NEW**: Enhanced payment return detection and handling
export const detectPaymentReturn = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const referrer = document.referrer || '';
  
  // Multiple detection methods
  const indicators = {
    hasStripeParams: urlParams.has('session_id') || hashParams.has('session_id'),
    hasPaymentStatus: urlParams.get('payment_status') === 'success' || hashParams.get('payment_status') === 'success',
    isFromStripe: referrer.includes('stripe.com') || referrer.includes('buy.stripe.com'),
    hasSessionStorage: sessionStorage.getItem('stripePaymentAttempt') === 'true',
    hasPendingPayment: localStorage.getItem('pendingPayment') !== null,
    isPaymentSuccessPage: window.location.href.includes('payment-success')
  };
  
  const isPaymentReturn = Object.values(indicators).some(Boolean);
  
  console.log('🔍 Payment return detection:', {
    indicators,
    isPaymentReturn,
    currentUrl: window.location.href,
    referrer
  });
  
  return {
    isPaymentReturn,
    indicators,
    sessionId: urlParams.get('session_id') || hashParams.get('session_id'),
    planId: urlParams.get('plan') || hashParams.get('plan'),
    paymentStatus: urlParams.get('payment_status') || hashParams.get('payment_status')
  };
};

// **ENHANCED**: Create checkout session for Payment Links with better redirect handling
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
  
  // **STEP 1**: Store payment attempt for return detection
  const paymentAttempt = {
    planId,
    userEmail,
    timestamp: Date.now(),
    sessionId: `cs_link_${Math.random().toString(36).substring(2, 15)}`,
    source: 'payment_link',
    originalUrl: plan.paymentLink
  };
  
  // Store in both localStorage and sessionStorage for redundancy
  localStorage.setItem('pendingPayment', JSON.stringify(paymentAttempt));
  sessionStorage.setItem('stripePaymentAttempt', 'true');
  sessionStorage.setItem('paymentPlanId', planId);
  sessionStorage.setItem('paymentUserEmail', userEmail);
  
  // **STEP 2**: Set up return detection with multiple methods
  const setupReturnDetection = () => {
    // Method 1: Window focus detection
    const handleWindowFocus = () => {
      setTimeout(() => {
        const pendingPayment = JSON.parse(localStorage.getItem('pendingPayment') || 'null');
        
        if (pendingPayment && (Date.now() - pendingPayment.timestamp) < 30 * 60 * 1000) {
          console.log('🔍 Window focused after payment attempt, checking return...');
          
          // Check if we're already on payment success page
          if (window.location.href.includes('payment-success')) {
            console.log('✅ Already on payment success page');
            return;
          }
          
          // **IMPORTANT**: Ask user to confirm payment
          const confirmPayment = () => {
            const result = confirm(
              `🎉 Welcome back!\n\n` +
              `Did you successfully complete your payment for the ${plan.name} plan?\n\n` +
              `💳 Price: £${plan.price}/month\n\n` +
              `✅ Click OK if payment was successful\n` +
              `❌ Click Cancel if you didn't complete the payment`
            );
            
            if (result) {
              console.log('✅ User confirmed successful payment');
              
              // Clear storage
              localStorage.removeItem('pendingPayment');
              sessionStorage.removeItem('stripePaymentAttempt');
              
              // Redirect to success page
              const successUrl = `/#/payment-success?payment_status=success&plan=${pendingPayment.planId}&session_id=${pendingPayment.sessionId}&user_email=${encodeURIComponent(pendingPayment.userEmail)}&source=user_confirmation&timestamp=${Date.now()}`;
              
              window.location.href = successUrl;
            } else {
              console.log('❌ User cancelled or payment was unsuccessful');
              localStorage.removeItem('pendingPayment');
              sessionStorage.removeItem('stripePaymentAttempt');
            }
          };
          
          // Small delay to ensure page is fully loaded
          setTimeout(confirmPayment, 1000);
        }
      }, 2000); // Wait 2 seconds after focus
    };
    
    // Method 2: Periodic check for return
    const checkInterval = setInterval(() => {
      const detection = detectPaymentReturn();
      
      if (detection.isPaymentReturn && !window.location.href.includes('payment-success')) {
        console.log('🔄 Payment return detected via periodic check');
        clearInterval(checkInterval);
        
        const successUrl = `/#/payment-success?payment_status=success&plan=${planId}&session_id=${detection.sessionId || paymentAttempt.sessionId}&user_email=${encodeURIComponent(userEmail)}&source=periodic_check&timestamp=${Date.now()}`;
        
        window.location.href = successUrl;
      }
    }, 5000); // Check every 5 seconds
    
    // Clean up after 30 minutes
    setTimeout(() => {
      clearInterval(checkInterval);
      window.removeEventListener('focus', handleWindowFocus);
    }, 30 * 60 * 1000);
    
    // Add focus listener
    window.addEventListener('focus', handleWindowFocus);
  };
  
  // **STEP 3**: Set up detection after small delay
  setTimeout(setupReturnDetection, 1000);
  
  // **STEP 4**: Return payment link data
  return {
    url: plan.paymentLink,
    originalUrl: plan.paymentLink,
    sessionId: paymentAttempt.sessionId,
    planId,
    userEmail,
    paymentAttempt
  };
};

// **NEW**: Function to handle post-payment processing for Payment Links
export const handlePostPaymentReturn = async (searchParams, userEmail) => {
  try {
    console.log('🔄 Processing post-payment return for Payment Links...', {
      searchParams: Object.fromEntries(searchParams.entries()),
      userEmail
    });

    const sessionId = searchParams.get('session_id');
    const paymentStatus = searchParams.get('payment_status');
    const planId = searchParams.get('plan');
    const source = searchParams.get('source');

    // Check for various success indicators
    const isSuccessfulPayment = paymentStatus === 'success' || 
                               sessionId?.startsWith('cs_') ||
                               source === 'user_confirmation' ||
                               source === 'periodic_check' ||
                               source === 'focus_detection';

    if (isSuccessfulPayment && userEmail) {
      console.log('✅ Valid payment return detected, processing subscription activation...');

      // Import subscription service
      const { updateUserSubscription } = await import('../services/subscriptionService');
      
      // Update subscription directly to ensure immediate activation
      const finalSessionId = sessionId || `cs_manual_${Date.now()}`;
      const finalPlanId = planId || 'professional';
      
      await updateUserSubscription(userEmail, finalPlanId, finalSessionId);
      
      // Clear all caches for immediate refresh
      const cacheKeys = [
        `featureCache_${userEmail}`,
        `subscriptionCache_${userEmail}`,
        `planLimits_${userEmail}`,
        'pendingPayment',
        'stripePaymentAttempt',
        'paymentPlanId',
        'paymentUserEmail'
      ];
      
      cacheKeys.forEach(key => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });
      
      // Dispatch immediate subscription update event
      window.dispatchEvent(new CustomEvent('subscriptionUpdated', {
        detail: {
          userEmail,
          planId: finalPlanId,
          sessionId: finalSessionId,
          immediate: true,
          source: 'post_payment_return_payment_link'
        }
      }));

      // Force feature access refresh
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('refreshFeatureAccess', {
          detail: {
            source: 'post_payment_payment_link',
            immediate: true,
            userEmail,
            force: true
          }
        }));
      }, 500);

      return {
        success: true,
        planId: finalPlanId,
        sessionId: finalSessionId,
        activated: true,
        source: 'payment_link'
      };
    }

    return {
      success: false,
      reason: 'Invalid payment return parameters for Payment Link'
    };

  } catch (error) {
    console.error('❌ Error processing post-payment return for Payment Link:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// **NEW**: Manual redirect handler for when payment links don't support redirect URLs
export const handlePaymentLinkReturn = () => {
  const detection = detectPaymentReturn();
  
  if (detection.isPaymentReturn && !window.location.href.includes('payment-success')) {
    console.log('🔄 Detected payment return, redirecting to payment success...');
    
    // Extract available parameters
    const sessionId = detection.sessionId || `cs_auto_${Date.now()}`;
    const planId = detection.planId || sessionStorage.getItem('paymentPlanId') || 'professional';
    const userEmail = sessionStorage.getItem('paymentUserEmail') || '';
    
    // Build success URL
    const successUrl = `/#/payment-success?payment_status=success&plan=${planId}&session_id=${sessionId}&user_email=${encodeURIComponent(userEmail)}&source=auto_redirect&timestamp=${Date.now()}`;
    
    console.log('🎯 Auto-redirecting to:', successUrl);
    
    // Redirect to payment success page
    setTimeout(() => {
      window.location.href = successUrl;
    }, 100);
    
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