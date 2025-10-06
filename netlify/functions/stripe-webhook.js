import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 🚫 Tell Netlify not to parse the body — needed for Stripe signature verification
export const config = {
  bodyParser: false,
};

export const handler = async (event, context) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = event.headers["stripe-signature"];

  // ✅ Get the raw request body (Stripe requires exact bytes)
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body, "base64")
    : Buffer.from(event.body || "");

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

  // ✅ Handle successful checkout session
  if (stripeEvent.type === "checkout.session.completed") {
    const session = stripeEvent.data.object;
    const email =
      session.customer_details?.email ||
      session.customer_email ||
      session.metadata?.email;

    console.log("💰 Payment successful for email:", email);

    if (!email) {
      return { statusCode: 200, body: "No email found in session" };
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
