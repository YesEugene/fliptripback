/**
 * Auth Module - Routes
 * API endpoints для аутентификации и авторизации
 */

import express from 'express';
import { register, login, getCurrentUser } from './controllers.js';
import { authenticateToken } from './middleware.js';

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes
router.get('/me', authenticateToken, getCurrentUser);

export default router;

