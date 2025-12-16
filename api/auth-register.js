/**
 * Auth Module - Register Endpoint
 * Serverless function for user registration (using PostgreSQL/Supabase)
 */

import { supabase } from '../database/db.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

// Simple JWT-like token generation (for demo, replace with real JWT later)
function generateToken(userId) {
  const payload = {
    userId,
    timestamp: Date.now()
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

export default async function handler(req, res) {
  // CORS headers - ВСЕГДА устанавливаем первыми, ДО любых операций
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');

  // OPTIONS запрос - обрабатываем СРАЗУ, без каких-либо других операций
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Только POST запросы дальше
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { name, email, password, role = 'user' } = req.body;

    // Валидация
    if (!name || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Все поля обязательны' 
      });
    }

    // Проверка формата email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Неверный формат email' 
      });
    }

    // Проверка длины пароля
    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'Пароль должен содержать минимум 6 символов' 
      });
    }

    // Проверка существования пользователя в БД
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'Пользователь с таким email уже существует' 
      });
    }

    // Хеширование пароля
    const hashedPassword = await bcrypt.hash(password, 10);

    // Не разрешаем создание админа через публичную регистрацию
    const userRole = role === 'guide' ? 'guide' : 'user';

    // Создание пользователя в БД
    const userId = uuidv4();
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        id: userId,
        name,
        email,
        password_hash: hashedPassword,
        role: userRole
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    // Если guide, создаем профиль гида
    if (userRole === 'guide') {
      await supabase
        .from('guides')
        .insert({
          id: userId,
          name: name
        });
    }

    // Генерация токена
    const token = generateToken(userId);

    // Сохранение токена в Redis (для совместимости)
    try {
      const { Redis } = await import('@upstash/redis');
      const redisUrl = process.env.FTSTORAGE_KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
      const redisToken = process.env.FTSTORAGE_KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
      
      if (redisUrl && redisToken) {
        const redis = new Redis({ url: redisUrl, token: redisToken });
        await redis.set(`token:${token}`, userId, { ex: 86400 * 7 }); // 7 дней
      }
    } catch (redisError) {
      console.warn('Redis token storage failed (non-critical):', redisError);
    }

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    // Убеждаемся, что CORS headers установлены даже в случае ошибки
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    return res.status(500).json({ 
      success: false, 
      message: 'Ошибка регистрации',
      error: error.message 
    });
  }
}
