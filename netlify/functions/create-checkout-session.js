import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

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

  const { email, userId } = JSON.parse(event.body);

  try {
    // Create a Stripe Checkout Session for the professional plan
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [
        {
          price: "price_1RxEcJEw1FLYKy8h3FDMZ6QP", // your professional plan price
          quantity: 1,
        },
      ],
      customer_email: email,
      metadata: {
        user_id: userId, // links the payment to a specific user
      },
      success_url: `https://gotrackio.netlify.app/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://gotrackio.netlify.app/cancel`,
    });

    // Save checkout session in Supabase (optional)
    await supabase.from("checkout_sessions").insert([
      { email, session_id: session.id, user_id: userId, status: "created" },
    ]);

    return {
      statusCode: 200,
      body: JSON.stringify({ sessionId: session.id }),
    };
  } catch (err) {
    console.error("❌ Checkout session error:", err);
    return { statusCode: 500, body: "Internal Server Error" };
  }
};
