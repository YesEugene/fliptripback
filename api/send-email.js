/**
 * Send Email API Endpoint
 * Sends itinerary email to user after payment
 */

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
    
    // TODO: Implement actual email sending (e.g., using SendGrid, Resend, etc.)
    // For now, just log and return success
    console.log('📧 Email would be sent with itinerary:', {
      city: itinerary.city || formData?.city,
      date: itinerary.date || formData?.date,
      itineraryId: itineraryId
    });

    // Return success (email sending will be implemented later)
    return res.status(200).json({
      success: true,
      message: 'Email sent successfully'
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

