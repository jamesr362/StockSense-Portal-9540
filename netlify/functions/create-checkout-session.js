import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// Initialise Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-06-30.acacia", // Use a stable API version
});

// Initialise Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export const handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    // Pull email + userId from your frontend
    const { email, userId } = JSON.parse(event.body);

    // Create a Checkout Session with user_id metadata
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [
        {
          // your Stripe price ID
          price: "price_1RxEcJEw1FLYKy8h3FDMZ6QP",
          quantity: 1,
        },
      ],
      customer_email: email,
      metadata: {
        user_id: userId, // 👈 This tells the webhook which Supabase user to upgrade
      },
      success_url: `https://gotrackio.netlify.app/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://gotrackio.netlify.app/cancel`,
    });

    // (Optional) Save the session in Supabase for record-keeping
    await supabase.from("checkout_sessions").insert([
      {
        email,
        session_id: session.id,
        status: "created",
        user_id: userId,
      },
    ]);

    return {
      statusCode: 200,
      body: JSON.stringify({ sessionId: session.id }),
    };
  } catch (err) {
    console.error("❌ Error creating checkout session:", err);
    return { statusCode: 500, body: "Internal Server Error" };
  }
};
