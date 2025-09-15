// Replace with your actual Stripe publishable key
const STRIPE_PUBLISHABLE_KEY=process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || 'pk_test_51NRLFoEw1FLYKy8hTsUx1GNUX0cUQ3Fgqf4nXJVwxmNILOAF5SaAOaLYMDjfLXQxfUTYMvhUzNFWPTtQW5jXgdHU00Qv5s0uK5';

// Stripe configuration
export const STRIPE_CONFIG={
  currency: 'gbp',
  country: 'GB',
  locale: 'en-GB'
};

// Function to get Stripe API keys - can be overridden by platform admin
let stripeKeys={
  publishableKey: STRIPE_PUBLISHABLE_KEY,
  secretKey: null,// Never expose in client-side code
  webhookSecret: null
};

// Function to update Stripe configuration (for platform admin)
export const updateStripeConfig=(config)=> {
  // In a real application,this would make a server call to update the configuration
  // For client-side,we only update the publishable key
  if (config && config.publishableKey) {
    stripeKeys.publishableKey=config.publishableKey;
  }
  return stripeKeys;
};

// Function to get current Stripe configuration
export const getStripeConfig=()=> {
  return {
    publishableKey: stripeKeys.publishableKey,
    testMode: stripeKeys.publishableKey.startsWith('pk_test_')
  };
};

// Helper function to build return URLs for Stripe
export const buildStripeReturnUrls=(planId)=> {
  const baseUrl=window.location.origin;
  const basePath=window.location.pathname;
  
  // Use hash routing for return URLs
  const successUrl=`${baseUrl}${basePath}#/payment-success?payment_status=success&plan=${planId}`;
  const cancelUrl=`${baseUrl}${basePath}#/pricing?payment_status=canceled`;
  
  return {
    success_url: successUrl,
    cancel_url: cancelUrl
  };
};

// Subscription plans configuration - UPDATED WITH NEW STRIPE LINK
export const SUBSCRIPTION_PLANS={
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    priceId: 'price_free',
    paymentLink: null,
    features: [
      'Up to 100 inventory items',
      'Basic dashboard',
      'Manual item entry',
      '1 receipt scan per month',
      '1 Excel import per month'
    ],
    limits: {
      inventoryItems: 100,
      receiptScans: 1,
      excelImport: 1,// Updated from false to 1
      teamMembers: 1,
      features: ['basic_dashboard','manual_entry','receipt_scanner','excel_importer']
    }
  },
  professional: {
    id: 'professional',
    name: 'Professional',
    price: 9.99,
    priceId: 'price_1RxEcJEw1FLYKy8h3FDMZ6QP',
    // Updated with the new Stripe payment link you provided
    paymentLink: 'https://buy.stripe.com/test_9B6fZh4xneOXcdN4zCcjS07',
    features: [
      'Unlimited inventory items',
      'Unlimited receipt scans',
      'Unlimited Excel imports',
      'Professional tax export reports'
    ],
    limits: {
      inventoryItems: -1,// unlimited
      receiptScans: -1,// unlimited
      excelImport: -1,// unlimited
      teamMembers: 1,
      features: [
        'receipt_scanner',
        'excel_importer',
        'tax_exports',
        'unlimited_items'
      ]
    },
    highlighted: true
  }
};

// Helper functions
export const formatPrice=(amount,currency='gbp')=> {
  if (typeof amount==='string') return amount;
  return new Intl.NumberFormat('en-GB',{
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
};

export const getPlanById=(planId)=> {
  return SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS.free;
};

export const getUserPlanLimits=(planId)=> {
  const plan=getPlanById(planId);
  return plan ? plan.limits : SUBSCRIPTION_PLANS.free.limits;
};

export const canUserAccessFeature=(userPlan,feature)=> {
  const limits=getUserPlanLimits(userPlan);
  return limits ? limits.features.includes(feature) : false;
};

export const isWithinLimit=(userPlan,limitType,currentCount)=> {
  const limits=getUserPlanLimits(userPlan);
  if (!limits) return false;
  
  const limit=limits[limitType];
  if (limit===-1) return true;// unlimited
  return currentCount < limit;
};

export const isFeatureAvailable=(userPlan,feature)=> {
  switch (feature) {
    case 'excelImport':
      return getUserPlanLimits(userPlan).excelImport > 0 || getUserPlanLimits(userPlan).excelImport===-1;
    case 'receiptScanner':
      return getUserPlanLimits(userPlan).receiptScans > 0;
    case 'taxExports':
      return userPlan==='professional';
    default:
      return canUserAccessFeature(userPlan,feature);
  }
};

export const hasReachedLimit=(userPlan,limitType,currentUsage)=> {
  const limits=getUserPlanLimits(userPlan);
  if (!limits) return true;
  
  const limit=limits[limitType];
  if (limit===-1) return false;// unlimited
  if (limit===0) return true;// not available on this plan
  return currentUsage >=limit;
};

// Plan comparison helper
export const comparePlans=(currentPlan,targetPlan)=> {
  const current=getPlanById(currentPlan);
  const target=getPlanById(targetPlan);
  
  if (current.price==='Custom' || target.price==='Custom') {
    return 'contact';// Need to contact for custom plans
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
export const getNextBillingDate=(subscriptionData)=> {
  if (!subscriptionData || !subscriptionData.current_period_end) {
    return null;
  }
  return new Date(subscriptionData.current_period_end * 1000);
};

export const getDaysUntilRenewal=(subscriptionData)=> {
  const nextBilling=getNextBillingDate(subscriptionData);
  if (!nextBilling) return null;
  
  const now=new Date();
  const diffTime=nextBilling - now;
  const diffDays=Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

export const calculateProration=(currentPlan,newPlan,daysRemaining)=> {
  if (typeof currentPlan.price==='string' || typeof newPlan.price==='string') {
    return null;// Cannot calculate for custom plans
  }
  
  const dailyCurrentCost=currentPlan.price / 30;
  const dailyNewCost=newPlan.price / 30;
  const refund=dailyCurrentCost * daysRemaining;
  const newCharge=dailyNewCost * daysRemaining;
  
  return {
    refund: refund,
    newCharge: newCharge,
    difference: newCharge - refund
  };
};