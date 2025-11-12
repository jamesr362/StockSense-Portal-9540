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
    const { subscriptionId } = JSON.parse(event.body);

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
            status: 'active',
            cancel_at_period_end: false,
            canceled_at: null,
            current_period_end: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000)
          }
        }),
      };
    }

    console.log(`🔄 Reactivating Stripe subscription: ${subscriptionId}`);

    // Remove the cancellation by setting cancel_at_period_end to false
    const result = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });
    
    console.log('✅ Subscription reactivated - billing will continue');
    console.log('📊 Stripe response:', {
      id: result.id,
      status: result.status,
      cancel_at_period_end: result.cancel_at_period_end,
      current_period_end: result.current_period_end
    });

    // Verify the reactivation was successful
    const verification = await stripe.subscriptions.retrieve(subscriptionId);
    console.log('🔍 Verification - Subscription status in Stripe:', {
      id: verification.id,
      status: verification.status,
      cancel_at_period_end: verification.cancel_at_period_end
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
          cancel_at_period_end: verification.cancel_at_period_end
        },
        message: 'Subscription successfully reactivated - billing will continue'
      }),
    };

  } catch (error) {
    console.error('❌ Error reactivating subscription:', error);
    
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
        error: 'Failed to reactivate subscription',
        message: error.message,
        type: error.type || 'unknown_error',
        details: error.code ? `Stripe error: ${error.code}` : 'Internal server error'
      }),
    };
  }
};