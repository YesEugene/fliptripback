/**
 * Auth Module - Login Endpoint
 * Serverless function for user login
 */

import { Redis } from '@upstash/redis';
import bcrypt from 'bcryptjs';

// Lazy initialization of Redis client
function getRedis() {
  const url = process.env.FTSTORAGE_KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.FTSTORAGE_KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  
  if (!url || !token) {
    throw new Error('Redis environment variables not set');
  }
  
  return new Redis({ url, token });
}

// Simple JWT-like token generation (for demo, replace with real JWT later)
function generateToken(userId) {
  const payload = {
    userId,
    timestamp: Date.now()
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

export default async function handler(req, res) {
  // CORS headers - устанавливаем в самом начале
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Обработка preflight запроса
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { email, password } = req.body;

    // Валидация
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email и пароль обязательны' 
      });
    }

    const redis = getRedis();

    // Поиск пользователя по email
    const userId = await redis.get(`user:email:${email}`);
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Неверный email или пароль' 
      });
    }

    // Получение данных пользователя
    const userData = await redis.get(`user:${userId}`);
    if (!userData) {
      return res.status(401).json({ 
        success: false, 
        message: 'Неверный email или пароль' 
      });
    }

    const user = typeof userData === 'string' ? JSON.parse(userData) : userData;

    // Проверка пароля
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Неверный email или пароль' 
      });
    }

    // Генерация токена
    const token = generateToken(userId);

    // Сохранение токена
    await redis.set(`token:${token}`, userId, { ex: 86400 * 7 }); // 7 дней

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Ошибка входа',
      error: error.message 
    });
  }
}

