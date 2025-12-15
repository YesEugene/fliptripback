/**
 * Database Service - PostgreSQL/Supabase Connection
 * Handles all database operations
 */

import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Supabase credentials not set. Database operations will fail.');
  console.warn('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
}

// Create Supabase client with service role key (for admin operations)
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Test database connection
 */
export async function testConnection() {
  try {
    const { data, error } = await supabase.from('users').select('count').limit(1);
    if (error) {
      console.error('❌ Database connection failed:', error.message);
      return false;
    }
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection error:', error);
    return false;
  }
}

/**
 * Execute raw SQL query (for migrations and admin operations)
 */
export async function executeSQL(query, params = []) {
  try {
    // For raw SQL, we need to use the REST API or a direct PostgreSQL connection
    // Supabase JS client doesn't support raw SQL directly
    // We'll use the REST API for now, or implement direct pg connection if needed
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({ query, params })
    });
    
    if (!response.ok) {
      throw new Error(`SQL execution failed: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('SQL execution error:', error);
    throw error;
  }
}

export default supabase;

