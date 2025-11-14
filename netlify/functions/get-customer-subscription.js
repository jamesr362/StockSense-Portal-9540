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

    // Get customer's subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'all',
      limit: 10
    });

    // Find the most recent active subscription
    const activeSubscription = subscriptions.data.find(sub => 
      sub.status === 'active' || sub.status === 'trialing'
    );

    if (!activeSubscription) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'No active subscription found',
          message: 'Customer has no active subscriptions'
        }),
      };
    }

    // Get the latest invoice for PDF
    let invoicePdf = null;
    try {
      const invoices = await stripe.invoices.list({
        customer: customer.id,
        limit: 1
      });
      if (invoices.data.length > 0 && invoices.data[0].invoice_pdf) {
        invoicePdf = invoices.data[0].invoice_pdf;
      }
    } catch (invoiceError) {
      console.log('Could not fetch invoice:', invoiceError);
    }

    const subscription = {
      id: activeSubscription.id,
      status: activeSubscription.status,
      customer: activeSubscription.customer,
      price_id: activeSubscription.items.data[0]?.price?.id || 'price_unknown',
      amount: activeSubscription.items.data[0]?.price?.unit_amount || 0,
      currency: activeSubscription.items.data[0]?.price?.currency || 'gbp',
      current_period_start: activeSubscription.current_period_start,
      current_period_end: activeSubscription.current_period_end,
      cancel_at_period_end: activeSubscription.cancel_at_period_end,
      canceled_at: activeSubscription.canceled_at,
      trial_start: activeSubscription.trial_start,
      trial_end: activeSubscription.trial_end,
      invoice_pdf: invoicePdf
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        subscription: subscription,
        customer: {
          id: customer.id,
          email: customer.email,
          name: customer.name
        }
      }),
    };

  } catch (error) {
    console.error('Stripe API error:', error);
    
    let errorMessage = 'Failed to get customer subscription';
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