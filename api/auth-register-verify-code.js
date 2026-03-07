/**
 * Auth Module - Verify registration code
 * Completes registration after one-time code validation.
 */

import { supabase } from '../database/db.js';
import { v4 as uuidv4 } from 'uuid';
import { Redis } from '@upstash/redis';

const MAX_VERIFY_ATTEMPTS = 5;

function generateToken(userId) {
  const payload = {
    userId,
    timestamp: Date.now()
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

function getRedisClient() {
  const url = process.env.FTSTORAGE_KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.FTSTORAGE_KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function normalizeEmail(email = '') {
  return String(email).trim().toLowerCase();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  try {
    const { email, code } = req.body || {};
    const normalizedEmail = normalizeEmail(email);
    const normalizedCode = String(code || '').trim();

    if (!normalizedEmail || !normalizedCode) {
      return res.status(400).json({ success: false, message: 'Email and code are required' });
    }

    const redis = getRedisClient();
    if (!redis) {
      return res.status(500).json({ success: false, message: 'Verification service is temporarily unavailable' });
    }

    const draftKey = `auth:reg:draft:${normalizedEmail}`;
    const attemptsKey = `auth:reg:attempts:${normalizedEmail}`;
    const payload = await redis.get(draftKey);

    if (!payload || !payload.code) {
      return res.status(400).json({ success: false, message: 'Code expired or not found. Please request a new one.' });
    }

    const attempts = Number((await redis.get(attemptsKey)) || 0);
    if (attempts >= MAX_VERIFY_ATTEMPTS) {
      return res.status(429).json({ success: false, message: 'Too many invalid attempts. Please request a new code.' });
    }

    if (normalizedCode !== String(payload.code)) {
      const nextAttempts = attempts + 1;
      const ttl = await redis.ttl(draftKey);
      if (ttl > 0) {
        await redis.set(attemptsKey, nextAttempts, { ex: ttl });
      } else {
        await redis.set(attemptsKey, nextAttempts, { ex: 600 });
      }
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code',
        attemptsLeft: Math.max(0, MAX_VERIFY_ATTEMPTS - nextAttempts)
      });
    }

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User with this email already exists' });
    }

    const userId = uuidv4();
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        id: userId,
        name: payload.name,
        email: payload.email,
        password_hash: payload.passwordHash,
        role: payload.role === 'guide' ? 'guide' : 'user'
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    if (newUser.role === 'guide') {
      await supabase
        .from('guides')
        .insert({
          id: userId,
          name: payload.name
        });
    }

    await redis.del(draftKey);
    await redis.del(attemptsKey);
    await redis.del(`auth:reg:cooldown:${normalizedEmail}`);

    const token = generateToken(userId);

    try {
      await redis.set(`token:${token}`, userId, { ex: 86400 * 7 });
    } catch (redisTokenError) {
      console.warn('Token storage in Redis failed (non-critical):', redisTokenError);
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
    console.error('Verify registration code error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify registration',
      error: error.message
    });
  }
}
