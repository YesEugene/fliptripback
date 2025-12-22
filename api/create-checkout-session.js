// FlipTrip Clean Backend - Payment API
import Stripe from 'stripe';
import { supabase } from '../database/db.js';

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

    const { city, audience, interests, date, budget, email, itineraryId, tourId, tourType, selectedDate, quantity } = req.body;

    if (!city || !email) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required fields',
        message: 'City and email are required' 
      });
    }
    
    // Use default audience if not provided
    const finalAudience = audience || 'solo';
    
    // Determine tour type (default to self-guided)
    const finalTourType = tourType || 'self-guided';
    
    // Validate with-guide selection
    if (finalTourType === 'with-guide') {
      if (!selectedDate) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          message: 'Selected date is required for guided tours'
        });
      }
      
      if (!tourId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          message: 'Tour ID is required for guided tours'
        });
      }
      
      // Validate date availability
      const dateObj = new Date(selectedDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (dateObj < today) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date',
          message: 'Selected date cannot be in the past'
        });
      }
      
      // Check availability in database
      if (supabase) {
        const { data: slot, error: slotError } = await supabase
          .from('tour_availability_slots')
          .select('*')
          .eq('tour_id', tourId)
          .eq('date', selectedDate)
          .single();
        
        if (slotError || !slot) {
          return res.status(400).json({
            success: false,
            error: 'Date not available',
            message: 'Selected date is not available for this tour'
          });
        }
        
        // Check if date is available and has spots
        const availableSpots = (slot.max_group_size || 0) - (slot.booked_spots || 0);
        if (slot.is_blocked || !slot.is_available || availableSpots <= 0) {
          return res.status(400).json({
            success: false,
            error: 'Date not available',
            message: 'Selected date is fully booked or blocked'
          });
        }
      }
    }
    
    // Get tour price from database if tourId is provided
    let tourPrice = null;
    let currency = 'USD';
    
    if (tourId && supabase) {
      const { data: tour, error: tourError } = await supabase
        .from('tours')
        .select('price_pdf, price_guided, currency')
        .eq('id', tourId)
        .single();
      
      if (!tourError && tour) {
        currency = tour.currency || 'USD';
        if (finalTourType === 'with-guide') {
          tourPrice = tour.price_guided;
        } else {
          tourPrice = tour.price_pdf || 16;
        }
      }
    }
    
    // Fallback to default price if not found in DB
    if (!tourPrice) {
      tourPrice = finalTourType === 'with-guide' ? 150 : 16; // Default prices
    }

    // Build success URL with itineraryId and tourId if present
    // Use flip-trip.com domain instead of vercel.app
    const baseUrl = 'https://flip-trip.com';
    const interestsStr = Array.isArray(interests) ? interests.join(',') : interests || '';
    let successUrl = `${baseUrl}/itinerary?email=${encodeURIComponent(email)}&city=${encodeURIComponent(city)}&date=${encodeURIComponent(date || '')}&budget=${encodeURIComponent(budget || '')}&session_id={CHECKOUT_SESSION_ID}&paid=true`;
    if (tourId) {
      successUrl += `&tourId=${encodeURIComponent(tourId)}&previewOnly=true`;
    } else if (itineraryId) {
      successUrl += `&itineraryId=${encodeURIComponent(itineraryId)}`;
    }
    if (finalAudience) {
      successUrl += `&audience=${encodeURIComponent(finalAudience)}`;
    }
    if (interestsStr) {
      successUrl += `&interests=${encodeURIComponent(interestsStr)}`;
    }
    
    let cancelUrl = `${baseUrl}/itinerary?city=${encodeURIComponent(city)}&previewOnly=true`;
    if (tourId) {
      cancelUrl += `&tourId=${encodeURIComponent(tourId)}`;
    } else if (itineraryId) {
      cancelUrl += `&itineraryId=${encodeURIComponent(itineraryId)}`;
    }
    if (finalAudience) {
      cancelUrl += `&audience=${encodeURIComponent(finalAudience)}`;
    }
    if (interestsStr) {
      cancelUrl += `&interests=${encodeURIComponent(interestsStr)}`;
    }
    if (date) {
      cancelUrl += `&date=${encodeURIComponent(date)}`;
    }
    if (budget) {
      cancelUrl += `&budget=${encodeURIComponent(budget)}`;
    }

    // Create Stripe price dynamically or use existing price_id
    let lineItems;
    
    // Try to use existing price_id for self-guided tours (if available)
    if (finalTourType === 'self-guided' && process.env.STRIPE_PRICE_ID) {
      lineItems = [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ];
    } else {
      // Create dynamic price for guided tours or if no price_id is set
      const finalQuantity = finalTourType === 'with-guide' ? (parseInt(quantity) || 1) : 1;
      const price = await stripe.prices.create({
        unit_amount: Math.round(tourPrice * 100), // Convert to cents (price per person)
        currency: currency.toLowerCase(),
        product_data: {
          name: finalTourType === 'with-guide' 
            ? `Guided Tour - ${city}` 
            : `Self-guided Tour - ${city}`,
        },
      });
      
      lineItems = [
        {
          price: price.id,
          quantity: finalQuantity, // Number of spots
        },
      ];
    }
    
    // Создаем Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: email,
      metadata: {
        city,
        audience: finalAudience,
        interests: interestsStr,
        date: date || '',
        budget: budget || '',
        email,
        itineraryId: itineraryId || '',
        tourId: tourId || '',
        tourType: finalTourType,
        selectedDate: selectedDate || '',
        quantity: finalTourType === 'with-guide' ? (quantity || 1).toString() : '1'
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
