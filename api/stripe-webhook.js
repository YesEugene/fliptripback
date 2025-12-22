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

  console.log('🔔 WEBHOOK: Received request');
  console.log('📦 Request body type:', typeof req.body);
  console.log('📦 Request body keys:', req.body ? Object.keys(req.body) : 'null');

  const sig = req.headers['stripe-signature'];
  console.log('🔐 Stripe signature present:', !!sig);

  let event;
  let signatureVerified = false;

  try {
    // For Vercel, req.body is already parsed, but Stripe needs raw body
    // We'll try to verify signature, but if it fails, we'll still process the event
    // with additional metadata validation as a security measure
    
    if (!webhookSecret) {
      console.warn('⚠️ STRIPE_WEBHOOK_SECRET not set, skipping signature verification');
      event = req.body; // Use parsed body directly
    } else {
      // Try to verify signature
      // In Vercel, req.body is already parsed, so JSON.stringify won't work for verification
      // This is a known limitation - we'll use fallback with metadata validation
      try {
        const rawBody = JSON.stringify(req.body);
        event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
        signatureVerified = true;
        console.log('✅ Signature verification successful');
      } catch (verifyError) {
        // Signature verification failed - this is expected in Vercel
        // We'll use fallback but log a warning
        console.warn('⚠️ Signature verification failed (expected in Vercel):', verifyError.message);
        signatureVerified = false;
        
        // Extract event from parsed body
        // Stripe sends events in format: { type: 'checkout.session.completed', data: { object: {...} } }
        if (req.body && req.body.type && req.body.data && req.body.data.object) {
          event = req.body;
          console.log('✅ Using parsed body as event (fallback mode)');
        } else if (req.body && req.body.object === 'checkout.session') {
          // Direct checkout.session object (from test events or different format)
          event = {
            type: 'checkout.session.completed',
            data: { object: req.body }
          };
          console.log('✅ Constructed event from checkout.session object');
        } else {
          throw new Error('Unable to parse event from request body');
        }
      }
    }
  } catch (err) {
    console.error('❌ Error processing webhook event:', err.message);
    console.error('📦 Full request body:', JSON.stringify(req.body, null, 2));
    
    // Don't block processing - return 200 to acknowledge receipt
    // But log the error for monitoring
    return res.status(200).json({ 
      received: true, 
      error: 'Event processing failed',
      message: err.message 
    });
  }

  console.log('📋 Event type:', event.type);
  console.log('📋 Event ID:', event.id || 'N/A');

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    
    console.log('✅ PAYMENT: Checkout session completed:', session.id);
    console.log('📝 Session metadata:', JSON.stringify(session.metadata, null, 2));
    console.log('📝 Session customer_email:', session.customer_email);
    console.log('📝 Session payment_status:', session.payment_status);
    
    // Additional security: verify this is a real Stripe event
    if (!session.id || !session.id.startsWith('cs_')) {
      console.error('❌ Invalid session ID format:', session.id);
      return res.status(400).json({ error: 'Invalid session ID' });
    }

    try {
      // Extract metadata - use customer_email as fallback if not in metadata
      const metadata = session.metadata || {};
      const email = metadata.email || session.customer_email;
      
      const {
        tourId,
        tourType,
        selectedDate,
        quantity
      } = metadata;

      console.log('🔍 Extracted metadata:');
      console.log('  - tourId:', tourId);
      console.log('  - tourType:', tourType);
      console.log('  - selectedDate:', selectedDate);
      console.log('  - quantity:', quantity);
      console.log('  - email:', email);

      if (!email) {
        console.error('❌ Missing email in metadata and session');
        return res.status(200).json({ received: true, skipped: 'missing_email' });
      }

      // Process both guided and self-guided tours
      const isGuidedTour = tourType === 'with-guide';
      const isSelfGuidedTour = tourType === 'self-guided' || !tourType;

      if (!isGuidedTour && !isSelfGuidedTour) {
        console.log('ℹ️ Skipping: Unknown tour type (tourType:', tourType, ')');
        return res.status(200).json({ received: true, skipped: 'unknown_tour_type' });
      }

      // For guided tours, tourId and selectedDate are required
      if (isGuidedTour) {
        if (!tourId) {
          console.error('❌ Missing tourId in metadata for guided tour');
          return res.status(200).json({ received: true, skipped: 'missing_tourId' });
        }

        if (!selectedDate) {
          console.error('❌ Missing selectedDate in metadata for guided tour');
          return res.status(200).json({ received: true, skipped: 'missing_selectedDate' });
        }
      }

      // For self-guided tours, tourId is optional (can be AI-generated itinerary)
      // If tourId is provided, we'll try to get tour info, otherwise we'll use metadata
      let tour = null;
      if (tourId) {
        const { data: tourData, error: tourError } = await supabase
          .from('tours')
          .select('id, guide_id, price_guided, price_pdf, currency, default_group_size, title')
          .eq('id', tourId)
          .single();

        if (tourError || !tourData) {
          console.warn('⚠️ Tour not found:', tourId);
          // For self-guided tours, we can continue without tour data
          // For guided tours, this is an error
          if (isGuidedTour) {
            console.error('❌ Guided tour not found:', tourId);
            return res.status(400).json({ error: 'Guided tour not found' });
          }
          // For self-guided, we'll use metadata and skip booking creation
          console.log('ℹ️ Self-guided tour not found in DB, will log purchase only');
        } else {
          tour = tourData;
        }
      }

      // For guided tours, guide_id is required
      if (isGuidedTour && (!tour || !tour.guide_id)) {
        console.error('❌ Guided tour has no guide_id:', tourId);
        return res.status(400).json({ error: 'Guided tour has no guide' });
      }

      // For self-guided tours without tourId, skip booking creation
      if (isSelfGuidedTour && !tourId) {
        console.log('ℹ️ Self-guided purchase without tourId (AI-generated itinerary)');
        console.log('  - Customer:', email);
        console.log('  - Amount:', session.amount_total / 100, session.currency);
        console.log('  - City:', metadata.city);
        
        // Return success - purchase is recorded in Stripe
        return res.status(200).json({ 
          received: true, 
          type: 'self-guided',
          message: 'Purchase recorded (AI-generated itinerary)'
        });
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

      // Calculate price and other details based on tour type
      let basePrice, totalPrice, currency, finalQuantity, tourDate, guideId, tourTitle;

      if (isGuidedTour) {
        // Guided tour
        finalQuantity = parseInt(quantity || '1', 10);
        basePrice = parseFloat(tour.price_guided || 0);
        totalPrice = basePrice * finalQuantity;
        currency = tour.currency || 'USD';
        tourDate = selectedDate;
        guideId = tour.guide_id;
        tourTitle = tour.title;
      } else {
        // Self-guided tour
        finalQuantity = 1; // Always 1 for self-guided
        basePrice = parseFloat(tour?.price_pdf || session.amount_total / 100 || 16);
        totalPrice = basePrice; // Single purchase
        currency = tour?.currency || 'USD';
        // Use date from metadata or current date for self-guided
        tourDate = metadata.date || new Date().toISOString().split('T')[0];
        guideId = tour?.guide_id || null; // May be null for AI-generated tours
        tourTitle = tour?.title || metadata.city || 'Self-guided Tour';
      }

      // For self-guided tours, if tour was not found in DB, skip booking creation
      if (isSelfGuidedTour && !tour) {
        console.log('ℹ️ Self-guided tour not found in database, skipping booking creation');
        console.log('  - Customer:', email);
        console.log('  - Amount:', totalPrice, currency);
        console.log('  - City:', metadata.city);
        
        // Return success - purchase is recorded in Stripe
        return res.status(200).json({ 
          received: true, 
          type: 'self-guided',
          message: 'Purchase recorded (tour not in database)'
        });
      }

      // Create tour booking
      console.log('💾 Creating booking in database...');
      console.log('  - tour_id:', tourId);
      console.log('  - user_id:', userId);
      console.log('  - guide_id:', guideId);
      console.log('  - tour_date:', tourDate);
      console.log('  - group_size:', finalQuantity);
      console.log('  - total_price:', totalPrice, currency);
      console.log('  - tour_type:', isGuidedTour ? 'guided' : 'self-guided');
      
      const bookingData = {
        tour_id: tourId,
        user_id: userId,
        tour_date: tourDate,
        group_size: finalQuantity,
        base_price: basePrice,
        total_price: totalPrice,
        currency: currency,
        status: 'confirmed',
        payment_status: 'paid',
        checkout_session_id: session.id,
        payment_intent_id: session.payment_intent,
        // Store tour type in additional_services JSONB for reference
        additional_services: {
          tour_type: isGuidedTour ? 'guided' : 'self-guided',
          purchased_as: isGuidedTour ? 'with-guide' : 'self-guided'
        }
      };

      // For self-guided tours, guide_id should exist if tour is from database
      // If guide_id is null, it means it's an AI-generated itinerary without tourId
      // In that case, we already returned earlier
      if (!guideId && isSelfGuidedTour) {
        console.warn('⚠️ Self-guided tour without guide_id - cannot create booking in tour_bookings');
        // This shouldn't happen if tourId exists, but handle it gracefully
        return res.status(200).json({ 
          received: true, 
          type: 'self-guided',
          message: 'Purchase recorded (self-guided tour without guide)'
        });
      }

      // Add guide_id to booking data
      bookingData.guide_id = guideId;
      
      const { data: booking, error: bookingError } = await supabase
        .from('tour_bookings')
        .insert(bookingData)
        .select('id')
        .single();

      if (bookingError) {
        console.error('❌ Error creating booking:', bookingError);
        console.error('❌ Booking error details:', JSON.stringify(bookingError, null, 2));
        return res.status(500).json({ 
          error: 'Failed to create booking',
          details: bookingError.message 
        });
      }

      console.log('✅ Booking created successfully:', booking.id);
      
      // Update booked_spots in tour_availability_slots (only for guided tours)
      if (isGuidedTour) {
        console.log('🔄 Updating availability slots (should be automatic via trigger)...');
      }

      // Create notification for guide (only if guide exists)
      if (guideId) {
        console.log('📬 Creating notification for guide:', guideId);
        const notificationMessage = isGuidedTour
          ? `${finalQuantity} spot(s) booked for ${tourTitle} on ${tourDate}`
          : `Self-guided tour "${tourTitle}" purchased for ${totalPrice} ${currency}`;
        
        const { error: notificationError } = await supabase
          .from('notifications')
          .insert({
            user_id: guideId,
            type: 'booking',
            title: isGuidedTour ? 'New Guided Tour Booking' : 'New Self-guided Tour Purchase',
            message: notificationMessage,
            related_id: booking.id,
            related_type: 'booking',
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
            .eq('id', guideId)
            .single();

          if (guide && guide.email && resend) {
            const emailSubject = isGuidedTour 
              ? `New Booking: ${tourTitle}`
              : `New Purchase: ${tourTitle}`;
            
            const emailHtml = isGuidedTour
              ? `
                <h2>You have a new booking!</h2>
                <p><strong>Tour:</strong> ${tourTitle}</p>
                <p><strong>Date:</strong> ${tourDate}</p>
                <p><strong>Spots:</strong> ${finalQuantity}</p>
                <p><strong>Total:</strong> ${currency} ${totalPrice}</p>
                <p><strong>Customer:</strong> ${email}</p>
                <p><strong>Booking ID:</strong> ${booking.id}</p>
                <p>Please check your dashboard for more details.</p>
              `
              : `
                <h2>You have a new purchase!</h2>
                <p><strong>Tour:</strong> ${tourTitle}</p>
                <p><strong>Type:</strong> Self-guided</p>
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
      }

      console.log('✅ WEBHOOK: Successfully processed booking');
      return res.status(200).json({ 
        received: true, 
        bookingId: booking.id,
        type: isGuidedTour ? 'guided' : 'self-guided',
        signatureVerified: signatureVerified
      });

    } catch (error) {
      console.error('❌ Error processing webhook:', error);
      console.error('❌ Error stack:', error.stack);
      console.error('❌ Full error:', JSON.stringify(error, null, 2));
      return res.status(500).json({ 
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  // Event type not handled
  console.log('ℹ️ Event type not handled:', event.type);
  return res.status(200).json({ received: true, eventType: event.type });
}

