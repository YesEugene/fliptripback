// Admin Users API - Returns users for admin dashboard
import { supabase } from '../database/db.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
  // CORS headers
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://www.flip-trip.com',
    'https://fliptripfrontend.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000'
  ];
  
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      if (!supabase) {
        return res.status(500).json({
          success: false,
          error: 'Database not configured'
        });
      }

      const { search, role } = req.query;

      let query = supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (search) {
        query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%`);
      }

      if (role) {
        query = query.eq('role', role);
      }

      const { data: users, error } = await query;

      if (error) {
        throw error;
      }

      // Format users for display (exclude password_hash)
      const formattedUsers = (users || []).map(user => ({
        id: user.id,
        email: user.email,
        name: user.name || 'N/A',
        role: user.role || 'user',
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }));

      return res.status(200).json({
        success: true,
        users: formattedUsers
      });
    } catch (error) {
      console.error('❌ Error fetching users:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch users',
        message: error.message
      });
    }
  }

  // Handle POST - create user
  if (req.method === 'POST') {
    try {
      if (!supabase) {
        return res.status(500).json({
          success: false,
          error: 'Database not configured'
        });
      }

      const { email, password, name, role = 'user' } = req.body;

      // Validation
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email and password are required'
        });
      }

      // Check if user already exists
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking existing user:', checkError);
        return res.status(500).json({
          success: false,
          error: 'Error checking existing user',
          message: checkError.message
        });
      }

      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'User with this email already exists'
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user directly in users table
      const userId = uuidv4();
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          id: userId,
          email,
          password_hash: hashedPassword,
          name: name || null,
          role: role
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating user:', insertError);
        return res.status(500).json({
          success: false,
          error: 'Failed to create user',
          message: insertError.message
        });
      }

      // If guide or creator, create guide profile
      if (role === 'guide' || role === 'creator') {
        const { error: guideError } = await supabase
          .from('guides')
          .insert({
            user_id: userId,
            name: name || email.split('@')[0] || 'Guide'
          });

        if (guideError) {
          console.warn('Warning: Could not create guide profile:', guideError);
        }
      }

      return res.status(201).json({
        success: true,
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role
        }
      });
    } catch (error) {
      console.error('❌ Error creating user:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create user',
        message: error.message
      });
    }
  }

  // Handle DELETE - delete user
  if (req.method === 'DELETE') {
    try {
      if (!supabase) {
        return res.status(500).json({
          success: false,
          error: 'Database not configured'
        });
      }

      const { id } = req.query;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
      }

      // Delete user from Supabase Auth (this will cascade to users table)
      const { error: deleteError } = await supabase.auth.admin.deleteUser(id);

      if (deleteError) {
        // If admin API doesn't work, try direct delete from users table
        const { error: dbError } = await supabase
          .from('users')
          .delete()
          .eq('id', id);

        if (dbError) {
          throw dbError;
        }
      }

      console.log(`✅ User ${id} deleted successfully`);

      return res.status(200).json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      console.error('❌ Error deleting user:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete user',
        message: error.message
      });
    }
  }

  // Handle PUT/PATCH - update user
  if (req.method === 'PUT' || req.method === 'PATCH') {
    try {
      if (!supabase) {
        return res.status(500).json({
          success: false,
          error: 'Database not configured'
        });
      }

      const { id } = req.query;
      const { email, name, role } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
      }

      const updateData = {};
      if (email !== undefined) updateData.email = email;
      if (name !== undefined) updateData.name = name;
      if (role !== undefined) updateData.role = role;

      const { data: user, error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      return res.status(200).json({
        success: true,
        user
      });
    } catch (error) {
      console.error('❌ Error updating user:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update user',
        message: error.message
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

