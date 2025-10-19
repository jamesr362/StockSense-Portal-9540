/*
# Enhanced receipts table with scanned items

This migration enhances the receipts table to store extracted items and metadata from receipt scanning.

## 1. Enhanced Tables

- ### `receipts` (enhanced)
  - `scanned_items` (jsonb): Array of items extracted from the receipt with name, quantity, price
  - `total_items` (integer): Count of items extracted
  - `scan_status` (text): Status of the OCR scan (pending, completed, failed)
  - `ocr_text` (text): Raw OCR text extracted from receipt
  - `file_size` (integer): Size of uploaded file in bytes
  - `mime_type` (text): MIME type of uploaded file
  - `updated_at` (timestamptz): Last update timestamp

## 2. Security

- Row Level Security remains enabled
- Existing policies continue to apply
*/

-- Add new columns to receipts table
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'receipts' AND column_name = 'scanned_items'
  ) THEN
    ALTER TABLE receipts ADD COLUMN scanned_items JSONB DEFAULT '[]'::jsonb;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'receipts' AND column_name = 'total_items'
  ) THEN
    ALTER TABLE receipts ADD COLUMN total_items INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'receipts' AND column_name = 'scan_status'
  ) THEN
    ALTER TABLE receipts ADD COLUMN scan_status TEXT DEFAULT 'pending';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'receipts' AND column_name = 'ocr_text'
  ) THEN
    ALTER TABLE receipts ADD COLUMN ocr_text TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'receipts' AND column_name = 'file_size'
  ) THEN
    ALTER TABLE receipts ADD COLUMN file_size INTEGER;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'receipts' AND column_name = 'mime_type'
  ) THEN
    ALTER TABLE receipts ADD COLUMN mime_type TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'receipts' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE receipts ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS receipts_user_id_created_at_idx ON receipts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS receipts_scan_status_idx ON receipts(scan_status);

-- Add policy for updating receipts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'receipts' 
    AND policyname = 'Users can update their own receipts'
  ) THEN
    CREATE POLICY "Users can update their own receipts"
    ON receipts
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id);
  END IF;
END $$;