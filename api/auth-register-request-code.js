/**
 * Auth Module - Request registration code
 * Sends one-time verification code to complete registration.
 */

import { supabase } from '../database/db.js';
import bcrypt from 'bcryptjs';
import { Redis } from '@upstash/redis';
import { Resend } from 'resend';

const CODE_TTL_SECONDS = 10 * 60; // 10 minutes
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_VERIFY_ATTEMPTS = 5;
const MAX_REQUESTS_PER_HOUR = 12;

function getRedisClient() {
  const url = process.env.FTSTORAGE_KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.FTSTORAGE_KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function normalizeEmail(email = '') {
  return String(email).trim().toLowerCase();
}

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  try {
    const { name, email, password, role = 'user' } = req.body || {};
    const normalizedEmail = normalizeEmail(email);
    const userRole = role === 'guide' ? 'guide' : 'user';

    if (!name || !normalizedEmail || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User with this email already exists' });
    }

    const redis = getRedisClient();
    if (!redis) {
      return res.status(500).json({ success: false, message: 'Verification service is temporarily unavailable' });
    }

    const ip = getClientIp(req);
    const ipRateKey = `auth:reg:req:ip:${ip}`;
    const currentRate = await redis.incr(ipRateKey);
    if (currentRate === 1) {
      await redis.expire(ipRateKey, 3600);
    }
    if (currentRate > MAX_REQUESTS_PER_HOUR) {
      return res.status(429).json({ success: false, message: 'Too many attempts. Please try again later.' });
    }

    const cooldownKey = `auth:reg:cooldown:${normalizedEmail}`;
    const isCooldown = await redis.get(cooldownKey);
    if (isCooldown) {
      return res.status(429).json({ success: false, message: 'Please wait before requesting another code' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const code = generateCode();
    const payload = {
      name: String(name).trim(),
      email: normalizedEmail,
      passwordHash,
      role: userRole,
      code,
      createdAt: Date.now()
    };

    const draftKey = `auth:reg:draft:${normalizedEmail}`;
    const attemptsKey = `auth:reg:attempts:${normalizedEmail}`;

    await redis.set(draftKey, payload, { ex: CODE_TTL_SECONDS });
    await redis.set(attemptsKey, 0, { ex: CODE_TTL_SECONDS });
    await redis.set(cooldownKey, 1, { ex: RESEND_COOLDOWN_SECONDS });

    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.FROM_EMAIL || 'enjoy@flip-trip.com',
      to: normalizedEmail,
      subject: 'Your FlipTrip registration code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
          <h2 style="margin: 0 0 12px;">Complete your FlipTrip registration</h2>
          <p style="margin: 0 0 16px; color: #444;">Use this verification code to finish creating your account:</p>
          <div style="font-size: 34px; letter-spacing: 8px; font-weight: 700; margin: 14px 0 18px;">${code}</div>
          <p style="margin: 0; color: #666;">The code expires in 10 minutes.</p>
          <p style="margin: 12px 0 0; color: #666;">If you didn't request this, you can ignore this email.</p>
        </div>
      `
    });

    return res.status(200).json({
      success: true,
      message: 'Verification code sent',
      ttlSeconds: CODE_TTL_SECONDS,
      maxAttempts: MAX_VERIFY_ATTEMPTS
    });
  } catch (error) {
    console.error('Request registration code error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send verification code',
      error: error.message
    });
  }
}
