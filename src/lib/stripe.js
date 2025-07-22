import { loadStripe } from '@stripe/stripe-js';

// Replace with your actual Stripe publishable key
const STRIPE_PUBLISHABLE_KEY = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || 'pk_test_your_publishable_key_here';

// Initialize Stripe
let stripePromise;
const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
  }
  return stripePromise;
};

export default getStripe;

// Stripe configuration
export const STRIPE_CONFIG = {
  currency: 'gbp',
  country: 'GB',
  locale: 'en-GB'
};

// Subscription plans configuration
export const SUBSCRIPTION_PLANS = {
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 29,
    priceId: 'price_starter_monthly', // Replace with actual Stripe price ID
    features: [
      'Up to 500 inventory items',
      'Basic stock alerts',
      '2 team members',
      'Email support',
      'Mobile app access'
    ],
    limits: {
      inventoryItems: 500,
      teamMembers: 2,
      features: ['basic_alerts', 'email_support', 'mobile_access']
    }
  },
  professional: {
    id: 'professional',
    name: 'Professional',
    price: 79,
    priceId: 'price_professional_monthly', // Replace with actual Stripe price ID
    features: [
      'Unlimited inventory items',
      'Advanced analytics',
      '10 team members',
      'Priority support',
      'Multiple locations',
      'Custom categories',
      'Batch operations'
    ],
    limits: {
      inventoryItems: -1, // unlimited
      teamMembers: 10,
      features: ['advanced_analytics', 'priority_support', 'multiple_locations', 'custom_categories', 'batch_operations']
    },
    highlighted: true
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: 199,
    priceId: 'price_enterprise_monthly', // Replace with actual Stripe price ID
    features: [
      'All Professional features',
      'Unlimited team members',
      'Dedicated account manager',
      'Custom API access',
      'Advanced security features',
      'Custom integrations'
    ],
    limits: {
      inventoryItems: -1, // unlimited
      teamMembers: -1, // unlimited
      features: ['all_professional', 'unlimited_team', 'dedicated_manager', 'custom_api', 'advanced_security', 'custom_integrations']
    }
  }
};

// Payment methods configuration
export const PAYMENT_METHODS = {
  card: {
    name: 'Credit/Debit Card',
    icon: '💳',
    description: 'Visa, Mastercard, American Express'
  },
  paypal: {
    name: 'PayPal',
    icon: '🅿️',
    description: 'Pay with your PayPal account'
  },
  bank_transfer: {
    name: 'Bank Transfer',
    icon: '🏦',
    description: 'Direct bank transfer (UK only)'
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
  return plan ? plan.limits : null;
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