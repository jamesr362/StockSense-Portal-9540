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

  // Get the customer's email
  const email = session.customer_email;

  console.log("💰 Payment successful for:", email);

  // Update the user's plan to 'professional'
  const { data, error } = await supabase
    .from("users_tb2k4x9p1m")
    .update({ plan: "professional" })
    .eq("email", email);

  if (error) {
    console.error("❌ Supabase update error:", error.message);
    return { statusCode: 500, body: "Database update failed" };
  }

  console.log("✅ User upgraded to Professional:", data);
  break;


    default:
      console.log(`⚠️ Unhandled event type: ${stripeEvent.type}`);
  }

  return {
    statusCode: 200,
    body: "✅ Webhook received",
  };
};
