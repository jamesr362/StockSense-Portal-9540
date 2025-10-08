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
 * Process Stripe webhook events with enhanced error handling and database operations
 */
export const processWebhookEvent = async (event) => {
  try {
    console.log('🎯 Processing webhook event:', event.type, event.id);
    
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
        console.log('ℹ️ Unhandled webhook event type:', event.type);
        return { status: 'ignored', message: 'Event type not handled' };
    }
  } catch (error) {
    console.error('❌ Error processing webhook event:', error);
    logSecurityEvent('WEBHOOK_PROCESSING_ERROR', {
      eventType: event.type,
      eventId: event.id,
      error: error.message
    });
    throw error;
  }
};

/**
 * Handle successful checkout session completion with robust database operations
 */
const handleCheckoutSessionCompleted = async (session) => {
  try {
    console.log('💳 Processing checkout session completed:', session.id);

    const customerEmail = session.customer_details?.email || 
                         session.customer_email || 
                         session.client_reference_id ||
                         session.metadata?.customer_email;
    
    const subscriptionId = session.subscription;
    
    if (!customerEmail) {
      throw new Error('No customer email found in checkout session');
    }

    console.log('👤 Customer email:', customerEmail);

    // Extract plan information with better fallback logic
    let planId = 'professional'; // Default
    if (session.metadata?.plan_id) {
      planId = session.metadata.plan_id;
    } else if (session.line_items?.data?.[0]?.price?.lookup_key) {
      planId = session.line_items.data[0].price.lookup_key;
    } else if (session.mode === 'subscription') {
      planId = 'professional';
    }

    console.log('📋 Plan ID:', planId);

    // Create comprehensive subscription data
    const subscriptionData = {
      user_email: customerEmail.toLowerCase(),
      stripe_customer_id: session.customer,
      stripe_subscription_id: subscriptionId,
      stripe_session_id: session.id,
      plan_id: `price_${planId}`,
      status: 'active',
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      cancel_at_period_end: false,
      canceled_at: null,
      updated_at: new Date().toISOString()
    };

    if (supabase) {
      try {
        // Use upsert to handle both insert and update cases
        const { data, error } = await supabase
          .from('subscriptions_tb2k4x9p1m')
          .upsert(subscriptionData, { 
            onConflict: 'user_email',
            ignoreDuplicates: false 
          })
          .select();

        if (error) {
          console.error('❌ Error upserting subscription:', error);
          throw error;
        }

        console.log('✅ Successfully upserted subscription for:', customerEmail);
        console.log('📊 Subscription data:', data);

        // Clear feature cache for immediate access
        localStorage.removeItem(`featureCache_${customerEmail}`);
        localStorage.removeItem(`subscriptionCache_${customerEmail}`);
        
        // Dispatch subscription update event
        window.dispatchEvent(new CustomEvent('subscriptionUpdated', {
          detail: { 
            userEmail: customerEmail, 
            planId, 
            subscriptionId,
            immediate: true,
            source: 'checkout_completed'
          }
        }));

        logSecurityEvent('CHECKOUT_SESSION_PROCESSED', {
          userEmail: customerEmail,
          planId,
          subscriptionId,
          sessionId: session.id
        });

        return {
          status: 'success',
          message: 'Checkout session processed successfully',
          userEmail: customerEmail,
          planId,
          subscriptionData: data
        };

      } catch (supabaseError) {
        console.error('❌ Supabase operation failed:', supabaseError);
        
        // If it's a missing table error, try to initialize the database
        if (supabaseError.message?.includes('relation') && supabaseError.message?.includes('does not exist')) {
          console.log('🔧 Attempting to initialize database...');
          
          // Import and run database initialization
          const { initializeDatabase } = await import('./supabaseSetup');
          const initialized = await initializeDatabase();
          
          if (initialized) {
            console.log('✅ Database initialized, retrying subscription creation...');
            
            // Retry the upsert operation
            const { data, error } = await supabase
              .from('subscriptions_tb2k4x9p1m')
              .upsert(subscriptionData, { 
                onConflict: 'user_email',
                ignoreDuplicates: false 
              })
              .select();

            if (error) throw error;
            
            console.log('✅ Successfully created subscription after database init');
            return {
              status: 'success',
              message: 'Checkout session processed after database initialization',
              userEmail: customerEmail,
              planId,
              subscriptionData: data
            };
          }
        }
        
        throw supabaseError;
      }
    } else {
      console.warn('⚠️ Supabase not available, storing subscription data locally');
      
      // Fallback: Store in localStorage for demo purposes
      const localSubscriptions = JSON.parse(localStorage.getItem('localSubscriptions') || '{}');
      localSubscriptions[customerEmail] = subscriptionData;
      localStorage.setItem('localSubscriptions', JSON.stringify(localSubscriptions));
      
      return {
        status: 'success',
        message: 'Checkout session processed (local storage)',
        userEmail: customerEmail,
        planId
      };
    }

  } catch (error) {
    console.error('❌ Error handling checkout session completed:', error);
    logSecurityEvent('CHECKOUT_SESSION_ERROR', {
      sessionId: session.id,
      error: error.message
    });
    throw error;
  }
};

