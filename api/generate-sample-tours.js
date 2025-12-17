/**
 * API endpoint to generate 10 sample tours in the database
 * POST /api/generate-sample-tours
 * 
 * This endpoint creates 10 sample tours for different cities with various tags and locations.
 */

import { supabase } from '../database/db.js';

// Sample tours data with FULL day plans
const sampleTours = [
  {
    city: 'Paris',
    country: 'France',
    title: 'Romantic Weekend in Paris',
    description: 'A charming two-day journey through the romantic streets of Paris, discovering hidden gems and iconic landmarks. Perfect for couples seeking an unforgettable experience in the City of Light.',
    tags: ['romantic', 'culture', 'food', 'architecture'],
    preview_media_url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&h=600&fit=crop&q=80',
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
    description: 'Experience Vienna\'s imperial grandeur and musical heritage. From opulent palaces to world-class opera, discover why Vienna is the capital of classical music.',
    tags: ['culture', 'music', 'architecture', 'imperial'],
    preview_media_url: 'https://images.unsplash.com/photo-1516550893923-42d28e5677af?w=800&h=600&fit=crop&q=80',
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
    let userColumnName = null;
    
    try {
      const { data: users } = await supabase
        .from('users')
        .select('id')
        .in('role', ['creator', 'guide'])
        .limit(1);
      
      if (users && users.length > 0) {
        creatorId = users[0].id;
        console.log(`✅ Using creator ID: ${creatorId}`);
        
        // Determine which column to use for guide_id
        // Test if guide_id column exists, if not try other options
        const testResult = await supabase
          .from('tours')
          .select('id')
          .eq('guide_id', creatorId)
          .limit(1);
        
        if (testResult.error && testResult.error.code === '42703') {
          // guide_id doesn't exist, try other columns
          const testColumns = ['creator_id', 'user_id', 'created_by'];
          for (const colName of testColumns) {
            const test = await supabase
              .from('tours')
              .select('id')
              .eq(colName, creatorId)
              .limit(1);
            
            if (!test.error || test.error.code !== '42703') {
              userColumnName = colName;
              console.log(`✅ Using ${colName} column`);
              break;
            }
          }
        } else {
          userColumnName = 'guide_id';
          console.log('✅ Using guide_id column');
        }
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
        console.log(`\n📝 Processing tour: ${tourData.title} in ${tourData.city}`);
        
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
        
        // Check if tour already exists
        const { data: existingTours } = await supabase
          .from('tours')
          .select('id, title')
          .ilike('title', tourData.title)
          .limit(1);
        
        let tour;
        let isUpdate = false;
        
        if (existingTours && existingTours.length > 0) {
          // Update existing tour
          tour = existingTours[0];
          isUpdate = true;
          console.log(`🔄 Updating existing tour: ${tour.title} (ID: ${tour.id})`);
          
          // Calculate duration from daily_plan
          const maxDay = Math.max(...tourData.daily_plan.map(d => d.day));
          const durationValue = maxDay;
          
          const baseTourData = {
            title: tourData.title,
            description: tourData.description,
            city_id: cityId,
            default_format: 'self_guided',
            duration_type: 'days',
            duration_value: durationValue,
            price_pdf: 16,
            currency: 'USD',
            preview_media_url: tourData.preview_media_url,
            preview_media_type: 'image',
            is_published: true
          };
          
          const { error: updateError } = await supabase
            .from('tours')
            .update(baseTourData)
            .eq('id', tour.id);
          
          if (updateError) {
            console.error(`❌ Error updating tour:`, updateError);
            errors.push({ tour: tourData.title, error: updateError.message });
            continue;
          }
          
          // Delete existing structure
          const { data: existingDays } = await supabase
            .from('tour_days')
            .select('id')
            .eq('tour_id', tour.id);
          
          if (existingDays && existingDays.length > 0) {
            const dayIds = existingDays.map(d => d.id);
            const { data: existingBlocks } = await supabase
              .from('tour_blocks')
              .select('id')
              .in('tour_day_id', dayIds);
            
            if (existingBlocks && existingBlocks.length > 0) {
              const blockIds = existingBlocks.map(b => b.id);
              await supabase.from('tour_items').delete().in('tour_block_id', blockIds);
            }
            await supabase.from('tour_blocks').delete().in('tour_day_id', dayIds);
          }
          await supabase.from('tour_days').delete().eq('tour_id', tour.id);
          await supabase.from('tour_tags').delete().eq('tour_id', tour.id);
        } else {
          // Create new tour
          const baseTourData = {
            title: tourData.title,
            description: tourData.description,
            city_id: cityId,
            default_format: 'self_guided',
            duration_type: 'days',
            duration_value: Math.max(...tourData.daily_plan.map(d => d.day)),
            price_pdf: 16,
            currency: 'USD',
            preview_media_url: tourData.preview_media_url,
            preview_media_type: 'image',
            is_published: true
          };
          
          // Add creator/guide ID using the correct column name
          if (creatorId && userColumnName) {
            baseTourData[userColumnName] = creatorId;
          }
          
          const { data: newTour, error: tourError } = await supabase
            .from('tours')
            .insert(baseTourData)
            .select('id')
            .single();
          
          if (tourError || !newTour) {
            console.error(`❌ Error creating tour:`, tourError);
            errors.push({ tour: tourData.title, error: tourError?.message || 'Unknown error' });
            continue;
          }
          
          tour = newTour;
          console.log(`✅ Tour created with ID: ${tour.id}`);
        }
        
        createdTours.push({ id: tour.id, title: tourData.title, action: isUpdate ? 'updated' : 'created' });
        
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

