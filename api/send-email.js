/**
 * Send Email API Endpoint
 * Sends itinerary email to user after payment using Resend
 */

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  // CORS headers - устанавливаем ПЕРВЫМИ
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
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: 'Method not allowed' 
    });
  }

  try {
    const { email, itinerary, formData, itineraryId } = req.body;
    
    if (!email || !itinerary) {
      return res.status(400).json({
        success: false,
        error: 'Email and itinerary are required'
      });
    }

    console.log('📧 Sending email to:', email);
    console.log('📧 Itinerary ID:', itineraryId);
    
    const city = itinerary.city || formData?.city || 'your destination';
    const date = itinerary.date || formData?.date || new Date().toISOString().slice(0, 10);
    const itineraryUrl = `https://flip-trip.com/itinerary?itineraryId=${itineraryId}&full=true`;
    
    // Build email HTML content
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #e11d48 0%, #3E85FC 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: #3E85FC; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Your ${city} Itinerary is Ready!</h1>
            </div>
            <div class="content">
              <p>Hi there!</p>
              <p>Your personalized itinerary for <strong>${city}</strong> on <strong>${date}</strong> is ready!</p>
              <p>We've crafted a perfect day just for you, with carefully selected locations and activities.</p>
              <div style="text-align: center;">
                <a href="${itineraryUrl}" class="button">🚀 View Your Itinerary</a>
              </div>
              <p>Or copy this link:</p>
              <p style="word-break: break-all; color: #3E85FC;">${itineraryUrl}</p>
              <p>Enjoy your trip! 🌍</p>
            </div>
            <div class="footer">
              <p>Best regards,<br>The FlipTrip Team</p>
              <p>If you have any questions, feel free to reach out to us.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send email via Resend
    const { data, error } = await resend.emails.send({
      from: process.env.FROM_EMAIL || 'enjoy@flip-trip.com',
      to: email,
      subject: `Your ${city} Itinerary is Ready! 🎉`,
      html: emailHtml
    });

    if (error) {
      console.error('❌ Resend error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to send email',
        message: error.message
      });
    }

    console.log('✅ Email sent successfully via Resend:', data);
    return res.status(200).json({
      success: true,
      message: 'Email sent successfully',
      emailId: data?.id
    });

  } catch (error) {
    console.error('❌ Error sending email:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to send email',
      message: error.message
    });
  }
}

