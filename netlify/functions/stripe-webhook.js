import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// ✅ Initialize Stripe and Supabase
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const handler = async (event, context) => {
  // Stripe signature header
  const sig = event.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // ✅ IMPORTANT: Use raw body (not parsed JSON)
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    console.log("📦 Stripe webhook event received:", stripeEvent.type);
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return {
      statusCode: 400,
      body: `Webhook Error: ${err.message}`,
    };
  }

  // ✅ Handle payment success
  if (stripeEvent.type === "checkout.session.completed") {
    const session = stripeEvent.data.object;
    const email =
      session.customer_details?.email ||
      session.customer_email ||
      session.metadata?.email;

    console.log("💰 Payment successful for email:", email);
    console.log("📄 Full session:", JSON.stringify(session, null, 2));

    if (!email) {
      console.warn("⚠️ No email found in session data");
      return { statusCode: 200, body: "No email found" };
    }

    const { error } = await supabase
      .from("users_tb2k4x9p1m")
      .update({ plan: "Professional" })
      .eq("email", email.toLowerCase());

    if (error) {
      console.error("❌ Supabase update failed:", error);
      return { statusCode: 500, body: "Supabase update failed" };
    }

    console.log("✅ User upgraded to Professional:", email);
  } else {
    console.log("⚠️ Unhandled event type:", stripeEvent.type);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ received: true }),
  };
};
