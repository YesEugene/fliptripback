/**
 * Users Service - Database operations for users
 */

import { supabase } from '../db.js';
import bcrypt from 'bcryptjs';

/**
 * Get all users with filters
 */
export async function getUsers(filters = {}) {
  try {
    let query = supabase
      .from('users')
      .select('*');

    if (filters.role) {
      query = query.eq('role', filters.role);
    }
    if (filters.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    }
    if (filters.search) {
      query = query.or(`email.ilike.%${filters.search}%,name.ilike.%${filters.search}%`);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, users: data || [] };
  } catch (error) {
    console.error('Get users error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get user by ID
 */
export async function getUserById(userId) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*, guide:guides(*)')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return { success: true, user: data };
  } catch (error) {
    console.error('Get user error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create user
 */
export async function createUser(userData) {
  try {
    const passwordHash = await bcrypt.hash(userData.password, 10);

    const user = {
      email: userData.email,
      password_hash: passwordHash,
      name: userData.name,
      role: userData.role || 'user'
    };

    const { data, error } = await supabase
      .from('users')
      .insert(user)
      .select()
      .single();

    if (error) throw error;

    // If guide, create guide profile
    if (userData.role === 'guide') {
      await supabase
        .from('guides')
        .insert({ id: data.id, name: userData.name });
    }

    return { success: true, user: data };
  } catch (error) {
    console.error('Create user error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update user
 */
export async function updateUser(userId, userData) {
  try {
    const updateFields = {};

    if (userData.name !== undefined) updateFields.name = userData.name;
    if (userData.role !== undefined) updateFields.role = userData.role;
    if (userData.is_active !== undefined) updateFields.is_active = userData.is_active;
    if (userData.password) {
      updateFields.password_hash = await bcrypt.hash(userData.password, 10);
    }

    const { data, error } = await supabase
      .from('users')
      .update(updateFields)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, user: data };
  } catch (error) {
    console.error('Update user error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete user
 */
export async function deleteUser(userId) {
  try {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Delete user error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create user by email (admin function)
 */
export async function createUserByEmail(email, role = 'user', name = null) {
  try {
    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-12);
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const user = {
      email,
      password_hash: passwordHash,
      name: name || email.split('@')[0],
      role
    };

    const { data, error } = await supabase
      .from('users')
      .insert(user)
      .select()
      .single();

    if (error) throw error;

    // If guide, create guide profile
    if (role === 'guide') {
      await supabase
        .from('guides')
        .insert({ id: data.id, name: user.name });
    }

    return {
      success: true,
      user: data,
      tempPassword // Return temp password (should be sent via email in production)
    };
  } catch (error) {
    console.error('Create user by email error:', error);
    return { success: false, error: error.message };
  }
}

