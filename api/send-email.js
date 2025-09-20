// FlipTrip Clean Backend - Email API via Resend
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('📧 EMAIL: Starting email send process...');
    console.log('📝 Request body:', JSON.stringify(req.body, null, 2));

    const { email, formData } = req.body;

    if (!email || !formData) {
      return res.status(400).json({ error: 'Missing required fields: email, formData' });
    }

    // Проверяем API ключи
    if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL) {
      console.log('❌ EMAIL: Missing API keys');
      return res.status(500).json({ error: 'Email service not configured' });
    }

    console.log('✅ EMAIL: API keys present');

    // Генерируем ссылку на страницу результатов
    const itineraryLink = generateItineraryLink(formData);
    
    // Генерируем простой HTML email со ссылкой
    const htmlContent = generateSimpleEmailHTML(formData, itineraryLink);
    const textContent = generateSimpleEmailText(formData, itineraryLink);

    console.log('📧 EMAIL: Sending to:', email);

    // Отправляем email через Resend
    const emailResult = await resend.emails.send({
      from: process.env.FROM_EMAIL,
      to: [email],
      subject: `Your ${formData.city} Itinerary is Ready! 🎉`,
      html: htmlContent,
      text: textContent,
    });

    console.log('✅ EMAIL: Sent successfully:', emailResult);

    return res.status(200).json({ 
      success: true, 
      message: 'Email sent successfully',
      emailId: emailResult.id 
    });

  } catch (error) {
    console.error('❌ EMAIL: Error sending email:', error);
    return res.status(500).json({ 
      error: 'Failed to send email', 
      message: error.message 
    });
  }
}

// =============================================================================
// ГЕНЕРАЦИЯ ССЫЛКИ НА СТРАНИЦУ РЕЗУЛЬТАТОВ
// =============================================================================

function generateItineraryLink(formData) {
  const params = new URLSearchParams({
    city: formData.city,
    audience: formData.audience,
    interests: Array.isArray(formData.interests) ? formData.interests.join(',') : formData.interests,
    date: formData.date,
    budget: formData.budget
  });
  
  return `https://flip-trip.com/itinerary?${params.toString()}`;
}

// =============================================================================
// ПРОСТОЙ HTML EMAIL СО ССЫЛКОЙ
// =============================================================================

function generateSimpleEmailHTML(formData, itineraryLink) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Your ${formData.city} Itinerary is Ready!</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Helvetica Neue', Arial, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; background-color: white;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 32px 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">
            🎉 Your ${formData.city} Adventure is Ready!
          </h1>
          <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 16px;">
            ${formData.date} • For ${formData.audience} • Budget: €${formData.budget}
          </p>
        </div>

        <!-- Content -->
        <div style="padding: 32px 24px; text-align: center;">
          
          <h2 style="color: #1f2937; margin: 0 0 16px; font-size: 22px;">
            Thank you for your purchase!
          </h2>
          
          <p style="color: #4b5563; margin: 0 0 24px; font-size: 16px; line-height: 1.5;">
            Your personalized ${formData.city} itinerary has been generated with real places, AI descriptions, and authentic recommendations.
          </p>

          <!-- CTA Button -->
          <a href="${itineraryLink}" 
             style="display: inline-block; background-color: #3b82f6; color: white; padding: 16px 32px; 
                    border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; 
                    margin-bottom: 24px;">
            🚀 View Your Itinerary
          </a>

          <p style="color: #6b7280; margin: 0; font-size: 14px; line-height: 1.4;">
            Click the button above to view your complete day plan with:<br>
            • Real places and addresses<br>
            • AI-generated descriptions<br>
            • Authentic photos<br>
            • Practical recommendations<br>
            • PDF download option
          </p>

          <!-- Footer -->
          <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; margin: 0; font-size: 14px;">
              Have an amazing trip! 🌟<br>
              <strong>FlipTrip Team</strong>
            </p>
          </div>

        </div>
      </div>
    </body>
    </html>
  `;
}

// =============================================================================
// ПРОСТОЙ TEXT EMAIL (FALLBACK)
// =============================================================================

function generateSimpleEmailText(formData, itineraryLink) {
  return `
🎉 Your ${formData.city} Adventure is Ready!

Thank you for your purchase!

Your personalized ${formData.city} itinerary has been generated with real places, AI descriptions, and authentic recommendations.

View your complete itinerary here:
${itineraryLink}

Your itinerary includes:
• Real places and addresses
• AI-generated descriptions  
• Authentic photos
• Practical recommendations
• PDF download option

Have an amazing trip! 🌟
FlipTrip Team
  `;
}
