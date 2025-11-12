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
    const { customerId } = JSON.parse(event.body);

    if (!customerId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          error: 'Customer ID is required'
        }),
      };
    }

    let customer = null;
    
    // Try to find customer by ID first, then by email
    try {
      if (customerId.startsWith('cus_')) {
        customer = await stripe.customers.retrieve(customerId);
      } else {
        const customers = await stripe.customers.list({
          email: customerId,
          limit: 1
        });
        customer = customers.data[0];
      }
    } catch (error) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Customer not found',
          message: 'Customer does not exist in Stripe'
        }),
      };
    }

    if (!customer) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Customer not found',
          message: 'No customer found with the provided ID or email'
        }),
      };
    }

    // Create the portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${process.env.URL || 'http://localhost:5173'}/billing`,
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        url: session.url
      }),
    };

  } catch (error) {
    console.error('Stripe portal error:', error);
    
    let errorMessage = 'Failed to create portal session';
    let statusCode = 500;
    
    if (error.type === 'StripeInvalidRequestError') {
      if (error.code === 'resource_missing') {
        errorMessage = 'Customer not found in Stripe';
        statusCode = 404;
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