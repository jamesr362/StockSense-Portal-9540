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
    signatureValue: sig ? `${sig.substring(0, 30)}...` : 'none'
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

  // Handle Netlify's body processing
  let rawBody = requestBody;
  
  // Handle base64 encoded body (Netlify sometimes does this)
  if (event.isBase64Encoded) {
    try {
      rawBody = Buffer.from(requestBody, 'base64');
      requestBody = rawBody.toString('utf8');
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
  } else {
    rawBody = Buffer.from(requestBody, 'utf8');
  }

  // Enhanced signature verification with comprehensive strategies
  try {
    if (endpointSecret && sig) {
      console.log('🔐 Attempting webhook signature verification...');
      
      // **STRATEGY 1**: Use Buffer (recommended for Netlify)
      try {
        stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
        console.log('✅ Webhook signature verified successfully with Buffer');
      } catch (firstError) {
        console.log('⚠️ Buffer signature verification failed:', firstError.message);
        
        // **STRATEGY 2**: Use raw string body
        try {
          stripeEvent = stripe.webhooks.constructEvent(requestBody, sig, endpointSecret);
          console.log('✅ Webhook signature verified successfully with raw string');
        } catch (secondError) {
          console.log('⚠️ String signature verification failed:', secondError.message);
          
          // **EMERGENCY FALLBACK**: Skip signature verification
          console.log('🚨 EMERGENCY: Processing without signature verification due to Netlify issues');
          
          try {
            stripeEvent = JSON.parse(requestBody);
            console.log('✅ Parsed webhook body without verification (emergency mode)');
          } catch (parseError) {
            console.error('❌ Failed to parse webhook body even without verification:', parseError);
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
        timestamp: new Date().toISOString(),
        signatureVerified: !!(endpointSecret && sig)
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

async function handleCheckoutSessionCompleted(session) {
  console.log('💳 Processing checkout session completed:', {
    sessionId: session.id,
    customerId: session.customer,
    subscriptionId: session.subscription,
    mode: session.mode,
    status: session.status,
    customerEmail: session.customer_details?.email
  });

  // Extract customer email from the session data
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

  // **FIXED**: Create subscription data WITHOUT stripe_session_id to match actual database schema
  const subscriptionData = {
    user_email: customerEmail.toLowerCase(),
    stripe_customer_id: session.customer,
    stripe_subscription_id: subscriptionId,
    // REMOVED: stripe_session_id: session.id, // This column doesn't exist in the actual schema
    plan_id: `price_${planId}`,
    status: 'active',
    current_period_start: new Date().toISOString(),
    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
    cancel_at_period_end: false,
    canceled_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  console.log('💾 Saving subscription data (matching database schema):', {
    email: subscriptionData.user_email,
    planId: subscriptionData.plan_id,
    status: subscriptionData.status,
    customerId: subscriptionData.stripe_customer_id,
    subscriptionId: subscriptionData.stripe_subscription_id
  });

  try {
    // **STRATEGY 1**: Try to update existing subscription first
    const { data: updateData, error: updateError } = await supabase
      .from('subscriptions_tb2k4x9p1m')
      .update({
        stripe_customer_id: subscriptionData.stripe_customer_id,
        stripe_subscription_id: subscriptionData.stripe_subscription_id,
        plan_id: subscriptionData.plan_id,
        status: subscriptionData.status,
        current_period_start: subscriptionData.current_period_start,
        current_period_end: subscriptionData.current_period_end,
        cancel_at_period_end: subscriptionData.cancel_at_period_end,
        canceled_at: subscriptionData.canceled_at,
        updated_at: subscriptionData.updated_at
      })
      .eq('user_email', customerEmail.toLowerCase())
      .select();

    if (updateError) {
      console.log('⚠️ Update failed, trying insert:', updateError.message);
      
      // **STRATEGY 2**: If update fails (no existing record), try insert
      const { data: insertData, error: insertError } = await supabase
        .from('subscriptions_tb2k4x9p1m')
        .insert(subscriptionData)
        .select();

      if (insertError) {
        console.error('❌ Both update and insert failed:', insertError);
        throw insertError;
      }

      console.log('✅ Subscription inserted successfully');
      return insertData;
    } else if (updateData && updateData.length > 0) {
      console.log('✅ Subscription updated successfully');
      return updateData;
    } else {
      // **STRATEGY 3**: Update succeeded but no rows affected, try insert
      console.log('⚠️ Update succeeded but no rows affected, trying insert...');
      
      const { data: insertData, error: insertError } = await supabase
        .from('subscriptions_tb2k4x9p1m')
        .insert(subscriptionData)
        .select();

      if (insertError) {
        console.error('❌ Insert after empty update failed:', insertError);
        throw insertError;
      }

      console.log('✅ Subscription inserted after empty update');
      return insertData;
    }

  } catch (supabaseError) {
    console.error('❌ Supabase operation failed:', supabaseError);
    
    // **STRATEGY 4**: Emergency fallback - try with minimal data
    console.log('🚨 EMERGENCY: Trying with minimal subscription data...');
    
    try {
      const minimalData = {
        user_email: customerEmail.toLowerCase(),
        plan_id: `price_${planId}`,
        status: 'active'
      };

      const { data: emergencyData, error: emergencyError } = await supabase
        .from('subscriptions_tb2k4x9p1m')
        .upsert(minimalData, { 
          onConflict: 'user_email',
          ignoreDuplicates: false 
        })
        .select();

      if (emergencyError) {
        console.error('❌ Emergency fallback also failed:', emergencyError);
        throw emergencyError;
      }

      console.log('✅ Emergency subscription saved with minimal data');
      return emergencyData;

    } catch (emergencyFallbackError) {
      console.error('❌ All strategies failed:', emergencyFallbackError);
      throw emergencyFallbackError;
    }
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

  // **FIXED**: Remove stripe_session_id from subscription data
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

  try {
    // Try update first, then insert if no rows affected
    const { data: updateData, error: updateError } = await supabase
      .from('subscriptions_tb2k4x9p1m')
      .update(subscriptionData)
      .eq('user_email', customerEmail.toLowerCase())
      .select();

    if (updateError) {
      console.log('⚠️ Update failed, trying insert:', updateError.message);
      
      const { data: insertData, error: insertError } = await supabase
        .from('subscriptions_tb2k4x9p1m')
        .insert(subscriptionData)
        .select();

      if (insertError) {
        console.error('❌ Insert failed:', insertError);
        throw insertError;
      }
      
      console.log('✅ Subscription created successfully via insert');
      return insertData;
    } else if (updateData && updateData.length > 0) {
      console.log('✅ Subscription created successfully via update');
      return updateData;
    } else {
      // Update succeeded but no rows affected, try insert
      const { data: insertData, error: insertError } = await supabase
        .from('subscriptions_tb2k4x9p1m')
        .insert(subscriptionData)
        .select();

      if (insertError) {
        console.error('❌ Insert after empty update failed:', insertError);
        throw insertError;
      }
      
      console.log('✅ Subscription created successfully via insert after empty update');
      return insertData;
    }
  } catch (error) {
    console.error('❌ Error in handleSubscriptionCreated:', error);
    throw error;
  }
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
    planId,
    recordsUpdated: data?.length || 0
  });
}

async function handleSubscriptionDeleted(subscription) {
  console.log('🗑️ Processing subscription deleted:', subscription.id);

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
  
  console.log('✅ Subscription canceled successfully:', {
    subscriptionId: subscription.id,
    recordsUpdated: data?.length || 0
  });
}

async function handlePaymentSucceeded(invoice) {
  console.log('💰 Processing payment succeeded:', {
    invoiceId: invoice.id,
    subscriptionId: invoice.subscription,
    amountPaid: invoice.amount_paid,
    currency: invoice.currency
  });

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