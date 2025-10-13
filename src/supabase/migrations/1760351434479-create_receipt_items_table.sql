/*
# Create receipt_items table

This migration introduces the `receipt_items` table to store individual items parsed from a receipt. It links items to a specific receipt and user.

## 1. New Tables
- ### `receipt_items`
  - `id` (bigint, primary key): Unique identifier for each item.
  - `created_at` (timestamptz): Timestamp of when the item was created.
  - `receipt_id` (bigint): Foreign key referencing `receipts.id`.
  - `user_id` (uuid): Foreign key referencing `auth.users(id)`.
  - `name` (text): Name of the item.
  - `quantity` (integer): Quantity of the item.
  - `price` (numeric): Price of the item.

## 2. Security
- **Row Level Security (RLS)** is enabled on `receipt_items`.
- **Policies**:
  - **Insert**: Authenticated users can insert items for their own receipts.
  - **Select**: Authenticated users can select their own items.
  - **Update**: Authenticated users can update their own items.
  - **Delete**: Authenticated users can delete their own items.
*/

CREATE TABLE IF NOT EXISTS receipt_items (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  receipt_id BIGINT REFERENCES receipts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0.00
);

ALTER TABLE receipt_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert items for their own receipts"
ON receipt_items
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own receipt items"
ON receipt_items
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own receipt items"
ON receipt_items
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own receipt items"
ON receipt_items
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt_id ON receipt_items(receipt_id);
CREATE INDEX IF NOT EXISTS idx_receipt_items_user_id ON receipt_items(user_id);