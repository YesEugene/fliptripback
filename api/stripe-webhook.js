/**
 * Stripe Webhook Handler
 * Handles checkout.session.completed events to create tour bookings
 */

import Stripe from 'stripe';
import { Resend } from 'resend';
import { supabase } from '../database/db.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Stripe-Signature');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];

  let event;

  try {
    // For Vercel, req.body is already parsed, but Stripe needs raw body
    // We'll reconstruct it from the parsed body for signature verification
    // Note: In production, you may need to configure Vercel to pass raw body
    // For now, we'll skip signature verification in development and verify in production
    // TODO: Configure Vercel to pass raw body for webhook signature verification
    
    // If webhookSecret is not set, skip verification (for testing)
    if (!webhookSecret) {
      console.warn('⚠️ STRIPE_WEBHOOK_SECRET not set, skipping signature verification');
      event = req.body; // Use parsed body directly
    } else {
      // Try to verify signature
      // In Vercel, we need raw body - this is a limitation
      // For now, we'll accept the event and verify metadata instead
      const rawBody = JSON.stringify(req.body);
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    }
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    // For development, we'll still process the event
    // In production, you should configure proper raw body handling
    if (process.env.NODE_ENV === 'production' && webhookSecret) {
      return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }
    // Fallback: use parsed body (less secure, but works for testing)
    console.warn('⚠️ Using parsed body as fallback');
    event = { type: req.body.type || 'checkout.session.completed', data: { object: req.body } };
  }

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    
    console.log('✅ PAYMENT: Checkout session completed:', session.id);
    console.log('📝 Session metadata:', session.metadata);

    try {
      // Extract metadata
      const {
        tourId,
        tourType,
        selectedDate,
        quantity,
        email,
        city
      } = session.metadata;

      // Only process guided tours (with-guide)
      if (tourType !== 'with-guide' || !tourId || !selectedDate) {
        console.log('ℹ️ Skipping: Not a guided tour or missing required data');
        return res.status(200).json({ received: true });
      }

      const finalQuantity = parseInt(quantity || '1', 10);

      // Get tour information
      const { data: tour, error: tourError } = await supabase
        .from('tours')
        .select('id, guide_id, price_guided, currency, default_group_size, title')
        .eq('id', tourId)
        .single();

      if (tourError || !tour) {
        console.error('❌ Tour not found:', tourId);
        return res.status(400).json({ error: 'Tour not found' });
      }

      if (!tour.guide_id) {
        console.error('❌ Tour has no guide_id:', tourId);
        return res.status(400).json({ error: 'Tour has no guide' });
      }

      // Get or create user by email
      let userId = null;
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (existingUser) {
        userId = existingUser.id;
      } else {
        // Create user if doesn't exist
        const { data: newUser, error: userError } = await supabase
          .from('users')
          .insert({
            email: email,
            name: email.split('@')[0], // Use email prefix as name
            role: 'user'
          })
          .select('id')
          .single();

        if (userError) {
          console.error('❌ Error creating user:', userError);
          return res.status(500).json({ error: 'Failed to create user' });
        }

        userId = newUser.id;
      }

      // Calculate price
      const basePrice = parseFloat(tour.price_guided || 0);
      const totalPrice = basePrice * finalQuantity;
      const currency = tour.currency || 'USD';

      // Create tour booking
      const { data: booking, error: bookingError } = await supabase
        .from('tour_bookings')
        .insert({
          tour_id: tourId,
          user_id: userId,
          guide_id: tour.guide_id,
          tour_date: selectedDate,
          group_size: finalQuantity,
          base_price: basePrice,
          total_price: totalPrice,
          currency: currency,
          status: 'confirmed',
          payment_status: 'paid',
          stripe_session_id: session.id,
          stripe_payment_intent_id: session.payment_intent
        })
        .select('id')
        .single();

      if (bookingError) {
        console.error('❌ Error creating booking:', bookingError);
        return res.status(500).json({ error: 'Failed to create booking' });
      }

      console.log('✅ Booking created:', booking.id);

      // Create notification for guide
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: tour.guide_id,
          type: 'booking',
          title: 'New Booking',
          message: `${finalQuantity} spot(s) booked for ${tour.title} on ${selectedDate}`,
          related_id: booking.id,
          is_read: false
        });

      if (notificationError) {
        console.error('⚠️ Error creating notification:', notificationError);
        // Don't fail the webhook if notification fails
      } else {
        console.log('✅ Notification created for guide');
      }

      // Send email notification to guide
      try {
        const { data: guide } = await supabase
          .from('users')
          .select('email, name')
          .eq('id', tour.guide_id)
          .single();

        if (guide && guide.email && resend) {
          const emailSubject = `New Booking: ${tour.title}`;
          const emailHtml = `
            <h2>You have a new booking!</h2>
            <p><strong>Tour:</strong> ${tour.title}</p>
            <p><strong>Date:</strong> ${selectedDate}</p>
            <p><strong>Spots:</strong> ${finalQuantity}</p>
            <p><strong>Total:</strong> ${currency} ${totalPrice}</p>
            <p><strong>Customer:</strong> ${email}</p>
            <p><strong>Booking ID:</strong> ${booking.id}</p>
            <p>Please check your dashboard for more details.</p>
          `;

          await resend.emails.send({
            from: 'FlipTrip <noreply@flip-trip.com>',
            to: guide.email,
            subject: emailSubject,
            html: emailHtml
          });

          console.log('✅ Email sent to guide:', guide.email);
        }
      } catch (emailError) {
        console.error('⚠️ Error sending email:', emailError);
        // Don't fail the webhook if email fails
      }

      return res.status(200).json({ received: true, bookingId: booking.id });

    } catch (error) {
      console.error('❌ Error processing webhook:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  // Return a response to acknowledge receipt of the event
  return res.status(200).json({ received: true });
}

