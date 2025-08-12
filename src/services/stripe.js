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

// Mock Stripe services for demo purposes (replace with real Stripe API calls)
export const createCheckoutSession = async (priceId, customerId = null, metadata = {}) => {
  try {
    logSecurityEvent('STRIPE_CHECKOUT_INITIATED', { priceId, customerId });

    // In a real app, this would make an API call to your backend 
    // For demo purposes, we'll simulate a checkout session
    console.log('Demo: Creating checkout session for:', { priceId, customerId, metadata });
    
    // Simulate redirect to pricing page (in real app, this would redirect to Stripe)
    window.location.href = '/pricing';
    
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
    
    // In a real app, this would create a Stripe portal session
    // For demo purposes, we'll open a new tab
    window.open('https://stripe.com/docs/billing/subscriptions/customer-portal', '_blank');
    
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
    // Mock subscription data
    return {
      id: 'sub_demo123',
      status: 'active',
      price_id: 'price_professional_monthly',
      amount: 7900, // $79.00 in cents
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
    logSecurityEvent('STRIPE_SUBSCRIPTION_CANCEL_INITIATED', { subscriptionId });
    
    // Mock cancellation
    console.log('Demo: Canceling subscription:', subscriptionId);
    
    logSecurityEvent('STRIPE_SUBSCRIPTION_CANCELLED', { subscriptionId });
    
    return { status: 'canceled' };
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
    
    // Mock update
    console.log('Demo: Updating subscription:', { subscriptionId, priceId });
    
    logSecurityEvent('STRIPE_SUBSCRIPTION_UPDATED', { subscriptionId, priceId });
    
    return { status: 'active' };
  } catch (error) {
    console.error('Update subscription error:', error);
    logSecurityEvent('STRIPE_SUBSCRIPTION_UPDATE_FAILED', { error: error.message });
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
          exp_year: 2025
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

// Test Stripe connection
export const testStripeConnection = async (config) => {
  try {
    logSecurityEvent('STRIPE_CONNECTION_TEST_INITIATED', { 
      testMode: config.testMode,
    });
    
    // In a real app, this would make an API call to test the connection
    // For demo purposes, we'll simulate a successful test
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock success
    logSecurityEvent('STRIPE_CONNECTION_TEST_SUCCESS', { 
      testMode: config.testMode 
    });
    
    return { success: true };
  } catch (error) {
    console.error('Stripe connection test error:', error);
    logSecurityEvent('STRIPE_CONNECTION_TEST_ERROR', { error: error.message });
    throw error;
  }
};