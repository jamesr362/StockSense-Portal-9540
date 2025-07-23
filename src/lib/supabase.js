// Safe Supabase integration with fallback
let supabase = null;

try {
  // Only import Supabase if configured
  const SUPABASE_URL = 'https://<PROJECT-ID>.supabase.co';
  const SUPABASE_ANON_KEY = '<ANON_KEY>';
  
  if (SUPABASE_URL !== 'https://<PROJECT-ID>.supabase.co' && SUPABASE_ANON_KEY !== '<ANON_KEY>') {
    // Dynamic import to prevent build errors when not configured
    import('@supabase/supabase-js').then(({ createClient }) => {
      supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true
        }
      });
      console.log('Supabase connected successfully');
    }).catch(error => {
      console.warn('Supabase failed to load:', error);
    });
  } else {
    console.log('Supabase not configured - using IndexedDB only');
  }
} catch (error) {
  console.warn('Supabase not available:', error);
}

export { supabase };
export default supabase;