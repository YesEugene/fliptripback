// Database connection for Supabase
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔌 Supabase connection check:', {
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseServiceKey,
  urlLength: supabaseUrl?.length || 0,
  keyLength: supabaseServiceKey?.length || 0
});

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠️ Supabase credentials not found. Database features will be limited.');
  console.warn('⚠️ Required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
}

export const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

if (supabase) {
  console.log('✅ Supabase client created successfully');
} else {
  console.error('❌ Failed to create Supabase client - missing credentials');
}

