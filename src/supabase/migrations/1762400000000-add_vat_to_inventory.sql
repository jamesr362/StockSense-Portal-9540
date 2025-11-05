/* 
# Add VAT Configuration to Inventory Items

This migration adds VAT (Value Added Tax) configuration fields to inventory items, allowing users to:
- Specify if VAT is included in the item price
- Set custom VAT percentage for each item
- Track VAT amounts for tax calculations

## Changes Made:

1. **New Columns Added to Inventory Table:**
   - `vat_included` (boolean) - Whether VAT is included in the unit price
   - `vat_percentage` (decimal) - VAT percentage (0-100)
   - `vat_amount` (decimal) - Calculated VAT amount per unit
   - `price_excluding_vat` (decimal) - Price without VAT

2. **Default Values:**
   - VAT included: false (prices exclude VAT by default)
   - VAT percentage: 20.0 (UK standard VAT rate)
   - Calculated fields are computed based on unit price and VAT settings

3. **Data Integrity:**
   - VAT percentage must be between 0 and 100
   - All new fields have appropriate defaults for existing records
*/

-- Add VAT configuration columns to inventory table
DO $$ 
BEGIN
  -- Add vat_included column (whether VAT is included in unit price)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inventory_tb2k4x9p1m' AND column_name = 'vat_included'
  ) THEN
    ALTER TABLE inventory_tb2k4x9p1m 
    ADD COLUMN vat_included BOOLEAN DEFAULT false;
  END IF;

  -- Add vat_percentage column (VAT rate as percentage)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inventory_tb2k4x9p1m' AND column_name = 'vat_percentage'
  ) THEN
    ALTER TABLE inventory_tb2k4x9p1m 
    ADD COLUMN vat_percentage DECIMAL(5,2) DEFAULT 20.00;
  END IF;

  -- Add vat_amount column (calculated VAT amount per unit)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inventory_tb2k4x9p1m' AND column_name = 'vat_amount'
  ) THEN
    ALTER TABLE inventory_tb2k4x9p1m 
    ADD COLUMN vat_amount DECIMAL(10,2) DEFAULT 0.00;
  END IF;

  -- Add price_excluding_vat column (price without VAT)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inventory_tb2k4x9p1m' AND column_name = 'price_excluding_vat'
  ) THEN
    ALTER TABLE inventory_tb2k4x9p1m 
    ADD COLUMN price_excluding_vat DECIMAL(10,2) DEFAULT 0.00;
  END IF;
END $$;

-- Add constraints for data integrity
DO $$
BEGIN
  -- Ensure VAT percentage is between 0 and 100
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'inventory_vat_percentage_range'
  ) THEN
    ALTER TABLE inventory_tb2k4x9p1m 
    ADD CONSTRAINT inventory_vat_percentage_range 
    CHECK (vat_percentage >= 0 AND vat_percentage <= 100);
  END IF;

  -- Ensure VAT amount is not negative
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'inventory_vat_amount_positive'
  ) THEN
    ALTER TABLE inventory_tb2k4x9p1m 
    ADD CONSTRAINT inventory_vat_amount_positive 
    CHECK (vat_amount >= 0);
  END IF;

  -- Ensure price excluding VAT is not negative
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'inventory_price_excluding_vat_positive'
  ) THEN
    ALTER TABLE inventory_tb2k4x9p1m 
    ADD CONSTRAINT inventory_price_excluding_vat_positive 
    CHECK (price_excluding_vat >= 0);
  END IF;
END $$;

-- Create function to calculate VAT amounts
CREATE OR REPLACE FUNCTION calculate_vat_amounts()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate VAT amounts based on whether VAT is included in price
  IF NEW.vat_included THEN
    -- VAT is included in unit_price, so calculate backwards
    NEW.price_excluding_vat = NEW.unit_price / (1 + (NEW.vat_percentage / 100));
    NEW.vat_amount = NEW.unit_price - NEW.price_excluding_vat;
  ELSE
    -- VAT is not included, so unit_price is the price excluding VAT
    NEW.price_excluding_vat = NEW.unit_price;
    NEW.vat_amount = NEW.unit_price * (NEW.vat_percentage / 100);
  END IF;

  -- Round to 2 decimal places
  NEW.vat_amount = ROUND(NEW.vat_amount, 2);
  NEW.price_excluding_vat = ROUND(NEW.price_excluding_vat, 2);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically calculate VAT amounts on insert/update
DROP TRIGGER IF EXISTS calculate_vat_trigger ON inventory_tb2k4x9p1m;
CREATE TRIGGER calculate_vat_trigger
  BEFORE INSERT OR UPDATE ON inventory_tb2k4x9p1m
  FOR EACH ROW
  EXECUTE FUNCTION calculate_vat_amounts();

-- Update existing records to calculate VAT amounts
UPDATE inventory_tb2k4x9p1m 
SET 
  vat_included = COALESCE(vat_included, false),
  vat_percentage = COALESCE(vat_percentage, 20.00),
  vat_amount = CASE 
    WHEN COALESCE(vat_included, false) THEN 
      unit_price - (unit_price / (1 + (COALESCE(vat_percentage, 20.00) / 100)))
    ELSE 
      unit_price * (COALESCE(vat_percentage, 20.00) / 100)
  END,
  price_excluding_vat = CASE 
    WHEN COALESCE(vat_included, false) THEN 
      unit_price / (1 + (COALESCE(vat_percentage, 20.00) / 100))
    ELSE 
      unit_price
  END
WHERE vat_amount IS NULL OR price_excluding_vat IS NULL;