import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-06-30.basil",
});

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
    console.error("❌ Webhook signature verification failed:", err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  console.log("📦 Stripe webhook event received:", stripeEvent.type);

  try {
    if (stripeEvent.type === "checkout.session.completed") {
      const session = stripeEvent.data.object;
      const userId = session.metadata?.user_id;

      console.log("💰 Payment successful for user:", userId);

      if (userId) {
        const { data, error } = await supabase
          .from("users_tb2k4x9p1m") // 👈 your actual table name
          .update({ plan: "Professional" })
          .eq("id", userId);

        if (error) {
          console.error("❌ Error updating user plan:", error.message);
        } else {
          console.log("✅ User upgraded to Professional:", data);
        }
      } else {
        console.warn("⚠️ No user_id found in session metadata");
      }
    } else {
      console.log(`⚠️ Unhandled event type: ${stripeEvent.type}`);
    }

    return { statusCode: 200, body: "✅ Webhook received" };
  } catch (err) {
    console.error("❌ Webhook handler error:", err);
    return { statusCode: 500, body: "Internal Server Error" };
  }
};
