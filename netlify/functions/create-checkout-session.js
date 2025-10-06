import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-06-30.basil",
});

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // Parse the request body
  const { email, userId } = JSON.parse(event.body);

  try {
    // ✅ Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [
        {
          price: "price_1RxEcJEw1FLYKy8h3FDMZ6QP", // 👈 your Professional Plan price ID
          quantity: 1,
        },
      ],
      customer_email: email,
      metadata: {
        user_id: userId, // 👈 this links the Stripe payment back to your Supabase user
      },
      success_url: `https://gotrackio.netlify.app/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://gotrackio.netlify.app/cancel`,
    });

    // ✅ Save session info in Supabase (optional but useful)
    await supabase.from("checkout_sessions").insert([
      { email, session_id: session.id, status: "created" },
    ]);

    // ✅ Return the session ID to the frontend
    return {
      statusCode: 200,
      body: JSON.stringify({ sessionId: session.id }),
    };
  } catch (err) {
    console.error("❌ Stripe Checkout error:", err);
    return { statusCode: 500, body: "Internal Server Error" };
  }
};

