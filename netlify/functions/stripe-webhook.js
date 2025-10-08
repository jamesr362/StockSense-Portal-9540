const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with service key for admin operations
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://xnfxcsdsjxgiewrssgrn.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuZnhjc2RzanhnaWV3cnNzZ3JuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwMjcxMDYsImV4cCI6MjA3MDYwMzEwNn0._lug2dvx1Y1qKLuKVWc6b3DDTWqVQ1Ow77q768CcaG4'
);

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

exports.handler = async (event, context) => {
  console.log('🎯 Stripe Webhook received:', {
    method: event.httpMethod,
    headers: Object.keys(event.headers),
    bodyLength: event.body?.length || 0,
    hasSignature: !!event.headers['stripe-signature'],
    hasEndpointSecret: !!endpointSecret
  });

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const sig = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    // Handle webhook signature verification
    if (endpointSecret && sig) {
      // Production: Verify webhook signature
      console.log('🔐 Verifying webhook signature...');
      stripeEvent = stripe.webhooks.constructEvent(event.body, sig, endpointSecret);
      console.log('✅ Webhook signature verified successfully');
    } else {
      // Development/Demo: Skip signature verification but still parse event
      console.log('⚠️ Processing webhook without signature verification (development mode)');
      try {
        stripeEvent = JSON.parse(event.body);
      } catch (parseError) {
        console.error('❌ Failed to parse webhook body:', parseError);
        return {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
          body: JSON.stringify({ error: 'Invalid JSON payload' })
        };
      }
    }
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({ 
        error: `Webhook Error: ${err.message}`,
        suggestion: 'Ensure webhook endpoint secret is correctly configured'
      })
    };
  }

  console.log('🚀 Processing webhook event:', stripeEvent.type, stripeEvent.id);

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
        console.log(`ℹ️ Unhandled event type: ${stripeEvent.type}`);
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({ 
        received: true, 
        eventId: stripeEvent.id,
        eventType: stripeEvent.type,
        processed: true,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({ 
        error: 'Internal server error',
        eventId: stripeEvent?.id,
        eventType: stripeEvent?.type
      })
    };
  }
};

async function handleCheckoutSessionCompleted(session) {
  console.log('💳 Processing checkout session completed:', session.id);

  const customerEmail = session.customer_details?.email || 
                       session.customer_email || 
                       session.client_reference_id ||
                       session.metadata?.customer_email;
  
  const subscriptionId = session.subscription;
  
  if (!customerEmail) {
    console.error('❌ No customer email found in checkout session');
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
    // For subscription mode, default to professional
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
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  try {
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

      if (updateError) {
        console.error('❌ Error updating subscription:', updateError);
        throw updateError;
      }
      console.log('✅ Updated existing subscription for:', customerEmail);
    } else {
      // Create new subscription
      const { error: insertError } = await supabase
        .from('subscriptions_tb2k4x9p1m')
        .insert([subscriptionData]);

      if (insertError) {
        console.error('❌ Error creating subscription:', insertError);
        throw insertError;
      }
      console.log('✅ Created new subscription for:', customerEmail);
    }

    console.log('🎉 Checkout session processed successfully for:', customerEmail);
  } catch (supabaseError) {
    console.error('❌ Supabase operation failed:', supabaseError);
    throw supabaseError;
  }
}

async function handleSubscriptionCreated(subscription) {
  console.log('📝 Processing subscription created:', subscription.id);

  // Try to get customer email from subscription metadata or customer object
  let customerEmail = subscription.metadata?.customer_email;
  
  if (!customerEmail && subscription.customer) {
    // Fetch customer details from Stripe
    try {
      const customer = await stripe.customers.retrieve(subscription.customer);
      customerEmail = customer.email;
    } catch (error) {
      console.warn('⚠️ Could not fetch customer details:', error.message);
    }
  }

  if (!customerEmail) {
    console.warn('⚠️ No customer email found in subscription, skipping...');
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

  if (error) {
    console.error('❌ Error upserting subscription:', error);
    throw error;
  }
  console.log('✅ Subscription created successfully for:', customerEmail);
}

async function handleSubscriptionUpdated(subscription) {
  console.log('🔄 Processing subscription updated:', subscription.id);

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

  if (error) {
    console.error('❌ Error updating subscription:', error);
    throw error;
  }
  console.log('✅ Subscription updated successfully:', subscription.id);
}

async function handleSubscriptionDeleted(subscription) {
  console.log('🗑️ Processing subscription deleted:', subscription.id);

  const { error } = await supabase
    .from('subscriptions_tb2k4x9p1m')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    console.error('❌ Error canceling subscription:', error);
    throw error;
  }
  console.log('✅ Subscription canceled successfully:', subscription.id);
}

async function handlePaymentSucceeded(invoice) {
  console.log('💰 Processing payment succeeded:', invoice.id);

  const subscriptionId = invoice.subscription;
  if (!subscriptionId) {
    console.log('ℹ️ No subscription ID in invoice, skipping...');
    return;
  }

  const { error } = await supabase
    .from('subscriptions_tb2k4x9p1m')
    .update({
      status: 'active',
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', subscriptionId);

  if (error) {
    console.error('❌ Error updating payment status:', error);
    throw error;
  }
  console.log('✅ Payment processed successfully:', invoice.id);
}

async function handlePaymentFailed(invoice) {
  console.log('💸 Processing payment failed:', invoice.id);

  const subscriptionId = invoice.subscription;
  if (!subscriptionId) {
    console.log('ℹ️ No subscription ID in invoice, skipping...');
    return;
  }

  const { error } = await supabase
    .from('subscriptions_tb2k4x9p1m')
    .update({
      status: 'past_due',
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', subscriptionId);

  if (error) {
    console.error('❌ Error updating payment failure status:', error);
    throw error;
  }
  console.log('✅ Payment failure processed:', invoice.id);
}

function extractPlanFromPriceId(priceId) {
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
}