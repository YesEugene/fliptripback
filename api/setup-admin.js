/**
 * Setup Admin Endpoint
 * POST /api/setup-admin - Create admin user and profile in database
 * This endpoint creates the admin user in users table and corresponding profile in admins table
 * 
 * IMPORTANT: This should be called once to migrate hardcoded admin to database
 */

import { supabase } from '../database/db.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    if (!supabase) {
      return res.status(500).json({
        success: false,
        error: 'Database not configured'
      });
    }

    const { email = 'yes.stroynov@gmail.com', password = 'fliptrip13', name = 'Admin' } = req.body;

    console.log('🔧 Setting up admin user...', { email, hasPassword: !!password });

    // Check if admin already exists in users table
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('email', email)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing admin:', checkError);
      return res.status(500).json({
        success: false,
        error: 'Error checking existing admin',
        message: checkError.message
      });
    }

    let userId;
    let userCreated = false;

    if (existingUser) {
      // Admin already exists in users table
      console.log('✅ Admin user already exists:', existingUser.id);
      userId = existingUser.id;

      // Update role to admin if needed
      if (existingUser.role !== 'admin') {
        const { error: updateError } = await supabase
          .from('users')
          .update({ role: 'admin' })
          .eq('id', userId);
        
        if (updateError) {
          console.error('Error updating user role:', updateError);
        } else {
          console.log('✅ Updated user role to admin');
        }
      }
    } else {
      // Create new admin user
      console.log('📝 Creating new admin user...');
      userId = uuidv4();
      
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          id: userId,
          email,
          password_hash: hashedPassword,
          name,
          role: 'admin',
          is_active: true
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ Error creating admin user:', insertError);
        return res.status(500).json({
          success: false,
          error: 'Error creating admin user',
          message: insertError.message
        });
      }

      console.log('✅ Admin user created:', userId);
      userCreated = true;
    }

    // Check if admin profile exists in admins table
    const { data: existingAdmin, error: adminCheckError } = await supabase
      .from('admins')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (adminCheckError && adminCheckError.code !== 'PGRST116') {
      console.error('Error checking existing admin profile:', adminCheckError);
      // If table doesn't exist, return instructions
      if (adminCheckError.code === '42P01') {
        return res.status(500).json({
          success: false,
          error: 'Admins table does not exist',
          message: 'Please create the admins table first using the SQL script: database/create-admins-table.sql',
          instructions: 'Run the SQL script in Supabase SQL Editor to create the admins table'
        });
      }
      return res.status(500).json({
        success: false,
        error: 'Error checking existing admin profile',
        message: adminCheckError.message
      });
    }

    let adminProfileCreated = false;

    if (!existingAdmin) {
      // Create admin profile
      console.log('📝 Creating admin profile...');
      const { data: newAdmin, error: adminInsertError } = await supabase
        .from('admins')
        .insert({
          id: userId,
          name: name || email.split('@')[0] || 'Admin'
        })
        .select()
        .single();

      if (adminInsertError) {
        console.error('❌ Error creating admin profile:', adminInsertError);
        // If table doesn't exist, return instructions
        if (adminInsertError.code === '42P01') {
          return res.status(500).json({
            success: false,
            error: 'Admins table does not exist',
            message: 'Please create the admins table first using the SQL script: database/create-admins-table.sql',
            instructions: 'Run the SQL script in Supabase SQL Editor to create the admins table'
          });
        }
        return res.status(500).json({
          success: false,
          error: 'Error creating admin profile',
          message: adminInsertError.message
        });
      }

      console.log('✅ Admin profile created:', userId);
      adminProfileCreated = true;
    } else {
      console.log('✅ Admin profile already exists');
    }

    return res.status(200).json({
      success: true,
      message: 'Admin setup completed',
      admin: {
        id: userId,
        email,
        name,
        role: 'admin'
      },
      created: {
        user: userCreated,
        profile: adminProfileCreated
      }
    });
  } catch (error) {
    console.error('❌ Setup admin error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error setting up admin',
      error: error.message
    });
  }
}


