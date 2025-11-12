import Stripe from 'stripe';

export const handler = async (event) => {
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

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Stripe not configured',
          message: 'STRIPE_SECRET_KEY environment variable not set'
        }),
      };
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const { subscriptionId, priceId } = JSON.parse(event.body);

    if (!subscriptionId || !priceId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          error: 'Subscription ID and Price ID are required'
        }),
      };
    }

    // Verify the subscription exists
    let existingSubscription;
    try {
      existingSubscription = await stripe.subscriptions.retrieve(subscriptionId);
    } catch (retrieveError) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Subscription not found',
          message: 'Subscription does not exist in Stripe'
        }),
      };
    }

    // Update the subscription
    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      items: [{
        id: existingSubscription.items.data[0].id,
        price: priceId,
      }],
      proration_behavior: 'create_prorations',
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
          id: updatedSubscription.id,
          status: updatedSubscription.status,
          price_id: updatedSubscription.items.data[0].price.id,
          amount: updatedSubscription.items.data[0].price.unit_amount,
          current_period_end: updatedSubscription.current_period_end,
        }
      }),
    };

  } catch (error) {
    console.error('Stripe update error:', error);
    
    let errorMessage = 'Failed to update subscription';
    let statusCode = 500;
    
    if (error.type === 'StripeInvalidRequestError') {
      if (error.code === 'resource_missing') {
        errorMessage = 'Subscription or price not found in Stripe';
        statusCode = 404;
      } else if (error.code === 'parameter_invalid_empty') {
        errorMessage = 'Invalid subscription or price ID provided';
        statusCode = 400;
      }
    } else if (error.type === 'StripeAuthenticationError') {
      errorMessage = 'Stripe authentication failed';
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
        type: error.type || 'unknown_error'
      }),
    };
  }
};