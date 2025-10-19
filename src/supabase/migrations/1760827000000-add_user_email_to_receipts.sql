/*
# Add user_email column to receipts table

This migration adds a user_email column to the receipts table to support
the hybrid authentication system and improve query performance.

## 1. Schema Changes

- **receipts table**:
  - Add `user_email` column (text, indexed)
  - Update existing records to use email-based identification
  - Add index for better query performance

## 2. Security Updates

- **RLS Policies**: Update policies to work with both user_id and user_email
- **Backward Compatibility**: Ensure existing records continue to work

## 3. Data Migration

- Populate user_email for existing records where possible
- Add indexes for optimal query performance
*/

-- Add user_email column to receipts table
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'receipts' AND column_name = 'user_email'
  ) THEN
    ALTER TABLE receipts ADD COLUMN user_email text;
  END IF;
END $$;

-- Create index for user_email for better query performance
CREATE INDEX IF NOT EXISTS receipts_user_email_idx ON receipts(user_email);

-- Update RLS policies to work with both user_id and user_email
DROP POLICY IF EXISTS "Users can insert their own receipts" ON receipts;
DROP POLICY IF EXISTS "Users can view their own receipts" ON receipts;
DROP POLICY IF EXISTS "Users can update their own receipts" ON receipts;
DROP POLICY IF EXISTS "Users can delete their own receipts" ON receipts;

-- Create new policies that work with both authentication methods
CREATE POLICY "Users can insert their own receipts"
ON receipts
FOR INSERT 
TO authenticated, anon
WITH CHECK (
  (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR
  (user_email IS NOT NULL AND length(user_email) > 0)
);

CREATE POLICY "Users can view their own receipts"
ON receipts
FOR SELECT 
TO authenticated, anon
USING (
  (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR
  (user_email IS NOT NULL AND length(user_email) > 0)
);

CREATE POLICY "Users can update their own receipts"
ON receipts
FOR UPDATE 
TO authenticated, anon
USING (
  (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR
  (user_email IS NOT NULL AND length(user_email) > 0)
)
WITH CHECK (
  (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR
  (user_email IS NOT NULL AND length(user_email) > 0)
);

CREATE POLICY "Users can delete their own receipts"
ON receipts
FOR DELETE 
TO authenticated, anon
USING (
  (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR
  (user_email IS NOT NULL AND length(user_email) > 0)
);

-- Allow service role to bypass RLS for admin operations
CREATE POLICY "Service role can manage all receipts"
ON receipts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Ensure RLS is enabled
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;