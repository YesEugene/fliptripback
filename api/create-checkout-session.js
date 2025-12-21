// FlipTrip Clean Backend - Payment API
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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
    console.log('💳 PAYMENT: Creating checkout session...');
    console.log('📝 Form data received:', req.body);

    const { city, audience, interests, date, budget, email, itineraryId, tourId } = req.body;

    if (!city || !audience || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Build success URL with itineraryId and tourId if present
    // Use flip-trip.com domain instead of vercel.app
    const baseUrl = 'https://flip-trip.com';
    const interestsStr = Array.isArray(interests) ? interests.join(',') : interests;
    let successUrl = `${baseUrl}/success?itineraryId=${encodeURIComponent(itineraryId || '')}&email=${encodeURIComponent(email)}&city=${encodeURIComponent(city)}&audience=${encodeURIComponent(audience)}&interests=${encodeURIComponent(interestsStr)}&date=${encodeURIComponent(date)}&budget=${encodeURIComponent(budget)}&session_id={CHECKOUT_SESSION_ID}`;
    if (tourId) {
      successUrl += `&tourId=${encodeURIComponent(tourId)}`;
    }
    
    const cancelUrl = `${baseUrl}/itinerary?city=${encodeURIComponent(city)}&audience=${encodeURIComponent(audience)}&interests=${encodeURIComponent(interestsStr)}&date=${encodeURIComponent(date)}&budget=${encodeURIComponent(budget)}&previewOnly=true${itineraryId ? `&itineraryId=${encodeURIComponent(itineraryId)}` : ''}`;

    // Создаем Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: email,
      metadata: {
        city,
        audience,
        interests: interestsStr,
        date,
        budget,
        email,
        itineraryId: itineraryId || '',
        tourId: tourId || ''
      }
    });

    console.log('✅ PAYMENT: Checkout session created');
    return res.status(200).json({ 
      success: true,
      sessionUrl: session.url,
      sessionId: session.id
    });

  } catch (error) {
    console.error('❌ PAYMENT: Error creating checkout session:', error);
    return res.status(500).json({ 
      error: 'Failed to create checkout session', 
      message: error.message 
    });
  }
}
