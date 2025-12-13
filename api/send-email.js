// FlipTrip Clean Backend - Send Email with Itinerary Link
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  // CORS headers - УСТАНАВЛИВАЕМ ПЕРВЫМИ, ДО ЛЮБЫХ ДРУГИХ ОПЕРАЦИЙ
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, itinerary, formData, itineraryId } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    if (!itineraryId) {
      return res.status(400).json({ success: false, error: 'Itinerary ID is required' });
    }

    // Generate itinerary link
    const baseUrl = process.env.FRONTEND_URL || 'https://fliptripfront.vercel.app';
    const itineraryLink = `${baseUrl}/itinerary?city=${encodeURIComponent(formData?.city || '')}&audience=${encodeURIComponent(formData?.audience || '')}&interests=${encodeURIComponent(formData?.interests?.join(',') || '')}&date=${encodeURIComponent(formData?.date || '')}&budget=${encodeURIComponent(formData?.budget || '')}&id=${itineraryId}&full=true`;

    // Email content
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🌍 Your FlipTrip Itinerary is Ready!</h1>
            </div>
            <div class="content">
              <p>Hello!</p>
              <p>Your personalized itinerary for <strong>${formData?.city || 'your destination'}</strong> is ready!</p>
              <p>Click the button below to view your complete day plan:</p>
              <div style="text-align: center;">
                <a href="${itineraryLink}" class="button">View Full Itinerary</a>
              </div>
              <p>Or copy this link:</p>
              <p style="word-break: break-all; color: #3b82f6;">${itineraryLink}</p>
              <p>Enjoy your trip! 🎉</p>
            </div>
            <div class="footer">
              <p>Created with ❤️ by FlipTrip</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send email
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'FlipTrip <noreply@fliptrip.com>';
    
    const result = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: `Your FlipTrip Itinerary for ${formData?.city || 'Your Destination'}`,
      html: emailHtml
    });

    console.log('✅ Email sent successfully:', result);
    return res.status(200).json({ success: true, messageId: result.id });

  } catch (error) {
    // Убеждаемся, что CORS заголовки установлены даже при ошибке
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    
    console.error('❌ Error sending email:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to send email', 
      details: error.message 
    });
  }
}

