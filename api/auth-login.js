/**
 * Auth Module - Login Endpoint
 * Serverless function for user login (using PostgreSQL/Supabase)
 */

import { supabase } from '../database/db.js';
import bcrypt from 'bcryptjs';

// Simple JWT-like token generation (for demo, replace with real JWT later)
function generateToken(userId) {
  const payload = {
    userId,
    timestamp: Date.now()
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

export default async function handler(req, res) {
  // CORS headers - ВСЕГДА устанавливаем первыми
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');

  // OPTIONS запрос - обрабатываем СРАЗУ
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
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

    // Поиск пользователя в БД
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('is_active', true)
      .single();

    if (userError || !user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Неверный email или пароль' 
      });
    }

    // Проверка пароля
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Неверный email или пароль' 
      });
    }

    // Обновление last_login
    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    // Генерация токена
    const token = generateToken(user.id);

    // Сохранение токена в Redis (для совместимости, можно убрать позже)
    try {
      const { Redis } = await import('@upstash/redis');
      const redisUrl = process.env.FTSTORAGE_KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
      const redisToken = process.env.FTSTORAGE_KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
      
      if (redisUrl && redisToken) {
        const redis = new Redis({ url: redisUrl, token: redisToken });
        await redis.set(`token:${token}`, user.id, { ex: 86400 * 7 }); // 7 дней
      }
    } catch (redisError) {
      console.warn('Redis token storage failed (non-critical):', redisError);
    }

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
    // Убеждаемся, что CORS headers установлены даже в случае ошибки
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.status(500).json({ 
      success: false, 
      message: 'Ошибка входа',
      error: error.message 
    });
  }
}
