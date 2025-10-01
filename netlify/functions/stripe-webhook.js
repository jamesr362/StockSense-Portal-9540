import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-06-30.basil",
});

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const sig = event.headers["stripe-signature"];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Webhook signature verification failed.", err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  console.log("📦 Stripe webhook event received:", stripeEvent.type);

  switch (stripeEvent.type) {
    case "checkout.session.completed":
      const session = stripeEvent.data.object;

      console.log("💳 Checkout session completed:", session);

      // Insert subscription into Supabase
      const { data, error } = await supabase.from("subscriptions").insert([
        {
          customer_id: session.customer,
          subscription_id: session.subscription,
          email: session.customer_details?.email || null,
          name: session.customer_details?.name || null,
          amount: session.amount_total,
          currency: session.currency,
          status: "active",
        },
      ]);

      if (error) {
        console.error("❌ Supabase insert error:", error.message);
        return { statusCode: 500, body: "Database insert failed" };
      }

      console.log("✅ Subscription saved in Supabase:", data);
      break;

    default:
      console.log(`⚠️ Unhandled event type: ${stripeEvent.type}`);
  }

  return {
    statusCode: 200,
    body: "✅ Webhook received",
  };
};
