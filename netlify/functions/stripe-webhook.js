import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Initialize Supabase with service role key (not anon key)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const handler = async (event) => {
  try {
    // Stripe requires raw body for signature verification
    const sig = event.headers['stripe-signature'];
    const body = event.body;

    const stripeEvent = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    console.log('📦 Stripe webhook event received:', stripeEvent.type);

    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object;
      const customerEmail = session.customer_details?.email;

      console.log('💰 Payment successful for:', customerEmail);

      if (customerEmail) {
        const { error } = await supabase
          .from('users_tb2k4x9p1m')
          .update({ plan: 'professional' })
          .eq('email', customerEmail.toLowerCase());

        if (error) {
          console.error('❌ Supabase update failed:', error);
          throw error;
        }

        console.log('✅ User upgraded to Professional:', customerEmail);
      } else {
        console.warn('⚠️ No email found in session data');
      }
    } else {
      console.log('⚠️ Unhandled event type:', stripeEvent.type);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true }),
    };
  } catch (err) {
    console.error('❌ Webhook Error:', err.message);
    return {
      statusCode: 400,
      body: `Webhook Error: ${err.message}`,
    };
  }
};
