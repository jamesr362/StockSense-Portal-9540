# Trackio - Inventory Management System

## Stripe Payment Integration

This application includes a comprehensive Stripe payment integration for handling Professional plan subscriptions. Here's how it works:

### 🔧 Backend Setup Required

To enable live payment verification, you need to deploy the webhook endpoint:

#### 1. Deploy Webhook Endpoint

Choose one of these deployment options:

**Option A: Vercel (Recommended)**
```bash
# Deploy the webhook as a Vercel function
# Place the webhook code in: /api/stripe/webhook.js
# Set environment variables in Vercel dashboard
```

**Option B: Netlify Functions**
```bash
# Deploy as Netlify function
# Place webhook code in: /.netlify/functions/stripe-webhook.js
```

**Option C: Express.js Server**
```bash
# Run your own Express.js server with the webhook endpoint
npm install express stripe @supabase/supabase-js
```

#### 2. Environment Variables

Set these environment variables in your deployment:

```env
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

#### 3. Configure Stripe Webhook

1. Go to your Stripe Dashboard → Webhooks
2. Add endpoint: `https://your-domain.com/api/stripe/webhook`
3. Select these events:
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

### 🔄 How Payment Verification Works

#### Frontend Flow:
1. User completes payment on Stripe
2. Stripe redirects back with payment parameters
3. `PaymentStatusHandler` detects the return and starts verification
4. Multiple verification methods are attempted:
   - Direct API verification (if session ID available)
   - Polling for subscription updates
   - Real-time Supabase subscriptions

#### Backend Flow:
1. Stripe webhook sends event to your endpoint
2. Webhook verifies signature and processes event
3. Subscription data is updated in Supabase
4. Frontend receives real-time updates

### 🧪 Testing

#### Test Mode (Current Setup):
- Uses Stripe test keys
- Payment links work but don't process real payments
- Webhook events can be simulated

#### Production Mode:
- Replace test keys with live Stripe keys
- Deploy webhook endpoint to production
- Configure live webhook in Stripe dashboard

### 📱 Features

- **Real-time verification** - Instant subscription updates
- **Fallback polling** - Ensures updates are caught even if webhooks fail
- **Error handling** - Graceful handling of payment failures
- **Security** - Webhook signature verification and secure credential handling
- **User feedback** - Clear status messages and progress indicators

### 🔒 Security

- Webhook signatures are verified
- Sensitive credentials are stored server-side
- All database updates use row-level security
- Payment parameters are cleaned from URLs after processing

### 🚀 Getting Started

1. Set up your Stripe account and get API keys
2. Deploy the webhook endpoint (see options above)
3. Configure environment variables
4. Update the Stripe payment links in your application
5. Test with Stripe test cards

The application will automatically handle payment verification and subscription activation once the backend is properly configured!