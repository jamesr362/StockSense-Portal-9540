import getStripe from '../lib/stripe';
import { logSecurityEvent } from '../utils/security';

// Create Stripe checkout session
export const createCheckoutSession = async (priceId, customerId = null, metadata = {}) => {
  try {
    logSecurityEvent('STRIPE_CHECKOUT_INITIATED', { priceId, customerId });

    const response = await fetch('/api/stripe/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        priceId,
        customerId,
        metadata,
        successUrl: `${window.location.origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${window.location.origin}/pricing`,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create checkout session');
    }

    const { sessionId } = await response.json();
    
    const stripe = await getStripe();
    const { error } = await stripe.redirectToCheckout({ sessionId });
    
    if (error) {
      logSecurityEvent('STRIPE_CHECKOUT_ERROR', { error: error.message });
      throw error;
    }

    logSecurityEvent('STRIPE_CHECKOUT_SUCCESS', { sessionId });
    
  } catch (error) {
    console.error('Stripe checkout error:', error);
    logSecurityEvent('STRIPE_CHECKOUT_FAILED', { error: error.message });
    throw error;
  }
};

// Create customer portal session
export const createPortalSession = async (customerId) => {
  try {
    logSecurityEvent('STRIPE_PORTAL_INITIATED', { customerId });

    const response = await fetch('/api/stripe/create-portal-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customerId,
        returnUrl: `${window.location.origin}/settings/billing`,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create portal session');
    }

    const { url } = await response.json();
    window.location.href = url;

    logSecurityEvent('STRIPE_PORTAL_SUCCESS', { customerId });
    
  } catch (error) {
    console.error('Stripe portal error:', error);
    logSecurityEvent('STRIPE_PORTAL_FAILED', { error: error.message });
    throw error;
  }
};

// Get customer subscription details
export const getCustomerSubscription = async (customerId) => {
  try {
    const response = await fetch(`/api/stripe/customer/${customerId}/subscription`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get subscription');
    }

    return await response.json();
    
  } catch (error) {
    console.error('Get subscription error:', error);
    throw error;
  }
};

// Cancel subscription
export const cancelSubscription = async (subscriptionId) => {
  try {
    logSecurityEvent('STRIPE_SUBSCRIPTION_CANCEL_INITIATED', { subscriptionId });

    const response = await fetch(`/api/stripe/subscription/${subscriptionId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to cancel subscription');
    }

    const result = await response.json();
    
    logSecurityEvent('STRIPE_SUBSCRIPTION_CANCELLED', { subscriptionId });
    return result;
    
  } catch (error) {
    console.error('Cancel subscription error:', error);
    logSecurityEvent('STRIPE_SUBSCRIPTION_CANCEL_FAILED', { error: error.message });
    throw error;
  }
};

// Update subscription
export const updateSubscription = async (subscriptionId, priceId) => {
  try {
    logSecurityEvent('STRIPE_SUBSCRIPTION_UPDATE_INITIATED', { subscriptionId, priceId });

    const response = await fetch(`/api/stripe/subscription/${subscriptionId}/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ priceId }),
    });

    if (!response.ok) {
      throw new Error('Failed to update subscription');
    }

    const result = await response.json();
    
    logSecurityEvent('STRIPE_SUBSCRIPTION_UPDATED', { subscriptionId, priceId });
    return result;
    
  } catch (error) {
    console.error('Update subscription error:', error);
    logSecurityEvent('STRIPE_SUBSCRIPTION_UPDATE_FAILED', { error: error.message });
    throw error;
  }
};

// Get payment methods
export const getPaymentMethods = async (customerId) => {
  try {
    const response = await fetch(`/api/stripe/customer/${customerId}/payment-methods`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get payment methods');
    }

    return await response.json();
    
  } catch (error) {
    console.error('Get payment methods error:', error);
    throw error;
  }
};

// Get usage-based billing data
export const getUsageData = async (subscriptionId) => {
  try {
    const response = await fetch(`/api/stripe/subscription/${subscriptionId}/usage`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get usage data');
    }

    return await response.json();
    
  } catch (error) {
    console.error('Get usage data error:', error);
    throw error;
  }
};