/**
 * Admin Users Endpoint
 * CRUD operations for users
 */

import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  createUserByEmail
} from '../database/services/usersService.js';

// Extract user ID from Authorization header
function getUserId(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  try {
    const token = authHeader.replace('Bearer ', '');
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return payload.userId || payload.id || null;
  } catch (error) {
    return null;
  }
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // TODO: Add admin authentication check
    const adminUserId = getUserId(req);

    if (req.method === 'GET') {
      const { id, ...filters } = req.query;

      if (id) {
        const result = await getUserById(id);
        return res.status(result.success ? 200 : 404).json(result);
      }

      const result = await getUsers(filters);
      return res.status(200).json(result);
    }

    if (req.method === 'POST') {
      const { email, role, name, createByEmail } = req.body;

      // Create user by email (admin function)
      if (createByEmail && email) {
        const result = await createUserByEmail(email, role || 'user', name);
        return res.status(result.success ? 201 : 400).json(result);
      }

      // Regular user creation
      const result = await createUser(req.body);
      return res.status(result.success ? 201 : 400).json(result);
    }

    if (req.method === 'PUT') {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ success: false, message: 'User ID required' });
      }

      const result = await updateUser(id, req.body);
      return res.status(result.success ? 200 : 400).json(result);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ success: false, message: 'User ID required' });
      }

      const result = await deleteUser(id);
      return res.status(result.success ? 200 : 400).json(result);
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });
  } catch (error) {
    console.error('Admin users error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error processing request',
      error: error.message
    });
  }
}

