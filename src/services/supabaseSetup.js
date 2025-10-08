import { supabase } from '../lib/supabase';

/**
 * Initialize required database tables for subscription management
 */
export const initializeDatabase = async () => {
  try {
    console.log('🔧 Initializing database tables...');

    // Create subscriptions table
    const { error: subscriptionsError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Create subscriptions table if it doesn't exist
        CREATE TABLE IF NOT EXISTS subscriptions_tb2k4x9p1m (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_email TEXT NOT NULL UNIQUE,
          stripe_customer_id TEXT,
          stripe_subscription_id TEXT,
          stripe_session_id TEXT,
          plan_id TEXT NOT NULL DEFAULT 'price_free',
          status TEXT NOT NULL DEFAULT 'active',
          current_period_start TIMESTAMPTZ DEFAULT NOW(),
          current_period_end TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
          cancel_at_period_end BOOLEAN DEFAULT FALSE,
          canceled_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Enable RLS
        ALTER TABLE subscriptions_tb2k4x9p1m ENABLE ROW LEVEL SECURITY;

        -- Create policies
        CREATE POLICY IF NOT EXISTS "Users can view own subscription" 
        ON subscriptions_tb2k4x9p1m FOR SELECT 
        USING (user_email = auth.jwt() ->> 'email' OR user_email = current_setting('app.current_user_email', true));

        CREATE POLICY IF NOT EXISTS "Users can insert own subscription" 
        ON subscriptions_tb2k4x9p1m FOR INSERT 
        WITH CHECK (user_email = auth.jwt() ->> 'email' OR user_email = current_setting('app.current_user_email', true));

        CREATE POLICY IF NOT EXISTS "Users can update own subscription" 
        ON subscriptions_tb2k4x9p1m FOR UPDATE 
        USING (user_email = auth.jwt() ->> 'email' OR user_email = current_setting('app.current_user_email', true));

        -- Create indexes for performance
        CREATE INDEX IF NOT EXISTS idx_subscriptions_user_email ON subscriptions_tb2k4x9p1m(user_email);
        CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions_tb2k4x9p1m(stripe_customer_id);
        CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription ON subscriptions_tb2k4x9p1m(stripe_subscription_id);
        CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions_tb2k4x9p1m(status);
      `
    });

    if (subscriptionsError) {
      console.error('❌ Error creating subscriptions table:', subscriptionsError);
    } else {
      console.log('✅ Subscriptions table initialized');
    }

    // Create inventory table if needed
    const { error: inventoryError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Create inventory table if it doesn't exist
        CREATE TABLE IF NOT EXISTS inventory_tb2k4x9p1m (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_email TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          quantity INTEGER DEFAULT 0,
          purchase_price DECIMAL(10,2),
          current_value DECIMAL(10,2),
          purchase_date DATE,
          category TEXT,
          location TEXT,
          status TEXT DEFAULT 'active',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Enable RLS
        ALTER TABLE inventory_tb2k4x9p1m ENABLE ROW LEVEL SECURITY;

        -- Create policies
        CREATE POLICY IF NOT EXISTS "Users can manage own inventory" 
        ON inventory_tb2k4x9p1m FOR ALL 
        USING (user_email = auth.jwt() ->> 'email' OR user_email = current_setting('app.current_user_email', true));

        -- Create indexes
        CREATE INDEX IF NOT EXISTS idx_inventory_user_email ON inventory_tb2k4x9p1m(user_email);
        CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory_tb2k4x9p1m(status);
      `
    });

    if (inventoryError) {
      console.error('❌ Error creating inventory table:', inventoryError);
    } else {
      console.log('✅ Inventory table initialized');
    }

    // Create receipt scans tracking table
    const { error: receiptScansError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Create receipt scans table if it doesn't exist
        CREATE TABLE IF NOT EXISTS receipt_scans_tb2k4x9p1m (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_email TEXT NOT NULL,
          scan_data JSONB,
          items_extracted INTEGER DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Enable RLS
        ALTER TABLE receipt_scans_tb2k4x9p1m ENABLE ROW LEVEL SECURITY;

        -- Create policies
        CREATE POLICY IF NOT EXISTS "Users can manage own receipt scans" 
        ON receipt_scans_tb2k4x9p1m FOR ALL 
        USING (user_email = auth.jwt() ->> 'email' OR user_email = current_setting('app.current_user_email', true));

        -- Create indexes
        CREATE INDEX IF NOT EXISTS idx_receipt_scans_user_email ON receipt_scans_tb2k4x9p1m(user_email);
        CREATE INDEX IF NOT EXISTS idx_receipt_scans_created_at ON receipt_scans_tb2k4x9p1m(created_at);
      `
    });

    if (receiptScansError) {
      console.error('❌ Error creating receipt scans table:', receiptScansError);
    } else {
      console.log('✅ Receipt scans table initialized');
    }

    // Create Excel imports tracking table
    const { error: excelImportsError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Create Excel imports table if it doesn't exist
        CREATE TABLE IF NOT EXISTS excel_imports_tb2k4x9p1m (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_email TEXT NOT NULL,
          file_name TEXT,
          items_imported INTEGER DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Enable RLS
        ALTER TABLE excel_imports_tb2k4x9p1m ENABLE ROW LEVEL SECURITY;

        -- Create policies
        CREATE POLICY IF NOT EXISTS "Users can manage own excel imports" 
        ON excel_imports_tb2k4x9p1m FOR ALL 
        USING (user_email = auth.jwt() ->> 'email' OR user_email = current_setting('app.current_user_email', true));

        -- Create indexes
        CREATE INDEX IF NOT EXISTS idx_excel_imports_user_email ON excel_imports_tb2k4x9p1m(user_email);
        CREATE INDEX IF NOT EXISTS idx_excel_imports_created_at ON excel_imports_tb2k4x9p1m(created_at);
      `
    });

    if (excelImportsError) {
      console.error('❌ Error creating Excel imports table:', excelImportsError);
    } else {
      console.log('✅ Excel imports table initialized');
    }

    console.log('🎉 Database initialization complete!');
    return true;

  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    return false;
  }
};

/**
 * Test database connection and basic functionality
 */
export const testDatabaseConnection = async () => {
  try {
    console.log('🔍 Testing database connection...');

    // Test basic query
    const { data, error } = await supabase
      .from('subscriptions_tb2k4x9p1m')
      .select('count')
      .limit(1);

    if (error) {
      console.error('❌ Database connection test failed:', error);
      return false;
    }

    console.log('✅ Database connection test successful');
    return true;

  } catch (error) {
    console.error('❌ Database connection test error:', error);
    return false;
  }
};