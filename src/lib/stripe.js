const STRIPE_PUBLISHABLE_KEY = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || 'pk_test_51NRLFoEw1FLYKy8hTsUx1GNUX0cUQ3Fgqf4nXJVwxmNILOAF5SaAOaLYMDjfLXQxfUTYMvhUzNFWPTtQW5jXgdHU00Qv5s0uK5';
import { secureLog } from '../utils/secureLogging';

export const STRIPE_CONFIG = {
  currency: 'gbp',
  country: 'GB',
  locale: 'en-GB'
};

let stripeKeys = {
  publishableKey: STRIPE_PUBLISHABLE_KEY,
  secretKey: null,
  webhookSecret: null
};

export const updateStripeConfig = (config) => {
  if (config && config.publishableKey) {
    stripeKeys.publishableKey = config.publishableKey;
  }
  return stripeKeys;
};

export const getStripeConfig = () => {
  return {
    publishableKey: stripeKeys.publishableKey,
    testMode: stripeKeys.publishableKey.startsWith('pk_test_')
  };
};

export const getAppBaseUrl = () => {
  return window.location.origin;
};

export const buildStripeReturnUrls = (planId) => {
  const baseUrl = getAppBaseUrl();
  
  const successUrl = `${baseUrl}/#/payment-success?payment_status=success&plan=${planId}&session_id={CHECKOUT_SESSION_ID}&timestamp=${Date.now()}`;
  const cancelUrl = `${baseUrl}/#/pricing?payment_status=canceled&plan=${planId}&timestamp=${Date.now()}`;
  
  secureLog.debug('Built Stripe return URLs for Payment Links');
  
  return {
    success_url: successUrl,
    cancel_url: cancelUrl
  };
};

export const getWebhookEndpointUrl = () => {
  const baseUrl = getAppBaseUrl();
  return `${baseUrl}/.netlify/functions/stripe-webhook`;
};

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
      inventoryItems: -1,
      receiptScans: -1,
      excelImport: -1,
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
  if (limit === -1) return true;
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
  if (limit === -1) return false;
  if (limit === 0) return true;
  return currentUsage >= limit;
};

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

export const detectPaymentReturn = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const referrer = document.referrer || '';
  const currentUrl = window.location.href;
  
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
        return timeDiff < 5 * 60 * 1000;
      }
      return false;
    })()
  };
  
  const isPaymentReturn = Object.values(indicators).some(Boolean);
  
  secureLog.debug('Enhanced payment return detection', {
    isPaymentReturn,
    currentUrl,
    referrer
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

export const createEnhancedCheckoutSession = async (planId, userEmail, options = {}) => {
  const plan = getPlanById(planId);
  if (!plan || !plan.paymentLink) {
    throw new Error('Invalid plan or missing payment link');
  }

  secureLog.debug('Creating enhanced checkout session for Payment Link...');
  
  const paymentData = {
    planId,
    userEmail,
    timestamp: Date.now(),
    sessionId: `pl_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    source: 'payment_link'
  };
  
  sessionStorage.setItem('paymentTracking', JSON.stringify(paymentData));
  sessionStorage.setItem('awaitingPayment', 'true');
  
  secureLog.debug('Stored payment tracking data');
  
  setupPaymentReturnMonitoring(paymentData);
  
  return {
    url: plan.paymentLink,
    sessionId: paymentData.sessionId,
    planId,
    userEmail,
    paymentData
  };
};

const setupPaymentReturnMonitoring = (paymentData) => {
  secureLog.debug('Setting up payment return monitoring...');
  
  const handleFocus = () => {
    secureLog.debug('Window focused - checking payment status...');
    
    setTimeout(() => {
      const tracking = JSON.parse(sessionStorage.getItem('paymentTracking') || 'null');
      const awaitingPayment = sessionStorage.getItem('awaitingPayment') === 'true';
      
      if (tracking && awaitingPayment) {
        secureLog.debug('Payment tracking found, checking with user...');
        
        const userConfirmed = confirm(
          `🔔 Payment Setup Confirmation\n\n` +
          `Did you successfully complete the setup for your ${tracking.planId.toUpperCase()} plan?\n\n` +
          `✅ Click OK if setup was successful\n` +
          `❌ Click Cancel if you didn't complete setup or had issues`
        );
        
        if (userConfirmed) {
          secureLog.debug('User confirmed payment setup success');
          processSuccessfulPayment(tracking);
        } else {
          secureLog.debug('User indicated payment setup was not successful');
          clearPaymentTracking();
        }
      }
    }, 1500);
  };
  
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      secureLog.debug('Page became visible - checking payment...');
      setTimeout(handleFocus, 1000);
    }
  };
  
  let checkCount = 0;
  const maxChecks = 20;
  
  const periodicCheck = () => {
    checkCount++;
    const tracking = JSON.parse(sessionStorage.getItem('paymentTracking') || 'null');
    const awaitingPayment = sessionStorage.getItem('awaitingPayment') === 'true';
    
    secureLog.debug(`Periodic check ${checkCount}/${maxChecks}`);
    
    if (!tracking || !awaitingPayment || checkCount >= maxChecks) {
      secureLog.debug('Stopping periodic checks');
      return;
    }
    
    const referrer = document.referrer || '';
    if (referrer.includes('stripe.com') || referrer.includes('buy.stripe.com')) {
      secureLog.debug('Detected return from Stripe!');
      setTimeout(() => {
        handleFocus();
      }, 2000);
      return;
    }
    
    setTimeout(periodicCheck, 30000);
  };
  
  window.addEventListener('focus', handleFocus);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  setTimeout(periodicCheck, 10000);
  
  setTimeout(() => {
    window.removeEventListener('focus', handleFocus);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    secureLog.debug('Payment monitoring cleanup completed');
  }, 30 * 60 * 1000);
};

