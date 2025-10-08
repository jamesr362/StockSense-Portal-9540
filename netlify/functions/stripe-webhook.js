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
    headers: Object.keys(event.headers || {}),
    bodyLength: event.body?.length || 0,
    hasSignature: !!(event.headers && event.headers['stripe-signature']),
    hasEndpointSecret: !!endpointSecret,
    isBase64Encoded: event.isBase64Encoded
  });

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, stripe-signature',
        'Access-Control-Max-Age': '86400'
      },
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, stripe-signature',
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Get the signature from headers (case-insensitive)
  const sig = event.headers['stripe-signature'] || 
              event.headers['Stripe-Signature'] ||
              event.headers['STRIPE-SIGNATURE'];

  let stripeEvent;
  let requestBody = event.body;

  // Handle base64 encoded body (common in Netlify)
  if (event.isBase64Encoded && requestBody) {
    try {
      requestBody = Buffer.from(requestBody, 'base64').toString('utf8');
      console.log('📝 Decoded base64 request body');
    } catch (decodeError) {
      console.error('❌ Failed to decode base64 body:', decodeError);
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, stripe-signature',
        },
        body: JSON.stringify({ error: 'Invalid base64 encoded body' })
      };
    }
  }

  try {
    // Handle webhook signature verification
    if (endpointSecret && sig && requestBody) {
      console.log('🔐 Verifying webhook signature with endpoint secret...');
      console.log('📋 Signature header:', sig.substring(0, 50) + '...');
      
      try {
        // Use the raw request body for signature verification
        stripeEvent = stripe.webhooks.constructEvent(requestBody, sig, endpointSecret);
        console.log('✅ Webhook signature verified successfully');
      } catch (sigError) {
        console.error('❌ Signature verification failed:', {
          error: sigError.message,
          hasBody: !!requestBody,
          bodyLength: requestBody?.length || 0,
          hasSignature: !!sig,
          hasSecret: !!endpointSecret,
          secretLength: endpointSecret?.length || 0
        });
        
        // For debugging: log the first few characters of each component
        console.log('🔍 Debug info:', {
          bodyStart: requestBody?.substring(0, 100),
          signatureStart: sig?.substring(0, 50),
          secretStart: endpointSecret?.substring(0, 10) + '...'
        });
        
        return {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, stripe-signature',
          },
          body: JSON.stringify({ 
            error: `Webhook signature verification failed: ${sigError.message}`,
            suggestion: 'Check that the webhook endpoint secret matches the one in Stripe dashboard'
          })
        };
      }
    } else {
      // Development/Demo mode or missing components
      console.log('⚠️ Processing webhook without signature verification:', {
        hasSecret: !!endpointSecret,
        hasSignature: !!sig,
        hasBody: !!requestBody,
        reason: !endpointSecret ? 'No endpoint secret' : !sig ? 'No signature' : !requestBody ? 'No body' : 'Unknown'
      });
      
      if (!requestBody) {
        return {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, stripe-signature',
          },
          body: JSON.stringify({ error: 'Empty request body' })
        };
      }
      
      try {
        stripeEvent = JSON.parse(requestBody);
        console.log('📝 Parsed webhook body without verification (development mode)');
      } catch (parseError) {
        console.error('❌ Failed to parse webhook body:', parseError);
        return {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, stripe-signature',
          },
          body: JSON.stringify({ error: 'Invalid JSON payload' })
        };
      }
    }
  } catch (err) {
    console.error('❌ Webhook processing error:', err.message);
    return {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, stripe-signature',
      },
      body: JSON.stringify({ 
        error: `Webhook Error: ${err.message}`
      })
    };
  }

  if (!stripeEvent) {
    console.error('❌ No stripe event parsed');
    return {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, stripe-signature',
      },
      body: JSON.stringify({ error: 'Failed to parse Stripe event' })
    };
  }

  console.log('🚀 Processing webhook event:', {
    type: stripeEvent.type,
    id: stripeEvent.id,
    created: stripeEvent.created,
    livemode: stripeEvent.livemode
  });

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

    console.log('✅ Webhook processed successfully:', {
      eventId: stripeEvent.id,
      eventType: stripeEvent.type,
      timestamp: new Date().toISOString()
    });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, stripe-signature',
        'Content-Type': 'application/json'
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
    console.error('❌ Error processing webhook event:', {
      error: error.message,
      stack: error.stack,
      eventId: stripeEvent?.id,
      eventType: stripeEvent?.type
    });
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, stripe-signature',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        error: 'Internal server error',
        eventId: stripeEvent?.id,
        eventType: stripeEvent?.type,
        message: error.message
      })
    };
  }
};

