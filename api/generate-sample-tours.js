/**
 * API endpoint to generate 10 sample tours in the database
 * POST /api/generate-sample-tours
 * 
 * This endpoint creates 10 sample tours for different cities with various tags and locations.
 */

import { supabase } from '../database/db.js';

// Sample tours data
const sampleTours = [
  {
    city: 'Paris',
    country: 'France',
    title: 'Romantic Weekend in Paris',
    description: 'Discover the most romantic spots in Paris with this carefully curated tour.',
    tags: ['romantic', 'culture', 'food'],
    preview_media_url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&h=600&fit=crop&q=80',
    daily_plan: [
      {
        day: 1,
        blocks: [
          {
            time: '09:00 - 11:00',
            items: [
              {
                title: 'Eiffel Tower',
                address: 'Champ de Mars, 5 Avenue Anatole France, 75007 Paris',
                category: 'landmark',
                description: 'Start your romantic journey at the iconic Eiffel Tower.',
                recommendations: 'Book tickets in advance to avoid long queues.'
              }
            ]
          },
          {
            time: '12:00 - 14:00',
            items: [
              {
                title: 'Le Marais District',
                address: 'Le Marais, Paris',
                category: 'neighborhood',
                description: 'Explore charming streets and enjoy lunch at a local bistro.',
                recommendations: 'Try the famous falafel in Rue des Rosiers.'
              }
            ]
          }
        ]
      }
    ]
  },
  {
    city: 'Barcelona',
    country: 'Spain',
    title: 'Artistic Exploration in Barcelona',
    description: 'Immerse yourself in Barcelona\'s rich art and architecture scene.',
    tags: ['culture', 'art', 'architecture'],
    preview_media_url: 'https://images.unsplash.com/photo-1539037116277-4db20889f2d2?w=800&h=600&fit=crop&q=80',
    daily_plan: [
      {
        day: 1,
        blocks: [
          {
            time: '10:00 - 12:00',
            items: [
              {
                title: 'Sagrada Familia',
                address: 'Carrer de Mallorca, 401, 08013 Barcelona',
                category: 'landmark',
                description: 'Visit Gaudi\'s masterpiece, the unfinished basilica.',
                recommendations: 'Purchase tickets online to skip the line.'
              }
            ]
          },
          {
            time: '14:00 - 16:00',
            items: [
              {
                title: 'Park Güell',
                address: '08024 Barcelona',
                category: 'park',
                description: 'Explore the colorful park designed by Antoni Gaudi.',
                recommendations: 'Wear comfortable shoes for walking.'
              }
            ]
          }
        ]
      }
    ]
  },
  {
    city: 'Amsterdam',
    country: 'Netherlands',
    title: 'Cycling Adventure in Amsterdam',
    description: 'Experience Amsterdam like a local with this cycling tour.',
    tags: ['active', 'cycling', 'nature'],
    preview_media_url: 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=800&h=600&fit=crop&q=80',
    daily_plan: [
      {
        day: 1,
        blocks: [
          {
            time: '09:00 - 11:00',
            items: [
              {
                title: 'Vondelpark',
                address: 'Vondelpark, Amsterdam',
                category: 'park',
                description: 'Start your cycling adventure in Amsterdam\'s largest park.',
                recommendations: 'Rent a bike from one of the many rental shops nearby.'
              }
            ]
          },
          {
            time: '13:00 - 15:00',
            items: [
              {
                title: 'Canal Ring',
                address: 'Canal Ring, Amsterdam',
                category: 'landmark',
                description: 'Cycle along the beautiful canal ring, a UNESCO World Heritage site.',
                recommendations: 'Stop for photos at the famous bridges.'
              }
            ]
          }
        ]
      }
    ]
  },
  {
    city: 'Rome',
    country: 'Italy',
    title: 'Ancient History Tour of Rome',
    description: 'Step back in time and explore Rome\'s ancient wonders.',
    tags: ['culture', 'history', 'architecture'],
    preview_media_url: 'https://images.unsplash.com/photo-1529260830199-42c24126f198?w=800&h=600&fit=crop&q=80',
    daily_plan: [
      {
        day: 1,
        blocks: [
          {
            time: '09:00 - 11:00',
            items: [
              {
                title: 'Colosseum',
                address: 'Piazza del Colosseo, 1, 00184 Roma RM',
                category: 'landmark',
                description: 'Visit the iconic Colosseum, symbol of ancient Rome.',
                recommendations: 'Book a guided tour to learn about gladiator history.'
              }
            ]
          },
          {
            time: '12:00 - 14:00',
            items: [
              {
                title: 'Roman Forum',
                address: 'Via della Salara Vecchia, 5/6, 00186 Roma RM',
                category: 'landmark',
                description: 'Walk through the ruins of ancient Rome\'s political center.',
                recommendations: 'Combine with Colosseum ticket for better value.'
              }
            ]
          }
        ]
      }
    ]
  },
  {
    city: 'Lisbon',
    country: 'Portugal',
    title: 'Coastal Charm of Lisbon',
    description: 'Discover Lisbon\'s beautiful coastline and historic neighborhoods.',
    tags: ['romantic', 'culture', 'food'],
    preview_media_url: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800&h=600&fit=crop&q=80',
    daily_plan: [
      {
        day: 1,
        blocks: [
          {
            time: '10:00 - 12:00',
            items: [
              {
                title: 'Belém Tower',
                address: 'Av. Brasília, 1400-038 Lisboa',
                category: 'landmark',
                description: 'Visit the iconic tower that once protected Lisbon\'s harbor.',
                recommendations: 'Try the famous pastéis de nata nearby.'
              }
            ]
          },
          {
            time: '14:00 - 16:00',
            items: [
              {
                title: 'Alfama District',
                address: 'Alfama, Lisbon',
                category: 'neighborhood',
                description: 'Get lost in the narrow streets of Lisbon\'s oldest district.',
                recommendations: 'Listen to Fado music in one of the local taverns.'
              }
            ]
          }
        ]
      }
    ]
  },
  {
    city: 'Berlin',
    country: 'Germany',
    title: 'Modern Art & Nightlife in Berlin',
    description: 'Experience Berlin\'s vibrant art scene and legendary nightlife.',
    tags: ['culture', 'nightlife', 'art'],
    preview_media_url: 'https://images.unsplash.com/photo-1587330979470-3595ac045ab0?w=800&h=600&fit=crop&q=80',
    daily_plan: [
      {
        day: 1,
        blocks: [
          {
            time: '11:00 - 13:00',
            items: [
              {
                title: 'East Side Gallery',
                address: 'Mühlenstraße, 10243 Berlin',
                category: 'landmark',
                description: 'See the longest remaining section of the Berlin Wall, covered in art.',
                recommendations: 'Visit early morning for fewer crowds.'
              }
            ]
          },
          {
            time: '20:00 - 23:00',
            items: [
              {
                title: 'Kreuzberg District',
                address: 'Kreuzberg, Berlin',
                category: 'neighborhood',
                description: 'Explore Berlin\'s most vibrant nightlife district.',
                recommendations: 'Try the local craft beer at one of the many bars.'
              }
            ]
          }
        ]
      }
    ]
  },
  {
    city: 'London',
    country: 'United Kingdom',
    title: 'Royal London Experience',
    description: 'Discover London\'s royal heritage and iconic landmarks.',
    tags: ['culture', 'history', 'family'],
    preview_media_url: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&h=600&fit=crop&q=80',
    daily_plan: [
      {
        day: 1,
        blocks: [
          {
            time: '10:00 - 12:00',
            items: [
              {
                title: 'Buckingham Palace',
                address: 'Westminster, London SW1A 1AA',
                category: 'landmark',
                description: 'Watch the Changing of the Guard ceremony.',
                recommendations: 'Arrive early to get a good viewing spot.'
              }
            ]
          },
          {
            time: '14:00 - 16:00',
            items: [
              {
                title: 'British Museum',
                address: 'Great Russell St, London WC1B 3DG',
                category: 'museum',
                description: 'Explore one of the world\'s greatest museums.',
                recommendations: 'Free entry, but book timed slots online.'
              }
            ]
          }
        ]
      }
    ]
  },
  {
    city: 'Madrid',
    country: 'Spain',
    title: 'Food & Culture in Madrid',
    description: 'Indulge in Madrid\'s culinary delights and cultural treasures.',
    tags: ['food', 'culture', 'romantic'],
    preview_media_url: 'https://images.unsplash.com/photo-1539037116277-4db20889f2d2?w=800&h=600&fit=crop&q=80',
    daily_plan: [
      {
        day: 1,
        blocks: [
          {
            time: '11:00 - 13:00',
            items: [
              {
                title: 'Prado Museum',
                address: 'Calle de Ruiz de Alarcón, 23, 28014 Madrid',
                category: 'museum',
                description: 'Admire masterpieces by Goya, Velázquez, and El Greco.',
                recommendations: 'Free entry on certain days - check schedule.'
              }
            ]
          },
          {
            time: '14:00 - 16:00',
            items: [
              {
                title: 'Mercado de San Miguel',
                address: 'Plaza de San Miguel, s/n, 28005 Madrid',
                category: 'market',
                description: 'Taste authentic Spanish tapas and local delicacies.',
                recommendations: 'Try the jamón ibérico and fresh seafood.'
              }
            ]
          }
        ]
      }
    ]
  },
  {
    city: 'Prague',
    country: 'Czech Republic',
    title: 'Medieval Magic of Prague',
    description: 'Step into a fairy tale in Prague\'s historic Old Town.',
    tags: ['culture', 'history', 'romantic'],
    preview_media_url: 'https://images.unsplash.com/photo-1541849546-216549ae216d?w=800&h=600&fit=crop&q=80',
    daily_plan: [
      {
        day: 1,
        blocks: [
          {
            time: '09:00 - 11:00',
            items: [
              {
                title: 'Prague Castle',
                address: 'Hradčany, 119 08 Praha 1',
                category: 'landmark',
                description: 'Explore the largest ancient castle complex in the world.',
                recommendations: 'Buy tickets online to skip the queue.'
              }
            ]
          },
          {
            time: '14:00 - 16:00',
            items: [
              {
                title: 'Charles Bridge',
                address: 'Karlův most, 110 00 Praha 1',
                category: 'landmark',
                description: 'Walk across the historic bridge with stunning city views.',
                recommendations: 'Visit early morning or sunset for best photos.'
              }
            ]
          }
        ]
      }
    ]
  },
  {
    city: 'Vienna',
    country: 'Austria',
    title: 'Classical Music & Architecture',
    description: 'Experience Vienna\'s imperial grandeur and musical heritage.',
    tags: ['culture', 'music', 'architecture'],
    preview_media_url: 'https://images.unsplash.com/photo-1516550893923-42d28e5677af?w=800&h=600&fit=crop&q=80',
    daily_plan: [
      {
        day: 1,
        blocks: [
          {
            time: '10:00 - 12:00',
            items: [
              {
                title: 'Schönbrunn Palace',
                address: 'Schönbrunner Schloßstraße 47, 1130 Wien',
                category: 'landmark',
                description: 'Visit the former imperial summer residence.',
                recommendations: 'Book a guided tour to see the private apartments.'
              }
            ]
          },
          {
            time: '15:00 - 17:00',
            items: [
              {
                title: 'Vienna State Opera',
                address: 'Opernring 2, 1010 Wien',
                category: 'landmark',
                description: 'Attend a performance at one of the world\'s greatest opera houses.',
                recommendations: 'Book tickets in advance for popular performances.'
              }
            ]
          }
        ]
      }
    ]
  }
];

