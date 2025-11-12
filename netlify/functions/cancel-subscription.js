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
    const { subscriptionId, cancelAtPeriodEnd = true, customerId } = JSON.parse(event.body);

    if (!subscriptionId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          error: 'Subscription ID is required'
        }),
      };
    }

    let realStripeSubscriptionId = subscriptionId;
    let foundViaCustomerSearch = false;

    // If subscription ID doesn't match Stripe format, search by customer
    if (!subscriptionId.startsWith('sub_')) {
      if (customerId) {
        try {
          let customer = null;
          
          if (customerId.startsWith('cus_')) {
            customer = await stripe.customers.retrieve(customerId);
          } else {
            const customers = await stripe.customers.list({
              email: customerId,
              limit: 1
            });
            customer = customers.data[0];
          }

          if (customer) {
            const subscriptions = await stripe.subscriptions.list({
              customer: customer.id,
              status: 'active',
              limit: 10
            });

            if (subscriptions.data.length > 0) {
              const activeSubscription = subscriptions.data.find(sub => 
                sub.status === 'active' && !sub.cancel_at_period_end
              );

              if (activeSubscription) {
                realStripeSubscriptionId = activeSubscription.id;
                foundViaCustomerSearch = true;
              } else {
                return {
                  statusCode: 200,
                  headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                  },
                  body: JSON.stringify({
                    success: true,
                    localOnly: true,
                    message: 'No active subscriptions found in Stripe',
                    subscription: {
                      id: subscriptionId,
                      status: 'canceled',
                      cancel_at_period_end: true,
                      canceled_at: Math.floor(Date.now() / 1000),
                      current_period_end: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000)
                    }
                  }),
                };
              }
            } else {
              return {
                statusCode: 200,
                headers: {
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                  success: true,
                  localOnly: true,
                  message: 'Customer has no active subscriptions',
                  subscription: {
                    id: subscriptionId,
                    status: 'canceled',
                    cancel_at_period_end: true,
                    canceled_at: Math.floor(Date.now() / 1000),
                    current_period_end: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000)
                  }
                }),
              };
            }
          } else {
            return {
              statusCode: 200,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              },
              body: JSON.stringify({
                success: true,
                localOnly: true,
                message: 'Customer not found in Stripe',
                subscription: {
                  id: subscriptionId,
                  status: 'canceled',
                  cancel_at_period_end: true,
                  canceled_at: Math.floor(Date.now() / 1000),
                  current_period_end: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000)
                }
              }),
            };
          }
        } catch (customerError) {
          return {
            statusCode: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              success: true,
              localOnly: true,
              message: 'Error finding customer in Stripe',
              subscription: {
                id: subscriptionId,
                status: 'canceled',
                cancel_at_period_end: true,
                canceled_at: Math.floor(Date.now() / 1000),
                current_period_end: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000)
              }
            }),
          };
        }
      } else {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            error: 'Invalid subscription format',
            message: 'No customer ID provided for search'
          }),
        };
      }
    }

    // Verify the subscription exists in Stripe
    let existingSubscription;
    try {
      existingSubscription = await stripe.subscriptions.retrieve(realStripeSubscriptionId);
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

    // Check if already cancelled
    if (existingSubscription.cancel_at_period_end) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          stripeVerified: true,
          message: 'Subscription is already set to cancel at period end',
          subscription: {
            id: existingSubscription.id,
            status: existingSubscription.status,
            cancel_at_period_end: existingSubscription.cancel_at_period_end,
            canceled_at: existingSubscription.canceled_at,
            current_period_end: existingSubscription.current_period_end,
          }
        }),
      };
    }

    // Cancel the subscription in Stripe
    let result;

    if (cancelAtPeriodEnd) {
      result = await stripe.subscriptions.update(realStripeSubscriptionId, {
        cancel_at_period_end: true,
      });
    } else {
      result = await stripe.subscriptions.cancel(realStripeSubscriptionId);
    }

    // Verify the cancellation
    const verification = await stripe.subscriptions.retrieve(realStripeSubscriptionId);
    
    const isCancelled = verification.cancel_at_period_end || verification.status === 'canceled';
    
    if (!isCancelled) {
      throw new Error('Subscription is still active after cancellation attempt');
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        stripeVerified: true,
        foundViaCustomerSearch,
        originalSubscriptionId: subscriptionId,
        realStripeSubscriptionId: realStripeSubscriptionId,
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
          ? 'Subscription cancelled successfully in Stripe'
          : 'Subscription cancelled immediately in Stripe'
      }),
    };

  } catch (error) {
    console.error('Stripe API error:', error);
    
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
        type: error.type || 'unknown_error',
        code: error.code
      }),
    };
  }
};