import { supabase } from '../lib/supabase';
import { logSecurityEvent } from '../utils/security';

// Webhook event types we handle
const WEBHOOK_EVENTS = {
  CHECKOUT_SESSION_COMPLETED: 'checkout.session.completed',
  CUSTOMER_SUBSCRIPTION_CREATED: 'customer.subscription.created',
  CUSTOMER_SUBSCRIPTION_UPDATED: 'customer.subscription.updated',
  CUSTOMER_SUBSCRIPTION_DELETED: 'customer.subscription.deleted',
  INVOICE_PAYMENT_SUCCEEDED: 'invoice.payment_succeeded',
  INVOICE_PAYMENT_FAILED: 'invoice.payment_failed'
};

/**
 * Process Stripe webhook events
 * This would typically run on your backend, but for demo purposes
 * we're simulating the webhook processing client-side
 */
export const processWebhookEvent = async (event) => {
  try {
    console.log('Processing webhook event:', event.type, event.id);
    
    logSecurityEvent('WEBHOOK_EVENT_RECEIVED', {
      eventType: event.type,
      eventId: event.id,
      timestamp: new Date().toISOString()
    });

    switch (event.type) {
      case WEBHOOK_EVENTS.CHECKOUT_SESSION_COMPLETED:
        return await handleCheckoutSessionCompleted(event.data.object);
      
      case WEBHOOK_EVENTS.CUSTOMER_SUBSCRIPTION_CREATED:
        return await handleSubscriptionCreated(event.data.object);
      
      case WEBHOOK_EVENTS.CUSTOMER_SUBSCRIPTION_UPDATED:
        return await handleSubscriptionUpdated(event.data.object);
      
      case WEBHOOK_EVENTS.CUSTOMER_SUBSCRIPTION_DELETED:
        return await handleSubscriptionDeleted(event.data.object);
      
      case WEBHOOK_EVENTS.INVOICE_PAYMENT_SUCCEEDED:
        return await handlePaymentSucceeded(event.data.object);
      
      case WEBHOOK_EVENTS.INVOICE_PAYMENT_FAILED:
        return await handlePaymentFailed(event.data.object);
      
      default:
        console.log('Unhandled webhook event type:', event.type);
        return { status: 'ignored', message: 'Event type not handled' };
    }
  } catch (error) {
    console.error('Error processing webhook event:', error);
    logSecurityEvent('WEBHOOK_PROCESSING_ERROR', {
      eventType: event.type,
      eventId: event.id,
      error: error.message
    });
    throw error;
  }
};

/**
 * Handle successful checkout session completion
 */
