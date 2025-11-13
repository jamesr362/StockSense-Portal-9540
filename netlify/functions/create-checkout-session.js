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

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const { priceId, customerId, userEmail, planName } = JSON.parse(event.body);

    if (!priceId) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Missing priceId' })
      };
    }

    // FIXED: Use custom domain instead of Netlify URL
    const baseUrl = 'https://gotrackio.co.uk';
    
    const sessionConfig = {
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${baseUrl}/#/payment-success?payment_status=success&plan=${planName || 'unknown'}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/#/billing`,
      metadata: {
        user_email: userEmail,
        plan_name: planName
      }
    };

    // Only add customer if provided
    if (customerId) {
      sessionConfig.customer = customerId;
    } else if (userEmail) {
      // If no customer ID but we have email, let Stripe create a new customer
      sessionConfig.customer_email = userEmail;
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        id: session.id,
        url: session.url,
        success_url: session.success_url,
        cancel_url: session.cancel_url
      })
    };

  } catch (error) {
    console.error('Error creating checkout session:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        error: 'Internal Server Error',
        message: error.message
      })
    };
  }
};