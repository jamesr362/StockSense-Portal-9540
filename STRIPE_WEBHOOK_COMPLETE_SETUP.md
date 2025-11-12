# 🎯 COMPLETE STRIPE WEBHOOK SETUP GUIDE

## 🚨 CRITICAL ISSUE IDENTIFIED
Your Stripe webhook is NOT configured in the Stripe Dashboard, which is why cancellations aren't reflecting in Stripe.

## 📋 STEP-BY-STEP SETUP CHECKLIST

### 1. **Configure Stripe Webhook in Dashboard**

1. **Go to Stripe Dashboard**: https://dashboard.stripe.com/webhooks
2. **Click "Add endpoint"**
3. **Enter your webhook URL**: 
   ```
   https://gotrackio.co.uk/.netlify/functions/stripe-webhook
   ```
4. **Select events to listen to**:
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.created`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
   - ✅ `invoice.payment_succeeded`
   - ✅ `invoice.payment_failed`

5. **Click "Add endpoint"**
6. **Copy the "Signing secret"** (starts with `whsec_`)

### 2. **Add Environment Variables to Netlify**

Go to your Netlify dashboard → Site settings → Environment variables:

```bash
# Required Stripe Variables
STRIPE_SECRET_KEY=sk_test_... (or sk_live_... for production)
STRIPE_WEBHOOK_SECRET=whsec_... (from step 1.6 above)

# Required Supabase Variables  
VITE_SUPABASE_URL=https://xnfxcsdsjxgiewrssgrn.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. **Test the Webhook**

1. **Create a test subscription** through your app
2. **Check Netlify Functions logs**:
   - Go to Netlify Dashboard → Functions → stripe-webhook
   - Look for successful event processing logs
3. **Verify in Stripe Dashboard**:
   - Go to Webhooks → Your endpoint
   - Check "Recent deliveries" for successful events

### 4. **Test Subscription Cancellation**

1. **Cancel a subscription** in your app
2. **Check the following**:
   - ✅ Netlify function logs show cancellation
   - ✅ Stripe Dashboard shows subscription as canceled
   - ✅ Your database shows `status: 'canceled'`
   - ✅ UI reflects the cancellation

## 🔧 CURRENT CODE STATUS

Your code is **CORRECT** and ready to work! The webhook handler properly:
- ✅ Extracts correct Stripe IDs (`sub_xxx`, `cus_xxx`)
- ✅ Handles all subscription events
- ✅ Updates Supabase database correctly
- ✅ Validates webhook signatures

## 🚨 WHY IT'S NOT WORKING NOW

**The webhook is NOT configured in Stripe Dashboard**, so:
1. When you cancel via UI → Netlify function is called ✅
2. Netlify function cancels in Stripe ✅
3. **But Stripe doesn't send webhook events back** ❌
4. **So your database is never updated** ❌
5. **UI still shows "active" on refresh** ❌

## ✅ EXPECTED RESULTS AFTER SETUP

After configuring the webhook:
1. **New subscriptions**: Webhook fires → Database updated ✅
2. **Cancellations**: UI cancels → Stripe cancels → Webhook fires → Database updated ✅
3. **Status sync**: Database always matches Stripe ✅
4. **Real-time updates**: Changes reflect immediately ✅

## 🎯 VERIFICATION STEPS

### Test New Subscription:
```bash
# Check Netlify logs for:
✅ "Received event type: checkout.session.completed"
✅ "Subscription created/updated for user email@example.com"
✅ "Stripe Customer ID: cus_xxx"
✅ "Stripe Subscription ID: sub_xxx"
```

### Test Cancellation:
```bash
# Check Netlify logs for:
✅ "Received event type: customer.subscription.updated"
✅ "Subscription sub_xxx updated to canceled"
```

### Check Database:
```sql
SELECT user_email, stripe_customer_id, stripe_subscription_id, status 
FROM subscriptions_tb2k4x9p1m 
WHERE user_email = 'your@email.com';

-- Should show:
-- stripe_customer_id: cus_xxx (not null)
-- stripe_subscription_id: sub_xxx (not cs_xxx)
-- status: 'canceled' (after cancellation)
```

## 🚨 TROUBLESHOOTING

### If webhook still not working:

1. **Check webhook URL is accessible**:
   ```bash
   curl -X POST https://gotrackio.co.uk/.netlify/functions/stripe-webhook
   # Should return 400 (webhook signature verification failed) - this is GOOD
   ```

2. **Check environment variables**:
   - Netlify Dashboard → Site settings → Environment variables
   - Verify `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are set

3. **Check Stripe Dashboard**:
   - Webhooks → Your endpoint → Recent deliveries
   - Look for failed deliveries and error messages

4. **Check Netlify Function logs**:
   - Netlify Dashboard → Functions → stripe-webhook
   - Look for error messages during event processing

## 🎉 SUCCESS INDICATORS

You'll know it's working when:
- ✅ Netlify logs show successful webhook processing
- ✅ Stripe Dashboard webhook shows successful deliveries
- ✅ Database updates reflect subscription changes
- ✅ UI shows accurate subscription status
- ✅ Cancellations work and persist after page refresh

## 📞 SUPPORT

If you're still having issues after following this guide:
1. Check Netlify function logs for specific error messages
2. Verify webhook endpoint is receiving events in Stripe Dashboard
3. Ensure environment variables are correctly set in Netlify
4. Test with a simple webhook event first (like checkout.session.completed)

The core issue is **missing webhook configuration in Stripe Dashboard**. Once that's set up, everything should work perfectly!