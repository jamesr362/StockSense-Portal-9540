import { supabase } from '../lib/supabase';
import { secureLog } from '../utils/secureLogging';

/**
 * Test database connection and basic functionality
 */
export const testDatabaseConnection = async () => {
  try {
    secureLog.debug('Testing database connection...');

    // Test basic connection with a simple query that doesn't depend on specific tables
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .limit(1);

    if (error) {
      // If information_schema doesn't work, try a simple auth query
      const { data: authData, error: authError } = await supabase.auth.getSession();
      
      if (authError) {
        secureLog.error('Database connection test failed:', authError);
        return false;
      }
    }

    secureLog.debug('Database connection test successful');
    return true;

  } catch (error) {
    secureLog.error('Database connection test error:', error);
    return false;
  }
};

/**
 * Check if required tables exist
 */
export const checkTablesExist = async () => {
  try {
    const tables = [
      'subscriptions_tb2k4x9p1m',
      'inventory_tb2k4x9p1m',
      'receipt_scans_tb2k4x9p1m',
      'excel_imports_tb2k4x9p1m'
    ];

    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('count')
        .limit(1);

      if (error) {
        secureLog.debug(`Table ${table} does not exist or is not accessible`);
        return false;
      }
    }

    return true;
  } catch (error) {
    secureLog.error('Error checking tables exist:', error);
    return false;
  }
};

/**
 * Initialize required database tables for subscription management
 */
export const initializeDatabase = async () => {
  try {
    secureLog.debug('Initializing database tables...');

    // First check if we can execute RPC functions
    const { data: rpcTest, error: rpcError } = await supabase.rpc('now');
    
    if (rpcError) {
      secureLog.error('RPC functions not available, skipping database initialization');
      return false;
    }

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
      secureLog.error('Error creating subscriptions table:', subscriptionsError);
    } else {
      secureLog.debug('Subscriptions table initialized');
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
      secureLog.error('Error creating inventory table:', inventoryError);
    } else {
      secureLog.debug('Inventory table initialized');
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
      secureLog.error('Error creating receipt scans table:', receiptScansError);
    } else {
      secureLog.debug('Receipt scans table initialized');
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
      secureLog.error('Error creating Excel imports table:', excelImportsError);
    } else {
      secureLog.debug('Excel imports table initialized');
    }

    secureLog.debug('Database initialization complete!');
    return true;

  } catch (error) {
    secureLog.error('Database initialization failed:', error);
    return false;
  }
};

/**
 * Safe database initialization that won't crash the app
 */
export const safeInitializeDatabase = async () => {
  try {
    // Test basic connection first
    const connectionOk = await testDatabaseConnection();
    if (!connectionOk) {
      secureLog.debug('Database connection failed, skipping initialization');
      return false;
    }

    // Check if tables already exist
    const tablesExist = await checkTablesExist();
    if (tablesExist) {
      secureLog.debug('Database tables already exist');
      return true;
    }

    // Try to initialize tables
    return await initializeDatabase();

  } catch (error) {
    secureLog.error('Safe database initialization error:', error);
    return false;
  }
};