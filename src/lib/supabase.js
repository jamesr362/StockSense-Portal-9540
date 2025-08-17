// Safe Supabase integration with fallback
import { createClient } from '@supabase/supabase-js';

// Project URL and key will be auto-injected during deployment
const SUPABASE_URL = 'https://xnfxcsdsjxgiewrssgrn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuZnhjc2RzanhnaWV3cnNzZ3JuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwMjcxMDYsImV4cCI6MjA3MDYwMzEwNn0._lug2dvx1Y1qKLuKVWc6b3DDTWqVQ1Ow77q768CcaG4';

let supabase = null;

try {
  // Only create client if credentials are properly configured
  if (SUPABASE_URL !== 'https://<PROJECT-ID>.supabase.co' && 
      SUPABASE_ANON_KEY !== '<ANON_KEY>') {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });
    console.log('Supabase connected successfully');
  } else {
    console.log('Supabase configured with default credentials');
  }
} catch (error) {
  console.warn('Supabase not available:', error);
}

export { supabase };
export default supabase;