// Stripe Webhook Service for handling payment confirmations
import { supabase } from '../lib/supabase';
import { logSecurityEvent } from '../utils/security';

// Webhook endpoint configuration
const WEBHOOK_CONFIG = {
  endpoint: '/api/stripe/webhook',
  events: [
    'checkout.session.completed',
    'invoice.payment_succeeded',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted'
  ]
};

// Handle Stripe webhook events
export const handleStripeWebhook = async (event) => {
  try {
    logSecurityEvent('STRIPE_WEBHOOK_RECEIVED', {
      eventType: event.type,
      eventId: event.id
    });

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    logSecurityEvent('STRIPE_WEBHOOK_PROCESSED', {
      eventType: event.type,
      eventId: event.id
    });

    return { received: true };
  } catch (error) {
    console.error('Webhook processing error:', error);
    logSecurityEvent('STRIPE_WEBHOOK_ERROR', {
      eventType: event.type,
      error: error.message
    });
    throw error;
  }
};

// Handle successful checkout session
const handleCheckoutCompleted = async (session) => {
  try {
    console.log('Processing checkout completion:', session.id);
    
    // Extract customer information
    const customerEmail = session.customer_details?.email || session.customer_email;
    const subscriptionId = session.subscription;
    const customerId = session.customer;
    
    if (!customerEmail) {
      throw new Error('No customer email found in checkout session');
    }

    // Get subscription details from Stripe
    const subscriptionData = await getStripeSubscription(subscriptionId);
    
    // Update or create subscription in database
    await updateSubscriptionInDatabase({
      userEmail: customerEmail,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      planId: subscriptionData.items.data[0].price.id,
      status: subscriptionData.status,
      currentPeriodStart: new Date(subscriptionData.current_period_start * 1000).toISOString(),
      currentPeriodEnd: new Date(subscriptionData.current_period_end * 1000).toISOString()
    });

    logSecurityEvent('CHECKOUT_COMPLETED', {
      customerEmail,
      subscriptionId,
      planId: subscriptionData.items.data[0].price.id
    });

  } catch (error) {
    console.error('Error handling checkout completion:', error);
    throw error;
  }
};

// Handle successful payment
const handlePaymentSucceeded = async (invoice) => {
  try {
    console.log('Processing payment success:', invoice.id);
    
    const subscriptionId = invoice.subscription;
    const customerId = invoice.customer;
    
    // Get customer email
    const customer = await getStripeCustomer(customerId);
    const customerEmail = customer.email;
    
    // Update subscription status
    await updateSubscriptionStatus(customerEmail, 'active');
    
    logSecurityEvent('PAYMENT_SUCCEEDED', {
      customerEmail,
      invoiceId: invoice.id,
      amount: invoice.amount_paid / 100
    });

  } catch (error) {
    console.error('Error handling payment success:', error);
    throw error;
  }
};

// Handle subscription creation
const handleSubscriptionCreated = async (subscription) => {
  try {
    console.log('Processing subscription creation:', subscription.id);
    
    const customerId = subscription.customer;
    const customer = await getStripeCustomer(customerId);
    
    await updateSubscriptionInDatabase({
      userEmail: customer.email,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      planId: subscription.items.data[0].price.id,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString()
    });

  } catch (error) {
    console.error('Error handling subscription creation:', error);
    throw error;
  }
};

// Handle subscription updates
const handleSubscriptionUpdated = async (subscription) => {
  try {
    console.log('Processing subscription update:', subscription.id);
    
    const customerId = subscription.customer;
    const customer = await getStripeCustomer(customerId);
    
    await updateSubscriptionInDatabase({
      userEmail: customer.email,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      planId: subscription.items.data[0].price.id,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null
    });

  } catch (error) {
    console.error('Error handling subscription update:', error);
    throw error;
  }
};

// Handle subscription deletion
const handleSubscriptionDeleted = async (subscription) => {
  try {
    console.log('Processing subscription deletion:', subscription.id);
    
    const customerId = subscription.customer;
    const customer = await getStripeCustomer(customerId);
    
    await updateSubscriptionStatus(customer.email, 'canceled');

  } catch (error) {
    console.error('Error handling subscription deletion:', error);
    throw error;
  }
};

// Update subscription in database
const updateSubscriptionInDatabase = async (subscriptionData) => {
  if (!supabase) {
    throw new Error('Supabase not available');
  }

  try {
    // Check if subscription exists
    const { data: existingSubscription, error: fetchError } = await supabase
      .from('subscriptions_tb2k4x9p1m')
      .select('*')
      .eq('user_email', subscriptionData.userEmail.toLowerCase())
      .single();

    const subscriptionRecord = {
      user_email: subscriptionData.userEmail.toLowerCase(),
      stripe_customer_id: subscriptionData.stripeCustomerId,
      stripe_subscription_id: subscriptionData.stripeSubscriptionId,
      plan_id: subscriptionData.planId,
      status: subscriptionData.status,
      current_period_start: subscriptionData.currentPeriodStart,
      current_period_end: subscriptionData.currentPeriodEnd,
      cancel_at_period_end: subscriptionData.cancelAtPeriodEnd || false,
      canceled_at: subscriptionData.canceledAt,
      updated_at: new Date().toISOString()
    };

    if (existingSubscription && !fetchError) {
      // Update existing subscription
      const { error: updateError } = await supabase
        .from('subscriptions_tb2k4x9p1m')
        .update(subscriptionRecord)
        .eq('user_email', subscriptionData.userEmail.toLowerCase());

      if (updateError) throw updateError;
    } else {
      // Create new subscription
      subscriptionRecord.created_at = new Date().toISOString();
      const { error: insertError } = await supabase
        .from('subscriptions_tb2k4x9p1m')
        .insert([subscriptionRecord]);

      if (insertError) throw insertError;
    }

    console.log('Subscription updated in database:', subscriptionData.userEmail);
  } catch (error) {
    console.error('Error updating subscription in database:', error);
    throw error;
  }
};

// Update subscription status only
const updateSubscriptionStatus = async (userEmail, status) => {
  if (!supabase) {
    throw new Error('Supabase not available');
  }

  try {
    const { error } = await supabase
      .from('subscriptions_tb2k4x9p1m')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('user_email', userEmail.toLowerCase());

    if (error) throw error;
    
    console.log('Subscription status updated:', userEmail, status);
  } catch (error) {
    console.error('Error updating subscription status:', error);
    throw error;
  }
};

// Mock Stripe API calls (replace with actual Stripe API calls)
const getStripeSubscription = async (subscriptionId) => {
  // In production, use actual Stripe API:
  // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  // return await stripe.subscriptions.retrieve(subscriptionId);
  
  // Mock response for demo
  return {
    id: subscriptionId,
    status: 'active',
    current_period_start: Math.floor(Date.now() / 1000),
    current_period_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
    items: {
      data: [{
        price: {
          id: 'price_professional'
        }
      }]
    }
  };
};

const getStripeCustomer = async (customerId) => {
  // In production, use actual Stripe API:
  // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  // return await stripe.customers.retrieve(customerId);
  
  // Mock response for demo
  return {
    id: customerId,
    email: 'user@example.com' // This would come from the actual Stripe customer
  };
};

export { WEBHOOK_CONFIG };