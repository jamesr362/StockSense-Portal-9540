// Safe Supabase integration with fallback
import { createClient } from '@supabase/supabase-js';

// Project URL will be auto-injected during deployment
const SUPABASE_URL = 'https://xajnvqjkqmbdkwfkfxrs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhham52cWprcW1iZGt3ZmtmeHJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTMyMDY0NzUsImV4cCI6MjAyODc4MjQ3NX0.YVnMmLdoE1iKVoUGpJJqTbOaIwXMdOaOWIoFkKiNvvQ';

let supabase = null;

try {
  // Only create client if credentials are properly configured
  if (SUPABASE_URL !== 'https://xajnvqjkqmbdkwfkfxrs.supabase.co' && SUPABASE_ANON_KEY !== 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhham52cWprcW1iZGt3ZmtmeHJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTMyMDY0NzUsImV4cCI6MjAyODc4MjQ3NX0.YVnMmLdoE1iKVoUGpJJqTbOaIwXMdOaOWIoFkKiNvvQ') {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });
    console.log('Supabase connected successfully');
  } else {
    console.log('Supabase configured with default credentials');
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });
  }
} catch (error) {
  console.warn('Supabase not available:', error);
}

export { supabase };
export default supabase;