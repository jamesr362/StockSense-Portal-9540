```javascript
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const handler = async (event) => {
  const sig = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
  } catch (err) {
    console.error(`Webhook signature verification failed.`, err.message);
    return {
      statusCode: 400,
      body: `Webhook Error: ${err.message}`,
    };
  }

  try {
    const data = stripeEvent.data.object;
    const eventType = stripeEvent.type;

    console.log(`Received event type: ${eventType}`);

    switch (eventType) {
      case 'checkout.session.completed':
        if (data.mode === 'subscription') {
          await handleSubscriptionCreation(data);
        }
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(data);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionCancellation(data);
        break;
        
      default:
        console.log(`Unhandled event type ${eventType}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true }),
    };
  } catch (error) {
    console.error('Error processing webhook:', error);
    return {
      statusCode: 500,
      body: `Webhook handler failed. View logs for details.`,
    };
  }
};

async function handleSubscriptionCreation(session) {
  const { client_reference_id: userId, customer: customerId, subscription: subscriptionId } = session;
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const { id: priceId } = subscription.items.data[0].price;

  const { data: priceData, error: priceError } = await supabase
    .from('prices')
    .select('product_id')
    .eq('id', priceId)
    .single();

  if (priceError) throw new Error(`Error fetching price: ${priceError.message}`);

  const { data: productData, error: productError } = await supabase
    .from('products')
    .select('name')
    .eq('id', priceData.product_id)
    .single();

  if (productError) throw new Error(`Error fetching product: ${productError.message}`);

  const { error: insertError } = await supabase.from('subscriptions').insert({
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    status: subscription.status,
    plan_name: productData.name,
    price_id: priceId,
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
  });

  if (insertError) throw new Error(`Error inserting subscription: ${insertError.message}`);
  
  console.log(`Subscription created for user ${userId}`);
}

async function handleSubscriptionUpdate(subscription) {
  const { id: subscriptionId, status } = subscription;
  const { error } = await supabase
    .from('subscriptions')
    .update({ status: status })
    .eq('stripe_subscription_id', subscriptionId);
  
  if (error) throw new Error(`Error updating subscription: ${error.message}`);
  
  console.log(`Subscription ${subscriptionId} updated to ${status}`);
}

async function handleSubscriptionCancellation(subscription) {
  const { id: subscriptionId } = subscription;
  const { error } = await supabase
    .from('subscriptions')
    .update({ status: 'canceled', current_period_end: new Date().toISOString() })
    .eq('stripe_subscription_id', subscriptionId);

  if (error) throw new Error(`Error canceling subscription: ${error.message}`);
  
  console.log(`Subscription ${subscriptionId} canceled.`);
}
```