// Helper function to get or create city
async function getOrCreateCity(cityName, countryName) {
  if (!cityName || !supabase) return null;
  
  try {
    // Try to find existing city
    const { data: existing, error: findError } = await supabase
      .from('cities')
      .select('id')
      .ilike('name', cityName)
      .limit(1)
      .maybeSingle();
    
    if (findError && findError.code !== 'PGRST116') {
      console.error('Error finding city:', findError);
      // If error is not "not found", try to continue
      if (findError.code === 'PGRST116') {
        // Not found, continue to create
      } else {
        // Other error, return null
        return null;
      }
    }
    
    if (existing && existing.id) {
      console.log(`✅ Found existing city: ${cityName} (ID: ${existing.id})`);
      return existing.id;
    }
    
    // Create new city - try without country first
    let cityData = { name: cityName };
    const { data: newCity, error: createError } = await supabase
      .from('cities')
      .insert(cityData)
      .select('id')
      .single();
    
    if (createError) {
      console.error(`❌ Error creating city ${cityName}:`, createError);
      // Try to find again in case it was created by another request
      const { data: retryExisting } = await supabase
        .from('cities')
        .select('id')
        .ilike('name', cityName)
        .limit(1)
        .maybeSingle();
      
      if (retryExisting && retryExisting.id) {
        console.log(`✅ Found city on retry: ${cityName} (ID: ${retryExisting.id})`);
        return retryExisting.id;
      }
      
      return null;
    }
    
    if (newCity && newCity.id) {
      console.log(`✅ Created new city: ${cityName} (ID: ${newCity.id})`);
      return newCity.id;
    }
    
    return null;
  } catch (err) {
    console.error(`❌ Error in getOrCreateCity for ${cityName}:`, err);
    return null;
  }
}

