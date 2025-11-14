/*
# Fix Subscription Plan IDs and Data Integrity

This migration fixes the subscription plan ID storage to use internal plan IDs
instead of Stripe price IDs, and ensures proper data integrity.

1. Data Fixes
   - Convert Stripe price IDs to internal plan IDs ('professional', 'free')
   - Fix any incorrectly stored subscription IDs
   - Clean up duplicate entries

2. Schema Updates
   - Ensure proper column constraints
   - Add indexes for better performance
   - Update comments for clarity
*/

-- Fix plan_id values: convert Stripe price IDs to internal plan IDs
UPDATE subscriptions_tb2k4x9p1m 
SET plan_id = CASE 
  WHEN plan_id LIKE '%professional%' OR plan_id LIKE '%pro%' THEN 'professional'
  WHEN plan_id LIKE '%free%' OR plan_id LIKE '%basic%' OR plan_id IS NULL THEN 'free'
  WHEN plan_id = 'price_1RxEcJEw1FLYKy8h3FDMZ6QP' THEN 'professional' -- Your actual price ID
  ELSE 'professional' -- Default for paid subscriptions
END
WHERE plan_id != 'professional' AND plan_id != 'free';

-- Fix any subscription IDs that might be session IDs (cs_xxx should be sub_xxx)
-- Only update if they look like session IDs
UPDATE subscriptions_tb2k4x9p1m 
SET stripe_session_id = stripe_subscription_id,
    stripe_subscription_id = NULL
WHERE stripe_subscription_id LIKE 'cs_%';

-- Clean up any obviously fake or demo subscription IDs for free plans
UPDATE subscriptions_tb2k4x9p1m 
SET stripe_subscription_id = NULL,
    stripe_customer_id = NULL
WHERE plan_id = 'free' 
  AND (stripe_subscription_id LIKE 'sub_demo_%' 
       OR stripe_subscription_id LIKE 'cus_demo_%'
       OR stripe_customer_id LIKE 'cus_demo_%');

-- Remove duplicate subscriptions (keep the most recent one for each user)
WITH ranked_subscriptions AS (
  SELECT id,
         user_email,
         ROW_NUMBER() OVER (
           PARTITION BY user_email 
           ORDER BY updated_at DESC, created_at DESC
         ) as rn
  FROM subscriptions_tb2k4x9p1m
)
DELETE FROM subscriptions_tb2k4x9p1m 
WHERE id IN (
  SELECT id 
  FROM ranked_subscriptions 
  WHERE rn > 1
);

-- Add index on user_email for better performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_email 
ON subscriptions_tb2k4x9p1m(user_email);

-- Add index on stripe_subscription_id for webhook lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id 
ON subscriptions_tb2k4x9p1m(stripe_subscription_id);

-- Add index on plan_id and status for analytics
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_status 
ON subscriptions_tb2k4x9p1m(plan_id, status);

-- Update column comments for clarity
COMMENT ON COLUMN subscriptions_tb2k4x9p1m.plan_id IS 'Internal plan identifier: "free" or "professional" (NOT Stripe price IDs)';
COMMENT ON COLUMN subscriptions_tb2k4x9p1m.stripe_price_id IS 'Actual Stripe price ID from subscription items (e.g., price_1RxEcJ...)';
COMMENT ON COLUMN subscriptions_tb2k4x9p1m.stripe_subscription_id IS 'Stripe subscription ID (sub_xxx format) - NULL for free plans';
COMMENT ON COLUMN subscriptions_tb2k4x9p1m.stripe_customer_id IS 'Stripe customer ID (cus_xxx format) - NULL for free plans';
COMMENT ON COLUMN subscriptions_tb2k4x9p1m.stripe_session_id IS 'Stripe checkout session ID (cs_xxx format) for reference';

-- Add check constraint to ensure plan_id is valid
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'subscriptions_tb2k4x9p1m' 
    AND constraint_name = 'subscriptions_plan_id_check'
  ) THEN
    ALTER TABLE subscriptions_tb2k4x9p1m 
    ADD CONSTRAINT subscriptions_plan_id_check 
    CHECK (plan_id IN ('free', 'professional'));
  END IF;
END $$;

-- Verify the fixes
DO $$
DECLARE
  professional_count INTEGER;
  free_count INTEGER;
  invalid_plan_count INTEGER;
  cs_subscription_count INTEGER;
BEGIN
  -- Count subscriptions by plan
  SELECT COUNT(*) INTO professional_count 
  FROM subscriptions_tb2k4x9p1m 
  WHERE plan_id = 'professional';
  
  SELECT COUNT(*) INTO free_count 
  FROM subscriptions_tb2k4x9p1m 
  WHERE plan_id = 'free';
  
  -- Check for any invalid plan IDs
  SELECT COUNT(*) INTO invalid_plan_count 
  FROM subscriptions_tb2k4x9p1m 
  WHERE plan_id NOT IN ('free', 'professional');
  
  -- Check for any cs_ IDs in subscription ID field
  SELECT COUNT(*) INTO cs_subscription_count 
  FROM subscriptions_tb2k4x9p1m 
  WHERE stripe_subscription_id LIKE 'cs_%';
  
  -- Log the results
  RAISE NOTICE 'Migration verification:';
  RAISE NOTICE '  Professional subscriptions: %', professional_count;
  RAISE NOTICE '  Free subscriptions: %', free_count;
  RAISE NOTICE '  Invalid plan IDs: %', invalid_plan_count;
  RAISE NOTICE '  CS IDs in subscription field: %', cs_subscription_count;
  
  IF invalid_plan_count > 0 OR cs_subscription_count > 0 THEN
    RAISE WARNING 'Data integrity issues detected - manual review required';
  ELSE
    RAISE NOTICE '  ✅ All subscription data is now properly formatted';
  END IF;
END $$;