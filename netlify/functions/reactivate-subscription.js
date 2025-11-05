import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { subscriptionId } = JSON.parse(event.body);

    if (!subscriptionId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Subscription ID is required' }),
      };
    }

    console.log(`🔄 Reactivating Stripe subscription: ${subscriptionId}`);

    // Get current subscription status
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    if (subscription.cancel_at_period_end) {
      // Remove the cancellation - subscription will continue
      const result = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: false,
      });
      
      console.log('✅ Subscription reactivated - cancellation removed');
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: true,
          subscription: {
            id: result.id,
            status: result.status,
            cancel_at_period_end: result.cancel_at_period_end,
            current_period_end: result.current_period_end,
          }
        }),
      };
    } else if (subscription.status === 'canceled') {
      // Subscription is already cancelled - would need to create a new subscription
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: 'Cannot reactivate a cancelled subscription. A new subscription must be created.',
          subscription_status: subscription.status
        }),
      };
    } else {
      // Subscription is already active
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: true,
          message: 'Subscription is already active',
          subscription: {
            id: subscription.id,
            status: subscription.status,
            cancel_at_period_end: subscription.cancel_at_period_end,
            current_period_end: subscription.current_period_end,
          }
        }),
      };
    }

  } catch (error) {
    console.error('❌ Error reactivating subscription:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'Failed to reactivate subscription',
        message: error.message,
      }),
    };
  }
};