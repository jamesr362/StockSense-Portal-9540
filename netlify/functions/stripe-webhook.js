exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let stripeEvent;

  try {
    stripeEvent = JSON.parse(event.body);
  } catch (err) {
    console.error("❌ Error parsing webhook JSON:", err);
    return { statusCode: 400, body: "Invalid JSON" };
  }

  const eventType = stripeEvent.type;
  const data = stripeEvent.data.object;

  // Only handle subscription checkout events
  if (eventType === "checkout.session.completed") {
    // Your test subscription details
    const customerId = data.customer || "cus_T48nyVPJbPVEI3";
    const subscriptionId = data.subscription || 
"sub_1S80VoEw1FLYKy8hAJdI5t1G";
    const email = data.customer_details?.email || data.customer_email || 
"james.rogan@hotmail.com";

    console.log("✅ Checkout Session Completed!");
    console.log("Customer ID:", customerId);
    console.log("Subscription ID:", subscriptionId);
    console.log("Email:", email);

    // Example: activating subscription
    console.log(`Activating subscription for ${email} (Customer ID: 
${customerId}, Subscription ID: ${subscriptionId})`);
  } else {
    console.log(`Ignored event type: ${eventType}`);
  }

  return {
    statusCode: 200,
    body: "✅ Webhook received",
  };
};

