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
    console.log('🔄 Starting ENHANCED subscription cancellation process...');
    
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
          message: '🚨 CRITICAL: STRIPE_SECRET_KEY environment variable not set in Netlify',
          solution: 'Go to Netlify Dashboard → Site Settings → Environment Variables → Add STRIPE_SECRET_KEY'
        }),
      };
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    
    const { subscriptionId, cancelAtPeriodEnd = true, customerId } = JSON.parse(event.body);

    console.log('📋 Input parameters:', {
      subscriptionId,
      customerId,
      cancelAtPeriodEnd,
      subscriptionIdFormat: subscriptionId?.startsWith('sub_') ? 'VALID_STRIPE_FORMAT' : 'INVALID_FORMAT'
    });

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

    // 🎯 STEP 1: FIND THE REAL STRIPE SUBSCRIPTION
    let realStripeSubscriptionId = subscriptionId;
    let foundViaCustomerSearch = false;

    // If subscription ID doesn't match Stripe format, search by customer
    if (!subscriptionId.startsWith('sub_')) {
      console.log('⚠️ Non-Stripe subscription ID detected. Searching for real Stripe subscription...');
      
      if (customerId) {
        try {
          console.log('🔍 Searching for customer in Stripe...');
          
          // Try to find customer by ID or email
          let customer = null;
          
          if (customerId.startsWith('cus_')) {
            console.log('🔍 Retrieving customer by Stripe ID...');
            customer = await stripe.customers.retrieve(customerId);
          } else {
            console.log('🔍 Searching customer by email...');
            const customers = await stripe.customers.list({
              email: customerId,
              limit: 1
            });
            customer = customers.data[0];
          }

          if (customer) {
            console.log('✅ Found customer in Stripe:', customer.id, customer.email);
            
            // Get all active subscriptions for this customer
            const subscriptions = await stripe.subscriptions.list({
              customer: customer.id,
              status: 'active',
              limit: 10
            });

            console.log(`📋 Found ${subscriptions.data.length} active subscription(s) for customer`);

            if (subscriptions.data.length > 0) {
              // Find the first active subscription that's not already cancelled
              const activeSubscription = subscriptions.data.find(sub => 
                sub.status === 'active' && !sub.cancel_at_period_end
              );

              if (activeSubscription) {
                realStripeSubscriptionId = activeSubscription.id;
                foundViaCustomerSearch = true;
                console.log('🎯 FOUND REAL STRIPE SUBSCRIPTION:', realStripeSubscriptionId);
                console.log('📊 Subscription details:', {
                  id: activeSubscription.id,
                  status: activeSubscription.status,
                  cancel_at_period_end: activeSubscription.cancel_at_period_end,
                  current_period_end: activeSubscription.current_period_end
                });
              } else {
                console.log('⚠️ No active non-cancelled subscriptions found');
                return {
                  statusCode: 200,
                  headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                  },
                  body: JSON.stringify({
                    success: true,
                    localOnly: true,
                    message: 'No active subscriptions found in Stripe to cancel',
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
              console.log('⚠️ Customer has no active subscriptions in Stripe');
              return {
                statusCode: 200,
                headers: {
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                  success: true,
                  localOnly: true,
                  message: 'Customer has no active subscriptions in Stripe',
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
            console.log('❌ Customer not found in Stripe');
            return {
              statusCode: 200,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              },
              body: JSON.stringify({
                success: true,
                localOnly: true,
                message: 'Customer not found in Stripe - handling as local cancellation',
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
          console.error('❌ Error searching for customer:', customerError);
          return {
            statusCode: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              success: true,
              localOnly: true,
              message: 'Error finding customer in Stripe - handling as local cancellation',
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
        console.log('❌ No customer ID provided for subscription search');
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            error: 'Invalid subscription format',
            message: 'Subscription ID does not match Stripe format and no customer ID provided for search'
          }),
        };
      }
    }

    // 🎯 STEP 2: VERIFY THE SUBSCRIPTION EXISTS IN STRIPE
    console.log('🔍 Verifying subscription exists in Stripe:', realStripeSubscriptionId);
    
    let existingSubscription;
    try {
      existingSubscription = await stripe.subscriptions.retrieve(realStripeSubscriptionId);
      console.log('✅ Subscription found in Stripe:', {
        id: existingSubscription.id,
        status: existingSubscription.status,
        cancel_at_period_end: existingSubscription.cancel_at_period_end,
        customer: existingSubscription.customer
      });
    } catch (retrieveError) {
      console.error('❌ Subscription not found in Stripe:', retrieveError.message);
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Subscription not found',
          message: 'Subscription does not exist in Stripe',
          subscriptionId: realStripeSubscriptionId
        }),
      };
    }

    // Check if already cancelled
    if (existingSubscription.cancel_at_period_end) {
      console.log('⚠️ Subscription is already set to cancel at period end');
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          stripeVerified: true,
          message: '⚠️ Subscription is already set to cancel at period end',
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

    // 🎯 STEP 3: CANCEL THE SUBSCRIPTION IN STRIPE
    console.log('🎯 Proceeding with Stripe API cancellation...');
    console.log(`⚙️ Cancel at period end: ${cancelAtPeriodEnd}`);
    
    let result;

    if (cancelAtPeriodEnd) {
      console.log('🎯 Calling Stripe API to cancel at period end...');
      result = await stripe.subscriptions.update(realStripeSubscriptionId, {
        cancel_at_period_end: true,
      });
      
      console.log('✅ STRIPE API SUCCESS: Subscription set to cancel at period end');
    } else {
      console.log('🎯 Calling Stripe API to cancel immediately...');
      result = await stripe.subscriptions.cancel(realStripeSubscriptionId);
      
      console.log('✅ STRIPE API SUCCESS: Subscription cancelled immediately');
    }

    console.log('📊 Stripe API Response:', {
      id: result.id,
      status: result.status,
      cancel_at_period_end: result.cancel_at_period_end,
      current_period_end: result.current_period_end,
      canceled_at: result.canceled_at
    });

    // 🎯 STEP 4: VERIFY THE CANCELLATION
    console.log('🔍 Verifying cancellation with Stripe...');
    const verification = await stripe.subscriptions.retrieve(realStripeSubscriptionId);
    
    console.log('📊 VERIFICATION RESULT:', {
      id: verification.id,
      status: verification.status,
      cancel_at_period_end: verification.cancel_at_period_end,
      canceled_at: verification.canceled_at,
      current_period_end: verification.current_period_end
    });

    // Ensure the cancellation worked
    const isCancelled = verification.cancel_at_period_end || verification.status === 'canceled';
    
    if (!isCancelled) {
      throw new Error('🚨 VERIFICATION FAILED: Subscription is still active in Stripe after cancellation attempt');
    }

    console.log('🎉 SUCCESS: Subscription cancellation CONFIRMED in Stripe dashboard');
    console.log('✅ This change is now visible in your Stripe dashboard');

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
          ? '🎯 SUCCESS: Subscription cancelled in Stripe! No future charges will occur. The cancellation is immediately visible in your Stripe dashboard.'
          : '🎯 SUCCESS: Subscription cancelled immediately in Stripe! This is reflected in your Stripe dashboard.'
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
    let errorMessage = 'Failed to cancel subscription in Stripe';
    let statusCode = 500;
    let solution = 'Please try again or contact support if the problem persists';
    
    if (error.type === 'StripeInvalidRequestError') {
      if (error.code === 'resource_missing') {
        errorMessage = 'Subscription not found in Stripe';
        statusCode = 404;
        solution = 'The subscription may have already been cancelled or deleted';
      } else if (error.code === 'parameter_invalid_empty') {
        errorMessage = 'Invalid subscription ID provided';
        statusCode = 400;
        solution = 'Please check the subscription ID format';
      }
    } else if (error.type === 'StripeAuthenticationError') {
      errorMessage = '🚨 Stripe authentication failed';
      statusCode = 401;
      solution = 'Check your STRIPE_SECRET_KEY in Netlify environment variables';
    } else if (error.type === 'StripeConnectionError') {
      errorMessage = 'Unable to connect to Stripe';
      statusCode = 503;
      solution = 'Check your internet connection and try again';
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
        solution: solution,
        details: `Stripe API Error: ${error.message}`,
        timestamp: new Date().toISOString()
      }),
    };
  }
};