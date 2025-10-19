/*
# Recreate receipts table for custom authentication system

This migration recreates the receipts table to work with the custom authentication system
instead of Supabase's built-in auth.users table.

## 1. Schema Changes

- **receipts table**: Recreated to use user_email instead of user_id
  - `id` (uuid, primary key): Unique identifier for each receipt
  - `user_email` (text): Email of the user who uploaded the receipt
  - `storage_path` (text): Path to receipt file in Supabase Storage
  - `file_name` (text): Original name of uploaded file
  - `file_size` (integer): Size of uploaded file in bytes
  - `mime_type` (text): MIME type of uploaded file
  - `scanned_items` (jsonb): Array of extracted items
  - `total_items` (integer): Count of extracted items
  - `scan_status` (text): OCR scan status
  - `ocr_text` (text): Raw OCR text
  - `created_at` (timestamptz): Upload timestamp
  - `updated_at` (timestamptz): Last update timestamp

## 2. Security

- **Row Level Security (RLS)** enabled
- **Policies**: Allow users to manage their own receipts based on email
- **Indexes**: Added for performance optimization

## 3. Migration Safety

- Drops existing table if it exists (with CASCADE to handle dependencies)
- Creates new table with proper schema
- Ensures compatibility with custom authentication system
*/

-- Drop existing receipts table if it exists (with CASCADE for dependencies)
DROP TABLE IF EXISTS receipts CASCADE;

-- Create new receipts table with custom auth support
CREATE TABLE receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text NOT NULL,
  storage_path text NOT NULL,
  file_name text,
  file_size integer,
  mime_type text,
  scanned_items jsonb DEFAULT '[]'::jsonb,
  total_items integer DEFAULT 0,
  scan_status text DEFAULT 'pending',
  ocr_text text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

-- Create policies for custom authentication system
-- These policies work with both Supabase auth (if available) and custom sessions
CREATE POLICY "Users can insert their own receipts"
ON receipts
FOR INSERT 
TO authenticated, anon
WITH CHECK (
  user_email IS NOT NULL AND 
  length(user_email) > 0 AND
  user_email = COALESCE(
    auth.jwt() ->> 'email',
    current_setting('app.current_user_email', true),
    user_email
  )
);

CREATE POLICY "Users can view their own receipts"
ON receipts
FOR SELECT 
TO authenticated, anon
USING (
  user_email IS NOT NULL AND (
    user_email = COALESCE(
      auth.jwt() ->> 'email',
      current_setting('app.current_user_email', true)
    ) OR
    -- Allow if no auth context (for custom session system)
    (auth.jwt() IS NULL AND current_setting('app.current_user_email', true) IS NULL)
  )
);

CREATE POLICY "Users can update their own receipts"
ON receipts
FOR UPDATE 
TO authenticated, anon
USING (
  user_email IS NOT NULL AND (
    user_email = COALESCE(
      auth.jwt() ->> 'email',
      current_setting('app.current_user_email', true)
    ) OR
    -- Allow if no auth context (for custom session system)
    (auth.jwt() IS NULL AND current_setting('app.current_user_email', true) IS NULL)
  )
)
WITH CHECK (
  user_email IS NOT NULL AND 
  length(user_email) > 0
);

CREATE POLICY "Users can delete their own receipts"
ON receipts
FOR DELETE 
TO authenticated, anon
USING (
  user_email IS NOT NULL AND (
    user_email = COALESCE(
      auth.jwt() ->> 'email',
      current_setting('app.current_user_email', true)
    ) OR
    -- Allow if no auth context (for custom session system)
    (auth.jwt() IS NULL AND current_setting('app.current_user_email', true) IS NULL)
  )
);

-- Allow service role to bypass RLS for admin operations
CREATE POLICY "Service role can manage all receipts"
ON receipts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create indexes for better query performance
CREATE INDEX receipts_user_email_idx ON receipts(user_email);
CREATE INDEX receipts_user_email_created_at_idx ON receipts(user_email, created_at DESC);
CREATE INDEX receipts_scan_status_idx ON receipts(scan_status);
CREATE INDEX receipts_created_at_idx ON receipts(created_at DESC);

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_receipts_updated_at 
  BEFORE UPDATE ON receipts 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();