/**
 * Public contact form → email to hi@flip-trip.com (Resend)
 */

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const ALLOWED_REASONS = new Set([
  'Need help',
  'Interested in partnership',
  'Providing feedback',
  'Guide or creator inquiry',
  'Press inquiry',
  'General inquiry / other'
]);

const CONTACT_TO = process.env.CONTACT_TO_EMAIL || 'hi@flip-trip.com';
const CONTACT_FROM = process.env.CONTACT_FROM_EMAIL || process.env.FROM_EMAIL || 'hello@flip-trip.com';

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function setCors(req, res) {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://www.flip-trip.com',
    'https://flip-trip.com',
    'https://fliptripfrontend.vercel.app',
    'https://fliptrip-clean-frontend.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000'
  ];
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  if (!process.env.RESEND_API_KEY) {
    return res.status(503).json({ success: false, error: 'Email is not configured' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const { name, email, company, reason, message, website } = body;

    // Honeypot
    if (website && String(website).trim() !== '') {
      return res.status(200).json({ success: true });
    }

    const nameClean = String(name || '').trim().slice(0, 200);
    const emailClean = String(email || '').trim().slice(0, 320);
    const companyClean = String(company || '').trim().slice(0, 200);
    const reasonClean = String(reason || '').trim();
    const messageClean = String(message || '').trim().slice(0, 10000);

    if (!nameClean || !emailClean || !reasonClean || !messageClean) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean);
    if (!emailOk) {
      return res.status(400).json({ success: false, error: 'Invalid email' });
    }

    if (!ALLOWED_REASONS.has(reasonClean)) {
      return res.status(400).json({ success: false, error: 'Invalid reason' });
    }

    const safe = {
      name: escapeHtml(nameClean),
      email: escapeHtml(emailClean),
      company: escapeHtml(companyClean),
      reason: escapeHtml(reasonClean),
      message: escapeHtml(messageClean).replace(/\n/g, '<br/>')
    };

    const subject = `[FlipTrip contact] ${reasonClean} — ${nameClean}`.slice(0, 200);

    const html = `
      <p><strong>Name:</strong> ${safe.name}</p>
      <p><strong>Email:</strong> ${safe.email}</p>
      <p><strong>Company:</strong> ${safe.company || '—'}</p>
      <p><strong>Reason:</strong> ${safe.reason}</p>
      <p><strong>Message:</strong></p>
      <p>${safe.message}</p>
    `;

    const { error } = await resend.emails.send({
      from: CONTACT_FROM,
      to: CONTACT_TO,
      replyTo: emailClean,
      subject,
      html
    });

    if (error) {
      console.error('contact-form Resend error:', error);
      return res.status(500).json({ success: false, error: 'Failed to send' });
    }

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error('contact-form error:', e);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
}
