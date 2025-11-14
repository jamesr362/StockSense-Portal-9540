import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const handler = async (event) => {
  const sig = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
  } catch (err) {
    console.error(`Webhook signature verification failed.`, err.message);
    return {
      statusCode: 400,
      body: `Webhook Error: ${err.message}`,
    };
  }

  try {
    const data = stripeEvent.data.object;
    const eventType = stripeEvent.type;

    console.log(`🎯 Received event type: ${eventType}`);
    console.log(`📋 Event ID: ${stripeEvent.id}`);

    switch (eventType) {
      case 'checkout.session.completed':
        if (data.mode === 'subscription') {
          await handleCheckoutSessionCompleted(data);
        }
        break;
        
      case 'customer.subscription.created':
        await handleSubscriptionCreated(data);
        break;
        
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(data);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionCancellation(data);
        break;
        
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(data);
        break;
        
      case 'invoice.payment_failed':
        await handlePaymentFailed(data);
        break;
        
      default:
        console.log(`ℹ️ Unhandled event type ${eventType}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true }),
    };
  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    return {
      statusCode: 500,
      body: `Webhook handler failed. View logs for details.`,
    };
  }
};

async function handleCheckoutSessionCompleted(session) {
  console.log('🛒 Handling checkout session completed:', session.id);
  
  try {
    // CRITICAL FIX: Get the ACTUAL subscription ID from the session
    const subscriptionId = session.subscription;
    const customerId = session.customer;
    
    if (!subscriptionId || !customerId) {
      console.error('❌ Missing subscription or customer ID in session:', session.id);
      return;
    }

    console.log('🔍 Session details:');
    console.log('  - Session ID (cs_):', session.id);
    console.log('  - Customer ID (cus_):', customerId);
    console.log('  - Subscription ID (sub_):', subscriptionId);

    // VALIDATION: Ensure we have the correct ID formats
    if (!customerId.startsWith('cus_')) {
      console.error('❌ Invalid customer ID format:', customerId);
      return;
    }

    if (!subscriptionId.startsWith('sub_')) {
      console.error('❌ Invalid subscription ID format:', subscriptionId);
      return;
    }

    // Retrieve the actual subscription object from Stripe to get complete data
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['items.data.price']
    });
    
    const customer = await stripe.customers.retrieve(customerId);
    
    if (!customer.email) {
      console.error('❌ No email found for customer:', customerId);
      return;
    }

    console.log('✅ Retrieved subscription details:');
    console.log('  - Customer email:', customer.email);
    console.log('  - Subscription status:', subscription.status);
    console.log('  - Price ID:', subscription.items.data[0]?.price?.id);
    console.log('  - Price lookup key:', subscription.items.data[0]?.price?.lookup_key);

    // ENHANCED PLAN MAPPING: Use actual Stripe price data
    const priceId = subscription.items.data[0]?.price?.id;
    const lookupKey = subscription.items.data[0]?.price?.lookup_key;
    const planId = mapStripePriceToPlan(priceId, lookupKey);

    console.log('📋 Plan mapping result:', {
      stripePriceId: priceId,
      lookupKey: lookupKey,
      mappedPlan: planId
    });

    const subscriptionData = {
      user_email: customer.email.toLowerCase(),
      stripe_customer_id: customerId, // CORRECT: cus_xxx
      stripe_subscription_id: subscription.id, // CORRECT: sub_xxx (not cs_xxx!)
      stripe_session_id: session.id, // SEPARATE: cs_xxx for reference
      plan_id: planId, // CORRECT: 'professional' or 'free'
      stripe_price_id: priceId, // STORE: actual Stripe price ID
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('💾 Saving subscription data:', {
      userEmail: subscriptionData.user_email,
      customerId: subscriptionData.stripe_customer_id,
      subscriptionId: subscriptionData.stripe_subscription_id,
      sessionId: subscriptionData.stripe_session_id,
      planId: subscriptionData.plan_id,
      status: subscriptionData.status
    });

    // Insert or update subscription with enhanced error handling
    const { data, error: upsertError } = await supabase
      .from('subscriptions_tb2k4x9p1m')
      .upsert(subscriptionData, {
        onConflict: 'user_email',
        ignoreDuplicates: false
      })
      .select();

    if (upsertError) {
      console.error('❌ Error upserting subscription:', upsertError);
      throw upsertError;
    }

    console.log('✅ Subscription created/updated successfully for user:', customer.email);
    console.log('🔍 Database verification:');
    console.log('  - Stored Customer ID:', subscriptionData.stripe_customer_id);
    console.log('  - Stored Subscription ID:', subscriptionData.stripe_subscription_id);
    console.log('  - Stored Session ID:', subscriptionData.stripe_session_id);
    console.log('  - Plan ID:', subscriptionData.plan_id);
    console.log('  - Status:', subscriptionData.status);

    // VERIFICATION: Double-check what was actually stored
    const { data: verificationData, error: verifyError } = await supabase
      .from('subscriptions_tb2k4x9p1m')
      .select('*')
      .eq('user_email', customer.email.toLowerCase())
      .single();

    if (!verifyError && verificationData) {
      console.log('🔍 Database verification result:');
      console.log('  - Stored stripe_subscription_id:', verificationData.stripe_subscription_id);
      console.log('  - Stored stripe_customer_id:', verificationData.stripe_customer_id);
      console.log('  - Stored plan_id:', verificationData.plan_id);
      console.log('  - Stored status:', verificationData.status);
      
      // CRITICAL CHECK: Ensure we stored the subscription ID correctly
      if (!verificationData.stripe_subscription_id.startsWith('sub_')) {
        console.error('🚨 CRITICAL ERROR: Wrong subscription ID stored!', verificationData.stripe_subscription_id);
      } else {
        console.log('✅ Subscription ID verification passed');
      }

      // CRITICAL CHECK: Ensure plan ID is correct format
      if (verificationData.plan_id !== 'professional' && verificationData.plan_id !== 'free') {
        console.error('🚨 CRITICAL ERROR: Wrong plan ID format stored!', verificationData.plan_id);
      } else {
        console.log('✅ Plan ID verification passed');
      }
    }
    
  } catch (error) {
    console.error('❌ Error in handleCheckoutSessionCompleted:', error);
    throw error;
  }
}

async function handleSubscriptionCreated(subscription) {
  console.log('📝 Handling subscription created:', subscription.id);
  
  try {
    // VALIDATION: Ensure correct ID format
    if (!subscription.id.startsWith('sub_')) {
      console.error('❌ Invalid subscription ID format:', subscription.id);
      return;
    }

    // Get customer details
    const customer = await stripe.customers.retrieve(subscription.customer);
    
    if (!customer.email) {
      console.error('❌ No email found for customer:', subscription.customer);
      return;
    }

    // ENHANCED PLAN MAPPING
    const priceId = subscription.items.data[0]?.price?.id;
    const lookupKey = subscription.items.data[0]?.price?.lookup_key;
    const planId = mapStripePriceToPlan(priceId, lookupKey);

    console.log('📋 Subscription created details:', {
      subscriptionId: subscription.id,
      customerId: subscription.customer,
      customerEmail: customer.email,
      priceId: priceId,
      planId: planId,
      status: subscription.status
    });

    const subscriptionData = {
      user_email: customer.email.toLowerCase(),
      stripe_customer_id: subscription.customer, // CORRECT: cus_xxx
      stripe_subscription_id: subscription.id, // CORRECT: sub_xxx
      plan_id: planId, // CORRECT: 'professional' or 'free'
      stripe_price_id: priceId, // STORE: actual Stripe price ID
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Insert or update subscription
    const { error: upsertError } = await supabase
      .from('subscriptions_tb2k4x9p1m')
      .upsert(subscriptionData, {
        onConflict: 'user_email'
      });

    if (upsertError) {
      console.error('❌ Error upserting subscription:', upsertError);
      throw upsertError;
    }

    console.log('✅ Subscription created for user:', customer.email);
    console.log('📋 Final data - Customer ID:', subscription.customer, 'Subscription ID:', subscription.id, 'Plan:', planId);
    
  } catch (error) {
    console.error('❌ Error in handleSubscriptionCreated:', error);
    throw error;
  }
}

async function handleSubscriptionUpdate(subscription) {
  console.log('🔄 Handling subscription update:', subscription.id);
  
  try {
    // ENHANCED PLAN MAPPING
    const priceId = subscription.items.data[0]?.price?.id;
    const lookupKey = subscription.items.data[0]?.price?.lookup_key;
    const planId = mapStripePriceToPlan(priceId, lookupKey);

    const updateData = {
      plan_id: planId,
      stripe_price_id: priceId,
      status: subscription.status,
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const { error } = await supabase
      .from('subscriptions_tb2k4x9p1m')
      .update(updateData)
      .eq('stripe_subscription_id', subscription.id);
    
    if (error) {
      console.error('❌ Error updating subscription:', error);
      throw error;
    }
    
    console.log('✅ Subscription updated:', subscription.id, 'to status:', subscription.status, 'plan:', planId);
    
  } catch (error) {
    console.error('❌ Error in handleSubscriptionUpdate:', error);
    throw error;
  }
}

async function handleSubscriptionCancellation(subscription) {
  console.log('🗑️ Handling subscription cancellation:', subscription.id);
  
  try {
    const updateData = {
      status: 'canceled',
      cancel_at_period_end: false,
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const { error } = await supabase
      .from('subscriptions_tb2k4x9p1m')
      .update(updateData)
      .eq('stripe_subscription_id', subscription.id);

    if (error) {
      console.error('❌ Error canceling subscription:', error);
      throw error;
    }
    
    console.log('✅ Subscription canceled:', subscription.id);
    
  } catch (error) {
    console.error('❌ Error in handleSubscriptionCancellation:', error);
    throw error;
  }
}

async function handlePaymentSucceeded(invoice) {
  console.log('💰 Handling payment succeeded:', invoice.id);
  
  try {
    const subscriptionId = invoice.subscription;
    
    if (subscriptionId) {
      const updateData = {
        status: 'active',
        updated_at: new Date().toISOString()
      };
      
      const { error } = await supabase
        .from('subscriptions_tb2k4x9p1m')
        .update(updateData)
        .eq('stripe_subscription_id', subscriptionId);
      
      if (error) {
        console.error('❌ Error updating subscription after payment:', error);
        throw error;
      }
      
      console.log('✅ Subscription marked active after payment:', subscriptionId);
    }
    
  } catch (error) {
    console.error('❌ Error in handlePaymentSucceeded:', error);
    throw error;
  }
}

async function handlePaymentFailed(invoice) {
  console.log('💸 Handling payment failed:', invoice.id);
  
  try {
    const subscriptionId = invoice.subscription;
    
    if (subscriptionId) {
      const updateData = {
        status: 'past_due',
        updated_at: new Date().toISOString()
      };
      
      const { error } = await supabase
        .from('subscriptions_tb2k4x9p1m')
        .update(updateData)
        .eq('stripe_subscription_id', subscriptionId);
      
      if (error) {
        console.error('❌ Error updating subscription after failed payment:', error);
        throw error;
      }
      
      console.log('✅ Subscription marked past_due after failed payment:', subscriptionId);
    }
    
  } catch (error) {
    console.error('❌ Error in handlePaymentFailed:', error);
    throw error;
  }
}

/**
 * ENHANCED: Map Stripe price ID to internal plan ID
 */
function mapStripePriceToPlan(priceId, lookupKey) {
  // If we have a lookup key, use that first
  if (lookupKey) {
    if (lookupKey.includes('professional') || lookupKey.includes('pro')) {
      return 'professional';
    }
    if (lookupKey.includes('free') || lookupKey.includes('basic')) {
      return 'free';
    }
  }

  // Fallback to price ID mapping
  if (priceId) {
    // Common Stripe price ID patterns
    if (priceId.includes('professional') || priceId.includes('pro')) {
      return 'professional';
    }
    if (priceId.includes('free') || priceId.includes('basic')) {
      return 'free';
    }
    
    // Specific price ID mappings (update these with your actual Stripe price IDs)
    const priceIdMap = {
      'price_1RxEcJEw1FLYKy8h3FDMZ6QP': 'professional',
      'price_professional': 'professional',
      'price_free': 'free'
    };
    
    if (priceIdMap[priceId]) {
      return priceIdMap[priceId];
    }
  }

  // Default to professional for paid subscriptions
  console.log('⚠️ Could not map price to plan, defaulting to professional. Price ID:', priceId, 'Lookup Key:', lookupKey);
  return 'professional';
}