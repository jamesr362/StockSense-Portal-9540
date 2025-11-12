import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
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
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: 'Method not allowed'
      })
    };
  }

  try {
    // Check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: false,
          error: 'Stripe not configured: STRIPE_SECRET_KEY environment variable is missing'
        })
      };
    }

    const { subscriptionId, customerId, cancelAtPeriodEnd = true } = JSON.parse(event.body);

    console.log('🔄 Processing cancellation request:', {
      subscriptionId,
      customerId,
      cancelAtPeriodEnd
    });

    if (!subscriptionId) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: false,
          error: 'Missing subscription ID'
        })
      };
    }

    let targetSubscriptionId = subscriptionId;
    let foundViaCustomerSearch = false;
    let originalSubscriptionId = subscriptionId;

    // If the subscription ID doesn't look like a real Stripe subscription ID, try to find it
    if (!subscriptionId.startsWith('sub_')) {
      console.log('⚠️ Invalid subscription ID format:', subscriptionId);
      
      if (customerId) {
        console.log('🔍 Searching for subscription via customer ID:', customerId);
        
        try {
          // Try to find the subscription through the customer
          const subscriptions = await stripe.subscriptions.list({
            customer: customerId,
            status: 'active',
            limit: 10
          });

          if (subscriptions.data.length > 0) {
            targetSubscriptionId = subscriptions.data[0].id;
            foundViaCustomerSearch = true;
            console.log('✅ Found subscription via customer search:', targetSubscriptionId);
          } else {
            console.log('❌ No active subscriptions found for customer:', customerId);
            return {
              statusCode: 404,
              headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                success: false,
                error: 'No active subscription found for this customer'
              })
            };
          }
        } catch (customerError) {
          console.error('❌ Error searching customer subscriptions:', customerError);
          return {
            statusCode: 400,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              success: false,
              error: `Invalid subscription ID format and customer lookup failed: ${customerError.message}`
            })
          };
        }
      } else {
        return {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            success: false,
            error: `Invalid subscription ID format: ${subscriptionId} (should start with sub_)`
          })
        };
      }
    }

    console.log('🎯 Attempting to cancel subscription:', targetSubscriptionId);

    // Cancel the subscription in Stripe
    const updatedSubscription = await stripe.subscriptions.update(targetSubscriptionId, {
      cancel_at_period_end: cancelAtPeriodEnd
    });

    console.log('✅ Successfully cancelled subscription in Stripe:', {
      id: updatedSubscription.id,
      status: updatedSubscription.status,
      cancel_at_period_end: updatedSubscription.cancel_at_period_end,
      canceled_at: updatedSubscription.canceled_at,
      current_period_end: updatedSubscription.current_period_end
    });

    // If immediate cancellation was requested, also cancel immediately
    if (!cancelAtPeriodEnd) {
      console.log('🔄 Cancelling subscription immediately...');
      const cancelledSubscription = await stripe.subscriptions.cancel(targetSubscriptionId);
      
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: true,
          message: 'Subscription cancelled immediately',
          subscription: cancelledSubscription,
          stripeVerified: true,
          foundViaCustomerSearch,
          originalSubscriptionId,
          realStripeSubscriptionId: targetSubscriptionId
        })
      };
    }

    // Return success response
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        message: cancelAtPeriodEnd 
          ? 'Subscription will be cancelled at the end of the current billing period'
          : 'Subscription cancelled immediately',
        subscription: updatedSubscription,
        stripeVerified: true,
        foundViaCustomerSearch,
        originalSubscriptionId,
        realStripeSubscriptionId: targetSubscriptionId
      })
    };

  } catch (error) {
    console.error('❌ Cancellation error:', error);

    // Handle specific Stripe errors
    let errorMessage = error.message;
    let statusCode = 500;

    if (error.type === 'StripeInvalidRequestError') {
      if (error.message.includes('No such subscription')) {
        errorMessage = 'Subscription not found in Stripe. It may have already been cancelled.';
        statusCode = 404;
      } else {
        errorMessage = `Invalid request: ${error.message}`;
        statusCode = 400;
      }
    } else if (error.type === 'StripeAuthenticationError') {
      errorMessage = 'Stripe authentication failed. Check your STRIPE_SECRET_KEY.';
      statusCode = 401;
    } else if (error.type === 'StripePermissionError') {
      errorMessage = 'Insufficient permissions for this Stripe operation.';
      statusCode = 403;
    } else if (error.type === 'StripeRateLimitError') {
      errorMessage = 'Too many requests to Stripe. Please try again later.';
      statusCode = 429;
    }

    return {
      statusCode,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: errorMessage,
        type: error.type || 'UnknownError'
      })
    };
  }
};