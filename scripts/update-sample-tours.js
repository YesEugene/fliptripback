/**
 * Update Sample Tours Script
 * Updates existing tours in database with more complete content:
 * - Full day plans (6-8 locations per day)
 * - Multi-day tours (1-2 days)
 * - Better descriptions and titles
 * - More tags
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(supabaseUrl, supabaseServiceKey);

// Enhanced tour data with full day plans
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
  },
  {
    city: 'Rome',
    country: 'Italy',
    title: 'Ancient History Tour of Rome',
    description: 'Journey through 2,000 years of history in the Eternal City. From the Colosseum to the Vatican, discover Rome\'s ancient and Renaissance treasures over two unforgettable days.',
    tags: ['history', 'culture', 'landmark', 'architecture'],
    duration_days: 2,
    daily_plan: [
      {
        day: 1,
        blocks: [
          {
            time: '09:00 - 11:00',
            items: [
              {
                title: 'Colosseum',
                address: 'Piazza del Colosseo, 1, 00184 Roma RM, Italy',
                category: 'landmark',
                description: 'Step into the ancient amphitheater where gladiators once fought. A symbol of Imperial Rome.',
                recommendations: 'Book skip-the-line tickets with arena access. Combine with Roman Forum ticket.'
              }
            ]
          },
          {
            time: '11:30 - 13:00',
            items: [
              {
                title: 'Roman Forum',
                address: 'Via della Salara Vecchia, 5/6, 00186 Roma RM, Italy',
                category: 'landmark',
                description: 'Walk through the ruins of ancient Rome\'s political and social center.',
                recommendations: 'Get an audio guide or join a tour to understand the significance of each ruin.'
              }
            ]
          },
          {
            time: '13:30 - 15:00',
            items: [
              {
                title: 'Palatine Hill',
                address: '00186 Roma RM, Italy',
                category: 'landmark',
                description: 'Explore the most famous of Rome\'s seven hills, where emperors built their palaces.',
                recommendations: 'Included with Forum ticket. Great views of the city from the top.'
              }
            ]
          },
          {
            time: '15:30 - 17:00',
            items: [
              {
                title: 'Pantheon',
                address: 'Piazza della Rotonda, 00186 Roma RM, Italy',
                category: 'landmark',
                description: 'Marvel at the best-preserved ancient Roman building, with its incredible dome.',
                recommendations: 'Free entry. Visit early or late to avoid crowds. The oculus is spectacular.'
              }
            ]
          },
          {
            time: '17:30 - 19:00',
            items: [
              {
                title: 'Trevi Fountain',
                address: 'Piazza di Trevi, 00187 Roma RM, Italy',
                category: 'landmark',
                description: 'Throw a coin in the most famous fountain in the world and make a wish.',
                recommendations: 'Visit early morning or late evening for fewer crowds. Very crowded during day.'
              }
            ]
          },
          {
            time: '19:30 - 21:30',
            items: [
              {
                title: 'Trastevere',
                address: 'Trastevere, 00153 Roma RM, Italy',
                category: 'neighborhood',
                description: 'Experience authentic Roman life in this charming medieval neighborhood.',
                recommendations: 'Perfect for dinner. Try traditional Roman cuisine at a local trattoria.'
              }
            ]
          }
        ]
      },
      {
        day: 2,
        blocks: [
          {
            time: '09:00 - 11:30',
            items: [
              {
                title: 'Vatican Museums',
                address: '00120 Vatican City',
                category: 'museum',
                description: 'Explore one of the world\'s greatest art collections, including the Sistine Chapel.',
                recommendations: 'Book skip-the-line tickets months in advance. Allocate 3-4 hours minimum.'
              }
            ]
          },
          {
            time: '12:00 - 13:30',
            items: [
              {
                title: 'St. Peter\'s Basilica',
                address: 'Piazza San Pietro, 00120 Città del Vaticano, Vatican City',
                category: 'landmark',
                description: 'Visit the largest church in the world and admire Michelangelo\'s Pietà.',
                recommendations: 'Free entry but long queues. Climb the dome for incredible views (paid).'
              }
            ]
          },
          {
            time: '14:00 - 15:30',
            items: [
              {
                title: 'Castel Sant\'Angelo',
                address: 'Lungotevere Castello, 50, 00193 Roma RM, Italy',
                category: 'landmark',
                description: 'Explore the ancient mausoleum turned fortress with panoramic views of Rome.',
                recommendations: 'Less crowded than other attractions. Great views from the terrace.'
              }
            ]
          },
          {
            time: '16:00 - 17:30',
            items: [
              {
                title: 'Spanish Steps',
                address: 'Piazza di Spagna, 00187 Roma RM, Italy',
                category: 'landmark',
                description: 'Climb the famous 135 steps and enjoy the view of the elegant Piazza di Spagna.',
                recommendations: 'Sitting on the steps is now prohibited. Visit for photos and views.'
              }
            ]
          },
          {
            time: '18:00 - 19:30',
            items: [
              {
                title: 'Piazza Navona',
                address: 'Piazza Navona, 00186 Roma RM, Italy',
                category: 'landmark',
                description: 'Admire Bernini\'s Fountain of the Four Rivers in this beautiful Baroque square.',
                recommendations: 'Perfect for evening strolls. Many cafes and restaurants around the square.'
              }
            ]
          },
          {
            time: '20:00 - 22:00',
            items: [
              {
                title: 'Campo de\' Fiori',
                address: 'Campo de\' Fiori, 00186 Roma RM, Italy',
                category: 'neighborhood',
                description: 'Experience the vibrant market square by day and lively nightlife by evening.',
                recommendations: 'Great for dinner and drinks. Try local Roman specialties at nearby restaurants.'
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
    description: 'Discover Lisbon\'s stunning coastal beauty, historic neighborhoods, and delicious cuisine. A perfect blend of culture, history, and seaside relaxation.',
    tags: ['culture', 'nature', 'food', 'coastal'],
    duration_days: 1,
    daily_plan: [
      {
        day: 1,
        blocks: [
          {
            time: '09:00 - 10:30',
            items: [
              {
                title: 'Belém Tower',
                address: 'Av. Brasília, 1400-038 Lisboa, Portugal',
                category: 'landmark',
                description: 'Visit the iconic fortified tower that served as a point of embarkation for Portuguese explorers.',
                recommendations: 'Arrive early to avoid crowds. The surrounding area is beautiful for photos.'
              }
            ]
          },
          {
            time: '11:00 - 12:30',
            items: [
              {
                title: 'Jerónimos Monastery',
                address: 'Praça do Império 1400-206 Lisboa, Portugal',
                category: 'landmark',
                description: 'Admire the stunning Manueline architecture of this UNESCO World Heritage site.',
                recommendations: 'Free entry on first Sunday of month. The cloisters are particularly beautiful.'
              }
            ]
          },
          {
            time: '13:00 - 14:30',
            items: [
              {
                title: 'Pastéis de Belém',
                address: 'R. de Belém 84-92, 1300-085 Lisboa, Portugal',
                category: 'restaurant',
                description: 'Taste the original pastel de nata at the famous bakery where they were first created.',
                recommendations: 'Expect a queue but it moves quickly. Best pastéis in Lisbon!'
              }
            ]
          },
          {
            time: '15:00 - 16:30',
            items: [
              {
                title: 'Alfama District',
                address: 'Alfama, Lisbon, Portugal',
                category: 'neighborhood',
                description: 'Get lost in the narrow streets of Lisbon\'s oldest district, with its Moorish influence.',
                recommendations: 'Take Tram 28 for a scenic ride. Listen to Fado music in local taverns.'
              }
            ]
          },
          {
            time: '17:00 - 18:30',
            items: [
              {
                title: 'São Jorge Castle',
                address: 'R. de Santa Cruz do Castelo, 1100-129 Lisboa, Portugal',
                category: 'landmark',
                description: 'Explore the medieval castle with panoramic views over Lisbon and the Tagus River.',
                recommendations: 'Best visited at sunset for stunning views. Wear comfortable shoes for the climb.'
              }
            ]
          },
          {
            time: '19:00 - 20:30',
            items: [
              {
                title: 'Time Out Market',
                address: 'Av. 24 de Julho 49, 1200-479 Lisboa, Portugal',
                category: 'market',
                description: 'Experience Lisbon\'s food scene at this modern market with top local chefs.',
                recommendations: 'Very popular, arrive early for dinner. Try Portuguese specialties from different stalls.'
              }
            ]
          },
          {
            time: '21:00 - 22:30',
            items: [
              {
                title: 'Bairro Alto',
                address: 'Bairro Alto, 1200-109 Lisboa, Portugal',
                category: 'neighborhood',
                description: 'Experience Lisbon\'s vibrant nightlife in this historic neighborhood.',
                recommendations: 'Great for evening drinks. Many bars and restaurants. Very lively atmosphere.'
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
    description: 'Dive into Berlin\'s contemporary art scene and legendary nightlife. From world-class galleries to underground clubs, experience the city\'s creative energy.',
    tags: ['art', 'nightlife', 'culture', 'modern'],
    duration_days: 1,
    daily_plan: [
      {
        day: 1,
        blocks: [
          {
            time: '10:00 - 12:00',
            items: [
              {
                title: 'East Side Gallery',
                address: 'Mühlenstraße 3-100, 10243 Berlin, Germany',
                category: 'art_gallery',
                description: 'See the longest remaining section of the Berlin Wall, covered in powerful murals by international artists.',
                recommendations: 'Free to visit. Take your time to appreciate each artwork. Very photogenic.'
              }
            ]
          },
          {
            time: '12:30 - 14:00',
            items: [
              {
                title: 'Hamburger Bahnhof',
                address: 'Invalidenstraße 50-51, 10557 Berlin, Germany',
                category: 'museum',
                description: 'Explore contemporary art in a former railway station, featuring works by Warhol, Beuys, and more.',
                recommendations: 'Less crowded than other museums. The building itself is impressive.'
              }
            ]
          },
          {
            time: '14:30 - 16:00',
            items: [
              {
                title: 'Mitte District',
                address: 'Mitte, Berlin, Germany',
                category: 'neighborhood',
                description: 'Explore Berlin\'s central district with galleries, boutiques, and trendy cafes.',
                recommendations: 'Perfect for lunch. Many excellent restaurants and cafes in the area.'
              }
            ]
          },
          {
            time: '16:30 - 18:00',
            items: [
              {
                title: 'Brandenburg Gate',
                address: 'Pariser Platz, 10117 Berlin, Germany',
                category: 'landmark',
                description: 'Visit Berlin\'s most iconic landmark, symbol of German reunification.',
                recommendations: 'Best visited during golden hour for photos. Nearby Holocaust Memorial is worth visiting.'
              }
            ]
          },
          {
            time: '18:30 - 20:00',
            items: [
              {
                title: 'Reichstag Building',
                address: 'Platz der Republik 1, 11011 Berlin, Germany',
                category: 'landmark',
                description: 'Visit the German parliament building with its stunning glass dome offering 360° city views.',
                recommendations: 'Free entry but requires advance online registration. Book weeks in advance.'
              }
            ]
          },
          {
            time: '20:30 - 22:00',
            items: [
              {
                title: 'Kreuzberg District',
                address: 'Kreuzberg, Berlin, Germany',
                category: 'neighborhood',
                description: 'Experience Berlin\'s most vibrant nightlife district with diverse bars, clubs, and restaurants.',
                recommendations: 'Great for dinner. Try Turkish food (döner kebab) or international cuisine.'
              }
            ]
          },
          {
            time: '22:30 - 02:00',
            items: [
              {
                title: 'Berghain',
                address: 'Am Wriezener Bahnhof, 10243 Berlin, Germany',
                category: 'nightclub',
                description: 'Experience Berlin\'s legendary techno club (if you can get in). A cultural institution.',
                recommendations: 'Very selective door policy. Dress appropriately. Opens Friday night, closes Monday morning.'
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
    description: 'Discover London\'s royal heritage, iconic landmarks, and world-class museums. A comprehensive two-day journey through the British capital.',
    tags: ['culture', 'history', 'family', 'royal'],
    duration_days: 2,
    daily_plan: [
      {
        day: 1,
        blocks: [
          {
            time: '09:00 - 11:00',
            items: [
              {
                title: 'Buckingham Palace',
                address: 'Westminster, London SW1A 1AA, UK',
                category: 'landmark',
                description: 'Watch the famous Changing of the Guard ceremony at the official residence of the British monarch.',
                recommendations: 'Arrive by 10:30 AM for best viewing. Check schedule as it doesn\'t happen daily.'
              }
            ]
          },
          {
            time: '11:30 - 13:00',
            items: [
              {
                title: 'Westminster Abbey',
                address: '20 Deans Yd, London SW1P 3PA, UK',
                category: 'landmark',
                description: 'Visit the coronation church and final resting place of British monarchs and notable figures.',
                recommendations: 'Book tickets online. Audio guide included. Very popular, arrive early.'
              }
            ]
          },
          {
            time: '13:30 - 15:00',
            items: [
              {
                title: 'Big Ben & Houses of Parliament',
                address: 'Westminster, London SW1A 0AA, UK',
                category: 'landmark',
                description: 'Admire the iconic clock tower and the seat of British democracy.',
                recommendations: 'Best viewed from Westminster Bridge. Tours available but book in advance.'
              }
            ]
          },
          {
            time: '15:30 - 17:30',
            items: [
              {
                title: 'British Museum',
                address: 'Great Russell St, London WC1B 3DG, UK',
                category: 'museum',
                description: 'Explore one of the world\'s greatest museums with artifacts from around the globe.',
                recommendations: 'Free entry. Very large - focus on specific galleries. The Rosetta Stone is a must-see.'
              }
            ]
          },
          {
            time: '18:00 - 19:30',
            items: [
              {
                title: 'Covent Garden',
                address: 'Covent Garden, London WC2E 8RF, UK',
                category: 'neighborhood',
                description: 'Explore the historic market area with shops, restaurants, and street performers.',
                recommendations: 'Great for dinner. Many excellent restaurants. Street performers add to the atmosphere.'
              }
            ]
          },
          {
            time: '20:00 - 21:30',
            items: [
              {
                title: 'West End Show',
                address: 'Various theaters, West End, London',
                category: 'activity',
                description: 'Experience world-class theater in London\'s famous West End district.',
                recommendations: 'Book tickets in advance for popular shows. TKTS booth offers same-day discounts.'
              }
            ]
          }
        ]
      },
      {
        day: 2,
        blocks: [
          {
            time: '09:00 - 11:00',
            items: [
              {
                title: 'Tower of London',
                address: 'London EC3N 4AB, UK',
                category: 'landmark',
                description: 'Explore the historic castle, see the Crown Jewels, and learn about its dark history.',
                recommendations: 'Book tickets online. Join a Beefeater tour for fascinating stories. Allow 2-3 hours.'
              }
            ]
          },
          {
            time: '11:30 - 13:00',
            items: [
              {
                title: 'Tower Bridge',
                address: 'Tower Bridge Rd, London SE1 2UP, UK',
                category: 'landmark',
                description: 'Walk across the iconic bridge and visit the exhibition for panoramic views.',
                recommendations: 'Free to walk across. Paid exhibition offers great views from the walkway.'
              }
            ]
          },
          {
            time: '13:30 - 15:00',
            items: [
              {
                title: 'Borough Market',
                address: '8 Southwark St, London SE1 1TL, UK',
                category: 'market',
                description: 'Experience one of London\'s oldest food markets with gourmet treats and local produce.',
                recommendations: 'Great for lunch. Try artisanal cheeses, fresh bread, and international street food.'
              }
            ]
          },
          {
            time: '15:30 - 17:00',
            items: [
              {
                title: 'Tate Modern',
                address: 'Bankside, London SE1 9TG, UK',
                category: 'museum',
                description: 'Explore modern and contemporary art in a former power station on the Thames.',
                recommendations: 'Free entry to permanent collection. Special exhibitions require tickets. Great views from the restaurant.'
              }
            ]
          },
          {
            time: '17:30 - 19:00',
            items: [
              {
                title: 'St. Paul\'s Cathedral',
                address: 'St. Paul\'s Churchyard, London EC4M 8AD, UK',
                category: 'landmark',
                description: 'Climb to the top of the dome for stunning views of London.',
                recommendations: 'Book tickets online. The climb is steep but worth it. Whispering Gallery is unique.'
              }
            ]
          },
          {
            time: '19:30 - 21:30',
            items: [
              {
                title: 'Shoreditch',
                address: 'Shoreditch, London, UK',
                category: 'neighborhood',
                description: 'Explore London\'s trendy East End with street art, independent shops, and diverse dining.',
                recommendations: 'Great for dinner. Many excellent restaurants. Very vibrant and creative area.'
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
    description: 'Savor the flavors of Spanish cuisine and immerse yourself in Madrid\'s rich cultural heritage. A culinary and cultural journey through Spain\'s capital.',
    tags: ['food', 'culture', 'city_tour', 'dining'],
    duration_days: 1,
    daily_plan: [
      {
        day: 1,
        blocks: [
          {
            time: '09:00 - 10:30',
            items: [
              {
                title: 'Plaza Mayor',
                address: 'Pl. Mayor, 28012 Madrid, Spain',
                category: 'landmark',
                description: 'Start your day in Madrid\'s historic central square, surrounded by beautiful architecture.',
                recommendations: 'Arrive early for fewer crowds. Enjoy churros con chocolate at a nearby cafe.'
              }
            ]
          },
          {
            time: '11:00 - 12:30',
            items: [
              {
                title: 'Royal Palace of Madrid',
                address: 'Calle de Bailén, s/n, 28071 Madrid, Spain',
                category: 'landmark',
                description: 'Tour the official residence of the Spanish royal family, one of Europe\'s largest palaces.',
                recommendations: 'Book tickets online. Allow 2 hours. The armory and pharmacy are highlights.'
              }
            ]
          },
          {
            time: '13:00 - 14:30',
            items: [
              {
                title: 'Mercado de San Miguel',
                address: 'Plaza de San Miguel, s/n, 28005 Madrid, Spain',
                category: 'market',
                description: 'Taste authentic Spanish tapas, fresh seafood, and local delicacies in this beautiful market.',
                recommendations: 'Very popular, can be crowded. Try jamón ibérico, croquetas, and fresh oysters.'
              }
            ]
          },
          {
            time: '15:00 - 16:30',
            items: [
              {
                title: 'Prado Museum',
                address: 'Calle de Ruiz de Alarcón, 23, 28014 Madrid, Spain',
                category: 'museum',
                description: 'Admire masterpieces by Goya, Velázquez, El Greco, and other Spanish masters.',
                recommendations: 'Free entry 6-8 PM Mon-Sat. Very large - focus on Spanish art section.'
              }
            ]
          },
          {
            time: '17:00 - 18:30',
            items: [
              {
                title: 'Retiro Park',
                address: 'Plaza de la Independencia, 7, 28001 Madrid, Spain',
                category: 'park',
                description: 'Relax in Madrid\'s beautiful central park, rent a rowboat, or visit the Crystal Palace.',
                recommendations: 'Perfect for a break. The lake and gardens are beautiful. Great for photos.'
              }
            ]
          },
          {
            time: '19:00 - 20:30',
            items: [
              {
                title: 'Tapas Tour in La Latina',
                address: 'La Latina, Madrid, Spain',
                category: 'neighborhood',
                description: 'Experience Madrid\'s tapas culture in this historic neighborhood with traditional bars.',
                recommendations: 'Go bar-hopping. Try different tapas at each place. Very authentic experience.'
              }
            ]
          },
          {
            time: '21:00 - 23:00',
            items: [
              {
                title: 'Flamenco Show',
                address: 'Various venues, Madrid, Spain',
                category: 'activity',
                description: 'Experience authentic flamenco, Spain\'s passionate dance and music tradition.',
                recommendations: 'Book in advance. Many venues in the city center. Some include dinner.'
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
    description: 'Step into a fairy tale in Prague\'s historic Old Town. Discover medieval architecture, charming streets, and rich Czech culture over two magical days.',
    tags: ['history', 'architecture', 'romantic', 'medieval'],
    duration_days: 2,
    daily_plan: [
      {
        day: 1,
        blocks: [
          {
            time: '09:00 - 11:30',
            items: [
              {
                title: 'Prague Castle',
                address: 'Hradčany, 119 08 Praha 1, Czech Republic',
                category: 'landmark',
                description: 'Explore the largest ancient castle complex in the world, home to Czech kings and presidents.',
                recommendations: 'Buy tickets online. Allocate at least 3 hours. St. Vitus Cathedral is stunning.'
              }
            ]
          },
          {
            time: '12:00 - 13:30',
            items: [
              {
                title: 'Golden Lane',
                address: 'Zlatá ulička, 119 00 Praha 1, Czech Republic',
                category: 'landmark',
                description: 'Walk through the charming medieval street within the castle complex.',
                recommendations: 'Included with castle ticket. Franz Kafka lived at house #22.'
              }
            ]
          },
          {
            time: '14:00 - 15:30',
            items: [
              {
                title: 'Charles Bridge',
                address: 'Karlův most, 110 00 Praha 1, Czech Republic',
                category: 'landmark',
                description: 'Walk across the historic bridge with stunning views and Baroque statues.',
                recommendations: 'Visit early morning or sunset for best photos. Very crowded during day.'
              }
            ]
          },
          {
            time: '16:00 - 17:30',
            items: [
              {
                title: 'Old Town Square',
                address: 'Staroměstské nám., 110 00 Staré Město, Czech Republic',
                category: 'landmark',
                description: 'Admire the Astronomical Clock and the beautiful architecture of the historic square.',
                recommendations: 'Watch the clock show on the hour. Many cafes and restaurants around the square.'
              }
            ]
          },
          {
            time: '18:00 - 19:30',
            items: [
              {
                title: 'Jewish Quarter (Josefov)',
                address: 'Josefov, 110 00 Praha 1, Czech Republic',
                category: 'neighborhood',
                description: 'Explore the historic Jewish quarter with synagogues and the Old Jewish Cemetery.',
                recommendations: 'Buy combined ticket for all sites. Very moving and historically significant.'
              }
            ]
          },
          {
            time: '20:00 - 22:00',
            items: [
              {
                title: 'Traditional Czech Dinner',
                address: 'Various restaurants, Old Town, Prague',
                category: 'restaurant',
                description: 'Enjoy authentic Czech cuisine: goulash, dumplings, and Czech beer.',
                recommendations: 'Try traditional dishes like svíčková or duck. Pair with local Pilsner beer.'
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
                title: 'Petřín Hill',
                address: 'Petřín, 118 00 Praha 1, Czech Republic',
                category: 'park',
                description: 'Take the funicular to the top for panoramic views and visit the observation tower.',
                recommendations: 'Great for morning exercise. The views are spectacular. Less crowded than castle.'
              }
            ]
          },
          {
            time: '11:00 - 12:30',
            items: [
              {
                title: 'Lennon Wall',
                address: 'Velkopřevorské nám., 100 00 Praha 1, Czech Republic',
                category: 'landmark',
                description: 'See the colorful wall covered in John Lennon-inspired graffiti and messages of peace.',
                recommendations: 'Free to visit. Constantly changing artwork. Great for photos.'
              }
            ]
          },
          {
            time: '13:00 - 14:30',
            items: [
              {
                title: 'Wenceslas Square',
                address: 'Václavské nám., 110 00 Nové Město, Czech Republic',
                category: 'landmark',
                description: 'Walk through Prague\'s main commercial square, site of many historical events.',
                recommendations: 'Great for shopping and lunch. Many restaurants and cafes in the area.'
              }
            ]
          },
          {
            time: '15:00 - 16:30',
            items: [
              {
                title: 'Municipal House',
                address: 'nám. Republiky 5, 111 21 Praha 1, Czech Republic',
                category: 'landmark',
                description: 'Admire the Art Nouveau architecture and enjoy a coffee in the elegant cafe.',
                recommendations: 'Beautiful interior. The cafe is worth a visit even if you don\'t attend a concert.'
              }
            ]
          },
          {
            time: '17:00 - 18:30',
            items: [
              {
                title: 'Vltava River Cruise',
                address: 'Various departure points, Prague',
                category: 'activity',
                description: 'See Prague from the water on a relaxing river cruise.',
                recommendations: 'Many operators available. Evening cruises offer beautiful city lights.'
              }
            ]
          },
          {
            time: '19:00 - 21:00',
            items: [
              {
                title: 'Dancing House',
                address: 'Jiráskovo nám. 1981/6, 120 00 Praha 2, Czech Republic',
                category: 'landmark',
                description: 'Admire the unique modern architecture of this deconstructivist building.',
                recommendations: 'Great for photos. The rooftop bar offers nice views (paid access).'
              }
            ]
          },
          {
            time: '21:30 - 23:00',
            items: [
              {
                title: 'Prague Nightlife',
                address: 'Various venues, Old Town, Prague',
                category: 'nightlife',
                description: 'Experience Prague\'s vibrant nightlife with bars, clubs, and live music.',
                recommendations: 'Many options in Old Town and New Town. Czech beer is excellent and affordable.'
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
  }
];

// Helper function to get or create city
async function getOrCreateCity(cityName, countryName) {
  if (!cityName) return null;
  
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

// Helper function to get or create tags
async function getOrCreateTags(tagNames) {
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

// Main function to update tours
async function updateTours() {
  console.log('🚀 Starting tour updates...');
  
  // Get existing tours by title
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
        continue;
      }
      
      if (!existingTours || existingTours.length === 0) {
        console.warn(`⚠️ Tour "${tourData.title}" not found, skipping...`);
        continue;
      }
      
      const existingTour = existingTours[0];
      console.log(`✅ Found tour: ${existingTour.title} (ID: ${existingTour.id})`);
      
      // Get or create city
      const cityId = await getOrCreateCity(tourData.city, tourData.country);
      if (!cityId) {
        console.error(`❌ Failed to get/create city for ${tourData.city}`);
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
        continue;
      }
      
      console.log(`✅ Updated tour basic info`);
      
      // Delete existing tour structure (days, blocks, items)
      await db.from('tour_items').delete().in('tour_block_id', 
        db.from('tour_blocks').select('id').in('tour_day_id', 
          db.from('tour_days').select('id').eq('tour_id', existingTour.id)
        )
      );
      await db.from('tour_blocks').delete().in('tour_day_id', 
        db.from('tour_days').select('id').eq('tour_id', existingTour.id)
      );
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
      
      console.log(`✅ Successfully updated tour: ${tourData.title}`);
    } catch (err) {
      console.error(`❌ Error updating tour ${tourData.title}:`, err);
    }
  }
  
  console.log('\n✅ Tour updates complete!');
}

// Run the script
updateTours()
  .then(() => {
    console.log('🎉 All done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  });