// Helper function to get or create tags
async function getOrCreateTags(tagNames) {
  const tagIds = [];
  
  for (const tagName of tagNames) {
    try {
      // Try to find existing tag
      const { data: existing, error: findError } = await supabase
        .from('tags')
        .select('id')
        .ilike('name', tagName)
        .limit(1)
        .maybeSingle();
      
      if (findError && findError.code !== 'PGRST116') {
        console.error('Error finding tag:', findError);
      }
      
      if (existing) {
        tagIds.push(existing.id);
        continue;
      }
      
      // Create new tag
      const { data: newTag, error: createError } = await supabase
        .from('tags')
        .insert({ name: tagName })
        .select('id')
        .single();
      
      if (createError) {
        console.error(`❌ Error creating tag ${tagName}:`, createError);
        continue;
      }
      
      tagIds.push(newTag.id);
    } catch (err) {
      console.error(`❌ Error in getOrCreateTags for ${tagName}:`, err);
    }
  }
  
  return tagIds;
}

export default async function handler(req, res) {
  // CORS headers
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://www.flip-trip.com',
    'https://fliptripfrontend.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000'
  ];
  
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    if (!supabase) {
      return res.status(500).json({
        success: false,
        error: 'Database not configured'
      });
    }

    console.log('🚀 Starting tour generation...');
    
    // Get a creator user (or create a dummy one for testing)
    let creatorId = null;
    try {
      const { data: users } = await supabase
        .from('users')
        .select('id')
        .in('role', ['creator', 'guide'])
        .limit(1);
      
      if (users && users.length > 0) {
        creatorId = users[0].id;
        console.log(`✅ Using creator ID: ${creatorId}`);
      } else {
        console.warn('⚠️ No creator/guide user found. Tours will be created without creator_id.');
      }
    } catch (err) {
      console.warn('⚠️ Could not fetch creator user:', err.message);
    }
    
    const createdTours = [];
    const errors = [];
    
    for (const tourData of sampleTours) {
      try {
        console.log(`\n📝 Creating tour: ${tourData.title} in ${tourData.city}`);
        
        // Get or create city
        const cityId = await getOrCreateCity(tourData.city, tourData.country);
        if (!cityId) {
          console.error(`❌ Failed to get/create city for ${tourData.city}`);
          errors.push({ tour: tourData.title, error: 'Failed to get/create city' });
          continue;
        }
        
        // Get or create tags
        const tagIds = await getOrCreateTags(tourData.tags);
        console.log(`✅ Tags: ${tourData.tags.join(', ')} (IDs: ${tagIds.join(', ')})`);
        
        // Create tour
        const baseTourData = {
          title: tourData.title,
          description: tourData.description,
          city_id: cityId,
          // country field removed - not in schema
          default_format: 'self_guided',
          duration_type: 'days',
          duration_value: 1,
          price_pdf: 16,
          currency: 'USD',
          preview_media_url: tourData.preview_media_url,
          preview_media_type: 'image',
          is_published: true
        };
        
        if (creatorId) {
          baseTourData.creator_id = creatorId;
        }
        
        const { data: tour, error: tourError } = await supabase
          .from('tours')
          .insert(baseTourData)
          .select('id')
          .single();
        
        if (tourError || !tour) {
          console.error(`❌ Error creating tour:`, tourError);
          errors.push({ tour: tourData.title, error: tourError?.message || 'Unknown error' });
          continue;
        }
        
        console.log(`✅ Tour created with ID: ${tour.id}`);
        createdTours.push({ id: tour.id, title: tourData.title });
        
        // Create tour_tags
        if (tagIds.length > 0) {
          const tourTagInserts = tagIds.map(tagId => ({
            tour_id: tour.id,
            tag_id: tagId
          }));
          
          const { error: tagError } = await supabase
            .from('tour_tags')
            .insert(tourTagInserts);
          
          if (tagError) {
            console.error(`❌ Error creating tour_tags:`, tagError);
          } else {
            console.log(`✅ Created ${tagIds.length} tour tags`);
          }
        }
        
        // Create tour_days, tour_blocks, tour_items
        for (const day of tourData.daily_plan) {
          const { data: tourDay, error: dayError } = await supabase
            .from('tour_days')
            .insert({
              tour_id: tour.id,
              day_number: day.day,
              title: null,
              date_hint: null
            })
            .select('id')
            .single();
          
          if (dayError || !tourDay) {
            console.error(`❌ Error creating tour_day:`, dayError);
            continue;
          }
          
          for (const block of day.blocks) {
            const { data: tourBlock, error: blockError } = await supabase
              .from('tour_blocks')
              .insert({
                tour_day_id: tourDay.id,
                start_time: block.time.split(' - ')[0] || null,
                end_time: block.time.split(' - ')[1] || null,
                title: null
              })
              .select('id')
              .single();
            
            if (blockError || !tourBlock) {
              console.error(`❌ Error creating tour_block:`, blockError);
              continue;
            }
            
            for (let i = 0; i < block.items.length; i++) {
              const item = block.items[i];
              
              // Create location if needed
              let locationId = null;
              const { data: existingLocation } = await supabase
                .from('locations')
                .select('id')
                .eq('name', item.title)
                .eq('city_id', cityId)
                .limit(1)
                .maybeSingle();
              
              if (existingLocation) {
                locationId = existingLocation.id;
              } else {
                const { data: newLocation, error: locError } = await supabase
                  .from('locations')
                  .insert({
                    name: item.title,
                    city_id: cityId,
                    address: item.address,
                    category: item.category || null,
                    description: item.description || null,
                    recommendations: item.recommendations || null,
                    source: 'guide'
                  })
                  .select('id')
                  .single();
                
                if (!locError && newLocation) {
                  locationId = newLocation.id;
                }
              }
              
              if (locationId) {
                const { error: itemError } = await supabase
                  .from('tour_items')
                  .insert({
                    tour_block_id: tourBlock.id,
                    location_id: locationId,
                    custom_title: null,
                    custom_description: item.description || null,
                    custom_recommendations: item.recommendations || null,
                    order_index: i,
                    duration_minutes: null,
                    approx_cost: null
                  });
                
                if (itemError) {
                  console.error(`❌ Error creating tour_item:`, itemError);
                }
              }
            }
          }
        }
        
        console.log(`✅ Successfully created tour: ${tourData.title}`);
      } catch (err) {
        console.error(`❌ Error processing tour ${tourData.title}:`, err);
        errors.push({ tour: tourData.title, error: err.message });
      }
    }
    
    console.log('\n✅ Tour generation complete!');
    
    return res.status(200).json({
      success: true,
      message: `Generated ${createdTours.length} tours`,
      created: createdTours,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('❌ Fatal error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