const processSuccessfulPayment = async (tracking) => {
  try {
    secureLog.debug('Processing successful payment...');
    
    clearPaymentTracking();
    
    const successUrl = `/#/payment-success?` + new URLSearchParams({
      payment_status: 'success',
      plan: tracking.planId,
      session_id: tracking.sessionId,
      user_email: tracking.userEmail,
      source: 'user_confirmation',
      timestamp: Date.now().toString()
    }).toString();
    
    secureLog.debug('Redirecting to success page');
    window.location.href = successUrl;
    
  } catch (error) {
    secureLog.error('Error processing successful payment:', error);
    alert('Payment setup confirmation successful, but there was an issue. Please refresh the page or contact support.');
  }
};

const clearPaymentTracking = () => {
  sessionStorage.removeItem('paymentTracking');
  sessionStorage.removeItem('awaitingPayment');
  secureLog.debug('Payment tracking cleared');
};

export const handlePostPaymentReturn = async (searchParams, userEmail) => {
  try {
    secureLog.debug('Processing post-payment return...');

    const sessionId = searchParams.get('session_id') || searchParams.get('sessionId') || `pl_fallback_${Date.now()}`;
    const paymentStatus = searchParams.get('payment_status') || searchParams.get('status') || 'success';
    const planId = searchParams.get('plan') || searchParams.get('planId') || 'professional';
    const source = searchParams.get('source') || 'payment_success_page';
    const userEmailParam = searchParams.get('user_email') || searchParams.get('email') || userEmail;

    const isPaymentSuccessScenario = (
      paymentStatus === 'success' ||
      source === 'user_confirmation' ||
      source === 'auto_redirect' ||
      (sessionId && (sessionId.startsWith('pl_') || sessionId.startsWith('cs_'))) ||
      window.location.href.includes('payment-success') ||
      (userEmail && window.location.pathname.includes('payment-success'))
    );

    secureLog.debug('Payment success scenario check:', { isPaymentSuccessScenario });

    if (isPaymentSuccessScenario && userEmail) {
      secureLog.debug('Valid payment scenario detected, activating subscription...');

      try {
        const { updateUserSubscription } = await import('../services/subscriptionService');
        await updateUserSubscription(userEmail, planId, sessionId);
        
        secureLog.debug('Subscription updated successfully');
        
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
        
        secureLog.debug('Caches cleared');
        
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
                planId: planId,
                sessionId: sessionId,
                immediate: true,
                source: 'post_payment_return'
              }
            }));
            secureLog.debug(`Dispatched ${eventName} event`);
          }, index * 100);
        });

        return {
          success: true,
          planId: planId,
          sessionId: sessionId,
          activated: true,
          source: 'payment_success_processed',
          userEmail: userEmail
        };

      } catch (subscriptionError) {
        secureLog.error('Error updating subscription:', subscriptionError);
        
        return {
          success: true,
          planId: planId,
          sessionId: sessionId,
          activated: false,
          source: 'payment_success_webhook_pending',
          userEmail: userEmail,
          warning: 'Subscription activation pending - webhook will complete setup'
        };
      }
    }

    const missingItems = [];
    if (!userEmail) missingItems.push('user authentication');
    if (!isPaymentSuccessScenario) missingItems.push('payment success indicators');
    
    secureLog.debug('Payment processing failed:', { missingItems });

    return {
      success: false,
      reason: `Missing required items: ${missingItems.join(', ')}`,
      debug: {
        userEmail: !!userEmail,
        isPaymentSuccessScenario,
        extractedParams: {
          sessionId,
          paymentStatus,
          planId,
          source
        }
      }
    };

  } catch (error) {
    secureLog.error('Error processing post-payment return:', error);
    return {
      success: false,
      error: error.message,
      fallback: true
    };
  }
};

export const handlePaymentLinkReturn = () => {
  const detection = detectPaymentReturn();
  
  if (detection.isPaymentReturn && !window.location.href.includes('payment-success')) {
    secureLog.debug('Auto-handling payment return...');
    
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
    
    secureLog.debug('Auto-redirecting to success page');
    window.location.href = successUrl;
    
    return true;
  }
  
  return false;
};

export const verifyWebhookSignature = (payload, signature, secret) => {
  secureLog.debug('Webhook signature verification (simulated)');
  return true;
};