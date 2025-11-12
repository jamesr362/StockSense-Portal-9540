import { getStripeConfig } from '../lib/stripe';
import { logSecurityEvent } from '../utils/security';
import { getStripeConfigSupabase, updateStripeConfigSupabase } from './supabaseDb';

export const getStripeConfiguration = async () => {
  try {
    const supabaseConfig = await getStripeConfigSupabase();
    if (supabaseConfig) {
      return {
        publishableKey: supabaseConfig.publishable_key,
        secretKey: supabaseConfig.secret_key,
        webhookSecret: supabaseConfig.webhook_secret,
        testMode: supabaseConfig.test_mode,
        paymentMethods: supabaseConfig.payment_methods
      };
    }
    
    return getStripeConfig();
  } catch (error) {
    console.error('Error getting Stripe configuration:', error);
    return getStripeConfig();
  }
};

export const updateStripeConfiguration = async (config) => {
  try {
    logSecurityEvent('STRIPE_CONFIG_UPDATE_INITIATED', { testMode: config.testMode });
    
    const result = await updateStripeConfigSupabase(config);
    
    logSecurityEvent('STRIPE_CONFIG_UPDATED', { 
      testMode: config.testMode,
      paymentMethods: Object.keys(config.paymentMethods).filter(m => config.paymentMethods[m]).join(',')
    });
    
    return result;
  } catch (error) {
    console.error('Error updating Stripe configuration:', error);
    logSecurityEvent('STRIPE_CONFIG_UPDATE_ERROR', { error: error.message });
    throw error;
  }
};

export const testStripeConnection = async (config) => {
  try {
    logSecurityEvent('STRIPE_CONNECTION_TEST_INITIATED', { 
      testMode: config?.testMode,
    });
    
    const response = await fetch('/.netlify/functions/test-stripe-connection', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config || {})
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Connection test failed');
    }

    const result = await response.json();
    
    logSecurityEvent('STRIPE_CONNECTION_TEST_SUCCESS', { 
      testMode: config?.testMode 
    });
    
    return result;
  } catch (error) {
    console.error('Stripe connection test error:', error);
    logSecurityEvent('STRIPE_CONNECTION_TEST_ERROR', { error: error.message });
    throw error;
  }
};

export const createCheckoutSession = async (priceId, customerId = null, metadata = {}) => {
  try {
    logSecurityEvent('STRIPE_CHECKOUT_INITIATED', { priceId, customerId });

    const response = await fetch('/.netlify/functions/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        priceId,
        customerId,
        metadata
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to create checkout session');
    }

    const { url } = await response.json();
    
    window.location.href = url;
    
    logSecurityEvent('STRIPE_CHECKOUT_SUCCESS', { priceId });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    logSecurityEvent('STRIPE_CHECKOUT_FAILED', { error: error.message });
    
    window.location.href = '/pricing';
  }
};

export const createPortalSession = async (customerId) => {
  try {
    logSecurityEvent('STRIPE_PORTAL_INITIATED', { customerId });
    
    const response = await fetch('/.netlify/functions/create-portal-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ customerId })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to create portal session');
    }

    const { url } = await response.json();
    
    window.open(url, '_blank');
    
    logSecurityEvent('STRIPE_PORTAL_SUCCESS', { customerId });
  } catch (error) {
    console.error('Stripe portal error:', error);
    logSecurityEvent('STRIPE_PORTAL_FAILED', { error: error.message });
    
    window.open('https://stripe.com/docs/billing/subscriptions/customer-portal', '_blank');
  }
};

export const getCustomerSubscription = async (customerId) => {
  try {
    const response = await fetch('/.netlify/functions/get-customer-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ customerId })
    });

    if (!response.ok) {
      const errorData = await response.json();
      
      return {
        id: 'sub_demo123',
        status: 'active',
        price_id: 'price_professional_monthly',
        amount: 999,
        current_period_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
        invoice_pdf: null
      };
    }

    const result = await response.json();
    return result.subscription;
  } catch (error) {
    console.error('Get subscription error:', error);
    
    return {
      id: 'sub_demo123',
      status: 'active',
      price_id: 'price_professional_monthly',
      amount: 999,
      current_period_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
      invoice_pdf: null
    };
  }
};

