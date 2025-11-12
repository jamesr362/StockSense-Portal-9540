import Stripe from 'stripe';

export const handler = async (event) => {
  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    console.log('🔄 Starting subscription cancellation process...');
    
    // Check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('❌ STRIPE_SECRET_KEY environment variable not found');
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Stripe not configured',
          message: 'STRIPE_SECRET_KEY environment variable not set',
          solution: 'Add your Stripe secret key to Netlify environment variables'
        }),
      };
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    
    const { subscriptionId, cancelAtPeriodEnd = true } = JSON.parse(event.body);

    if (!subscriptionId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          error: 'Subscription ID is required',
          message: 'Please provide a valid subscription ID'
        }),
      };
    }

    console.log(`📋 Processing cancellation for subscription: ${subscriptionId}`);
    console.log(`⚙️ Cancel at period end: ${cancelAtPeriodEnd}`);

    // Validate that this is a real Stripe subscription ID
    if (!subscriptionId.startsWith('sub_')) {
      console.log(`⚠️ Invalid subscription ID format: ${subscriptionId} - handling as local subscription`);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          localOnly: true,
          message: 'Local subscription cancelled - no Stripe API call needed',
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

    let result;

    if (cancelAtPeriodEnd) {
      console.log('🎯 Calling Stripe API to cancel at period end...');
      // Cancel at period end - customer keeps access until billing period ends
      // This prevents future charges while maintaining current access
      result = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
      
      console.log('✅ STRIPE API SUCCESS: Subscription set to cancel at period end');
      console.log('📊 Stripe API Response:', {
        id: result.id,
        status: result.status,
        cancel_at_period_end: result.cancel_at_period_end,
        current_period_end: result.current_period_end,
        canceled_at: result.canceled_at
      });
    } else {
      console.log('🎯 Calling Stripe API to cancel immediately...');
      // Cancel immediately - ends access immediately
      result = await stripe.subscriptions.cancel(subscriptionId);
      
      console.log('✅ STRIPE API SUCCESS: Subscription cancelled immediately');
      console.log('📊 Stripe API Response:', {
        id: result.id,
        status: result.status,
        canceled_at: result.canceled_at
      });
    }

    // Verify the cancellation was successful by fetching the subscription again
    console.log('🔍 Verifying cancellation with Stripe...');
    const verification = await stripe.subscriptions.retrieve(subscriptionId);
    
    console.log('✅ VERIFICATION COMPLETE - Subscription status in Stripe:', {
      id: verification.id,
      status: verification.status,
      cancel_at_period_end: verification.cancel_at_period_end,
      canceled_at: verification.canceled_at,
      current_period_end: verification.current_period_end
    });

    // Double-check that the cancellation worked
    const isCancelled = verification.cancel_at_period_end || verification.status === 'canceled';
    
    if (!isCancelled) {
      throw new Error('Cancellation verification failed - subscription is still active in Stripe');
    }

    console.log('🎉 SUCCESS: Subscription cancellation confirmed in Stripe dashboard');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        stripeVerified: true,
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
          canceled_at: verification.canceled_at,
          current_period_end: verification.current_period_end
        },
        message: cancelAtPeriodEnd 
          ? '🎯 Subscription will be cancelled at the end of the billing period. No future charges will occur. This is now reflected in your Stripe dashboard.'
          : '🎯 Subscription cancelled immediately. This is now reflected in your Stripe dashboard.'
      }),
    };

  } catch (error) {
    console.error('❌ STRIPE API ERROR:', error);
    
    // Enhanced error logging for debugging
    console.error('❌ Full error details:', {
      message: error.message,
      type: error.type,
      code: error.code,
      param: error.param,
      statusCode: error.statusCode,
      requestId: error.requestId
    });
    
    // Determine error type and provide helpful message
    let errorMessage = 'Failed to cancel subscription';
    let statusCode = 500;
    
    if (error.type === 'StripeInvalidRequestError') {
      if (error.code === 'resource_missing') {
        errorMessage = 'Subscription not found in Stripe';
        statusCode = 404;
      } else if (error.code === 'parameter_invalid_empty') {
        errorMessage = 'Invalid subscription ID provided';
        statusCode = 400;
      }
    } else if (error.type === 'StripeAuthenticationError') {
      errorMessage = 'Stripe authentication failed - check API key';
      statusCode = 401;
    } else if (error.type === 'StripeConnectionError') {
      errorMessage = 'Unable to connect to Stripe';
      statusCode = 503;
    }
    
    return {
      statusCode: statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: errorMessage,
        message: error.message,
        type: error.type || 'unknown_error',
        code: error.code,
        details: `Stripe API Error: ${error.message}`,
        solution: error.type === 'StripeAuthenticationError' 
          ? 'Check your Stripe API key in Netlify environment variables'
          : 'Please try again or contact support if the problem persists'
      }),
    };
  }
};