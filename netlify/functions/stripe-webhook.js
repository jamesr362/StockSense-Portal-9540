// netlify/functions/stripe-webhook.js
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const handler = async (event) => {
  const sig = event.headers['stripe-signature'];

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, endpointSecret);
    console.log('📦 Stripe webhook event received:', stripeEvent.type);
  } catch (err) {
    console.error('⚠️ Webhook signature verification failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  // Handle the checkout completion event
  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    const userId = session.metadata?.user_id;
    const userEmail = session.metadata?.user_email;

    console.log('💰 Payment successful for:', userEmail || 'Unknown email');

    if (!userId) {
      console.warn('⚠️ No user_id found in session metadata');
      return { statusCode: 200, body: 'No user ID to update' };
    }

    // Update the user's plan to Professional
    const { error } = await supabase
      .from('users_tb2k4x9p1m') // your users table
      .update({ plan: 'professional' })
      .eq('id', userId);

    if (error) {
      console.error('❌ Error updating user plan:', error);
      return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }

    console.log('✅ User upgraded to Professional:', userId);
  } else {
    console.log('⚠️ Unhandled event type:', stripeEvent.type);
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