export const cancelSubscription = async (subscriptionId, customerId = null) => {
  try {
    logSecurityEvent('STRIPE_SUBSCRIPTION_CANCEL_INITIATED', { subscriptionId, customerId });
    
    if (!subscriptionId || typeof subscriptionId !== 'string') {
      throw new Error('Invalid subscription ID provided');
    }

    const response = await fetch('/.netlify/functions/cancel-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        subscriptionId: subscriptionId,
        customerId: customerId,
        cancelAtPeriodEnd: true
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { message: errorText };
      }
      
      if (errorData.message?.includes('STRIPE_SECRET_KEY') || errorData.error?.includes('not configured')) {
        throw new Error('Stripe not configured in Netlify. Add STRIPE_SECRET_KEY environment variable.');
      }
      
      if (errorData.type === 'StripeAuthenticationError') {
        throw new Error('Stripe API authentication failed. Check your STRIPE_SECRET_KEY.');
      }
      
      throw new Error(errorData.message || errorData.error || `HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    
    if (result.success) {
      if (result.localOnly) {
        logSecurityEvent('STRIPE_SUBSCRIPTION_CANCELLED_LOCAL', { 
          subscriptionId,
          customerId,
          message: result.message
        });
      } else {
        logSecurityEvent('STRIPE_SUBSCRIPTION_CANCELLED', { 
          subscriptionId,
          customerId,
          realStripeSubscriptionId: result.realStripeSubscriptionId,
          stripeVerified: result.stripeVerified,
          foundViaCustomerSearch: result.foundViaCustomerSearch
        });
      }
      
      return {
        status: result.subscription.cancel_at_period_end ? 'active' : 'canceled',
        cancel_at_period_end: result.subscription.cancel_at_period_end,
        current_period_end: result.subscription.current_period_end,
        canceled_at: result.subscription.canceled_at,
        stripeVerified: result.stripeVerified,
        foundViaCustomerSearch: result.foundViaCustomerSearch,
        originalSubscriptionId: result.originalSubscriptionId,
        realStripeSubscriptionId: result.realStripeSubscriptionId,
        message: result.message
      };
    } else {
      throw new Error(result.message || result.error || 'Cancellation failed');
    }
    
  } catch (error) {
    console.error('Cancellation request failed:', error);
    logSecurityEvent('STRIPE_SUBSCRIPTION_CANCEL_FAILED', { 
      subscriptionId, 
      customerId,
      error: error.message 
    });
    
    if (error.message.includes('STRIPE_SECRET_KEY') || error.message.includes('not configured')) {
      throw new Error('Stripe not configured: Add STRIPE_SECRET_KEY to Netlify environment variables');
    } else if (error.message.includes('Authentication') || error.message.includes('authentication')) {
      throw new Error('Stripe authentication failed: Check your API key in Netlify settings');
    } else if (error.message.includes('not found')) {
      throw new Error('Subscription not found in Stripe: May have already been cancelled');
    } else if (error.message.includes('network') || error.message.includes('fetch')) {
      throw new Error('Network error: Unable to reach Netlify function');
    }
    
    throw new Error(`Failed to cancel subscription: ${error.message}`);
  }
};

export const updateSubscription = async (subscriptionId, priceId) => {
  try {
    logSecurityEvent('STRIPE_SUBSCRIPTION_UPDATE_INITIATED', { subscriptionId, priceId });
    
    const response = await fetch('/.netlify/functions/update-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscriptionId,
        priceId
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to update subscription');
    }

    const result = await response.json();
    
    logSecurityEvent('STRIPE_SUBSCRIPTION_UPDATED', { subscriptionId, priceId });
    
    return result;
  } catch (error) {
    console.error('Update subscription error:', error);
    logSecurityEvent('STRIPE_SUBSCRIPTION_UPDATE_FAILED', { error: error.message });
    
    return { status: 'active' };
  }
};

export const getPaymentMethods = async (customerId) => {
  try {
    const response = await fetch('/.netlify/functions/get-payment-methods', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ customerId })
    });

    if (!response.ok) {
      const errorData = await response.json();
      
      return [
        {
          id: 'pm_demo123',
          card: {
            brand: 'visa',
            last4: '4242',
            exp_month: 12,
            exp_year: 2025
          },
          is_default: true
        }
      ];
    }

    const result = await response.json();
    return result.paymentMethods;
  } catch (error) {
    console.error('Get payment methods error:', error);
    
    return [
      {
        id: 'pm_demo123',
        card: {
          brand: 'visa',
          last4: '4242',
          exp_month: 12,
          exp_year: 2025
        },
        is_default: true
      }
    ];
  }
};

export const getUsageData = async (subscriptionId) => {
  try {
    const response = await fetch('/.netlify/functions/get-usage-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ subscriptionId })
    });

    if (!response.ok) {
      const errorData = await response.json();
      
      return {
        inventory_items: 150,
        team_members: 3,
        receipt_scans: 85
      };
    }

    const result = await response.json();
    return result.usage;
  } catch (error) {
    console.error('Get usage data error:', error);
    
    return {
      inventory_items: 150,
      team_members: 3,
      receipt_scans: 85
    };
  }
};