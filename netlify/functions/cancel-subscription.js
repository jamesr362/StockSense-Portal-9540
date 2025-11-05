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
    const { subscriptionId, cancelAtPeriodEnd = true } = JSON.parse(event.body);

    if (!subscriptionId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Subscription ID is required' }),
      };
    }

    console.log(`🔄 Cancelling Stripe subscription: ${subscriptionId}, cancelAtPeriodEnd: ${cancelAtPeriodEnd}`);

    let result;

    if (cancelAtPeriodEnd) {
      // Cancel at period end - customer keeps access until billing period ends
      result = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
      
      console.log('✅ Subscription set to cancel at period end');
    } else {
      // Cancel immediately
      result = await stripe.subscriptions.cancel(subscriptionId);
      
      console.log('✅ Subscription cancelled immediately');
    }

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
          canceled_at: result.canceled_at,
          current_period_end: result.current_period_end,
        }
      }),
    };

  } catch (error) {
    console.error('❌ Error cancelling subscription:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'Failed to cancel subscription',
        message: error.message,
      }),
    };
  }
};