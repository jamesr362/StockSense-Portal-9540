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
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    console.log('🔍 DEBUG: Starting subscription debug process...');
    
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
          message: 'STRIPE_SECRET_KEY environment variable not set'
        }),
      };
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const { subscriptionId, customerId } = JSON.parse(event.body);

    console.log('🔍 DEBUG: Input parameters:', {
      subscriptionId,
      customerId,
      subscriptionIdType: typeof subscriptionId,
      subscriptionIdStartsWith: subscriptionId?.substring(0, 10)
    });

    let debugInfo = {
      stripeConfigured: true,
      subscriptionId: subscriptionId,
      subscriptionIdFormat: subscriptionId?.startsWith('sub_') ? 'valid_stripe_format' : 'invalid_format',
      customerId: customerId
    };

    // If we have a subscription ID that looks like a Stripe ID, try to fetch it
    if (subscriptionId && subscriptionId.startsWith('sub_')) {
      console.log('🔍 DEBUG: Attempting to fetch subscription from Stripe...');
      
      try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        console.log('✅ DEBUG: Found subscription in Stripe:', {
          id: subscription.id,
          status: subscription.status,
          customer: subscription.customer,
          cancel_at_period_end: subscription.cancel_at_period_end,
          current_period_end: subscription.current_period_end
        });

        debugInfo.stripeSubscription = {
          found: true,
          id: subscription.id,
          status: subscription.status,
          customer: subscription.customer,
          cancel_at_period_end: subscription.cancel_at_period_end,
          current_period_end: subscription.current_period_end,
          created: subscription.created,
          plan: subscription.items?.data?.[0]?.price?.id
        };

      } catch (error) {
        console.log('❌ DEBUG: Subscription not found in Stripe:', error.message);
        debugInfo.stripeSubscription = {
          found: false,
          error: error.message,
          type: error.type,
          code: error.code
        };
      }
    } else {
      console.log('⚠️ DEBUG: Subscription ID does not match Stripe format');
      debugInfo.stripeSubscription = {
        found: false,
        reason: 'Invalid subscription ID format - should start with "sub_"'
      };
    }

    // If we have a customer ID, try to list their subscriptions
    if (customerId) {
      console.log('🔍 DEBUG: Fetching customer subscriptions...');
      
      try {
        // Try to find customer by ID first
        let customer;
        if (customerId.startsWith('cus_')) {
          customer = await stripe.customers.retrieve(customerId);
        } else {
          // Search by email
          const customers = await stripe.customers.list({
            email: customerId,
            limit: 1
          });
          customer = customers.data[0];
        }

        if (customer) {
          console.log('✅ DEBUG: Found customer:', customer.id, customer.email);
          
          // Get their subscriptions
          const subscriptions = await stripe.subscriptions.list({
            customer: customer.id,
            limit: 10
          });

          console.log('📋 DEBUG: Customer subscriptions:', subscriptions.data.length);
          
          debugInfo.customerSubscriptions = subscriptions.data.map(sub => ({
            id: sub.id,
            status: sub.status,
            cancel_at_period_end: sub.cancel_at_period_end,
            current_period_end: sub.current_period_end,
            plan: sub.items?.data?.[0]?.price?.id
          }));

        } else {
          console.log('❌ DEBUG: Customer not found');
          debugInfo.customerSubscriptions = {
            found: false,
            reason: 'Customer not found in Stripe'
          };
        }

      } catch (error) {
        console.log('❌ DEBUG: Error fetching customer:', error.message);
        debugInfo.customerSubscriptions = {
          found: false,
          error: error.message
        };
      }
    }

    // Test a simple Stripe API call to verify connection
    try {
      const products = await stripe.products.list({ limit: 1 });
      debugInfo.stripeConnection = {
        working: true,
        testCall: 'products.list successful'
      };
    } catch (error) {
      debugInfo.stripeConnection = {
        working: false,
        error: error.message
      };
    }

    console.log('🔍 DEBUG: Complete debug info:', debugInfo);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        debug: debugInfo,
        timestamp: new Date().toISOString(),
        recommendations: getRecommendations(debugInfo)
      }),
    };

  } catch (error) {
    console.error('❌ DEBUG: Error during debug process:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Debug process failed',
        message: error.message,
        type: error.type
      }),
    };
  }
};

function getRecommendations(debugInfo) {
  const recommendations = [];

  if (!debugInfo.stripeConnection?.working) {
    recommendations.push('🚨 Fix Stripe connection - check your API key in Netlify environment variables');
  }

  if (debugInfo.subscriptionIdFormat === 'invalid_format') {
    recommendations.push('⚠️ The subscription ID does not match Stripe format (should start with "sub_")');
  }

  if (debugInfo.stripeSubscription?.found === false && debugInfo.subscriptionIdFormat === 'valid_stripe_format') {
    recommendations.push('❌ Subscription not found in Stripe - it may have been deleted or never existed');
  }

  if (debugInfo.customerSubscriptions?.found === false) {
    recommendations.push('❌ Customer not found in Stripe - they may not have any subscriptions');
  }

  if (debugInfo.customerSubscriptions && Array.isArray(debugInfo.customerSubscriptions)) {
    if (debugInfo.customerSubscriptions.length === 0) {
      recommendations.push('💡 Customer exists but has no subscriptions in Stripe');
    } else {
      recommendations.push(`✅ Customer has ${debugInfo.customerSubscriptions.length} subscription(s) in Stripe`);
      debugInfo.customerSubscriptions.forEach(sub => {
        if (sub.status === 'active' && !sub.cancel_at_period_end) {
          recommendations.push(`🎯 Active subscription found: ${sub.id} - this can be cancelled`);
        }
      });
    }
  }

  if (recommendations.length === 0) {
    recommendations.push('✅ Everything looks good - subscription should be cancellable');
  }

  return recommendations;
}