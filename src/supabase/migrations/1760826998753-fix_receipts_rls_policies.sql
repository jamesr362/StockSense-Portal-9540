/*
# Fix receipts table RLS policies

This migration fixes the Row Level Security policies for the receipts table to ensure proper authentication and authorization for receipt operations.

## 1. Security Updates

- **Row Level Security (RLS)** policies updated for proper authentication
- **Policies**:
  - **Insert**: Users can insert receipts linked to their authenticated user ID
  - **Select**: Users can view their own receipts
  - **Update**: Users can update their own receipts
  - **Delete**: Users can delete their own receipts

## 2. Authentication Fix

- Ensures proper user_id matching with Supabase auth
- Handles both authenticated and service role access
*/

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Users can insert their own receipts" ON receipts;
DROP POLICY IF EXISTS "Users can view their own receipts" ON receipts;
DROP POLICY IF EXISTS "Users can update their own receipts" ON receipts;

-- Create comprehensive RLS policies for receipts table
CREATE POLICY "Users can insert their own receipts"
ON receipts
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own receipts"
ON receipts
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own receipts"
ON receipts
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own receipts"
ON receipts
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

-- Allow service role to bypass RLS for admin operations
CREATE POLICY "Service role can manage all receipts"
ON receipts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Ensure RLS is enabled
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS receipts_user_id_idx ON receipts(user_id);
CREATE INDEX IF NOT EXISTS receipts_created_at_idx ON receipts(created_at DESC);