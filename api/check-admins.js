/**
 * Check Admins Endpoint
 * GET /api/check-admins - Check current admins in database for migration planning
 */

import { supabase } from '../database/db.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    if (!supabase) {
      return res.status(500).json({
        success: false,
        error: 'Database not configured'
      });
    }

    // Get all admins from users table
    const { data: admins, error: adminsError } = await supabase
      .from('users')
      .select('id, email, name, role, is_active, created_at, updated_at')
      .eq('role', 'admin')
      .order('created_at', { ascending: false });

    if (adminsError) {
      console.error('Error fetching admins:', adminsError);
      return res.status(500).json({
        success: false,
        error: 'Error fetching admins',
        message: adminsError.message
      });
    }

    // Check if admins table exists
    let adminsTableExists = false;
    let adminsInTable = [];
    try {
      const { data: adminsFromTable, error: tableError } = await supabase
        .from('admins')
        .select('*')
        .limit(1);
      
      if (!tableError) {
        adminsTableExists = true;
        // Get all admins from admins table
        const { data: allAdmins } = await supabase
          .from('admins')
          .select('*');
        adminsInTable = allAdmins || [];
      }
    } catch (e) {
      // Table doesn't exist yet
      adminsTableExists = false;
    }

    // Check specific admin email
    const { data: specificAdmin, error: specificError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'yes.stroynov@gmail.com')
      .maybeSingle();

    return res.status(200).json({
      success: true,
      summary: {
        totalAdminsInUsers: admins?.length || 0,
        adminsTableExists: adminsTableExists,
        totalAdminsInAdminsTable: adminsInTable.length,
        specificAdminExists: !!specificAdmin
      },
      adminsInUsers: admins || [],
      adminsInAdminsTable: adminsInTable,
      specificAdmin: specificAdmin || null,
      migrationStatus: {
        needsMigration: (admins?.length || 0) > 0 && adminsInTable.length === 0,
        canCreateTable: !adminsTableExists,
        specificAdminNeedsCreation: !specificAdmin && adminsTableExists
      }
    });
  } catch (error) {
    console.error('Check admins error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking admins',
      error: error.message
    });
  }
}



