import { getStripeConfig } from '../lib/stripe';
import { logSecurityEvent } from '../utils/security';
import { getStripeConfigSupabase, updateStripeConfigSupabase } from './supabaseDb';

// Get the current Stripe configuration
export const getStripeConfiguration = async () => {
  try {
    // Try to get from Supabase first
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
    
    // Fallback to local config
    return getStripeConfig();
  } catch (error) {
    console.error('Error getting Stripe configuration:', error);
    // Fallback to local config
    return getStripeConfig();
  }
};

// Update Stripe configuration
export const updateStripeConfiguration = async (config) => {
  try {
    logSecurityEvent('STRIPE_CONFIG_UPDATE_INITIATED', { testMode: config.testMode });
    
    // Try to update in Supabase
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

// Create checkout session
export const createCheckoutSession = async (priceId, customerId = null, metadata = {}) => {
  try {
    logSecurityEvent('STRIPE_CHECKOUT_INITIATED', { priceId, customerId });

    // Call the Netlify function to create checkout session
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
    
    // Redirect to Stripe checkout
    window.location.href = url;
    
    logSecurityEvent('STRIPE_CHECKOUT_SUCCESS', { priceId });
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
    
    // Call Netlify function to create portal session
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
    
    // Open portal in new tab
    window.open(url, '_blank');
    
    logSecurityEvent('STRIPE_PORTAL_SUCCESS', { customerId });
  } catch (error) {
    console.error('Stripe portal error:', error);
    logSecurityEvent('STRIPE_PORTAL_FAILED', { error: error.message });
    
    // Fallback: Open Stripe documentation
    window.open('https://stripe.com/docs/billing/subscriptions/customer-portal', '_blank');
  }
};

// Cancel subscription - REAL implementation
export const cancelSubscription = async (subscriptionId) => {
  try {
    logSecurityEvent('STRIPE_SUBSCRIPTION_CANCEL_INITIATED', { subscriptionId });
    
    console.log('🔄 Calling Netlify function to cancel subscription:', subscriptionId);
    
    // Call the actual Netlify function to cancel in Stripe
    const response = await fetch('/.netlify/functions/cancel-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscriptionId: subscriptionId,
        cancelAtPeriodEnd: true // This prevents future charges while maintaining access
      })
    });

    console.log('📡 Netlify function response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Netlify function error response:', errorText);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { message: errorText };
      }
      
      throw new Error(errorData.message || `HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Subscription cancellation result:', result);
    
    // Enhanced success verification
    if (result.success) {
      if (result.localOnly) {
        console.log('💡 Local-only cancellation processed');
      } else {
        console.log('🎯 Stripe API cancellation confirmed');
        console.log('📊 Stripe verification:', result.verification);
      }
      
      logSecurityEvent('STRIPE_SUBSCRIPTION_CANCELLED', { 
        subscriptionId,
        stripeVerified: !result.localOnly
      });
      
      return {
        status: result.subscription.cancel_at_period_end ? 'active' : 'canceled',
        cancel_at_period_end: result.subscription.cancel_at_period_end,
        current_period_end: result.subscription.current_period_end,
        canceled_at: result.subscription.canceled_at,
        stripeVerified: !result.localOnly,
        message: result.message
      };
    } else {
      throw new Error(result.message || 'Cancellation failed');
    }
    
  } catch (error) {
    console.error('❌ Cancellation request failed:', error);
    logSecurityEvent('STRIPE_SUBSCRIPTION_CANCEL_FAILED', { 
      subscriptionId, 
      error: error.message 
    });
    throw new Error(`Failed to cancel subscription: ${error.message}`);
  }
};

// Update subscription
export const updateSubscription = async (subscriptionId, priceId) => {
  try {
    logSecurityEvent('STRIPE_SUBSCRIPTION_UPDATE_INITIATED', { subscriptionId, priceId });
    
    // Call Netlify function to update subscription
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
    throw error;
  }
};

// Get customer subscription details
export const getCustomerSubscription = async (customerId) => {
  try {
    // Call Netlify function to get subscription
    const response = await fetch('/.netlify/functions/get-customer-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ customerId })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to get subscription');
    }

    const result = await response.json();
    return result.subscription;
  } catch (error) {
    console.error('Get subscription error:', error);
    
    // Fallback: Return mock data for demo
    return {
      id: 'sub_demo123',
      status: 'active',
      price_id: 'price_professional_monthly',
      amount: 999, // £9.99 in pence
      current_period_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days from now
      invoice_pdf: null
    };
  }
};

// Get payment methods
export const getPaymentMethods = async (customerId) => {
  try {
    // Call Netlify function to get payment methods
    const response = await fetch('/.netlify/functions/get-payment-methods', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ customerId })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to get payment methods');
    }

    const result = await response.json();
    return result.paymentMethods;
  } catch (error) {
    console.error('Get payment methods error:', error);
    
    // Fallback: Return mock data for demo
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

// Get usage-based billing data
export const getUsageData = async (subscriptionId) => {
  try {
    // Call Netlify function to get usage data
    const response = await fetch('/.netlify/functions/get-usage-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ subscriptionId })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to get usage data');
    }

    const result = await response.json();
    return result.usage;
  } catch (error) {
    console.error('Get usage data error:', error);
    
    // Fallback: Return mock data for demo
    return {
      inventory_items: 150,
      team_members: 3,
      receipt_scans: 85
    };
  }
};

// Test Stripe connection
export const testStripeConnection = async (config) => {
  try {
    logSecurityEvent('STRIPE_CONNECTION_TEST_INITIATED', { 
      testMode: config.testMode,
    });
    
    // Call Netlify function to test connection
    const response = await fetch('/.netlify/functions/test-stripe-connection', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Connection test failed');
    }

    const result = await response.json();
    
    logSecurityEvent('STRIPE_CONNECTION_TEST_SUCCESS', { 
      testMode: config.testMode 
    });
    
    return result;
  } catch (error) {
    console.error('Stripe connection test error:', error);
    logSecurityEvent('STRIPE_CONNECTION_TEST_ERROR', { error: error.message });
    throw error;
  }
};