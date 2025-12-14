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

    const { city, audience, interests, date, budget, email } = req.body;

    if (!city || !audience || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

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
      success_url: `https://fliptripfront.vercel.app/itinerary?city=${encodeURIComponent(city)}&audience=${encodeURIComponent(audience)}&interests=${encodeURIComponent(Array.isArray(interests) ? interests.join(',') : interests)}&date=${encodeURIComponent(date)}&budget=${encodeURIComponent(budget)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://fliptripfront.vercel.app/preview?city=${encodeURIComponent(city)}&audience=${encodeURIComponent(audience)}&interests=${encodeURIComponent(Array.isArray(interests) ? interests.join(',') : interests)}&date=${encodeURIComponent(date)}&budget=${encodeURIComponent(budget)}`,
      metadata: {
        city,
        audience,
        interests: Array.isArray(interests) ? interests.join(',') : interests,
        date,
        budget,
        email
      }
    });

    console.log('✅ PAYMENT: Checkout session created');
    return res.status(200).json({ url: session.url });

  } catch (error) {
    console.error('❌ PAYMENT: Error creating checkout session:', error);
    return res.status(500).json({ 
      error: 'Failed to create checkout session', 
      message: error.message 
    });
  }
}
