import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const handler = async (event) => {
  // Handle CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { email } = JSON.parse(event.body);

    if (!email) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Email is required' })
      };
    }

    console.log('🔍 Getting subscription for user:', email);

    // Get subscription from database
    const { data: subscriptionData, error: dbError } = await supabase
      .from('subscriptions_tb2k4x9p1m')
      .select('*')
      .eq('user_email', email.toLowerCase())
      .single();

    if (dbError && dbError.code !== 'PGRST116') {
      console.error('❌ Database error:', dbError);
      throw dbError;
    }

    if (!subscriptionData) {
      console.log('ℹ️ No subscription found in database for:', email);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          subscription: null,
          customer: null,
          message: 'No subscription found'
        })
      };
    }

    console.log('📊 Database subscription:', {
      planId: subscriptionData.plan_id,
      status: subscriptionData.status,
      stripeSubscriptionId: subscriptionData.stripe_subscription_id,
      stripeCustomerId: subscriptionData.stripe_customer_id
    });

    // If it's a free plan or no Stripe IDs, return database data
    if (subscriptionData.plan_id === 'free' || !subscriptionData.stripe_subscription_id) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          subscription: {
            id: subscriptionData.stripe_subscription_id || `local_${subscriptionData.id}`,
            status: subscriptionData.status,
            items: {
              data: [{
                price: {
                  id: subscriptionData.stripe_price_id || 'price_free',
                  lookup_key: subscriptionData.plan_id
                }
              }]
            },
            current_period_start: subscriptionData.current_period_start ? 
              Math.floor(new Date(subscriptionData.current_period_start).getTime() / 1000) : null,
            current_period_end: subscriptionData.current_period_end ? 
              Math.floor(new Date(subscriptionData.current_period_end).getTime() / 1000) : null,
            cancel_at_period_end: subscriptionData.cancel_at_period_end,
            canceled_at: subscriptionData.canceled_at ? 
              Math.floor(new Date(subscriptionData.canceled_at).getTime() / 1000) : null
          },
          customer: {
            id: subscriptionData.stripe_customer_id || `local_customer_${email}`,
            email: email
          },
          source: 'database'
        })
      };
    }

    // For professional plans, verify with Stripe
    try {
      console.log('🔄 Verifying with Stripe - Subscription ID:', subscriptionData.stripe_subscription_id);
      
      const subscription = await stripe.subscriptions.retrieve(
        subscriptionData.stripe_subscription_id,
        { expand: ['customer', 'items.data.price'] }
      );

      console.log('✅ Stripe subscription retrieved:', {
        id: subscription.id,
        status: subscription.status,
        customerId: subscription.customer.id,
        priceId: subscription.items.data[0]?.price?.id
      });

      // Update database if Stripe status differs
      if (subscription.status !== subscriptionData.status) {
        console.log('🔄 Updating database status from Stripe');
        
        await supabase
          .from('subscriptions_tb2k4x9p1m')
          .update({
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
            canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
            updated_at: new Date().toISOString()
          })
          .eq('user_email', email.toLowerCase());
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          subscription: subscription,
          customer: subscription.customer,
          source: 'stripe'
        })
      };

    } catch (stripeError) {
      console.error('⚠️ Stripe API error:', stripeError.message);
      
      // If Stripe fails, return database data
      console.log('📊 Falling back to database data');
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          subscription: {
            id: subscriptionData.stripe_subscription_id,
            status: subscriptionData.status,
            items: {
              data: [{
                price: {
                  id: subscriptionData.stripe_price_id,
                  lookup_key: subscriptionData.plan_id
                }
              }]
            },
            current_period_start: subscriptionData.current_period_start ? 
              Math.floor(new Date(subscriptionData.current_period_start).getTime() / 1000) : null,
            current_period_end: subscriptionData.current_period_end ? 
              Math.floor(new Date(subscriptionData.current_period_end).getTime() / 1000) : null,
            cancel_at_period_end: subscriptionData.cancel_at_period_end,
            canceled_at: subscriptionData.canceled_at ? 
              Math.floor(new Date(subscriptionData.canceled_at).getTime() / 1000) : null
          },
          customer: {
            id: subscriptionData.stripe_customer_id,
            email: email
          },
          source: 'database_fallback',
          stripe_error: stripeError.message
        })
      };
    }

  } catch (error) {
    console.error('❌ Error in get-customer-subscription:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to retrieve subscription',
        details: error.message
      })
    };
  }
};