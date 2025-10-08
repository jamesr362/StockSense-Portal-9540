const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://xnfxcsdsjxgiewrssgrn.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuZnhjc2RzanhnaWV3cnNzZ3JuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwMjcxMDYsImV4cCI6MjA3MDYwMzEwNn0._lug2dvx1Y1qKLuKVWc6b3DDTWqVQ1Ow77q768CcaG4'
);

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

exports.handler = async (event, context) => {
  console.log('Webhook received:', {
    method: event.httpMethod,
    headers: Object.keys(event.headers),
    bodyLength: event.body?.length || 0
  });

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const sig = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    // Verify webhook signature
    if (endpointSecret) {
      stripeEvent = stripe.webhooks.constructEvent(event.body, sig, endpointSecret);
      console.log('Webhook signature verified successfully');
    } else {
      // For development/testing without webhook secret
      stripeEvent = JSON.parse(event.body);
      console.log('Webhook processed without signature verification (development mode)');
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: `Webhook Error: ${err.message}` })
    };
  }

  console.log('Processing webhook event:', stripeEvent.type, stripeEvent.id);

  try {
    // Handle the event
    switch (stripeEvent.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(stripeEvent.data.object);
        break;
      
      case 'customer.subscription.created':
        await handleSubscriptionCreated(stripeEvent.data.object);
        break;
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(stripeEvent.data.object);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(stripeEvent.data.object);
        break;
      
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(stripeEvent.data.object);
        break;
      
      case 'invoice.payment_failed':
        await handlePaymentFailed(stripeEvent.data.object);
        break;
      
      default:
        console.log(`Unhandled event type: ${stripeEvent.type}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true, eventId: stripeEvent.id })
    };
  } catch (error) {
    console.error('Error processing webhook:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

async function handleCheckoutSessionCompleted(session) {
  console.log('Processing checkout session completed:', session.id);

  const customerEmail = session.customer_details?.email || session.customer_email || session.client_reference_id;
  const subscriptionId = session.subscription;
  
  if (!customerEmail) {
    throw new Error('No customer email found in checkout session');
  }

  // Extract plan information
  let planId = 'professional';
  if (session.metadata?.plan_id) {
    planId = session.metadata.plan_id;
  }

  // Create or update subscription in database
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
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // Check if subscription already exists
  const { data: existingSubscription, error: fetchError } = await supabase
    .from('subscriptions_tb2k4x9p1m')
    .select('*')
    .eq('user_email', customerEmail.toLowerCase())
    .single();

  if (existingSubscription && !fetchError) {
    // Update existing subscription
    const { error: updateError } = await supabase
      .from('subscriptions_tb2k4x9p1m')
      .update(subscriptionData)
      .eq('user_email', customerEmail.toLowerCase());

    if (updateError) throw updateError;
    console.log('Updated existing subscription for:', customerEmail);
  } else {
    // Create new subscription
    const { error: insertError } = await supabase
      .from('subscriptions_tb2k4x9p1m')
      .insert([subscriptionData]);

    if (insertError) throw insertError;
    console.log('Created new subscription for:', customerEmail);
  }

  console.log('Checkout session processed successfully for:', customerEmail);
}

async function handleSubscriptionCreated(subscription) {
  console.log('Processing subscription created:', subscription.id);

  const customerEmail = subscription.metadata?.customer_email;
  if (!customerEmail) {
    console.warn('No customer email in subscription metadata');
    return;
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
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from('subscriptions_tb2k4x9p1m')
    .upsert(subscriptionData, { onConflict: 'user_email' });

  if (error) throw error;
  console.log('Subscription created successfully for:', customerEmail);
}

async function handleSubscriptionUpdated(subscription) {
  console.log('Processing subscription updated:', subscription.id);

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

  const { error } = await supabase
    .from('subscriptions_tb2k4x9p1m')
    .update(updateData)
    .eq('stripe_subscription_id', subscription.id);

  if (error) throw error;
  console.log('Subscription updated successfully:', subscription.id);
}

async function handleSubscriptionDeleted(subscription) {
  console.log('Processing subscription deleted:', subscription.id);

  const { error } = await supabase
    .from('subscriptions_tb2k4x9p1m')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) throw error;
  console.log('Subscription canceled successfully:', subscription.id);
}

async function handlePaymentSucceeded(invoice) {
  console.log('Processing payment succeeded:', invoice.id);

  const subscriptionId = invoice.subscription;
  if (!subscriptionId) return;

  const { error } = await supabase
    .from('subscriptions_tb2k4x9p1m')
    .update({
      status: 'active',
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', subscriptionId);

  if (error) throw error;
  console.log('Payment processed successfully:', invoice.id);
}

async function handlePaymentFailed(invoice) {
  console.log('Processing payment failed:', invoice.id);

  const subscriptionId = invoice.subscription;
  if (!subscriptionId) return;

  const { error } = await supabase
    .from('subscriptions_tb2k4x9p1m')
    .update({
      status: 'past_due',
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', subscriptionId);

  if (error) throw error;
  console.log('Payment failure processed:', invoice.id);
}

function extractPlanFromPriceId(priceId) {
  if (priceId.includes('professional') || priceId.includes('pro')) {
    return 'professional';
  }
  if (priceId.includes('free') || priceId.includes('basic')) {
    return 'free';
  }
  return 'professional';
}