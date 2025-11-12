import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST'
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { subscriptionId, cancelAtPeriodEnd = true } = JSON.parse(event.body);

    if (!subscriptionId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Subscription ID is required' }),
      };
    }

    // Validate that this is a real Stripe subscription ID
    if (!subscriptionId.startsWith('sub_')) {
      console.log(`⚠️ Invalid subscription ID format: ${subscriptionId} - skipping Stripe API call`);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          localOnly: true,
          message: 'Payment link subscription - handled locally only',
          subscription: {
            id: subscriptionId,
            status: cancelAtPeriodEnd ? 'active' : 'canceled',
            cancel_at_period_end: cancelAtPeriodEnd,
            canceled_at: Math.floor(Date.now() / 1000),
            current_period_end: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000)
          }
        }),
      };
    }

    console.log(`🔄 Cancelling Stripe subscription: ${subscriptionId}, cancelAtPeriodEnd: ${cancelAtPeriodEnd}`);

    let result;

    if (cancelAtPeriodEnd) {
      // Cancel at period end - customer keeps access until billing period ends
      // This is the SAFEST option - no immediate charge but prevents future billing
      result = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
      
      console.log('✅ Subscription set to cancel at period end - NO FUTURE CHARGES');
      console.log('📊 Stripe response:', {
        id: result.id,
        status: result.status,
        cancel_at_period_end: result.cancel_at_period_end,
        current_period_end: result.current_period_end
      });
    } else {
      // Cancel immediately - use with caution as this ends access immediately
      result = await stripe.subscriptions.cancel(subscriptionId);
      
      console.log('✅ Subscription cancelled immediately');
      console.log('📊 Stripe response:', {
        id: result.id,
        status: result.status,
        canceled_at: result.canceled_at
      });
    }

    // Verify the cancellation was successful
    const verification = await stripe.subscriptions.retrieve(subscriptionId);
    console.log('🔍 Verification - Subscription status in Stripe:', {
      id: verification.id,
      status: verification.status,
      cancel_at_period_end: verification.cancel_at_period_end,
      canceled_at: verification.canceled_at
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        subscription: {
          id: result.id,
          status: result.status,
          cancel_at_period_end: result.cancel_at_period_end,
          canceled_at: result.canceled_at,
          current_period_end: result.current_period_end,
        },
        verification: {
          status: verification.status,
          cancel_at_period_end: verification.cancel_at_period_end,
          canceled_at: verification.canceled_at
        },
        message: cancelAtPeriodEnd 
          ? 'Subscription will be cancelled at the end of the billing period - no future charges will occur'
          : 'Subscription cancelled immediately'
      }),
    };

  } catch (error) {
    console.error('❌ Error cancelling subscription:', error);
    
    // Enhanced error logging
    console.error('❌ Full error details:', {
      message: error.message,
      type: error.type,
      code: error.code,
      param: error.param,
      stack: error.stack
    });
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Failed to cancel subscription',
        message: error.message,
        type: error.type || 'unknown_error',
        details: error.code ? `Stripe error: ${error.code}` : 'Internal server error'
      }),
    };
  }
};