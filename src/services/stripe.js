// Mock payment services (replacement for Stripe)
import { logSecurityEvent } from '../utils/security';

export const createCheckoutSession = async (priceId, customerId = null, metadata = {}) => {
  try {
    logSecurityEvent('CHECKOUT_SESSION_INITIATED', {
      priceId,
      customerId
    });

    // Simulate checkout session creation
    console.log('Demo: Creating checkout session for:', { priceId, customerId, metadata });

    // Simulate redirect to checkout page
    window.location.href = `/checkout?plan=${metadata.plan_id || 'pro'}&billing=${metadata.billing_interval || 'monthly'}`;

    logSecurityEvent('CHECKOUT_SESSION_SUCCESS', {
      priceId
    });
  } catch (error) {
    console.error('Checkout session error:', error);
    logSecurityEvent('CHECKOUT_SESSION_FAILED', {
      error: error.message
    });
    throw error;
  }
};

// Create customer portal session
export const createPortalSession = async (customerId) => {
  try {
    logSecurityEvent('PORTAL_SESSION_INITIATED', {
      customerId
    });

    // Mock portal session - redirect to settings
    window.location.href = '/settings';

    logSecurityEvent('PORTAL_SESSION_SUCCESS', {
      customerId
    });
  } catch (error) {
    console.error('Portal session error:', error);
    logSecurityEvent('PORTAL_SESSION_FAILED', {
      error: error.message
    });
    throw error;
  }
};

// Get customer subscription details
export const getCustomerSubscription = async (customerId) => {
  try {
    // Mock subscription data
    return {
      id: 'sub_demo123',
      status: 'active',
      price_id: 'price_professional_monthly',
      amount: 1200, // £12.00 in pence
      current_period_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days from now
      invoice_pdf: null
    };
  } catch (error) {
    console.error('Get subscription error:', error);
    throw error;
  }
};

// Cancel subscription
export const cancelSubscription = async (subscriptionId) => {
  try {
    logSecurityEvent('SUBSCRIPTION_CANCEL_INITIATED', {
      subscriptionId
    });

    // Mock cancellation
    console.log('Demo: Canceling subscription:', subscriptionId);

    logSecurityEvent('SUBSCRIPTION_CANCELLED', {
      subscriptionId
    });

    return { status: 'canceled' };
  } catch (error) {
    console.error('Cancel subscription error:', error);
    logSecurityEvent('SUBSCRIPTION_CANCEL_FAILED', {
      error: error.message
    });
    throw error;
  }
};

// Update subscription
export const updateSubscription = async (subscriptionId, priceId) => {
  try {
    logSecurityEvent('SUBSCRIPTION_UPDATE_INITIATED', {
      subscriptionId,
      priceId
    });

    // Mock update
    console.log('Demo: Updating subscription:', { subscriptionId, priceId });

    logSecurityEvent('SUBSCRIPTION_UPDATED', {
      subscriptionId,
      priceId
    });

    return { status: 'active' };
  } catch (error) {
    console.error('Update subscription error:', error);
    logSecurityEvent('SUBSCRIPTION_UPDATE_FAILED', {
      error: error.message
    });
    throw error;
  }
};

// Get payment methods
export const getPaymentMethods = async (customerId) => {
  try {
    // Mock payment methods
    return [
      {
        id: 'pm_demo123',
        card: {
          brand: 'visa',
          last4: '4242',
          exp_month: 12,
          exp_year: 2025,
        },
        is_default: true
      }
    ];
  } catch (error) {
    console.error('Get payment methods error:', error);
    throw error;
  }
};

// Get usage-based billing data
export const getUsageData = async (subscriptionId) => {
  try {
    // Mock usage data
    return {
      inventory_items: 150,
      team_members: 3
    };
  } catch (error) {
    console.error('Get usage data error:', error);
    throw error;
  }
};