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

  try {
    const { email, id } = JSON.parse(event.body); // user ID from your app (Supabase)

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [
        {
          price: "price_1RxEcJEw1FLYKy8h3FDMZ6QP", // your Stripe price ID
          quantity: 1,
        },
      ],
      customer_email: email,
      metadata: {
        user_id: id, // stored in Stripe so the webhook can link it back to Supabase
      },
      success_url: `https://gotrackio.netlify.app/?success=true`,
      cancel_url: `https://gotrackio.netlify.app/?canceled=true`,
    });

    await supabase.from("checkout_sessions").insert([
      {
        email,
        user_id: id,
        session_id: session.id,
        status: "created",
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
