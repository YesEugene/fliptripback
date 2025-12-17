/**
 * Reset user password endpoint
 * Allows admin to reset password for a user
 */

import { supabase } from '../database/db.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  // CORS headers
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://www.flip-trip.com',
    'https://flip-trip.com',
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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

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

    const { email, newPassword } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    // Generate password if not provided
    let finalPassword = newPassword;
    let generatedPassword = false;
    
    if (!newPassword || !newPassword.trim() || newPassword.length < 6) {
      // Generate a random secure password
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
      finalPassword = '';
      for (let i = 0; i < 12; i++) {
        finalPassword += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      generatedPassword = true;
      console.log('🔑 Generated new password for user:', email);
    }

    // Find user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email)
      .maybeSingle();

    if (userError && userError.code !== 'PGRST116') {
      console.error('Error finding user:', userError);
      return res.status(500).json({
        success: false,
        error: 'Error finding user',
        message: userError.message
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(finalPassword, 10);

    // Update password
    const { error: updateError } = await supabase
      .from('users')
      .update({
        password_hash: hashedPassword,
        is_active: true // Also activate user if inactive
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating password:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Failed to update password',
        message: updateError.message
      });
    }

    const response = {
      success: true,
      message: 'Password reset successfully',
      email: user.email
    };

    // Include generated password if it was auto-generated
    if (generatedPassword) {
      response.newPassword = finalPassword;
      response.generatedPassword = finalPassword;
      response.message = 'Password was reset and auto-generated. Please save it and share with the user.';
    }

    console.log('✅ Password reset successful for user:', email);
    return res.status(200).json(response);
  } catch (error) {
    console.error('❌ Error resetting password:', error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({ 
      success: false, 
      message: 'Error resetting password',
      error: error.message 
    });
  }
}

