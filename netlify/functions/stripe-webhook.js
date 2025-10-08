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
    headers: event.headers ? Object.keys(event.headers) : [],
    bodyLength: event.body?.length || 0,
    hasSignature: !!(event.headers && (event.headers['stripe-signature'] || event.headers['Stripe-Signature'])),
    hasEndpointSecret: !!endpointSecret,
    isBase64Encoded: event.isBase64Encoded,
    netlifyContext: context.functionName
  });

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, stripe-signature, Stripe-Signature',
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
        'Access-Control-Allow-Headers': 'Content-Type, stripe-signature, Stripe-Signature',
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Get signature from headers with multiple fallbacks
  const sig = event.headers['stripe-signature'] || 
              event.headers['Stripe-Signature'] ||
              event.headers['STRIPE-SIGNATURE'] ||
              event.headers['x-stripe-signature'];

  console.log('🔍 Header analysis:', {
    allHeaders: event.headers ? Object.keys(event.headers) : [],
    signatureFound: !!sig,
    signatureValue: sig ? `${sig.substring(0, 20)}...` : 'none'
  });

  let stripeEvent;
  let requestBody = event.body;

  // Ensure we have a request body
  if (!requestBody) {
    console.error('❌ No request body received');
    return {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, stripe-signature',
      },
      body: JSON.stringify({ error: 'Empty request body' })
    };
  }

  // Handle base64 encoded body (Netlify sometimes does this)
  if (event.isBase64Encoded) {
    try {
      // For Netlify Functions, we need to handle the body as a Buffer for signature verification
      const bodyBuffer = Buffer.from(requestBody, 'base64');
      requestBody = bodyBuffer.toString('utf8');
      console.log('📝 Decoded base64 request body, length:', requestBody.length);
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

  // Signature verification with multiple strategies
  try {
    if (endpointSecret && sig) {
      console.log('🔐 Attempting webhook signature verification...');
      console.log('🔍 Verification details:', {
        hasSecret: !!endpointSecret,
        secretLength: endpointSecret?.length,
        hasSignature: !!sig,
        signatureStart: sig?.substring(0, 30),
        bodyLength: requestBody?.length,
        bodyStart: requestBody?.substring(0, 100)
      });

      try {
        // Strategy 1: Use raw string body (most common for Netlify)
        stripeEvent = stripe.webhooks.constructEvent(requestBody, sig, endpointSecret);
        console.log('✅ Webhook signature verified successfully with raw string');
      } catch (firstError) {
        console.log('⚠️ First signature verification attempt failed:', firstError.message);
        
        try {
          // Strategy 2: Try with Buffer if base64 encoded
          if (event.isBase64Encoded) {
            const bodyBuffer = Buffer.from(event.body, 'base64');
            stripeEvent = stripe.webhooks.constructEvent(bodyBuffer, sig, endpointSecret);
            console.log('✅ Webhook signature verified successfully with Buffer');
          } else {
            throw firstError;
          }
        } catch (secondError) {
          console.log('⚠️ Second signature verification attempt failed:', secondError.message);
          
          try {
            // Strategy 3: Try with original body as Buffer
            const bodyBuffer = Buffer.from(requestBody, 'utf8');
            stripeEvent = stripe.webhooks.constructEvent(bodyBuffer, sig, endpointSecret);
            console.log('✅ Webhook signature verified successfully with UTF8 Buffer');
          } catch (thirdError) {
            console.error('❌ All signature verification strategies failed:', {
              strategy1: firstError.message,
              strategy2: secondError.message,
              strategy3: thirdError.message,
              bodyType: typeof requestBody,
              bodyLength: requestBody?.length,
              isBase64: event.isBase64Encoded,
              signaturePresent: !!sig,
              secretPresent: !!endpointSecret
            });

            // For development/testing, allow processing without signature verification
            if (process.env.NODE_ENV === 'development' || !process.env.STRIPE_WEBHOOK_SECRET) {
              console.log('🚧 Development mode: Processing without signature verification');
              stripeEvent = JSON.parse(requestBody);
            } else {
              return {
                statusCode: 400,
                headers: {
                  'Access-Control-Allow-Origin': '*',
                  'Access-Control-Allow-Headers': 'Content-Type, stripe-signature',
                },
                body: JSON.stringify({ 
                  error: `Webhook signature verification failed: ${thirdError.message}`,
                  suggestion: 'Verify webhook endpoint secret in Netlify environment variables',
                  debug: {
                    hasSecret: !!endpointSecret,
                    hasSignature: !!sig,
                    bodyLength: requestBody?.length,
                    isBase64: event.isBase64Encoded
                  }
                })
              };
            }
          }
        }
      }
    } else {
      // No signature verification - parse directly
      const missingComponent = !endpointSecret ? 'endpoint secret' : 'signature header';
      console.log(`⚠️ Processing webhook without signature verification (missing ${missingComponent})`);
      
      try {
        stripeEvent = JSON.parse(requestBody);
        console.log('📝 Parsed webhook body without verification');
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
      
      // Create the subscriptions table using direct SQL
      const createTableSQL = `
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
        
        DROP POLICY IF EXISTS "Users can view own subscription" ON subscriptions_tb2k4x9p1m;
        CREATE POLICY "Users can view own subscription" 
        ON subscriptions_tb2k4x9p1m FOR SELECT 
        USING (auth.email() = user_email);
        
        DROP POLICY IF EXISTS "Service role can manage all subscriptions" ON subscriptions_tb2k4x9p1m;
        CREATE POLICY "Service role can manage all subscriptions" 
        ON subscriptions_tb2k4x9p1m FOR ALL 
        USING (auth.role() = 'service_role');
        
        CREATE INDEX IF NOT EXISTS idx_subscriptions_user_email 
        ON subscriptions_tb2k4x9p1m (user_email);
        
        CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer 
        ON subscriptions_tb2k4x9p1m (stripe_customer_id);
        
        CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription 
        ON subscriptions_tb2k4x9p1m (stripe_subscription_id);
      `;

      // Try to execute the SQL directly
      const { error: createError } = await supabase.rpc('exec_sql', {
        sql: createTableSQL
      });
      
      if (createError) {
        console.error('❌ Error creating subscriptions table with exec_sql:', createError);
        // Fallback: try creating through individual operations
        console.log('🔄 Trying alternative table creation method...');
        // This would require more complex handling, but for now we'll log and continue
      } else {
        console.log('✅ Subscriptions table created successfully');
      }
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
    status: session.status,
    customerEmail: session.customer_details?.email
  });

  // Ensure tables exist before processing
  await ensureTablesExist();

  // Extract customer email from the session data you provided
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

  console.log('👤 Customer email found:', customerEmail);

  // Extract plan information - for your payment link, it's professional
  let planId = 'professional'; // Default for subscription payments
  if (session.metadata?.plan_id) {
    planId = session.metadata.plan_id;
  } else if (session.line_items?.data?.[0]?.price?.lookup_key) {
    planId = session.line_items.data[0].price.lookup_key;
  } else if (session.mode === 'subscription') {
    planId = 'professional'; // Your payment link is for professional plan
  }

  console.log('📋 Plan ID determined:', planId);

  // Create subscription data
  const subscriptionData = {
    user_email: customerEmail.toLowerCase(),
    stripe_customer_id: session.customer,
    stripe_subscription_id: subscriptionId,
    stripe_session_id: session.id,
    plan_id: `price_${planId}`,
    status: 'active',
    current_period_start: new Date().toISOString(),
    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
    cancel_at_period_end: false,
    canceled_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  console.log('💾 Saving subscription data:', {
    email: subscriptionData.user_email,
    planId: subscriptionData.plan_id,
    status: subscriptionData.status,
    customerId: subscriptionData.stripe_customer_id,
    subscriptionId: subscriptionData.stripe_subscription_id
  });

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
      recordId: data?.[0]?.id
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

  await ensureTablesExist();

  let customerEmail = subscription.metadata?.customer_email;
  
  if (!customerEmail && subscription.customer) {
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
  
  // Map your specific price ID
  const priceIdMap = {
    'price_1RxEcJEw1FLYKy8h3FDMZ6QP': 'professional', // Your actual price ID
    'price_professional': 'professional',
    'price_free': 'free'
  };
  
  return priceIdMap[priceId] || 'professional';
}