async function ensureTablesExist() {
  console.log('🔧 Ensuring database tables exist...');
  
  try {
    // Check if subscriptions table exists
    const { data, error } = await supabase
      .from('subscriptions_tb2k4x9p1m')
      .select('id')
      .limit(1);
    
    if (error && error.message?.includes('relation') && error.message?.includes('does not exist')) {
      console.log('📋 Subscriptions table does not exist, creating...');
      
      // Create the subscriptions table
      const { error: createError } = await supabase.rpc('exec', {
        sql: `
          CREATE TABLE IF NOT EXISTS subscriptions_tb2k4x9p1m (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_email TEXT UNIQUE NOT NULL,
            stripe_customer_id TEXT,
            stripe_subscription_id TEXT UNIQUE,
            stripe_session_id TEXT,
            plan_id TEXT NOT NULL DEFAULT 'price_free',
            status TEXT NOT NULL DEFAULT 'active',
            current_period_start TIMESTAMPTZ,
            current_period_end TIMESTAMPTZ,
            cancel_at_period_end BOOLEAN DEFAULT FALSE,
            canceled_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );
          
          ALTER TABLE subscriptions_tb2k4x9p1m ENABLE ROW LEVEL SECURITY;
          
          CREATE POLICY "Users can view own subscription" 
          ON subscriptions_tb2k4x9p1m FOR SELECT 
          USING (auth.email() = user_email);
          
          CREATE POLICY "Service role can manage all subscriptions" 
          ON subscriptions_tb2k4x9p1m FOR ALL 
          USING (auth.role() = 'service_role');
          
          CREATE INDEX IF NOT EXISTS idx_subscriptions_user_email 
          ON subscriptions_tb2k4x9p1m (user_email);
          
          CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer 
          ON subscriptions_tb2k4x9p1m (stripe_customer_id);
          
          CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription 
          ON subscriptions_tb2k4x9p1m (stripe_subscription_id);
        `
      });
      
      if (createError) {
        console.error('❌ Error creating subscriptions table:', createError);
        throw createError;
      }
      
      console.log('✅ Subscriptions table created successfully');
    } else {
      console.log('✅ Subscriptions table already exists');
    }
  } catch (error) {
    console.error('❌ Error ensuring tables exist:', error);
    // Don't throw - we'll try to continue with the webhook processing
  }
}

