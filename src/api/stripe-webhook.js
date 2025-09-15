// Backend API endpoint for Stripe webhook handling
// This should be deployed to your backend server (Node.js/Express, Vercel, Netlify Functions, etc.)

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role key for admin operations
);

// Webhook endpoint handler
const handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('Received webhook event:', event.type);

  try {
    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

// Handle successful checkout
const handleCheckoutCompleted = async (session) => {
  console.log('Processing checkout session:', session.id);
  
  try {
    // Get customer email from session
    const customerEmail = session.customer_details?.email || session.customer_email;
    
    if (!customerEmail) {
      throw new Error('No customer email found in checkout session');
    }

    // Get subscription details if this was a subscription checkout
    if (session.subscription) {
      const subscription = await stripe.subscriptions.retrieve(session.subscription);
      await updateSubscriptionInDatabase(customerEmail, subscription);
    }

    // Log successful processing
    console.log('Checkout processed successfully for:', customerEmail);
    
  } catch (error) {
    console.error('Error processing checkout:', error);
    throw error;
  }
};

// Handle successful payment
const handlePaymentSucceeded = async (invoice) => {
  console.log('Processing payment success:', invoice.id);
  
  try {
    if (invoice.subscription) {
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
      const customer = await stripe.customers.retrieve(invoice.customer);
      
      await updateSubscriptionInDatabase(customer.email, subscription);
    }
    
  } catch (error) {
    console.error('Error processing payment success:', error);
    throw error;
  }
};

// Handle subscription updates
const handleSubscriptionUpdated = async (subscription) => {
  console.log('Processing subscription update:', subscription.id);
  
  try {
    const customer = await stripe.customers.retrieve(subscription.customer);
    await updateSubscriptionInDatabase(customer.email, subscription);
    
  } catch (error) {
    console.error('Error processing subscription update:', error);
    throw error;
  }
};

// Handle subscription deletion
const handleSubscriptionDeleted = async (subscription) => {
  console.log('Processing subscription deletion:', subscription.id);
  
  try {
    const customer = await stripe.customers.retrieve(subscription.customer);
    
    // Update subscription status to canceled
    const { error } = await supabase
      .from('subscriptions_tb2k4x9p1m')
      .update({
        status: 'canceled',
        canceled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_email', customer.email.toLowerCase());

    if (error) throw error;
    
  } catch (error) {
    console.error('Error processing subscription deletion:', error);
    throw error;
  }
};

// Update subscription in database
const updateSubscriptionInDatabase = async (customerEmail, subscription) => {
  try {
    const subscriptionData = {
      user_email: customerEmail.toLowerCase(),
      stripe_customer_id: subscription.customer,
      stripe_subscription_id: subscription.id,
      plan_id: subscription.items.data[0].price.id,
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
      updated_at: new Date().toISOString()
    };

    // Check if subscription exists
    const { data: existingSubscription, error: fetchError } = await supabase
      .from('subscriptions_tb2k4x9p1m')
      .select('id')
      .eq('user_email', customerEmail.toLowerCase())
      .single();

    if (existingSubscription && !fetchError) {
      // Update existing subscription
      const { error: updateError } = await supabase
        .from('subscriptions_tb2k4x9p1m')
        .update(subscriptionData)
        .eq('user_email', customerEmail.toLowerCase());

      if (updateError) throw updateError;
    } else {
      // Create new subscription
      subscriptionData.created_at = new Date().toISOString();
      const { error: insertError } = await supabase
        .from('subscriptions_tb2k4x9p1m')
        .insert([subscriptionData]);

      if (insertError) throw insertError;
    }

    console.log('Subscription updated successfully for:', customerEmail);
    
  } catch (error) {
    console.error('Error updating subscription in database:', error);
    throw error;
  }
};

// Payment verification endpoint
const verifyPayment = async (req, res) => {
  try {
    const { session_id, user_email } = req.body;

    if (!session_id || !user_email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Session ID and user email are required' 
      });
    }

    // Retrieve checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id);
    
    if (session.payment_status === 'paid') {
      // Get subscription if it exists
      let subscriptionData = null;
      
      if (session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        await updateSubscriptionInDatabase(user_email, subscription);
        
        subscriptionData = {
          id: subscription.id,
          customerId: subscription.customer,
          subscriptionId: subscription.id,
          planId: subscription.items.data[0].price.id,
          status: subscription.status,
          currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
          userEmail: user_email
        };
      }

      res.json({
        success: true,
        message: 'Payment verified successfully',
        subscription: subscriptionData,
        session: {
          id: session.id,
          payment_status: session.payment_status,
          amount_total: session.amount_total
        }
      });
    } else {
      res.json({
        success: false,
        message: 'Payment not completed',
        payment_status: session.payment_status
      });
    }

  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Payment verification failed',
      error: error.message
    });
  }
};

// Export handlers for different platforms
module.exports = {
  // For Express.js
  handleStripeWebhook,
  verifyPayment,
  
  // For Vercel Functions
  default: async (req, res) => {
    if (req.method === 'POST' && req.url === '/api/stripe/webhook') {
      return handleStripeWebhook(req, res);
    } else if (req.method === 'POST' && req.url === '/api/stripe/verify-payment') {
      return verifyPayment(req, res);
    } else {
      res.status(404).json({ error: 'Not found' });
    }
  },
  
  // For Netlify Functions
  handler: async (event, context) => {
    const req = {
      method: event.httpMethod,
      headers: event.headers,
      body: event.body,
      url: event.path
    };
    
    const res = {
      status: (code) => ({ statusCode: code }),
      json: (body) => ({ statusCode: 200, body: JSON.stringify(body) }),
      send: (body) => ({ statusCode: 200, body })
    };

    if (req.method === 'POST' && req.url === '/api/stripe/webhook') {
      return handleStripeWebhook(req, res);
    } else if (req.method === 'POST' && req.url === '/api/stripe/verify-payment') {
      return verifyPayment(req, res);
    } else {
      return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
    }
  }
};