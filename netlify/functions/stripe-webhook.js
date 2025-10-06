import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export const handler = async (event) => {
  try {
    const sig = event.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let stripeEvent;
    try {
      stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err.message);
      return { statusCode: 400, body: `Webhook Error: ${err.message}` };
    }

    console.log(`📦 Stripe webhook event received: ${stripeEvent.type}`);

    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object;

      // Try every possible email field Stripe might send
      const customerEmail =
        session.customer_email ||
        session.customer_details?.email ||
        session.metadata?.email ||
        null;

      console.log('💰 Payment successful for email:', customerEmail);
      console.log('📄 Full session object for debugging:', JSON.stringify(session, null, 2));

      if (!customerEmail) {
        console.log('⚠️ No email found — cannot update user plan.');
        return { statusCode: 200, body: 'No email found in session' };
      }

      // Update your specific Supabase table and column
      const { data, error } = await supabase
        .from('users_tb2k4x9p1m') // 👈 your table name
        .update({ plan: 'professional' }) // 👈 change 'plan' to your column name if needed
        .eq('email', customerEmail.toLowerCase());

      if (error) {
        console.error('❌ Supabase update error:', error);
        return { statusCode: 500, body: JSON.stringify(error) };
      }

      console.log('✅ User upgraded to Professional:', customerEmail);
    } else {
      console.log(`⚠️ Unhandled event type: ${stripeEvent.type}`);
    }

    return { statusCode: 200, body: 'Success' };
  } catch (err) {
    console.error('❌ Webhook handler failed:', err);
    return { statusCode: 500, body: err.message };
  }
};
