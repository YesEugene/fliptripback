// FlipTrip Clean Backend - Send Email with Itinerary
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Generate itinerary link with ID and full=true
function generateItineraryLink(formData, itineraryId) {
  const params = new URLSearchParams({
    city: formData.city,
    audience: formData.audience,
    interests: Array.isArray(formData.interests) ? formData.interests.join(',') : formData.interests,
    date: formData.date,
    budget: formData.budget,
    id: itineraryId, // Add itinerary ID
    full: 'true'     // Ensure full plan is shown
  });
  return `https://fliptripfront.vercel.app/itinerary?${params.toString()}`;
}

export default async function handler(req, res) {
  // CORS headers - УСТАНАВЛИВАЕМ ПЕРВЫМИ, ДО ЛЮБЫХ ДРУГИХ ОПЕРАЦИЙ
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    
    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
  } catch (corsError) {
    console.error('❌ CORS setup error:', corsError);
    return res.status(200).json({ error: 'CORS setup failed' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, itinerary, formData } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    if (!formData) {
      return res.status(400).json({ success: false, error: 'Form data is required' });
    }

    // Get itinerary ID from formData or generate link without ID
    const itineraryId = formData.itineraryId || formData.id || null;
    const itineraryLink = generateItineraryLink(formData, itineraryId);

    console.log('📧 Sending email to:', email);
    console.log('🔗 Itinerary link:', itineraryLink);

    // Check if Resend API key is set
    if (!process.env.RESEND_API_KEY) {
      console.error('❌ RESEND_API_KEY not set');
      return res.status(500).json({ 
        success: false, 
        error: 'Email service not configured' 
      });
    }

    // Prepare email content
    const city = formData.city || 'your destination';
    const date = formData.date || 'your selected date';
    
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
              <p>Your personalized travel itinerary for <strong>${city}</strong> on <strong>${date}</strong> is ready!</p>
              <p>We've created a perfect day plan tailored just for you, with real places, detailed descriptions, and insider tips.</p>
              <div style="text-align: center;">
                <a href="${itineraryLink}" class="button">View Your Itinerary</a>
              </div>
              <p>This link will take you directly to your complete itinerary with all the details you need for an amazing day in ${city}.</p>
              <p>Have a wonderful trip! 🌍✈️</p>
              <p>Best regards,<br>The FlipTrip Team</p>
            </div>
            <div class="footer">
              <p>FlipTrip - Your AI-Powered Travel Planner</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send email via Resend
    const emailResult = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'FlipTrip <noreply@fliptrip.com>',
      to: email,
      subject: `Your ${city} Itinerary is Ready! 🎉`,
      html: emailHtml
    });

    console.log('✅ Email sent successfully:', emailResult);

    return res.status(200).json({ 
      success: true, 
      message: 'Email sent successfully',
      emailId: emailResult.id
    });

  } catch (error) {
    console.error('❌ Error sending email:', error);
    console.error('❌ Stack trace:', error.stack);
    // Убеждаемся, что CORS headers установлены даже при ошибке
    try {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    } catch (corsErr) {
      console.error('❌ Failed to set CORS headers in error handler:', corsErr);
    }
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to send email',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

