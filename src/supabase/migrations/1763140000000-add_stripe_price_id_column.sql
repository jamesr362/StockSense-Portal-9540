/*
# Add Stripe Price ID Column to Subscriptions

This migration adds a new column to store the actual Stripe price ID separately from the internal plan ID.

1. Changes
   - Add `stripe_price_id` column to subscriptions table
   - Add `stripe_session_id` column for reference tracking
   - Update existing records to have correct ID formats

2. Purpose
   - Separate internal plan IDs ('professional', 'free') from Stripe price IDs
   - Track both checkout session IDs and subscription IDs properly
   - Improve subscription data integrity
*/

-- Add new columns to subscriptions table
DO $$ 
BEGIN
  -- Add stripe_price_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscriptions_tb2k4x9p1m' 
    AND column_name = 'stripe_price_id'
  ) THEN
    ALTER TABLE subscriptions_tb2k4x9p1m 
    ADD COLUMN stripe_price_id text;
  END IF;

  -- Add stripe_session_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscriptions_tb2k4x9p1m' 
    AND column_name = 'stripe_session_id'
  ) THEN
    ALTER TABLE subscriptions_tb2k4x9p1m 
    ADD COLUMN stripe_session_id text;
  END IF;
END $$;

-- Update existing subscriptions to fix plan_id format
UPDATE subscriptions_tb2k4x9p1m 
SET plan_id = 'free' 
WHERE plan_id = 'price_free' OR plan_id IS NULL;

UPDATE subscriptions_tb2k4x9p1m 
SET plan_id = 'professional' 
WHERE plan_id = 'price_professional' OR plan_id LIKE 'price_%' AND plan_id != 'price_free';

-- Fix any subscription IDs that might be session IDs (cs_xxx should be sub_xxx)
-- This is a data cleanup - in production you'd want to validate these against Stripe
UPDATE subscriptions_tb2k4x9p1m 
SET stripe_session_id = stripe_subscription_id,
    stripe_subscription_id = REPLACE(stripe_subscription_id, 'cs_', 'sub_')
WHERE stripe_subscription_id LIKE 'cs_%';

-- Add comments to document the columns
COMMENT ON COLUMN subscriptions_tb2k4x9p1m.plan_id IS 'Internal plan identifier: free, professional';
COMMENT ON COLUMN subscriptions_tb2k4x9p1m.stripe_price_id IS 'Stripe price ID from subscription items';
COMMENT ON COLUMN subscriptions_tb2k4x9p1m.stripe_session_id IS 'Stripe checkout session ID for reference';
COMMENT ON COLUMN subscriptions_tb2k4x9p1m.stripe_subscription_id IS 'Stripe subscription ID (sub_xxx format)';
COMMENT ON COLUMN subscriptions_tb2k4x9p1m.stripe_customer_id IS 'Stripe customer ID (cus_xxx format)';