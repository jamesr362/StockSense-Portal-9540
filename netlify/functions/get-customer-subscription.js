import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const handler = async (event) => {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { userEmail, stripeSubscriptionId } = JSON.parse(event.body);

    if (!userEmail && !stripeSubscriptionId) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'User email or Stripe subscription ID is required' }),
      };
    }

    console.log('🔍 Getting subscription for:', { userEmail, stripeSubscriptionId });

    let subscriptionData = null;

    if (stripeSubscriptionId) {
      // Primary method: Get subscription by Stripe subscription ID
      console.log('📋 Fetching by Stripe subscription ID:', stripeSubscriptionId);
      
      const { data, error } = await supabase
        .from('subscriptions_tb2k4x9p1m')
        .select('*')
        .eq('stripe_subscription_id', stripeSubscriptionId)
        .single();

      if (error) {
        if (error.code !== 'PGRST116') { // Not found is OK
          console.error('Error fetching subscription by Stripe ID:', error);
        }
      } else {
        subscriptionData = data;
        console.log('✅ Found subscription by Stripe ID');
      }
    }

    if (!subscriptionData && userEmail) {
      // Fallback method: Get subscription by email
      console.log('📋 Fetching by user email:', userEmail);
      
      const { data, error } = await supabase
        .from('subscriptions_tb2k4x9p1m')
        .select('*')
        .eq('user_email', userEmail.toLowerCase())
        .single();

      if (error) {
        if (error.code !== 'PGRST116') { // Not found is OK
          console.error('Error fetching subscription by email:', error);
        }
      } else {
        subscriptionData = data;
        console.log('✅ Found subscription by email');
      }
    }

    if (!subscriptionData) {
      console.log('ℹ️ No subscription found, user is on free plan');
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription: null,
          plan: 'free',
          status: 'free_plan'
        }),
      };
    }

    // Verify subscription with Stripe if we have the subscription ID
    let stripeSubscription = null;
    if (subscriptionData.stripe_subscription_id) {
      try {
        stripeSubscription = await stripe.subscriptions.retrieve(subscriptionData.stripe_subscription_id);
        console.log('✅ Verified with Stripe:', stripeSubscription.status);

        // Update our database if Stripe status differs
        if (stripeSubscription.status !== subscriptionData.status) {
          console.log('🔄 Updating status from Stripe:', stripeSubscription.status);
          
          const { error: updateError } = await supabase
            .from('subscriptions_tb2k4x9p1m')
            .update({
              status: stripeSubscription.status,
              cancel_at_period_end: stripeSubscription.cancel_at_period_end,
              current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('stripe_subscription_id', subscriptionData.stripe_subscription_id);

          if (!updateError) {
            subscriptionData.status = stripeSubscription.status;
            subscriptionData.cancel_at_period_end = stripeSubscription.cancel_at_period_end;
          }
        }
      } catch (stripeError) {
        console.error('Error verifying with Stripe:', stripeError);
        // Continue with database data
      }
    }

    // Determine plan from plan_id
    let planName = 'free';
    if (subscriptionData.plan_id && subscriptionData.plan_id.includes('professional')) {
      planName = 'professional';
    }

    const response = {
      subscription: {
        id: subscriptionData.id,
        userEmail: subscriptionData.user_email,
        stripeCustomerId: subscriptionData.stripe_customer_id,
        stripeSubscriptionId: subscriptionData.stripe_subscription_id,
        planId: subscriptionData.plan_id,
        status: subscriptionData.status,
        currentPeriodStart: subscriptionData.current_period_start,
        currentPeriodEnd: subscriptionData.current_period_end,
        cancelAtPeriodEnd: subscriptionData.cancel_at_period_end,
        canceledAt: subscriptionData.canceled_at,
        createdAt: subscriptionData.created_at,
        updatedAt: subscriptionData.updated_at
      },
      plan: planName,
      status: subscriptionData.status,
      isActive: subscriptionData.status === 'active'
    };

    console.log('📋 Returning subscription data:', {
      plan: planName,
      status: subscriptionData.status,
      stripeSubscriptionId: subscriptionData.stripe_subscription_id
    });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(response),
    };

  } catch (error) {
    console.error('❌ Error getting customer subscription:', error);

    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'Failed to get subscription',
        details: error.message,
      }),
    };
  }
};