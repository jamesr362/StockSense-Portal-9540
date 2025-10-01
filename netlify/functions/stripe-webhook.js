exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  console.log("📦 Stripe webhook event:", event.body);

  return {
    statusCode: 200,
    body: "✅ Webhook received",
  };
};

