/**
 * API Endpoint to update sample tours with enhanced content
 * POST /api/update-sample-tours
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const db = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

// Enhanced tour data (same as in update-sample-tours.js script)
const enhancedTours = [
  {
    city: 'Paris',
    country: 'France',
    title: 'Romantic Weekend in Paris',
    description: 'A charming two-day journey through the romantic streets of Paris, discovering hidden gems and iconic landmarks. Perfect for couples seeking an unforgettable experience in the City of Light.',
    tags: ['romantic', 'culture', 'food', 'architecture'],
    duration_days: 2,
    daily_plan: [
      {
        day: 1,
        blocks: [
          {
            time: '09:00 - 10:30',
            items: [
              {
                title: 'Eiffel Tower',
                address: 'Champ de Mars, 5 Av. Anatole France, 75007 Paris, France',
                category: 'landmark',
                description: 'Start your romantic journey at the iconic iron lattice tower. Take the elevator to the top for breathtaking views of Paris.',
                recommendations: 'Book tickets online in advance to avoid long queues. Visit early morning for fewer crowds.'
              }
            ]
          },
          {
            time: '11:00 - 12:30',
            items: [
              {
                title: 'Seine River Cruise',
                address: 'Port de la Bourdonnais, 75007 Paris, France',
                category: 'activity',
                description: 'Enjoy a romantic cruise along the Seine, passing under historic bridges and seeing Paris from a different perspective.',
                recommendations: 'Opt for an evening cruise for the most romantic experience with city lights.'
              }
            ]
          },
          {
            time: '13:00 - 14:30',
            items: [
              {
                title: 'Le Marais District',
                address: 'Le Marais, 75004 Paris, France',
                category: 'neighborhood',
                description: 'Explore the charming medieval streets, boutique shops, and cozy cafes of this historic district.',
                recommendations: 'Try authentic French pastries at a local patisserie. Perfect for a romantic lunch.'
              }
            ]
          },
          {
            time: '15:00 - 16:30',
            items: [
              {
                title: 'Notre-Dame Cathedral',
                address: '6 Parvis Notre-Dame - Pl. Jean-Paul II, 75004 Paris, France',
                category: 'landmark',
                description: 'Admire the Gothic architecture of this world-famous cathedral, a masterpiece of French medieval art.',
                recommendations: 'Check current visiting hours as restoration work may affect access.'
              }
            ]
          },
          {
            time: '17:00 - 18:30',
            items: [
              {
                title: 'Louvre Museum',
                address: 'Rue de Rivoli, 75001 Paris, France',
                category: 'museum',
                description: 'Discover the world\'s largest art museum, home to the Mona Lisa and thousands of masterpieces.',
                recommendations: 'Book timed entry online. Focus on specific galleries to avoid overwhelm.'
              }
            ]
          },
          {
            time: '19:30 - 21:30',
            items: [
              {
                title: 'Montmartre & Sacré-Cœur',
                address: '35 Rue du Chevalier de la Barre, 75018 Paris, France',
                category: 'landmark',
                description: 'Climb the steps to the basilica and enjoy panoramic views. Explore the artistic neighborhood below.',
                recommendations: 'Visit at sunset for the most romantic views. Dine at a traditional French bistro nearby.'
              }
            ]
          }
        ]
      },
      {
        day: 2,
        blocks: [
          {
            time: '09:00 - 10:30',
            items: [
              {
                title: 'Arc de Triomphe',
                address: 'Pl. Charles de Gaulle, 75008 Paris, France',
                category: 'landmark',
                description: 'Climb to the top for stunning views of the Champs-Élysées and the city\'s grand boulevards.',
                recommendations: 'Arrive early to avoid crowds. The view from the top is worth the climb.'
              }
            ]
          },
          {
            time: '11:00 - 12:30',
            items: [
              {
                title: 'Champs-Élysées',
                address: 'Champs-Élysées, 75008 Paris, France',
                category: 'shopping',
                description: 'Stroll down the world\'s most famous avenue, shop at luxury boutiques, and enjoy a coffee at a sidewalk cafe.',
                recommendations: 'Perfect for window shopping and people watching. Try Ladurée for famous macarons.'
              }
            ]
          },
          {
            time: '13:00 - 14:30',
            items: [
              {
                title: 'Versailles Palace',
                address: 'Place d\'Armes, 78000 Versailles, France',
                category: 'landmark',
                description: 'Take a day trip to the opulent palace of Versailles, a symbol of absolute monarchy.',
                recommendations: 'Book tickets in advance. Allocate at least 3-4 hours. Don\'t miss the Hall of Mirrors.'
              }
            ]
          },
          {
            time: '15:30 - 17:00',
            items: [
              {
                title: 'Musée d\'Orsay',
                address: '1 Rue de la Légion d\'Honneur, 75007 Paris, France',
                category: 'museum',
                description: 'Explore the world\'s finest collection of Impressionist art in a beautiful former railway station.',
                recommendations: 'Less crowded than the Louvre. Focus on the Impressionist galleries on the top floor.'
              }
            ]
          },
          {
            time: '18:00 - 19:30',
            items: [
              {
                title: 'Latin Quarter',
                address: 'Latin Quarter, 75005 Paris, France',
                category: 'neighborhood',
                description: 'Wander through historic streets, discover hidden bookshops, and enjoy the bohemian atmosphere.',
                recommendations: 'Perfect for a romantic dinner. Try traditional French cuisine at a local restaurant.'
              }
            ]
          },
          {
            time: '20:00 - 22:00',
            items: [
              {
                title: 'Seine River Walk',
                address: 'Quai de la Tournelle, 75005 Paris, France',
                category: 'activity',
                description: 'End your romantic weekend with a moonlit walk along the Seine, taking in the illuminated monuments.',
                recommendations: 'Bring a bottle of wine and find a quiet spot on the riverbank for a perfect ending.'
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
    description: 'Experience Vienna\'s imperial grandeur and musical heritage. From opulent palaces to world-class opera, discover why Vienna is the capital of classical music.',
    tags: ['culture', 'music', 'architecture', 'imperial'],
    duration_days: 1,
    daily_plan: [
      {
        day: 1,
        blocks: [
          {
            time: '09:00 - 11:00',
            items: [
              {
                title: 'Schönbrunn Palace',
                address: 'Schönbrunner Schloßstraße 47, 1130 Wien, Austria',
                category: 'landmark',
                description: 'Visit the former imperial summer residence, a UNESCO World Heritage site with stunning Baroque architecture.',
                recommendations: 'Book tickets online. The Grand Tour includes 40 rooms. Gardens are free to visit.'
              }
            ]
          },
          {
            time: '11:30 - 13:00',
            items: [
              {
                title: 'Schönbrunn Gardens',
                address: 'Schönbrunner Schloßstraße 47, 1130 Wien, Austria',
                category: 'park',
                description: 'Stroll through the beautiful palace gardens, maze, and climb to the Gloriette for city views.',
                recommendations: 'Free entry to gardens. Perfect for a morning walk. The maze is fun for all ages.'
              }
            ]
          },
          {
            time: '13:30 - 15:00',
            items: [
              {
                title: 'Naschmarkt',
                address: 'Naschmarkt, 1060 Wien, Austria',
                category: 'market',
                description: 'Explore Vienna\'s most famous market with fresh produce, international food, and local specialties.',
                recommendations: 'Great for lunch. Try Viennese specialties or international cuisine. Very vibrant atmosphere.'
              }
            ]
          },
          {
            time: '15:30 - 17:00',
            items: [
              {
                title: 'Hofburg Palace',
                address: 'Hofburg, 1010 Wien, Austria',
                category: 'landmark',
                description: 'Visit the former imperial palace, now home to museums, the Spanish Riding School, and the Austrian president.',
                recommendations: 'Very large complex. Choose specific areas to visit. The Sisi Museum is popular.'
              }
            ]
          },
          {
            time: '17:30 - 19:00',
            items: [
              {
                title: 'St. Stephen\'s Cathedral',
                address: 'Stephansplatz 3, 1010 Wien, Austria',
                category: 'landmark',
                description: 'Admire Vienna\'s iconic Gothic cathedral in the heart of the city.',
                recommendations: 'Free entry to main area. Climb the tower for views (paid). The roof tiles are beautiful.'
              }
            ]
          },
          {
            time: '19:30 - 21:30',
            items: [
              {
                title: 'Vienna State Opera',
                address: 'Opernring 2, 1010 Wien, Austria',
                category: 'landmark',
                description: 'Attend a performance at one of the world\'s greatest opera houses, or take a guided tour.',
                recommendations: 'Book tickets months in advance for popular performances. Standing room tickets available day-of.'
              }
            ]
          },
          {
            time: '22:00 - 23:30',
            items: [
              {
                title: 'Viennese Coffee House',
                address: 'Various, Vienna, Austria',
                category: 'cafe',
                description: 'Experience the traditional Viennese coffee house culture, a UNESCO intangible cultural heritage.',
                recommendations: 'Try Sachertorte or Apfelstrudel. Classic cafes: Café Central, Café Sacher, Café Demel.'
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
    description: 'Immerse yourself in Barcelona\'s vibrant art scene, from Gaudí\'s architectural masterpieces to contemporary galleries. A full-day journey through the city\'s creative soul.',
    tags: ['art', 'architecture', 'culture', 'design'],
    duration_days: 1,
    daily_plan: [
      {
        day: 1,
        blocks: [
          {
            time: '09:00 - 11:00',
            items: [
              {
                title: 'Sagrada Familia',
                address: 'Carrer de la Marina, 253, 08025 Barcelona, Spain',
                category: 'landmark',
                description: 'Gaudi\'s unfinished masterpiece, a basilica that combines Gothic and Art Nouveau styles in a unique way.',
                recommendations: 'Book tickets online months in advance. Audio guide highly recommended.'
              }
            ]
          },
          {
            time: '11:30 - 13:00',
            items: [
              {
                title: 'Park Güell',
                address: '08024 Barcelona, Spain',
                category: 'park',
                description: 'Explore Gaudi\'s colorful park with mosaic sculptures, curved architecture, and panoramic city views.',
                recommendations: 'Free access to most areas. Paid section requires advance booking. Wear comfortable shoes.'
              }
            ]
          },
          {
            time: '13:30 - 15:00',
            items: [
              {
                title: 'La Boqueria Market',
                address: 'La Rambla, 91, 08001 Barcelona, Spain',
                category: 'market',
                description: 'Experience one of Europe\'s most famous food markets with fresh produce, local delicacies, and vibrant atmosphere.',
                recommendations: 'Try fresh fruit juices, jamón ibérico, and local cheeses. Arrive early for best selection.'
              }
            ]
          },
          {
            time: '15:30 - 17:00',
            items: [
              {
                title: 'Picasso Museum',
                address: 'Carrer de Montcada, 15-23, 08003 Barcelona, Spain',
                category: 'museum',
                description: 'Discover Picasso\'s early works and see how Barcelona influenced his artistic development.',
                recommendations: 'Free entry on Thursday afternoons. Audio guide provides excellent context.'
              }
            ]
          },
          {
            time: '17:30 - 19:00',
            items: [
              {
                title: 'Casa Batlló',
                address: 'Passeig de Gràcia, 43, 08007 Barcelona, Spain',
                category: 'landmark',
                description: 'Admire Gaudi\'s architectural fantasy with its undulating facade and marine-inspired design.',
                recommendations: 'Book skip-the-line tickets. The rooftop offers great views of Passeig de Gràcia.'
              }
            ]
          },
          {
            time: '19:30 - 21:00',
            items: [
              {
                title: 'Gothic Quarter',
                address: 'Gothic Quarter, 08002 Barcelona, Spain',
                category: 'neighborhood',
                description: 'Wander through medieval streets, discover hidden plazas, and admire Gothic architecture.',
                recommendations: 'Perfect for evening strolls. Many excellent tapas bars and restaurants in the area.'
              }
            ]
          },
          {
            time: '21:30 - 23:00',
            items: [
              {
                title: 'Magic Fountain of Montjuïc',
                address: 'Pl. de Carles Buïgas, 1, 08038 Barcelona, Spain',
                category: 'landmark',
                description: 'Watch the spectacular light and music show at this iconic fountain.',
                recommendations: 'Check show times (usually evenings). Arrive early for best viewing spots.'
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
    description: 'Experience Amsterdam like a local on two wheels. A full-day cycling tour through canals, parks, and charming neighborhoods.',
    tags: ['active', 'nature', 'city_tour', 'outdoor'],
    duration_days: 1,
    daily_plan: [
      {
        day: 1,
        blocks: [
          {
            time: '09:00 - 10:30',
            items: [
              {
                title: 'Vondelpark',
                address: 'Vondelpark, Amsterdam, Netherlands',
                category: 'park',
                description: 'Start your cycling adventure in Amsterdam\'s largest city park, perfect for morning rides.',
                recommendations: 'Rent a bike from nearby rental shops. The park has dedicated cycling paths.'
              }
            ]
          },
          {
            time: '11:00 - 12:30',
            items: [
              {
                title: 'Anne Frank House',
                address: 'Westermarkt 20, 1016 GV Amsterdam, Netherlands',
                category: 'museum',
                description: 'Visit the hiding place where Anne Frank wrote her famous diary during WWII.',
                recommendations: 'Book tickets online months in advance. Very limited availability.'
              }
            ]
          },
          {
            time: '13:00 - 14:30',
            items: [
              {
                title: 'Jordaan District',
                address: 'Jordaan, Amsterdam, Netherlands',
                category: 'neighborhood',
                description: 'Cycle through this charming neighborhood with narrow streets, canals, and local cafes.',
                recommendations: 'Stop for lunch at a local cafe. Try traditional Dutch pancakes.'
              }
            ]
          },
          {
            time: '15:00 - 16:30',
            items: [
              {
                title: 'Rijksmuseum',
                address: 'Museumstraat 1, 1071 XX Amsterdam, Netherlands',
                category: 'museum',
                description: 'Explore the Netherlands\' national museum with works by Rembrandt, Vermeer, and other Dutch masters.',
                recommendations: 'Book tickets online. The building itself is a masterpiece of architecture.'
              }
            ]
          },
          {
            time: '17:00 - 18:30',
            items: [
              {
                title: 'Canal Cruise',
                address: 'Various departure points, Amsterdam',
                category: 'activity',
                description: 'Take a break from cycling and see the city from the water on a canal boat tour.',
                recommendations: 'Many operators available. Choose a smaller boat for a more intimate experience.'
              }
            ]
          },
          {
            time: '19:00 - 20:30',
            items: [
              {
                title: 'De Pijp Neighborhood',
                address: 'De Pijp, Amsterdam, Netherlands',
                category: 'neighborhood',
                description: 'Explore this trendy neighborhood known for its markets, cafes, and vibrant nightlife.',
                recommendations: 'Visit Albert Cuyp Market for local food. Great area for dinner.'
              }
            ]
          },
          {
            time: '21:00 - 22:30',
            items: [
              {
                title: 'Red Light District',
                address: 'De Wallen, Amsterdam, Netherlands',
                category: 'neighborhood',
                description: 'Experience Amsterdam\'s famous district (respectfully) and learn about its history.',
                recommendations: 'Visit during evening hours. Be respectful of the area and its workers.'
              }
            ]
          }
        ]
      }
    ]
  }
];

// Helper functions (same as in script)
async function getOrCreateCity(cityName, countryName) {
  if (!cityName || !db) return null;
  
  try {
    const { data: existing } = await db
      .from('cities')
      .select('id')
      .ilike('name', cityName)
      .limit(1)
      .maybeSingle();
    
    if (existing) {
      return existing.id;
    }
    
    const { data: newCity, error } = await db
      .from('cities')
      .insert({ name: cityName, country: countryName || null })
      .select('id')
      .single();
    
    if (error) {
      console.error(`❌ Error creating city ${cityName}:`, error);
      return null;
    }
    
    return newCity.id;
  } catch (err) {
    console.error(`❌ Error in getOrCreateCity for ${cityName}:`, err);
    return null;
  }
}

async function getOrCreateTags(tagNames) {
  if (!db) return [];
  const tagIds = [];
  
  for (const tagName of tagNames) {
    try {
      const { data: existing } = await db
        .from('tags')
        .select('id')
        .ilike('name', tagName)
        .limit(1)
        .maybeSingle();
      
      if (existing) {
        tagIds.push(existing.id);
        continue;
      }
      
      const { data: newTag, error } = await db
        .from('tags')
        .insert({ name: tagName })
        .select('id')
        .single();
      
      if (error) {
        console.error(`❌ Error creating tag ${tagName}:`, error);
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

  if (!db) {
    return res.status(500).json({ success: false, error: 'Database not configured' });
  }

  try {
    console.log('🚀 Starting tour updates...');
    
    const updatedTours = [];
    const errors = [];
    
    // Update each tour
    for (const tourData of enhancedTours) {
      try {
        console.log(`\n📝 Updating tour: ${tourData.title}`);
        
        // Find existing tour by title
        const { data: existingTours, error: findError } = await db
          .from('tours')
          .select('id, title')
          .ilike('title', tourData.title)
          .limit(1);
        
        if (findError) {
          console.error(`❌ Error finding tour ${tourData.title}:`, findError);
          errors.push({ tour: tourData.title, error: findError.message });
          continue;
        }
        
        if (!existingTours || existingTours.length === 0) {
          console.warn(`⚠️ Tour "${tourData.title}" not found, skipping...`);
          errors.push({ tour: tourData.title, error: 'Tour not found' });
          continue;
        }
        
        const existingTour = existingTours[0];
        console.log(`✅ Found tour: ${existingTour.title} (ID: ${existingTour.id})`);
        
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
        
        // Update tour basic info
        const { error: updateError } = await db
          .from('tours')
          .update({
            title: tourData.title,
            description: tourData.description,
            city_id: cityId,
            duration_type: 'days',
            duration_value: tourData.duration_days
          })
          .eq('id', existingTour.id);
        
        if (updateError) {
          console.error(`❌ Error updating tour ${tourData.title}:`, updateError);
          errors.push({ tour: tourData.title, error: updateError.message });
          continue;
        }
        
        console.log(`✅ Updated tour basic info`);
        
        // Get existing tour days to delete
        const { data: existingDays } = await db
          .from('tour_days')
          .select('id')
          .eq('tour_id', existingTour.id);
        
        if (existingDays && existingDays.length > 0) {
          const dayIds = existingDays.map(d => d.id);
          
          // Get existing blocks
          const { data: existingBlocks } = await db
            .from('tour_blocks')
            .select('id')
            .in('tour_day_id', dayIds);
          
          if (existingBlocks && existingBlocks.length > 0) {
            const blockIds = existingBlocks.map(b => b.id);
            
            // Delete items
            await db.from('tour_items').delete().in('tour_block_id', blockIds);
          }
          
          // Delete blocks
          await db.from('tour_blocks').delete().in('tour_day_id', dayIds);
        }
        
        // Delete days
        await db.from('tour_days').delete().eq('tour_id', existingTour.id);
        
        // Delete existing tour tags
        await db.from('tour_tags').delete().eq('tour_id', existingTour.id);
        
        // Create new tour tags
        if (tagIds.length > 0) {
          const tourTagInserts = tagIds.map(tagId => ({
            tour_id: existingTour.id,
            tag_id: tagId
          }));
          await db.from('tour_tags').insert(tourTagInserts);
          console.log(`✅ Created ${tourTagInserts.length} tour tags`);
        }
        
        // Create new tour structure
        for (const dayPlan of tourData.daily_plan) {
          const { data: newDay, error: dayError } = await db
            .from('tour_days')
            .insert({
              tour_id: existingTour.id,
              day_number: dayPlan.day,
              title: `Day ${dayPlan.day}`
            })
            .select('id')
            .single();
          
          if (dayError) {
            console.error(`❌ Error creating tour day:`, dayError);
            continue;
          }
          
          for (const blockPlan of dayPlan.blocks) {
            const { data: newBlock, error: blockError } = await db
              .from('tour_blocks')
              .insert({
                tour_day_id: newDay.id,
                title: blockPlan.title || blockPlan.time,
                start_time: blockPlan.time.split(' - ')[0],
                end_time: blockPlan.time.split(' - ')[1] || null
              })
              .select('id')
              .single();
            
            if (blockError) {
              console.error(`❌ Error creating tour block:`, blockError);
              continue;
            }
            
            for (let i = 0; i < blockPlan.items.length; i++) {
              const itemPlan = blockPlan.items[i];
              
              // Try to find existing location first
              let locationId = null;
              const { data: existingLocation } = await db
                .from('locations')
                .select('id')
                .ilike('name', itemPlan.title)
                .eq('city_id', cityId)
                .limit(1)
                .maybeSingle();
              
              if (existingLocation) {
                locationId = existingLocation.id;
                console.log(`  ✅ Found existing location: ${itemPlan.title}`);
              } else {
                // Create new location
                const locationData = {
                  name: itemPlan.title,
                  address: itemPlan.address,
                  city_id: cityId,
                  description: itemPlan.description,
                  recommendations: itemPlan.recommendations,
                  category: itemPlan.category,
                  verified: true,
                  source: 'admin'
                };
                
                const { data: newLocation, error: locationError } = await db
                  .from('locations')
                  .insert(locationData)
                  .select('id')
                  .single();
                
                if (locationError) {
                  console.error(`❌ Error creating location ${itemPlan.title}:`, locationError);
                  continue;
                }
                locationId = newLocation.id;
                console.log(`  ✅ Created new location: ${itemPlan.title}`);
              }
              
              if (locationId) {
                const { error: itemError } = await db
                  .from('tour_items')
                  .insert({
                    tour_block_id: newBlock.id,
                    location_id: locationId,
                    custom_title: null,
                    custom_description: itemPlan.description,
                    custom_recommendations: itemPlan.recommendations,
                    order_index: i,
                    approx_cost: null
                  });
                
                if (itemError) {
                  console.error(`❌ Error creating tour item:`, itemError);
                }
              }
            }
          }
        }
        
        updatedTours.push({ id: existingTour.id, title: tourData.title });
        console.log(`✅ Successfully updated tour: ${tourData.title}`);
      } catch (err) {
        console.error(`❌ Error updating tour ${tourData.title}:`, err);
        errors.push({ tour: tourData.title, error: err.message });
      }
    }
    
    res.status(200).json({
      success: true,
      message: `Updated ${updatedTours.length} tours`,
      updated: updatedTours,
      errors: errors
    });
  } catch (error) {
    console.error('Error in update-sample-tours API:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