/**
 * Handle subscription creation
 */
const handleSubscriptionCreated = async (subscription) => {
  try {
    console.log('📝 Processing subscription created:', subscription.id);

    // Try to get customer email from subscription metadata or customer object
    let customerEmail = subscription.metadata?.customer_email;
    
    if (!customerEmail && subscription.customer) {
      console.warn('⚠️ No customer email in metadata, subscription will be processed when customer data is available');
      return { status: 'pending', message: 'Waiting for customer email' };
    }

    if (!customerEmail) {
      console.warn('⚠️ No customer email found in subscription, skipping...');
      return { status: 'warning', message: 'No customer email found' };
    }

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
      updated_at: new Date().toISOString()
    };

    if (supabase) {
      const { error } = await supabase
        .from('subscriptions_tb2k4x9p1m')
        .upsert(subscriptionData, { onConflict: 'user_email' });

      if (error) {
        console.error('❌ Error upserting subscription:', error);
        throw error;
      }
      
      // Clear cache and notify
      localStorage.removeItem(`featureCache_${customerEmail}`);
      localStorage.removeItem(`subscriptionCache_${customerEmail}`);
      
      window.dispatchEvent(new CustomEvent('subscriptionUpdated', {
        detail: { 
          userEmail: customerEmail, 
          planId, 
          subscriptionId: subscription.id,
          source: 'subscription_created'
        }
      }));
    }

    logSecurityEvent('SUBSCRIPTION_CREATED', {
      userEmail: customerEmail,
      subscriptionId: subscription.id,
      planId
    });

    console.log('✅ Subscription created successfully for:', customerEmail);
    return { 
      status: 'success', 
      message: 'Subscription created successfully',
      userEmail: customerEmail,
      planId
    };
  } catch (error) {
    console.error('❌ Error handling subscription created:', error);
    throw error;
  }
};

/**
 * Handle subscription updates
 */
const handleSubscriptionUpdated = async (subscription) => {
  try {
    console.log('🔄 Processing subscription updated:', subscription.id);

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

      if (error) {
        console.error('❌ Error updating subscription:', error);
        throw error;
      }

      if (data?.user_email) {
        localStorage.removeItem(`featureCache_${data.user_email}`);
        localStorage.removeItem(`subscriptionCache_${data.user_email}`);
        
        window.dispatchEvent(new CustomEvent('subscriptionUpdated', {
          detail: { 
            userEmail: data.user_email, 
            planId, 
            subscriptionId: subscription.id,
            source: 'subscription_updated'
          }
        }));
      }
    }

    logSecurityEvent('SUBSCRIPTION_UPDATED', {
      subscriptionId: subscription.id,
      status: subscription.status
    });

    console.log('✅ Subscription updated successfully:', subscription.id);
    return { status: 'success', message: 'Subscription updated successfully' };
  } catch (error) {
    console.error('❌ Error handling subscription updated:', error);
    throw error;
  }
};

/**
 * Handle subscription deletion/cancellation
 */