async function handleCheckoutSessionCompleted(session) {
  console.log('💳 Processing checkout session completed:', {
    sessionId: session.id,
    customerId: session.customer,
    subscriptionId: session.subscription,
    mode: session.mode,
    status: session.status
  });

  // Ensure tables exist before processing
  await ensureTablesExist();

  const customerEmail = session.customer_details?.email || 
                       session.customer_email || 
                       session.client_reference_id ||
                       session.metadata?.customer_email;
  
  const subscriptionId = session.subscription;
  
  if (!customerEmail) {
    console.error('❌ No customer email found in checkout session:', {
      customerDetails: session.customer_details,
      customerEmail: session.customer_email,
      clientReferenceId: session.client_reference_id,
      metadata: session.metadata
    });
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

  console.log('📋 Plan ID determined:', planId);

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

  console.log('💾 Subscription data to save:', subscriptionData);

  try {
    // Use upsert to handle both new and existing subscriptions
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

    console.log('✅ Subscription upserted successfully:', {
      customerEmail,
      planId,
      subscriptionId,
      data: data?.[0]?.id
    });

    return data;
  } catch (supabaseError) {
    console.error('❌ Supabase operation failed:', supabaseError);
    throw supabaseError;
  }
}

async function handleSubscriptionCreated(subscription) {
  console.log('📝 Processing subscription created:', {
    subscriptionId: subscription.id,
    customerId: subscription.customer,
    status: subscription.status,
    currentPeriodStart: subscription.current_period_start,
    currentPeriodEnd: subscription.current_period_end
  });

  // Ensure tables exist before processing
  await ensureTablesExist();

  // Try to get customer email from subscription metadata or customer object
  let customerEmail = subscription.metadata?.customer_email;
  
  if (!customerEmail && subscription.customer) {
    // Fetch customer details from Stripe
    try {
      const customer = await stripe.customers.retrieve(subscription.customer);
      customerEmail = customer.email;
      console.log('👤 Retrieved customer email from Stripe:', customerEmail);
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

  const { data, error } = await supabase
    .from('subscriptions_tb2k4x9p1m')
    .upsert(subscriptionData, { onConflict: 'user_email' })
    .select();

  if (error) {
    console.error('❌ Error upserting subscription:', error);
    throw error;
  }
  
  console.log('✅ Subscription created successfully:', {
    customerEmail,
    planId,
    status: subscription.status
  });
}

async function handleSubscriptionUpdated(subscription) {
  console.log('🔄 Processing subscription updated:', subscription.id);

  // Ensure tables exist before processing
  await ensureTablesExist();

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
    .select();

  if (error) {
    console.error('❌ Error updating subscription:', error);
    throw error;
  }
  
  console.log('✅ Subscription updated successfully:', {
    subscriptionId: subscription.id,
    status: subscription.status,
    planId
  });
}

async function handleSubscriptionDeleted(subscription) {
  console.log('🗑️ Processing subscription deleted:', subscription.id);

  // Ensure tables exist before processing
  await ensureTablesExist();

  const { data, error } = await supabase
    .from('subscriptions_tb2k4x9p1m')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', subscription.id)
    .select();

  if (error) {
    console.error('❌ Error canceling subscription:', error);
    throw error;
  }
  
  console.log('✅ Subscription canceled successfully:', subscription.id);
}

async function handlePaymentSucceeded(invoice) {
  console.log('💰 Processing payment succeeded:', {
    invoiceId: invoice.id,
    subscriptionId: invoice.subscription,
    amountPaid: invoice.amount_paid,
    currency: invoice.currency
  });

  // Ensure tables exist before processing
  await ensureTablesExist();

  const subscriptionId = invoice.subscription;
  if (!subscriptionId) {
    console.log('ℹ️ No subscription ID in invoice, skipping...');
    return;
  }

  const { data, error } = await supabase
    .from('subscriptions_tb2k4x9p1m')
    .update({
      status: 'active',
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', subscriptionId)
    .select();

  if (error) {
    console.error('❌ Error updating payment status:', error);
    throw error;
  }
  
  console.log('✅ Payment processed successfully:', {
    invoiceId: invoice.id,
    subscriptionId,
    recordsUpdated: data?.length || 0
  });
}

async function handlePaymentFailed(invoice) {
  console.log('💸 Processing payment failed:', {
    invoiceId: invoice.id,
    subscriptionId: invoice.subscription,
    amountDue: invoice.amount_due,
    currency: invoice.currency
  });

  // Ensure tables exist before processing
  await ensureTablesExist();

  const subscriptionId = invoice.subscription;
  if (!subscriptionId) {
    console.log('ℹ️ No subscription ID in invoice, skipping...');
    return;
  }

  const { data, error } = await supabase
    .from('subscriptions_tb2k4x9p1m')
    .update({
      status: 'past_due',
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', subscriptionId)
    .select();

  if (error) {
    console.error('❌ Error updating payment failure status:', error);
    throw error;
  }
  
  console.log('✅ Payment failure processed:', {
    invoiceId: invoice.id,
    subscriptionId,
    recordsUpdated: data?.length || 0
  });
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