const handleCheckoutSessionCompleted = async (session) => {
  try {
    console.log('Processing checkout session completed:', session.id);

    const customerEmail = session.customer_details?.email || session.customer_email;
    const subscriptionId = session.subscription;
    const clientReferenceId = session.client_reference_id; // This should be the user email
    
    if (!customerEmail && !clientReferenceId) {
      throw new Error('No customer email found in checkout session');
    }

    const userEmail = customerEmail || clientReferenceId;

    // Extract plan information from session metadata or line items
    let planId = 'professional'; // Default
    if (session.metadata?.plan_id) {
      planId = session.metadata.plan_id;
    } else if (session.line_items?.data?.[0]?.price?.lookup_key) {
      planId = session.line_items.data[0].price.lookup_key;
    }

    // Create or update subscription in database
    const subscriptionData = {
      user_email: userEmail.toLowerCase(),
      stripe_customer_id: session.customer,
      stripe_subscription_id: subscriptionId,
      stripe_session_id: session.id,
      plan_id: `price_${planId}`,
      status: 'active',
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      cancel_at_period_end: false,
      canceled_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (supabase) {
      // Check if subscription already exists
      const { data: existingSubscription, error: fetchError } = await supabase
        .from('subscriptions_tb2k4x9p1m')
        .select('*')
        .eq('user_email', userEmail.toLowerCase())
        .single();

      if (existingSubscription && !fetchError) {
        // Update existing subscription
        const { error: updateError } = await supabase
          .from('subscriptions_tb2k4x9p1m')
          .update(subscriptionData)
          .eq('user_email', userEmail.toLowerCase());

        if (updateError) throw updateError;
        console.log('Updated existing subscription for:', userEmail);
      } else {
        // Create new subscription
        const { error: insertError } = await supabase
          .from('subscriptions_tb2k4x9p1m')
          .insert([subscriptionData]);

        if (insertError) throw insertError;
        console.log('Created new subscription for:', userEmail);
      }

      // Clear feature cache for immediate access
      localStorage.removeItem(`featureCache_${userEmail}`);
      
      // Dispatch subscription update event
      window.dispatchEvent(new CustomEvent('subscriptionUpdated', {
        detail: { userEmail, planId, subscriptionId }
      }));
    }

    logSecurityEvent('CHECKOUT_SESSION_PROCESSED', {
      userEmail,
      planId,
      subscriptionId,
      sessionId: session.id
    });

    return {
      status: 'success',
      message: 'Checkout session processed successfully',
      userEmail,
      planId
    };
  } catch (error) {
    console.error('Error handling checkout session completed:', error);
    throw error;
  }
};

/**
 * Handle subscription creation
 */
const handleSubscriptionCreated = async (subscription) => {
  try {
    console.log('Processing subscription created:', subscription.id);

    // Get customer details
    const customerEmail = subscription.metadata?.customer_email;
    if (!customerEmail) {
      console.warn('No customer email in subscription metadata');
      return { status: 'warning', message: 'No customer email found' };
    }

    // Extract plan from price ID
    const priceId = subscription.items.data[0]?.price?.id;
    const planId = priceId ? extractPlanFromPriceId(priceId) : 'professional';

    const subscriptionData = {
      user_email: customerEmail.toLowerCase(),
      stripe_customer_id: subscription.customer,
      stripe_subscription_id: subscription.id,
      plan_id: priceId || `price_${planId}`,
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (supabase) {
      const { error } = await supabase
        .from('subscriptions_tb2k4x9p1m')
        .upsert(subscriptionData, { onConflict: 'user_email' });

      if (error) throw error;
      
      // Clear cache and notify
      localStorage.removeItem(`featureCache_${customerEmail}`);
      window.dispatchEvent(new CustomEvent('subscriptionUpdated', {
        detail: { userEmail: customerEmail, planId, subscriptionId: subscription.id }
      }));
    }

    logSecurityEvent('SUBSCRIPTION_CREATED', {
      userEmail: customerEmail,
      subscriptionId: subscription.id,
      planId
    });

    return { status: 'success', message: 'Subscription created successfully' };
  } catch (error) {
    console.error('Error handling subscription created:', error);
    throw error;
  }
};

/**
 * Handle subscription updates
 */
const handleSubscriptionUpdated = async (subscription) => {
  try {
    console.log('Processing subscription updated:', subscription.id);

    if (supabase) {
      const priceId = subscription.items.data[0]?.price?.id;
      const planId = priceId ? extractPlanFromPriceId(priceId) : 'professional';

      const updateData = {
        plan_id: priceId || `price_${planId}`,
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end,
        canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('subscriptions_tb2k4x9p1m')
        .update(updateData)
        .eq('stripe_subscription_id', subscription.id)
        .select('user_email')
        .single();

      if (error) throw error;

      if (data?.user_email) {
        localStorage.removeItem(`featureCache_${data.user_email}`);
        window.dispatchEvent(new CustomEvent('subscriptionUpdated', {
          detail: { userEmail: data.user_email, planId, subscriptionId: subscription.id }
        }));
      }
    }

    logSecurityEvent('SUBSCRIPTION_UPDATED', {
      subscriptionId: subscription.id,
      status: subscription.status
    });

    return { status: 'success', message: 'Subscription updated successfully' };
  } catch (error) {
    console.error('Error handling subscription updated:', error);
    throw error;
  }
};

/**
 * Handle subscription deletion/cancellation
 */
const handleSubscriptionDeleted = async (subscription) => {
  try {
    console.log('Processing subscription deleted:', subscription.id);

    if (supabase) {
      const { data, error } = await supabase
        .from('subscriptions_tb2k4x9p1m')
        .update({
          status: 'canceled',
          canceled_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('stripe_subscription_id', subscription.id)
        .select('user_email')
        .single();

      if (error) throw error;

      if (data?.user_email) {
        localStorage.removeItem(`featureCache_${data.user_email}`);
        window.dispatchEvent(new CustomEvent('subscriptionUpdated', {
          detail: { userEmail: data.user_email, planId: 'free', subscriptionId: subscription.id }
        }));
      }
    }

    logSecurityEvent('SUBSCRIPTION_DELETED', {
      subscriptionId: subscription.id
    });

    return { status: 'success', message: 'Subscription canceled successfully' };
  } catch (error) {
    console.error('Error handling subscription deleted:', error);
    throw error;
  }
};

/**
 * Handle successful payment
 */
const handlePaymentSucceeded = async (invoice) => {
  try {
    console.log('Processing payment succeeded:', invoice.id);

    const subscriptionId = invoice.subscription;
    if (!subscriptionId) {
      return { status: 'ignored', message: 'No subscription ID in invoice' };
    }

    if (supabase) {
      // Update subscription status to active
      const { data, error } = await supabase
        .from('subscriptions_tb2k4x9p1m')
        .update({
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('stripe_subscription_id', subscriptionId)
        .select('user_email, plan_id')
        .single();

      if (error) throw error;

      if (data?.user_email) {
        localStorage.removeItem(`featureCache_${data.user_email}`);
        const planId = data.plan_id ? extractPlanFromPriceId(data.plan_id) : 'professional';
        window.dispatchEvent(new CustomEvent('subscriptionUpdated', {
          detail: { userEmail: data.user_email, planId, subscriptionId }
        }));
      }
    }

    logSecurityEvent('PAYMENT_SUCCEEDED', {
      invoiceId: invoice.id,
      subscriptionId
    });

    return { status: 'success', message: 'Payment processed successfully' };
  } catch (error) {
    console.error('Error handling payment succeeded:', error);
    throw error;
  }
};

/**
 * Handle failed payment
 */
const handlePaymentFailed = async (invoice) => {
  try {
    console.log('Processing payment failed:', invoice.id);

    const subscriptionId = invoice.subscription;
    if (!subscriptionId) {
      return { status: 'ignored', message: 'No subscription ID in invoice' };
    }

    if (supabase) {
      // Update subscription status
      const { data, error } = await supabase
        .from('subscriptions_tb2k4x9p1m')
        .update({
          status: 'past_due',
          updated_at: new Date().toISOString()
        })
        .eq('stripe_subscription_id', subscriptionId)
        .select('user_email')
        .single();

      if (error) throw error;

      if (data?.user_email) {
        localStorage.removeItem(`featureCache_${data.user_email}`);
        window.dispatchEvent(new CustomEvent('subscriptionUpdated', {
          detail: { userEmail: data.user_email, planId: 'free', subscriptionId }
        }));
      }
    }

    logSecurityEvent('PAYMENT_FAILED', {
      invoiceId: invoice.id,
      subscriptionId
    });

    return { status: 'success', message: 'Payment failure processed' };
  } catch (error) {
    console.error('Error handling payment failed:', error);
    throw error;
  }
};

/**
 * Extract plan ID from Stripe price ID
 */
const extractPlanFromPriceId = (priceId) => {
  if (priceId.includes('professional') || priceId.includes('pro')) {
    return 'professional';
  }
  if (priceId.includes('free') || priceId.includes('basic')) {
    return 'free';
  }
  return 'professional'; // Default to professional
};

/**
 * Simulate webhook endpoint for demo purposes
 * In production, this would be a server-side endpoint
 */
export const simulateWebhookEvent = async (eventType, objectData, metadata = {}) => {
  const webhookEvent = {
    id: `evt_${Math.random().toString(36).substring(2, 15)}`,
    object: 'event',
    api_version: '2020-08-27',
    created: Math.floor(Date.now() / 1000),
    type: eventType,
    data: {
      object: {
        ...objectData,
        metadata: {
          ...objectData.metadata,
          ...metadata
        }
      }
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: `req_${Math.random().toString(36).substring(2, 15)}`,
      idempotency_key: null
    }
  };

  console.log('Simulating webhook event:', webhookEvent);
  return await processWebhookEvent(webhookEvent);
};

export default {
  processWebhookEvent,
  simulateWebhookEvent,
  WEBHOOK_EVENTS
};