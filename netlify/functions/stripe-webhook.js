import Stripe from "stripe";
import { buffer } from "micro";
import { createClient } from "@supabase/supabase-js";

// ✅ Disable body parsing so Stripe signature works
export const config = {
  api: {
    bodyParser: false,
  },
};

// ✅ Initialize Stripe & Supabase
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    // ✅ Use raw body for signature verification
    const buf = await buffer(req);
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
    console.log("📦 Stripe webhook event received:", event.type);
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // ✅ Handle successful checkout
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const email =
      session.customer_details?.email ||
      session.customer_email ||
      session.metadata?.email;

    console.log("💰 Payment successful for email:", email);
    console.log("📄 Full session object for debugging:", JSON.stringify(session, null, 2));

    if (!email) {
      console.warn("⚠️ No email found in session data");
      return res.status(200).send("No email found in session");
    }

    // ✅ Update Supabase table
    const { error } = await supabase
      .from("users_tb2k4x9p1m")
      .update({ plan: "Professional" })
      .eq("email", email);

    if (error) {
      console.error("❌ Supabase update failed:", error);
      return res.status(500).send("Supabase update failed");
    }

    console.log("✅ User upgraded to Professional:", email);
  } else {
    console.log("⚠️ Unhandled event type:", event.type);
  }

  res.status(200).send("OK");
};

