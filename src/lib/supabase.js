import { createClient } from '@supabase/supabase-js';

// Project ID will be auto-injected during deployment
const SUPABASE_URL = 'https://project-id.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';

let supabase = null;

try {
  // Only create the client if credentials are properly configured
  if (SUPABASE_URL !== 'https://project-id.supabase.co' && SUPABASE_ANON_KEY !== 'your-anon-key') {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });
    console.log('Supabase client initialized');
  } else {
    console.log('Supabase not configured - using local storage only');
  }
} catch (error) {
  console.warn('Supabase initialization failed:', error);
}

export const checkSupabaseConnection = async () => {
  if (!supabase) return false;
  
  try {
    const { data, error } = await supabase.from('health_check').select('*').limit(1);
    return !error;
  } catch (error) {
    console.error('Supabase connection check failed:', error);
    return false;
  }
};

export { supabase };
export default supabase;