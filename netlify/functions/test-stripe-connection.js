import Stripe from 'stripe';

export const handler = async (event) => {
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

  try {
    console.log('🔍 Testing Stripe connection...');
    
    // Check if environment variable exists
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('❌ STRIPE_SECRET_KEY environment variable not found');
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Stripe configuration missing',
          message: 'STRIPE_SECRET_KEY environment variable not set in Netlify',
          solution: 'Add STRIPE_SECRET_KEY to your Netlify environment variables'
        }),
      };
    }

    // Initialize Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    
    // Test the connection by listing a few products (this is a safe read operation)
    const products = await stripe.products.list({ limit: 1 });
    
    console.log('✅ Stripe connection successful');
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: 'Stripe connection successful',
        environment: process.env.STRIPE_SECRET_KEY.startsWith('sk_test_') ? 'test' : 'live',
        timestamp: new Date().toISOString()
      }),
    };

  } catch (error) {
    console.error('❌ Stripe connection test failed:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Stripe connection failed',
        message: error.message,
        type: error.type || 'connection_error',
        solution: error.code === 'api_key_invalid' 
          ? 'Check your Stripe API key in Netlify environment variables'
          : 'Verify your Stripe account status and API key permissions'
      }),
    };
  }
};