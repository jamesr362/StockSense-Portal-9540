/*
# Create receipts table

This migration creates a new table to store uploaded receipt images and sets up security policies.

## 1. New Tables

- ### `receipts`
  - `id` (bigint, primary key): A unique identifier for each receipt.
  - `created_at` (timestamptz): The timestamp of when the receipt was uploaded.
  - `user_id` (uuid): A foreign key referencing the `id` in the `auth.users` table, linking the receipt to a user.
  - `storage_path` (text): The path to the receipt file in Supabase Storage.
  - `file_name` (text): The original name of the uploaded receipt file.

## 2. Security

- **Row Level Security (RLS)** is enabled on the `receipts` table to ensure data privacy.
- **Policies**:
  - **Insert**: Users can only insert receipts linked to their own `user_id`.
  - **Select**: Users can only retrieve receipts that they have uploaded.
*/

CREATE TABLE IF NOT EXISTS receipts (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT
);

ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own receipts"
ON receipts
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own receipts"
ON receipts
FOR SELECT TO authenticated
USING (auth.uid() = user_id);