const handleSubscriptionDeleted = async (subscription) => {
  try {
    console.log('🗑️ Processing subscription deleted:', subscription.id);

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

      if (error) {
        console.error('❌ Error canceling subscription:', error);
        throw error;
      }

      if (data?.user_email) {
        localStorage.removeItem(`featureCache_${data.user_email}`);
        localStorage.removeItem(`subscriptionCache_${data.user_email}`);
        
        window.dispatchEvent(new CustomEvent('subscriptionUpdated', {
          detail: { 
            userEmail: data.user_email, 
            planId: 'free', 
            subscriptionId: subscription.id,
            source: 'subscription_deleted'
          }
        }));
      }
    }

    logSecurityEvent('SUBSCRIPTION_DELETED', {
      subscriptionId: subscription.id
    });

    console.log('✅ Subscription canceled successfully:', subscription.id);
    return { status: 'success', message: 'Subscription canceled successfully' };
  } catch (error) {
    console.error('❌ Error handling subscription deleted:', error);
    throw error;
  }
};

/**
 * Handle successful payment
 */
const handlePaymentSucceeded = async (invoice) => {
  try {
    console.log('💰 Processing payment succeeded:', invoice.id);

    const subscriptionId = invoice.subscription;
    if (!subscriptionId) {
      console.log('ℹ️ No subscription ID in invoice, skipping...');
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

      if (error) {
        console.error('❌ Error updating payment status:', error);
        throw error;
      }

      if (data?.user_email) {
        localStorage.removeItem(`featureCache_${data.user_email}`);
        localStorage.removeItem(`subscriptionCache_${data.user_email}`);
        
        const planId = data.plan_id ? extractPlanFromPriceId(data.plan_id) : 'professional';
        window.dispatchEvent(new CustomEvent('subscriptionUpdated', {
          detail: { 
            userEmail: data.user_email, 
            planId, 
            subscriptionId,
            source: 'payment_succeeded'
          }
        }));
      }
    }

    logSecurityEvent('PAYMENT_SUCCEEDED', {
      invoiceId: invoice.id,
      subscriptionId
    });

    console.log('✅ Payment processed successfully:', invoice.id);
    return { status: 'success', message: 'Payment processed successfully' };
  } catch (error) {
    console.error('❌ Error handling payment succeeded:', error);
    throw error;
  }
};

/**
 * Handle failed payment
 */
const handlePaymentFailed = async (invoice) => {
  try {
    console.log('💸 Processing payment failed:', invoice.id);

    const subscriptionId = invoice.subscription;
    if (!subscriptionId) {
      console.log('ℹ️ No subscription ID in invoice, skipping...');
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

      if (error) {
        console.error('❌ Error updating payment failure status:', error);
        throw error;
      }

      if (data?.user_email) {
        localStorage.removeItem(`featureCache_${data.user_email}`);
        localStorage.removeItem(`subscriptionCache_${data.user_email}`);
        
        window.dispatchEvent(new CustomEvent('subscriptionUpdated', {
          detail: { 
            userEmail: data.user_email, 
            planId: 'free', 
            subscriptionId,
            source: 'payment_failed'
          }
        }));
      }
    }

    logSecurityEvent('PAYMENT_FAILED', {
      invoiceId: invoice.id,
      subscriptionId
    });

    console.log('✅ Payment failure processed:', invoice.id);
    return { status: 'success', message: 'Payment failure processed' };
  } catch (error) {
    console.error('❌ Error handling payment failed:', error);
    throw error;
  }
};

/**
 * Extract plan ID from Stripe price ID
 */
const extractPlanFromPriceId = (priceId) => {
  if (!priceId) return 'professional';
  
  // Convert Stripe price ID to plan ID
  if (priceId.includes('professional') || priceId.includes('pro')) {
    return 'professional';
  }
  if (priceId.includes('free') || priceId.includes('basic')) {
    return 'free';
  }
  
  // Default mapping for common price IDs
  const priceIdMap = {
    'price_1RxEcJEw1FLYKy8h3FDMZ6QP': 'professional',
    'price_professional': 'professional',
    'price_free': 'free'
  };
  
  return priceIdMap[priceId] || 'professional';
};

/**
 * Simulate webhook endpoint for demo purposes
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

  console.log('🎭 Simulating webhook event:', webhookEvent);
  return await processWebhookEvent(webhookEvent);
};

export default {
  processWebhookEvent,
  simulateWebhookEvent,
  WEBHOOK_EVENTS
};