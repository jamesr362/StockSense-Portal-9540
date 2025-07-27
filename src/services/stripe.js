// Stripe payment services
import { logSecurityEvent } from '../utils/security';

// Create checkout session for subscription
export const createCheckoutSession = async (priceId, customerId = null, metadata = {}) => {
  try {
    logSecurityEvent('CHECKOUT_SESSION_INITIATED', { priceId, customerId });

    // In demo mode, simulate checkout
    if (process.env.NODE_ENV !== 'production') {
      console.log('Demo: Creating checkout session for:', { priceId, customerId, metadata });
      
      // Simulate redirect to checkout page
      window.location.href = `/checkout?plan=${metadata.plan_id || 'pro'}&billing=${metadata.billing_interval || 'monthly'}`;
      
      logSecurityEvent('CHECKOUT_SESSION_SUCCESS', { priceId });
      return;
    }

    // Production Stripe integration
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
        cancelUrl: `${window.location.origin}/subscription`
      })
    });

    if (!response.ok) {
      throw new Error('Failed to create checkout session');
    }

    const { url } = await response.json();
    window.location.href = url;
    
    logSecurityEvent('CHECKOUT_SESSION_SUCCESS', { priceId });
  } catch (error) {
    console.error('Checkout session error:', error);
    logSecurityEvent('CHECKOUT_SESSION_FAILED', { error: error.message });
    throw error;
  }
};

// Create customer portal session
export const createPortalSession = async (customerId) => {
  try {
    logSecurityEvent('PORTAL_SESSION_INITIATED', { customerId });

    // In demo mode, redirect to settings
    if (process.env.NODE_ENV !== 'production') {
      window.location.href = '/settings';
      logSecurityEvent('PORTAL_SESSION_SUCCESS', { customerId });
      return;
    }

    // Production Stripe integration
    const response = await fetch('/api/stripe/create-portal-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customerId,
        returnUrl: `${window.location.origin}/settings`
      })
    });

    if (!response.ok) {
      throw new Error('Failed to create portal session');
    }

    const { url } = await response.json();
    window.location.href = url;
    
    logSecurityEvent('PORTAL_SESSION_SUCCESS', { customerId });
  } catch (error) {
    console.error('Portal session error:', error);
    logSecurityEvent('PORTAL_SESSION_FAILED', { error: error.message });
    throw error;
  }
};

// Get customer subscription details
export const getCustomerSubscription = async (customerId) => {
  try {
    // In demo mode, return mock data
    if (process.env.NODE_ENV !== 'production') {
      return {
        id: 'sub_demo123',
        status: 'active',
        price_id: 'price_professional_monthly',
        amount: 1200, // £12.00 in pence
        current_period_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days from now
        invoice_pdf: null
      };
    }

    // Production Stripe integration
    const response = await fetch(`/api/stripe/subscription/${customerId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
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
    logSecurityEvent('SUBSCRIPTION_CANCEL_INITIATED', { subscriptionId });

    // In demo mode, return mock response
    if (process.env.NODE_ENV !== 'production') {
      console.log('Demo: Canceling subscription:', subscriptionId);
      logSecurityEvent('SUBSCRIPTION_CANCELLED', { subscriptionId });
      return { status: 'canceled' };
    }

    // Production Stripe integration
    const response = await fetch(`/api/stripe/subscription/${subscriptionId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error('Failed to cancel subscription');
    }

    const result = await response.json();
    logSecurityEvent('SUBSCRIPTION_CANCELLED', { subscriptionId });
    return result;
  } catch (error) {
    console.error('Cancel subscription error:', error);
    logSecurityEvent('SUBSCRIPTION_CANCEL_FAILED', { error: error.message });
    throw error;
  }
};

// Update subscription
export const updateSubscription = async (subscriptionId, priceId) => {
  try {
    logSecurityEvent('SUBSCRIPTION_UPDATE_INITIATED', { subscriptionId, priceId });

    // In demo mode, return mock response
    if (process.env.NODE_ENV !== 'production') {
      console.log('Demo: Updating subscription:', { subscriptionId, priceId });
      logSecurityEvent('SUBSCRIPTION_UPDATED', { subscriptionId, priceId });
      return { status: 'active' };
    }

    // Production Stripe integration
    const response = await fetch(`/api/stripe/subscription/${subscriptionId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ priceId })
    });

    if (!response.ok) {
      throw new Error('Failed to update subscription');
    }

    const result = await response.json();
    logSecurityEvent('SUBSCRIPTION_UPDATED', { subscriptionId, priceId });
    return result;
  } catch (error) {
    console.error('Update subscription error:', error);
    logSecurityEvent('SUBSCRIPTION_UPDATE_FAILED', { error: error.message });
    throw error;
  }
};

// Get payment methods
export const getPaymentMethods = async (customerId) => {
  try {
    // In demo mode, return mock data
    if (process.env.NODE_ENV !== 'production') {
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
    }

    // Production Stripe integration
    const response = await fetch(`/api/stripe/payment-methods/${customerId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
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
    // In demo mode, return mock data
    if (process.env.NODE_ENV !== 'production') {
      return {
        inventory_items: 150,
        team_members: 3
      };
    }

    // Production Stripe integration
    const response = await fetch(`/api/stripe/usage/${subscriptionId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
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

// Process one-time payment
export const processPayment = async (paymentMethodId, amount, currency = 'gbp', metadata = {}) => {
  try {
    logSecurityEvent('PAYMENT_PROCESSING_INITIATED', { amount, currency });

    // In demo mode, simulate successful payment
    if (process.env.NODE_ENV !== 'production') {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate processing time
      
      const mockResult = {
        id: `pi_${Date.now()}`,
        amount: amount * 100,
        currency,
        status: 'succeeded',
        created: Date.now(),
        metadata
      };
      
      logSecurityEvent('PAYMENT_SUCCESS', { paymentId: mockResult.id });
      return mockResult;
    }

    // Production Stripe integration
    const response = await fetch('/api/stripe/process-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        paymentMethodId,
        amount: amount * 100, // Convert to cents
        currency,
        metadata
      })
    });

    if (!response.ok) {
      throw new Error('Payment processing failed');
    }

    const result = await response.json();
    logSecurityEvent('PAYMENT_SUCCESS', { paymentId: result.id });
    return result;
  } catch (error) {
    console.error('Payment processing error:', error);
    logSecurityEvent('PAYMENT_PROCESSING_ERROR', { error: error.message });
    throw error;
  }
};

// Validate webhook signature (for backend use)
export const validateWebhookSignature = (payload, signature, secret) => {
  try {
    // This would typically be done on the backend
    // Using Stripe's webhook signature validation
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    return stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (error) {
    console.error('Webhook signature validation failed:', error);
    throw error;
  }
};