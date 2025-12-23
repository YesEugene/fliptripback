// Admin Users API - Returns users for admin dashboard
import { supabase } from '../database/db.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
  // CORS headers - ALWAYS set first
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
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      if (!supabase) {
        return res.status(500).json({
          success: false,
          error: 'Database not configured'
        });
      }

      const { search, role } = req.query;

      let query = supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (search) {
        query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%`);
      }

      if (role) {
        query = query.eq('role', role);
      }

      const { data: users, error } = await query;

      if (error) {
        throw error;
      }

      // Helper function to safely parse additional_services
      const parseAdditionalServices = (additionalServices) => {
        if (!additionalServices) return null;
        if (typeof additionalServices === 'object') return additionalServices;
        if (typeof additionalServices === 'string') {
          try {
            return JSON.parse(additionalServices);
          } catch (e) {
            return null;
          }
        }
        return null;
      };

      // Get all user IDs for statistics queries
      const userIds = (users || []).map(u => u.id);
      const guideIds = (users || []).filter(u => u.role === 'guide' || u.role === 'creator').map(u => u.id);

      // Parallel queries for all statistics
      const [
        bookingsResult,
        toursCreatedResult,
        toursGeneratedResult,
        toursPurchasedResult
      ] = await Promise.all([
        // Get bookings for sales statistics
        supabase
          .from('tour_bookings')
          .select(`
            guide_id,
            total_price,
            payment_status,
            additional_services,
            tour:tours(id, default_format)
          `)
          .eq('payment_status', 'paid'),
        
        // Get tours created by guides (exclude user_generated)
        guideIds.length > 0 ? supabase
          .from('tours')
          .select('guide_id')
          .in('guide_id', guideIds)
          .or('source.is.null,source.in.(guide,admin)')
          : Promise.resolve({ data: [], error: null }),
        
        // Get generated tours (user_generated) for all users
        userIds.length > 0 ? (async () => {
          // Query for user_id matches
          const userMatches = await supabase
            .from('tours')
            .select('user_id, guide_id')
            .eq('source', 'user_generated')
            .in('user_id', userIds);
          
          // Query for guide_id matches
          const guideMatches = await supabase
            .from('tours')
            .select('user_id, guide_id')
            .eq('source', 'user_generated')
            .in('guide_id', userIds);
          
          // Combine results, removing duplicates
          const combined = [...(userMatches.data || []), ...(guideMatches.data || [])];
          const unique = Array.from(new Map(combined.map(t => [t.user_id || t.guide_id, t])).values());
          
          return { data: unique, error: userMatches.error || guideMatches.error };
        })() : Promise.resolve({ data: [], error: null }),
        
        // Get purchased tours (unique tour_id per user)
        userIds.length > 0 ? supabase
          .from('tour_bookings')
          .select('user_id, tour_id')
          .in('user_id', userIds)
          .eq('payment_status', 'paid')
          : Promise.resolve({ data: [], error: null })
      ]);

      const allBookings = bookingsResult.data || [];

      // Group bookings by guide_id for sales statistics
      const bookingsByGuide = {};
      if (allBookings) {
        allBookings.forEach(booking => {
          if (!booking.guide_id) return;
          
          if (!bookingsByGuide[booking.guide_id]) {
            bookingsByGuide[booking.guide_id] = {
              pdfSales: 0,
              guidedSales: 0,
              pdfRevenue: 0,
              guidedRevenue: 0
            };
          }

          const additionalServices = parseAdditionalServices(booking.additional_services);
          let isGuided = false;
          let isSelfGuided = false;

          // Check additional_services first (from webhook)
          if (additionalServices) {
            if (additionalServices.tour_type === 'guided' || additionalServices.purchased_as === 'with-guide') {
              isGuided = true;
            } else if (additionalServices.tour_type === 'self-guided' || additionalServices.purchased_as === 'self-guided') {
              isSelfGuided = true;
            }
          }

          // Fallback to tour.default_format
          if (!isGuided && !isSelfGuided) {
            const tourFormat = booking.tour?.default_format;
            if (tourFormat === 'with_guide' || tourFormat === 'guided') {
              isGuided = true;
            } else {
              isSelfGuided = true;
            }
          }

          const price = parseFloat(booking.total_price || 0);

          if (isGuided) {
            bookingsByGuide[booking.guide_id].guidedSales++;
            bookingsByGuide[booking.guide_id].guidedRevenue += price;
          } else if (isSelfGuided) {
            bookingsByGuide[booking.guide_id].pdfSales++;
            bookingsByGuide[booking.guide_id].pdfRevenue += price;
          }
        });
      }

      // Count tours created by guides
      const toursCreatedByGuide = {};
      if (toursCreatedResult.data) {
        toursCreatedResult.data.forEach(tour => {
          if (tour.guide_id) {
            toursCreatedByGuide[tour.guide_id] = (toursCreatedByGuide[tour.guide_id] || 0) + 1;
          }
        });
      }

      // Count generated tours (user_generated) per user
      const toursGeneratedByUser = {};
      if (toursGeneratedResult.data) {
        toursGeneratedResult.data.forEach(tour => {
          // Use user_id if available, otherwise guide_id
          const userId = tour.user_id || tour.guide_id;
          if (userId) {
            toursGeneratedByUser[userId] = (toursGeneratedByUser[userId] || 0) + 1;
          }
        });
      }

      // Count purchased tours (unique tour_id) per user
      const toursPurchasedByUser = {};
      if (toursPurchasedResult.data) {
        const userToursMap = {};
        toursPurchasedResult.data.forEach(booking => {
          if (booking.user_id && booking.tour_id) {
            if (!userToursMap[booking.user_id]) {
              userToursMap[booking.user_id] = new Set();
            }
            userToursMap[booking.user_id].add(booking.tour_id);
          }
        });
        // Convert Sets to counts
        Object.keys(userToursMap).forEach(userId => {
          toursPurchasedByUser[userId] = userToursMap[userId].size;
        });
      }

      // Format users for display (exclude password_hash) and add all stats
      const formattedUsers = (users || []).map(user => {
        const salesStats = bookingsByGuide[user.id] || {
          pdfSales: 0,
          guidedSales: 0,
          pdfRevenue: 0,
          guidedRevenue: 0
        };

        return {
          id: user.id,
          email: user.email,
          name: user.name || 'N/A',
          role: user.role || 'user',
          is_active: user.is_active !== false, // Default to true if not set
          createdAt: user.created_at,
          updatedAt: user.updated_at,
          sales: {
            pdf: salesStats.pdfSales,
            guided: salesStats.guidedSales,
            pdfRevenue: salesStats.pdfRevenue,
            guidedRevenue: salesStats.guidedRevenue
          },
          // New statistics fields
          toursCreated: toursCreatedByGuide[user.id] || 0, // Tours created by guide (only for guides)
          toursGenerated: toursGeneratedByUser[user.id] || 0, // AI-generated tours (for all users)
          toursPurchased: toursPurchasedByUser[user.id] || 0 // Purchased tours (unique tour_id, for all users)
        };
      });

      return res.status(200).json({
        success: true,
        users: formattedUsers
      });
    } catch (error) {
      console.error('❌ Error fetching users:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch users',
        message: error.message
      });
    }
  }

  // Handle POST - create user
  if (req.method === 'POST') {
    try {
      if (!supabase) {
        return res.status(500).json({
          success: false,
          error: 'Database not configured'
        });
      }

      console.log('📥 Received user creation request:', {
        email: req.body?.email,
        hasPassword: !!req.body?.password,
        passwordLength: req.body?.password?.length,
        name: req.body?.name,
        role: req.body?.role,
        bodyKeys: Object.keys(req.body || {})
      });

      const { email, password, name, role = 'user' } = req.body;

      // Validation - check for empty strings too
      if (!email || !email.trim()) {
        console.error('❌ Validation failed: email is missing or empty');
        return res.status(400).json({
          success: false,
          error: 'Email is required',
          details: 'Email field is missing or empty'
        });
      }

      // Generate password if not provided (for admin-created users)
      let finalPassword = password;
      let generatedPassword = false;
      
      if (!password || !password.trim() || password.length < 6) {
        // Generate a random secure password
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        finalPassword = '';
        for (let i = 0; i < 12; i++) {
          finalPassword += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        generatedPassword = true;
        console.log('🔑 Generated password for user (not shown in logs for security)');
      }

      // Check if user already exists
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking existing user:', checkError);
        return res.status(500).json({
          success: false,
          error: 'Error checking existing user',
          message: checkError.message
        });
      }

      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'User with this email already exists'
        });
      }

      // Hash password (use finalPassword which may be generated)
      console.log('🔑 Hashing password (length:', finalPassword.length, 'generated:', generatedPassword, ')');
      const hashedPassword = await bcrypt.hash(finalPassword, 10);
      console.log('🔑 Password hashed successfully (hash length:', hashedPassword.length, ')');

      // Create user directly in users table
      const userId = uuidv4();
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          id: userId,
          email,
          password_hash: hashedPassword,
          name: name || null,
          role: role,
          is_active: true // Set user as active by default
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ Error creating user in database:', insertError);
        console.error('❌ Insert error details:', JSON.stringify(insertError, null, 2));
        // Ensure CORS headers are set even on error
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
        return res.status(500).json({
          success: false,
          error: 'Failed to create user',
          message: insertError.message,
          code: insertError.code
        });
      }

      // If guide or creator, create guide profile
      if (role === 'guide' || role === 'creator') {
        // Based on auth-register.js, guides table uses 'id' column, not 'user_id'
        const { error: guideError } = await supabase
          .from('guides')
          .insert({
            id: userId, // Use id column (same as user id)
            name: name || email.split('@')[0] || 'Guide'
          });

        if (guideError) {
          console.warn('Warning: Could not create guide profile:', guideError);
          // This is not critical - user can still be created without guide profile
        } else {
          console.log('✅ Guide profile created successfully');
        }
      }

      // Build response - ALWAYS include password if it was generated
      const response = {
        success: true,
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role
        }
      };

      // ALWAYS include password in response if it was generated
      // Include in multiple fields for frontend compatibility
      if (generatedPassword) {
        // Frontend expects tempPassword (lowercase 't')
        response.tempPassword = finalPassword;
        response.temporaryPassword = finalPassword;
        response.generatedPassword = finalPassword;
        response.password = finalPassword;
        response.message = 'Password was auto-generated. Please save it and share with the user.';
        console.log(`✅ User created with generated password`);
        console.log(`🔑 Password value: ${finalPassword}`);
        console.log(`🔑 Password fields in response: tempPassword=${!!response.tempPassword}, temporaryPassword=${!!response.temporaryPassword}, generatedPassword=${!!response.generatedPassword}`);
      } else if (password && password.trim().length >= 6) {
        // If password was provided and valid, don't return it for security
        response.message = 'User created successfully.';
      } else {
        // This shouldn't happen, but just in case
        response.message = 'User created successfully.';
      }

      console.log('📤 Final response object:', JSON.stringify({
        success: response.success,
        hasGeneratedPassword: !!response.generatedPassword,
        hasTemporaryPassword: !!response.temporaryPassword,
        hasPassword: !!response.password,
        generatedPasswordLength: response.generatedPassword?.length || 0,
        temporaryPasswordLength: response.temporaryPassword?.length || 0
      }, null, 2));

      return res.status(201).json(response);
    } catch (error) {
      console.error('❌ Error creating user:', error);
      // Ensure CORS headers are set even on error
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
      return res.status(500).json({
        success: false,
        error: 'Failed to create user',
        message: error.message
      });
    }
  }

  // Handle DELETE - delete user
  if (req.method === 'DELETE') {
    try {
      if (!supabase) {
        return res.status(500).json({
          success: false,
          error: 'Database not configured'
        });
      }

      const { id } = req.query;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
      }

      // Delete user from Supabase Auth (this will cascade to users table)
      const { error: deleteError } = await supabase.auth.admin.deleteUser(id);

      if (deleteError) {
        // If admin API doesn't work, try direct delete from users table
        const { error: dbError } = await supabase
          .from('users')
          .delete()
          .eq('id', id);

        if (dbError) {
          throw dbError;
        }
      }

      console.log(`✅ User ${id} deleted successfully`);

      return res.status(200).json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      console.error('❌ Error deleting user:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete user',
        message: error.message
      });
    }
  }

  // Handle PUT/PATCH - update user
  if (req.method === 'PUT' || req.method === 'PATCH') {
    try {
      if (!supabase) {
        return res.status(500).json({
          success: false,
          error: 'Database not configured'
        });
      }

      const { id } = req.query;
      const { email, name, role } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
      }

      const updateData = {};
      if (email !== undefined) updateData.email = email;
      if (name !== undefined) updateData.name = name;
      if (role !== undefined) updateData.role = role;

      const { data: user, error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      return res.status(200).json({
        success: true,
        user
      });
    } catch (error) {
      console.error('❌ Error updating user:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update user',
        message: error.message
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

