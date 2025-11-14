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

    console.log(`Received event type: ${eventType}`);

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
        console.log(`Unhandled event type ${eventType}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true }),
    };
  } catch (error) {
    console.error('Error processing webhook:', error);
    return {
      statusCode: 500,
      body: `Webhook handler failed. View logs for details.`,
    };
  }
};

async function handleCheckoutSessionCompleted(session) {
  console.log('🔄 Handling checkout session completed:', session.id);
  
  try {
    // Get the actual subscription ID from the session
    const subscriptionId = session.subscription;
    const customerId = session.customer;
    
    if (!subscriptionId || !customerId) {
      console.error('Missing subscription or customer ID in session:', session.id);
      return;
    }

    // Retrieve the actual subscription object from Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const customer = await stripe.customers.retrieve(customerId);
    
    if (!customer.email) {
      console.error('No email found for customer:', customerId);
      return;
    }

    console.log('✅ Retrieved subscription:', subscription.id, 'for customer:', customer.email);

    const subscriptionData = {
      user_email: customer.email.toLowerCase(),
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id, // This is the real sub_xxx ID
      plan_id: subscription.items.data[0].price.id,
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
      console.error('Error upserting subscription:', upsertError);
      throw upsertError;
    }

    console.log(`✅ Subscription created/updated for user ${customer.email}`);
    console.log(`📋 Stripe Customer ID: ${customerId}`);
    console.log(`📋 Stripe Subscription ID: ${subscription.id}`);
    
  } catch (error) {
    console.error('Error in handleCheckoutSessionCompleted:', error);
    throw error;
  }
}

async function handleSubscriptionCreated(subscription) {
  console.log('🔄 Handling subscription created:', subscription.id);
  
  try {
    // Get customer details
    const customer = await stripe.customers.retrieve(subscription.customer);
    
    if (!customer.email) {
      console.error('No email found for customer:', subscription.customer);
      return;
    }

    const subscriptionData = {
      user_email: customer.email.toLowerCase(),
      stripe_customer_id: subscription.customer,
      stripe_subscription_id: subscription.id, // This is already the correct sub_xxx ID
      plan_id: subscription.items.data[0].price.id,
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
      console.error('Error upserting subscription:', upsertError);
      throw upsertError;
    }

    console.log(`✅ Subscription created for user ${customer.email}`);
    console.log(`📋 Stripe Customer ID: ${subscription.customer}`);
    console.log(`📋 Stripe Subscription ID: ${subscription.id}`);
    
  } catch (error) {
    console.error('Error in handleSubscriptionCreated:', error);
    throw error;
  }
}

async function handleSubscriptionUpdate(subscription) {
  console.log('🔄 Handling subscription update:', subscription.id);
  
  try {
    const { id: subscriptionId, status, cancel_at_period_end, canceled_at } = subscription;
    
    const updateData = {
      status: status,
      cancel_at_period_end: cancel_at_period_end,
      canceled_at: canceled_at ? new Date(canceled_at * 1000).toISOString() : null,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const { error } = await supabase
      .from('subscriptions_tb2k4x9p1m')
      .update(updateData)
      .eq('stripe_subscription_id', subscriptionId);
    
    if (error) {
      console.error('Error updating subscription:', error);
      throw error;
    }
    
    console.log(`✅ Subscription ${subscriptionId} updated to ${status}`);
    
  } catch (error) {
    console.error('Error in handleSubscriptionUpdate:', error);
    throw error;
  }
}

async function handleSubscriptionCancellation(subscription) {
  console.log('🔄 Handling subscription cancellation:', subscription.id);
  
  try {
    const { id: subscriptionId } = subscription;
    
    const updateData = {
      status: 'canceled',
      cancel_at_period_end: false,
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const { error } = await supabase
      .from('subscriptions_tb2k4x9p1m')
      .update(updateData)
      .eq('stripe_subscription_id', subscriptionId);

    if (error) {
      console.error('Error canceling subscription:', error);
      throw error;
    }
    
    console.log(`✅ Subscription ${subscriptionId} canceled`);
    
  } catch (error) {
    console.error('Error in handleSubscriptionCancellation:', error);
    throw error;
  }
}

async function handlePaymentSucceeded(invoice) {
  console.log('🔄 Handling payment succeeded:', invoice.id);
  
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
        console.error('Error updating subscription after payment:', error);
        throw error;
      }
      
      console.log(`✅ Subscription ${subscriptionId} marked active after payment`);
    }
    
  } catch (error) {
    console.error('Error in handlePaymentSucceeded:', error);
    throw error;
  }
}

async function handlePaymentFailed(invoice) {
  console.log('🔄 Handling payment failed:', invoice.id);
  
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
        console.error('Error updating subscription after failed payment:', error);
        throw error;
      }
      
      console.log(`✅ Subscription ${subscriptionId} marked past_due after failed payment`);
    }
    
  } catch (error) {
    console.error('Error in handlePaymentFailed:', error);
    throw error;
  }
}