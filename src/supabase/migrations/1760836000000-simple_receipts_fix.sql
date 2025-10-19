-- Simple receipts table setup that will work in Supabase migration system
-- This replaces all previous complex migration files

-- Drop existing table if it exists
DROP TABLE IF EXISTS receipts CASCADE;

-- Create receipts table with all required columns
CREATE TABLE receipts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email text NOT NULL,
    storage_path text NOT NULL,
    file_name text NOT NULL,
    file_size bigint,
    mime_type text,
    scanned_items jsonb DEFAULT '[]'::jsonb,
    total_items integer DEFAULT 0,
    scan_status text DEFAULT 'completed',
    ocr_text text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX idx_receipts_user_email ON receipts(user_email);
CREATE INDEX idx_receipts_created_at ON receipts(created_at DESC);

-- Enable RLS
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

-- Create simple, permissive policies that work with custom auth
CREATE POLICY "receipts_policy" ON receipts FOR ALL USING (true) WITH CHECK (true);

-- Grant necessary permissions
GRANT ALL ON receipts TO authenticated;
GRANT ALL ON receipts TO anon;
GRANT ALL ON receipts TO service_role;

-- Create RPC function to bypass RLS if needed
CREATE OR REPLACE FUNCTION insert_receipt_bypass_rls(
  p_user_email TEXT,
  p_storage_path TEXT,
  p_file_name TEXT,
  p_file_size INTEGER DEFAULT NULL,
  p_mime_type TEXT DEFAULT NULL,
  p_scanned_items JSONB DEFAULT '[]'::jsonb,
  p_total_items INTEGER DEFAULT 0,
  p_scan_status TEXT DEFAULT 'completed',
  p_ocr_text TEXT DEFAULT NULL
)
RETURNS receipts
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_record receipts;
BEGIN
  INSERT INTO receipts (
    user_email, storage_path, file_name, file_size, mime_type,
    scanned_items, total_items, scan_status, ocr_text
  ) VALUES (
    p_user_email, p_storage_path, p_file_name, p_file_size, p_mime_type,
    p_scanned_items, p_total_items, p_scan_status, p_ocr_text
  ) RETURNING * INTO new_record;
  
  RETURN new_record;
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION insert_receipt_bypass_rls TO authenticated;
GRANT EXECUTE ON FUNCTION insert_receipt_bypass_rls TO anon;
GRANT EXECUTE ON FUNCTION insert_receipt_bypass_rls TO service_role;