/**
 * Script to enrich ALL existing tours with full day plans (6-8 locations per day)
 * Run with: node scripts/enrich-all-tours.js
 * 
 * This script will:
 * 1. Find all existing tours in the database
 * 2. Update each tour with a complete day plan (6-8 locations per day)
 * 3. Preserve existing tour IDs and basic info
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Full tour data with 6-8 locations per day
const enrichedTours = {
  'Classical Music & Architecture': {
    city: 'Vienna',
    country: 'Austria',
    description: 'Experience Vienna\'s imperial grandeur and musical heritage. From opulent palaces to world-class opera, discover why Vienna is the capital of classical music.',
    tags: ['culture', 'music', 'architecture', 'imperial'],
    duration_days: 1,
    daily_plan: [
      {
        day: 1,
        blocks: [
          { time: '09:00 - 11:00', items: [{ title: 'Schönbrunn Palace', address: 'Schönbrunner Schloßstraße 47, 1130 Wien, Austria', category: 'landmark', description: 'Visit the former imperial summer residence, a UNESCO World Heritage site with stunning Baroque architecture.', recommendations: 'Book tickets online. The Grand Tour includes 40 rooms. Gardens are free to visit.' }] },
          { time: '11:30 - 13:00', items: [{ title: 'Schönbrunn Gardens', address: 'Schönbrunner Schloßstraße 47, 1130 Wien, Austria', category: 'park', description: 'Stroll through the beautiful palace gardens, maze, and climb to the Gloriette for city views.', recommendations: 'Free entry to gardens. Perfect for a morning walk. The maze is fun for all ages.' }] },
          { time: '13:30 - 15:00', items: [{ title: 'Naschmarkt', address: 'Naschmarkt, 1060 Wien, Austria', category: 'market', description: 'Explore Vienna\'s most famous market with fresh produce, international food, and local specialties.', recommendations: 'Great for lunch. Try Viennese specialties or international cuisine. Very vibrant atmosphere.' }] },
          { time: '15:30 - 17:00', items: [{ title: 'Hofburg Palace', address: 'Hofburg, 1010 Wien, Austria', category: 'landmark', description: 'Visit the former imperial palace, now home to museums, the Spanish Riding School, and the Austrian president.', recommendations: 'Very large complex. Choose specific areas to visit. The Sisi Museum is popular.' }] },
          { time: '17:30 - 19:00', items: [{ title: 'St. Stephen\'s Cathedral', address: 'Stephansplatz 3, 1010 Wien, Austria', category: 'landmark', description: 'Admire Vienna\'s iconic Gothic cathedral in the heart of the city.', recommendations: 'Free entry to main area. Climb the tower for views (paid). The roof tiles are beautiful.' }] },
          { time: '19:30 - 21:30', items: [{ title: 'Vienna State Opera', address: 'Opernring 2, 1010 Wien, Austria', category: 'landmark', description: 'Attend a performance at one of the world\'s greatest opera houses, or take a guided tour.', recommendations: 'Book tickets months in advance for popular performances. Standing room tickets available day-of.' }] },
          { time: '22:00 - 23:30', items: [{ title: 'Viennese Coffee House', address: 'Various, Vienna, Austria', category: 'cafe', description: 'Experience the traditional Viennese coffee house culture, a UNESCO intangible cultural heritage.', recommendations: 'Try Sachertorte or Apfelstrudel. Classic cafes: Café Central, Café Sacher, Café Demel.' }] }
        ]
      }
    ]
  },
  'Medieval Magic of Prague': {
    city: 'Prague',
    country: 'Czech Republic',
    description: 'Step into a fairy tale in Prague\'s historic Old Town. Discover medieval architecture, charming squares, and the magical atmosphere of one of Europe\'s most beautiful cities.',
    tags: ['culture', 'history', 'architecture', 'romantic'],
    duration_days: 1,
    daily_plan: [
      {
        day: 1,
        blocks: [
          { time: '09:00 - 11:00', items: [{ title: 'Prague Castle', address: 'Hradčany, 119 08 Prague 1, Czechia', category: 'landmark', description: 'Explore the largest ancient castle complex in the world, home to St. Vitus Cathedral and the Golden Lane.', recommendations: 'Arrive early to avoid crowds. The changing of the guard happens at noon.' }] },
          { time: '11:30 - 13:00', items: [{ title: 'Charles Bridge', address: 'Karlův most, 110 00 Prague 1, Czechia', category: 'landmark', description: 'Walk across the iconic 14th-century bridge adorned with 30 baroque statues.', recommendations: 'Visit early morning or late evening for fewer crowds. Sunset views are spectacular.' }] },
          { time: '13:30 - 15:00', items: [{ title: 'Old Town Square', address: 'Staroměstské nám., 110 00 Staré Město, Czechia', category: 'landmark', description: 'Admire the Astronomical Clock and the stunning Gothic architecture surrounding the square.', recommendations: 'Watch the Astronomical Clock show on the hour. Try trdelník from nearby vendors.' }] },
          { time: '15:30 - 17:00', items: [{ title: 'Jewish Quarter (Josefov)', address: 'Josefov, 110 00 Prague 1, Czechia', category: 'neighborhood', description: 'Explore the historic Jewish Quarter with synagogues and the Old Jewish Cemetery.', recommendations: 'Purchase a combined ticket for all synagogues. Very moving historical experience.' }] },
          { time: '17:30 - 19:00', items: [{ title: 'Wenceslas Square', address: 'Václavské nám., 110 00 Nové Město, Czechia', category: 'landmark', description: 'Stroll through Prague\'s main commercial boulevard, rich with history and modern shops.', recommendations: 'Great for shopping and people watching. Many restaurants and cafes nearby.' }] },
          { time: '19:30 - 21:30', items: [{ title: 'Vltava River Cruise', address: 'Dvořákovo nábř., 110 00 Staré Město, Czechia', category: 'activity', description: 'Enjoy a dinner cruise along the Vltava River with views of Prague Castle and bridges.', recommendations: 'Book in advance. Evening cruises offer the best views of illuminated Prague.' }] },
          { time: '22:00 - 23:30', items: [{ title: 'Traditional Czech Restaurant', address: 'Various, Prague, Czechia', category: 'restaurant', description: 'Experience authentic Czech cuisine in a traditional restaurant with local beer.', recommendations: 'Try goulash, svíčková, or roast pork with dumplings. Pilsner Urquell is a must!' }] }
        ]
      }
    ]
  },
  'Food & Culture in Madrid': {
    city: 'Madrid',
    country: 'Spain',
    description: 'Indulge in Madrid\'s culinary delights and cultural treasures. From tapas bars to world-class museums, experience the vibrant Spanish capital.',
    tags: ['food', 'culture', 'art', 'nightlife'],
    duration_days: 1,
    daily_plan: [
      {
        day: 1,
        blocks: [
          { time: '10:00 - 12:00', items: [{ title: 'Prado Museum', address: 'Calle de Ruiz de Alarcón, 23, 28014 Madrid, Spain', category: 'museum', description: 'Explore one of the world\'s finest art collections, featuring works by Goya, Velázquez, and El Greco.', recommendations: 'Free entry 6-8 PM Mon-Sat, 5-7 PM Sun. Book timed entry online.' }] },
          { time: '12:30 - 14:00', items: [{ title: 'Retiro Park', address: 'Plaza de la Independencia, 7, 28001 Madrid, Spain', category: 'park', description: 'Stroll through Madrid\'s beautiful central park, visit the Crystal Palace, and row a boat on the lake.', recommendations: 'Perfect for a relaxing break. The park is huge, so wear comfortable shoes.' }] },
          { time: '14:30 - 16:00', items: [{ title: 'Mercado de San Miguel', address: 'Plaza de San Miguel, s/n, 28005 Madrid, Spain', category: 'market', description: 'Experience Madrid\'s famous covered market with gourmet tapas, fresh produce, and local specialties.', recommendations: 'Very popular, can be crowded. Try jamón ibérico, olives, and Spanish cheeses.' }] },
          { time: '16:30 - 18:00', items: [{ title: 'Royal Palace of Madrid', address: 'Calle de Bailén, s/n, 28071 Madrid, Spain', category: 'landmark', description: 'Tour the official residence of the Spanish royal family, one of Europe\'s largest palaces.', recommendations: 'Book tickets online. The armory and pharmacy are highlights. Free for EU citizens certain hours.' }] },
          { time: '18:30 - 20:00', items: [{ title: 'Plaza Mayor', address: 'Plaza Mayor, 28012 Madrid, Spain', category: 'landmark', description: 'Admire the grand square, a hub of Madrid\'s social life since the 17th century.', recommendations: 'Great for people watching. Many cafes and restaurants around the square.' }] },
          { time: '20:30 - 22:30', items: [{ title: 'Tapas Crawl in La Latina', address: 'La Latina, Madrid, Spain', category: 'neighborhood', description: 'Experience authentic Madrid tapas culture in the historic La Latina neighborhood.', recommendations: 'Start early (around 8 PM). Try different tapas at multiple bars. Very social experience.' }] },
          { time: '23:00 - 01:00', items: [{ title: 'Flamenco Show', address: 'Various venues, Madrid, Spain', category: 'activity', description: 'Watch an authentic flamenco performance, an essential part of Spanish culture.', recommendations: 'Book in advance. Shows typically start around 10:30 PM. Some include dinner.' }] }
        ]
      }
    ]
  },
  'Royal London Experience': {
    city: 'London',
    country: 'United Kingdom',
    description: 'Discover London\'s royal heritage and iconic landmarks. From Buckingham Palace to the Tower of London, experience the grandeur of the British capital.',
    tags: ['culture', 'history', 'royal', 'family'],
    duration_days: 1,
    daily_plan: [
      {
        day: 1,
        blocks: [
          { time: '09:00 - 11:00', items: [{ title: 'Buckingham Palace', address: 'Westminster, London SW1A 1AA, UK', category: 'landmark', description: 'Watch the Changing of the Guard ceremony at the official residence of the British monarch.', recommendations: 'Arrive by 10:30 AM for best viewing. Ceremony starts at 11 AM. Check schedule online.' }] },
          { time: '11:30 - 13:00', items: [{ title: 'Westminster Abbey', address: '20 Deans Yd, London SW1P 3PA, UK', category: 'landmark', description: 'Visit the coronation church and final resting place of British monarchs and notable figures.', recommendations: 'Book tickets online. Audio guide included. Very busy, arrive early.' }] },
          { time: '13:30 - 15:00', items: [{ title: 'Big Ben & Houses of Parliament', address: 'Westminster, London SW1A 0AA, UK', category: 'landmark', description: 'Admire the iconic clock tower and the seat of the UK Parliament.', recommendations: 'Best viewed from Westminster Bridge. Tours of Parliament available (book in advance).' }] },
          { time: '15:30 - 17:00', items: [{ title: 'Tower of London', address: 'London EC3N 4AB, UK', category: 'landmark', description: 'Explore the historic castle, see the Crown Jewels, and learn about its dark history.', recommendations: 'Book tickets online. Yeoman Warder tours are free and entertaining. Allow 2-3 hours.' }] },
          { time: '17:30 - 19:00', items: [{ title: 'Tower Bridge', address: 'Tower Bridge Rd, London SE1 2UP, UK', category: 'landmark', description: 'Walk across the iconic Victorian bridge and visit the exhibition inside.', recommendations: 'Free to cross. Paid exhibition shows engine rooms and glass walkway. Great views.' }] },
          { time: '19:30 - 21:30', items: [{ title: 'British Museum', address: 'Great Russell St, London WC1B 3DG, UK', category: 'museum', description: 'Explore one of the world\'s greatest museums with artifacts from around the globe.', recommendations: 'Free entry. Very large, focus on specific galleries. Rosetta Stone and Parthenon Marbles are highlights.' }] },
          { time: '22:00 - 23:30', items: [{ title: 'West End Theatre', address: 'Various, London, UK', category: 'activity', description: 'Catch a world-class musical or play in London\'s famous theatre district.', recommendations: 'Book in advance for popular shows. Last-minute tickets available at TKTS booth.' }] }
        ]
      }
    ]
  },
  'Modern Art & Nightlife in Berlin': {
    city: 'Berlin',
    country: 'Germany',
    description: 'Experience Berlin\'s vibrant art scene and legendary nightlife. From street art to world-class clubs, discover why Berlin is Europe\'s creative capital.',
    tags: ['culture', 'nightlife', 'art', 'music'],
    duration_days: 1,
    daily_plan: [
      {
        day: 1,
        blocks: [
          { time: '10:00 - 12:00', items: [{ title: 'East Side Gallery', address: 'Mühlenstraße, 10243 Berlin, Germany', category: 'landmark', description: 'See the longest remaining section of the Berlin Wall, covered in 105 murals by artists from around the world.', recommendations: 'Free to visit. Best light in morning. Very photogenic, allow time for photos.' }] },
          { time: '12:30 - 14:00', items: [{ title: 'Brandenburg Gate', address: 'Pariser Platz, 10117 Berlin, Germany', category: 'landmark', description: 'Visit Berlin\'s most iconic landmark, symbol of German reunification.', recommendations: 'Free to visit. Very busy during day. Early morning or evening for fewer crowds.' }] },
          { time: '14:30 - 16:00', items: [{ title: 'Museum Island', address: 'Museumsinsel, 10178 Berlin, Germany', category: 'museum', description: 'Explore five world-class museums on a UNESCO World Heritage site in the Spree River.', recommendations: 'Museum Pass Berlin offers access to all. Pergamon Museum is most popular.' }] },
          { time: '16:30 - 18:00', items: [{ title: 'Hackescher Markt', address: 'Hackescher Markt, 10178 Berlin, Germany', category: 'neighborhood', description: 'Explore trendy courtyards, boutiques, and cafes in this vibrant neighborhood.', recommendations: 'Great for shopping and people watching. Many restaurants and bars.' }] },
          { time: '18:30 - 20:00', items: [{ title: 'Reichstag Building', address: 'Platz der Republik 1, 11011 Berlin, Germany', category: 'landmark', description: 'Visit the German parliament building with its iconic glass dome offering panoramic city views.', recommendations: 'Free entry but must book in advance online. Security check required. Sunset views are spectacular.' }] },
          { time: '20:30 - 22:30', items: [{ title: 'Kreuzberg District', address: 'Kreuzberg, Berlin, Germany', category: 'neighborhood', description: 'Experience Berlin\'s most vibrant neighborhood with diverse food, street art, and alternative culture.', recommendations: 'Great for dinner. Try Turkish food (Kreuzberg has large Turkish community). Very lively atmosphere.' }] },
          { time: '23:00 - 03:00', items: [{ title: 'Berlin Nightclub', address: 'Various, Berlin, Germany', category: 'nightlife', description: 'Experience Berlin\'s legendary club scene, known for techno music and all-night parties.', recommendations: 'Dress code: black, casual. Clubs like Berghain are famous but strict door policy. Start late (after midnight).' }] }
        ]
      }
    ]
  },
  'Coastal Charm of Lisbon': {
    city: 'Lisbon',
    country: 'Portugal',
    description: 'Discover Lisbon\'s beautiful coastline and historic neighborhoods. From medieval castles to modern art, experience the charm of Portugal\'s capital.',
    tags: ['romantic', 'culture', 'food', 'coastal'],
    duration_days: 1,
    daily_plan: [
      {
        day: 1,
        blocks: [
          { time: '09:00 - 11:00', items: [{ title: 'Belém Tower', address: 'Av. Brasília, 1400-038 Lisboa, Portugal', category: 'landmark', description: 'Visit the iconic 16th-century tower that once protected Lisbon\'s harbor, a symbol of the Age of Discoveries.', recommendations: 'Book tickets online. Combine with Jerónimos Monastery nearby. Free first Sunday of month.' }] },
          { time: '11:30 - 13:00', items: [{ title: 'Jerónimos Monastery', address: 'Praça do Império 1400-206 Lisboa, Portugal', category: 'landmark', description: 'Admire the stunning Manueline architecture of this UNESCO World Heritage site.', recommendations: 'Book tickets online. Very popular. The church is free, monastery requires ticket.' }] },
          { time: '13:30 - 15:00', items: [{ title: 'Pastéis de Belém', address: 'R. de Belém 84-92, 1300-085 Lisboa, Portugal', category: 'restaurant', description: 'Try the original pastéis de nata at the famous bakery where they were first created.', recommendations: 'Very popular, expect a queue. Worth the wait! Best eaten warm with cinnamon.' }] },
          { time: '15:30 - 17:00', items: [{ title: 'Alfama District', address: 'Alfama, Lisbon, Portugal', category: 'neighborhood', description: 'Get lost in the narrow, winding streets of Lisbon\'s oldest district, full of Fado music and charm.', recommendations: 'Wear comfortable shoes for hills. Many viewpoints (miradouros) with great views. Try Fado in evening.' }] },
          { time: '17:30 - 19:00', items: [{ title: 'São Jorge Castle', address: 'R. de Santa Cruz do Castelo, 1100-129 Lisboa, Portugal', category: 'landmark', description: 'Explore the medieval castle with panoramic views over Lisbon and the Tagus River.', recommendations: 'Book tickets online. Sunset views are spectacular. Allow 1-2 hours.' }] },
          { time: '19:30 - 21:30', items: [{ title: 'Time Out Market', address: 'Av. 24 de Julho 49, 1200-479 Lisboa, Portugal', category: 'market', description: 'Experience Lisbon\'s food hall with top chefs and local specialties under one roof.', recommendations: 'Very popular, can be crowded. Great variety. Try Portuguese wine and seafood.' }] },
          { time: '22:00 - 23:30', items: [{ title: 'Fado Performance', address: 'Various, Alfama, Lisbon, Portugal', category: 'activity', description: 'Listen to traditional Portuguese Fado music in an intimate setting in Alfama.', recommendations: 'Book in advance. Shows typically start around 8-9 PM. Some include dinner. Very emotional music.' }] }
        ]
      }
    ]
  },
  'Cycling Adventure in Amsterdam': {
    city: 'Amsterdam',
    country: 'Netherlands',
    description: 'Experience Amsterdam like a local with this cycling tour. Discover canals, museums, and the unique Dutch culture on two wheels.',
    tags: ['active', 'cycling', 'nature', 'culture'],
    duration_days: 1,
    daily_plan: [
      {
        day: 1,
        blocks: [
          { time: '09:00 - 11:00', items: [{ title: 'Vondelpark', address: 'Vondelpark, Amsterdam, Netherlands', category: 'park', description: 'Start your cycling adventure in Amsterdam\'s largest and most famous park, perfect for a morning ride.', recommendations: 'Rent a bike from one of the many rental shops. Park is free and beautiful. Watch for pedestrians.' }] },
          { time: '11:30 - 13:00', items: [{ title: 'Rijksmuseum', address: 'Museumstraat 1, 1071 XX Amsterdam, Netherlands', category: 'museum', description: 'Visit the Netherlands\' national museum with masterpieces by Rembrandt, Vermeer, and other Dutch masters.', recommendations: 'Book tickets online. Very popular. Focus on Gallery of Honour for highlights. Allow 2-3 hours.' }] },
          { time: '13:30 - 15:00', items: [{ title: 'Canal Ring', address: 'Canal Ring, Amsterdam, Netherlands', category: 'landmark', description: 'Cycle along the beautiful 17th-century canal ring, a UNESCO World Heritage site.', recommendations: 'Follow the bike paths. Stop for photos at famous bridges. Very scenic route.' }] },
          { time: '15:30 - 17:00', items: [{ title: 'Anne Frank House', address: 'Westermarkt 20, 1016 GV Amsterdam, Netherlands', category: 'museum', description: 'Visit the hiding place where Anne Frank wrote her famous diary during WWII.', recommendations: 'Must book tickets online months in advance. Very moving experience. No photos inside.' }] },
          { time: '17:30 - 19:00', items: [{ title: 'Jordaan Neighborhood', address: 'Jordaan, Amsterdam, Netherlands', category: 'neighborhood', description: 'Explore the charming Jordaan district with its narrow streets, art galleries, and cozy cafes.', recommendations: 'Great for a break. Many small restaurants and bars. Very picturesque.' }] },
          { time: '19:30 - 21:30', items: [{ title: 'Van Gogh Museum', address: 'Museumplein 6, 1071 DJ Amsterdam, Netherlands', category: 'museum', description: 'Explore the world\'s largest collection of Van Gogh\'s paintings and learn about his life.', recommendations: 'Book timed entry online. Very popular. Audio guide recommended. Allow 1.5-2 hours.' }] },
          { time: '22:00 - 23:30', items: [{ title: 'Dutch Pub Experience', address: 'Various, Amsterdam, Netherlands', category: 'restaurant', description: 'Enjoy traditional Dutch food and local beer in a cozy brown cafe (bruin café).', recommendations: 'Try bitterballen, stroopwafels, and Dutch cheese. Very cozy atmosphere.' }] }
        ]
      }
    ]
  },
  'Artistic Exploration in Barcelona': {
    city: 'Barcelona',
    country: 'Spain',
    description: 'Immerse yourself in Barcelona\'s rich art and architecture scene. From Gaudi\'s masterpieces to contemporary art, discover the creative soul of Catalonia.',
    tags: ['culture', 'art', 'architecture', 'gaudi'],
    duration_days: 1,
    daily_plan: [
      {
        day: 1,
        blocks: [
          { time: '09:00 - 11:30', items: [{ title: 'Sagrada Familia', address: 'Carrer de Mallorca, 401, 08013 Barcelona, Spain', category: 'landmark', description: 'Visit Gaudi\'s unfinished masterpiece, a stunning basilica that has been under construction for over 100 years.', recommendations: 'Book tickets online months in advance. Audio guide or guided tour highly recommended. Allow 2 hours.' }] },
          { time: '12:00 - 13:30', items: [{ title: 'Park Güell', address: '08024 Barcelona, Spain', category: 'park', description: 'Explore the colorful park designed by Antoni Gaudi with mosaic sculptures and stunning city views.', recommendations: 'Book timed entry online. The monumental zone requires ticket. Free areas also beautiful.' }] },
          { time: '14:00 - 15:30', items: [{ title: 'La Boqueria Market', address: 'La Rambla, 91, 08001 Barcelona, Spain', category: 'market', description: 'Experience Barcelona\'s most famous food market with fresh produce, seafood, and local specialties.', recommendations: 'Very crowded, especially weekends. Try fresh fruit juices and local snacks. Great for lunch.' }] },
          { time: '16:00 - 17:30', items: [{ title: 'Casa Batlló', address: 'Passeig de Gràcia, 43, 08008 Barcelona, Spain', category: 'landmark', description: 'Admire Gaudi\'s architectural masterpiece, a building that looks like it\'s from a fairy tale.', recommendations: 'Book tickets online. Audio guide included. Very popular, book in advance.' }] },
          { time: '18:00 - 19:30', items: [{ title: 'Gothic Quarter', address: 'Gothic Quarter, Barcelona, Spain', category: 'neighborhood', description: 'Wander through medieval streets, discover hidden plazas, and admire Gothic architecture.', recommendations: 'Free to explore. Very atmospheric. Many small shops and cafes. Great for evening stroll.' }] },
          { time: '20:00 - 22:00', items: [{ title: 'Tapas in El Born', address: 'El Born, Barcelona, Spain', category: 'neighborhood', description: 'Experience Barcelona\'s tapas culture in the trendy El Born neighborhood.', recommendations: 'Very popular area. Try different tapas at multiple bars. Very social dining experience.' }] },
          { time: '22:30 - 00:30', items: [{ title: 'Flamenco Show', address: 'Various, Barcelona, Spain', category: 'activity', description: 'Watch an authentic flamenco performance, experiencing the passion of Spanish dance and music.', recommendations: 'Book in advance. Shows typically start around 9-10 PM. Some include dinner and drinks.' }] }
        ]
      }
    ]
  },
  'Ancient History Tour of Rome': {
    city: 'Rome',
    country: 'Italy',
    description: 'Step back in time and explore Rome\'s ancient wonders. From the Colosseum to the Forum, discover the legacy of the Roman Empire.',
    tags: ['culture', 'history', 'architecture', 'ancient'],
    duration_days: 1,
    daily_plan: [
      {
        day: 1,
        blocks: [
          { time: '08:30 - 11:00', items: [{ title: 'Colosseum', address: 'Piazza del Colosseo, 1, 00184 Roma RM, Italy', category: 'landmark', description: 'Visit the iconic amphitheater, symbol of ancient Rome and one of the world\'s most famous landmarks.', recommendations: 'Book tickets online months in advance. Combined ticket includes Forum and Palatine Hill. Guided tours recommended.' }] },
          { time: '11:30 - 13:30', items: [{ title: 'Roman Forum', address: 'Via della Salara Vecchia, 5/6, 00186 Roma RM, Italy', category: 'landmark', description: 'Walk through the ruins of ancient Rome\'s political and commercial center.', recommendations: 'Included with Colosseum ticket. Audio guide helpful. Allow 1-2 hours. Very hot in summer, bring water.' }] },
          { time: '14:00 - 15:30', items: [{ title: 'Palatine Hill', address: 'Palatine Hill, 00186 Roma RM, Italy', category: 'landmark', description: 'Explore the hill where Rome was founded and where emperors built their palaces.', recommendations: 'Included with Colosseum ticket. Great views of Forum. Less crowded than Forum.' }] },
          { time: '16:00 - 17:30', items: [{ title: 'Pantheon', address: 'Piazza della Rotonda, 00186 Roma RM, Italy', category: 'landmark', description: 'Admire the best-preserved ancient Roman building, now a church with a remarkable dome.', recommendations: 'Free entry. Very popular, can be crowded. The oculus (hole in dome) is fascinating.' }] },
          { time: '18:00 - 19:30', items: [{ title: 'Trevi Fountain', address: 'Piazza di Trevi, 00187 Roma RM, Italy', category: 'landmark', description: 'Throw a coin in the famous Baroque fountain, ensuring your return to Rome.', recommendations: 'Very crowded during day. Evening is more atmospheric. Free to visit. Throw coin with right hand over left shoulder.' }] },
          { time: '20:00 - 22:00', items: [{ title: 'Spanish Steps', address: 'Piazza di Spagna, 00187 Roma RM, Italy', category: 'landmark', description: 'Climb the famous 135-step staircase and enjoy views of Rome.', recommendations: 'Free to visit. Very popular spot. No sitting on steps (fines enforced). Great for people watching.' }] },
          { time: '22:30 - 00:00', items: [{ title: 'Traditional Roman Restaurant', address: 'Various, Rome, Italy', category: 'restaurant', description: 'Enjoy authentic Roman cuisine in a traditional trattoria.', recommendations: 'Try carbonara, cacio e pepe, or amatriciana. Book in advance for popular restaurants.' }] }
        ]
      }
    ]
  },
  'Romantic Weekend in Paris': {
    city: 'Paris',
    country: 'France',
    description: 'A charming two-day journey through the romantic streets of Paris, discovering hidden gems and iconic landmarks. Perfect for couples seeking an unforgettable experience in the City of Light.',
    tags: ['romantic', 'culture', 'food', 'architecture'],
    duration_days: 2,
    daily_plan: [
      {
        day: 1,
        blocks: [
          { time: '09:00 - 10:30', items: [{ title: 'Eiffel Tower', address: 'Champ de Mars, 5 Av. Anatole France, 75007 Paris, France', category: 'landmark', description: 'Start your romantic journey at the iconic iron lattice tower. Take the elevator to the top for breathtaking views of Paris.', recommendations: 'Book tickets online in advance to avoid long queues. Visit early morning for fewer crowds.' }] },
          { time: '11:00 - 12:30', items: [{ title: 'Seine River Cruise', address: 'Port de la Bourdonnais, 75007 Paris, France', category: 'activity', description: 'Enjoy a romantic cruise along the Seine, passing under historic bridges and seeing Paris from a different perspective.', recommendations: 'Opt for an evening cruise for the most romantic experience with city lights.' }] },
          { time: '13:00 - 14:30', items: [{ title: 'Le Marais District', address: 'Le Marais, 75004 Paris, France', category: 'neighborhood', description: 'Explore the charming medieval streets, boutique shops, and cozy cafes of this historic district.', recommendations: 'Try authentic French pastries at a local patisserie. Perfect for a romantic lunch.' }] },
          { time: '15:00 - 16:30', items: [{ title: 'Notre-Dame Cathedral', address: '6 Parvis Notre-Dame - Pl. Jean-Paul II, 75004 Paris, France', category: 'landmark', description: 'Admire the Gothic architecture of this world-famous cathedral, a masterpiece of French medieval art.', recommendations: 'Check current visiting hours as restoration work may affect access.' }] },
          { time: '17:00 - 18:30', items: [{ title: 'Louvre Museum', address: 'Rue de Rivoli, 75001 Paris, France', category: 'museum', description: 'Discover the world\'s largest art museum, home to the Mona Lisa and thousands of masterpieces.', recommendations: 'Book timed entry online. Focus on specific galleries to avoid overwhelm.' }] },
          { time: '19:30 - 21:30', items: [{ title: 'Montmartre & Sacré-Cœur', address: '35 Rue du Chevalier de la Barre, 75018 Paris, France', category: 'landmark', description: 'Climb the steps to the basilica and enjoy panoramic views. Explore the artistic neighborhood below.', recommendations: 'Visit at sunset for the most romantic views. Dine at a traditional French bistro nearby.' }] }
        ]
      },
      {
        day: 2,
        blocks: [
          { time: '09:00 - 10:30', items: [{ title: 'Arc de Triomphe', address: 'Pl. Charles de Gaulle, 75008 Paris, France', category: 'landmark', description: 'Climb to the top for stunning views of the Champs-Élysées and the city\'s grand boulevards.', recommendations: 'Arrive early to avoid crowds. The view from the top is worth the climb.' }] },
          { time: '11:00 - 12:30', items: [{ title: 'Champs-Élysées', address: 'Champs-Élysées, 75008 Paris, France', category: 'shopping', description: 'Stroll down the world\'s most famous avenue, shop at luxury boutiques, and enjoy a coffee at a sidewalk cafe.', recommendations: 'Perfect for window shopping and people watching. Try Ladurée for famous macarons.' }] },
          { time: '13:00 - 14:30', items: [{ title: 'Versailles Palace', address: 'Place d\'Armes, 78000 Versailles, France', category: 'landmark', description: 'Take a day trip to the opulent palace of Versailles, a symbol of absolute monarchy.', recommendations: 'Book tickets in advance. Allocate at least 3-4 hours. Don\'t miss the Hall of Mirrors.' }] },
          { time: '15:30 - 17:00', items: [{ title: 'Musée d\'Orsay', address: '1 Rue de la Légion d\'Honneur, 75007 Paris, France', category: 'museum', description: 'Explore the world\'s finest collection of Impressionist art in a beautiful former railway station.', recommendations: 'Less crowded than the Louvre. Focus on the Impressionist galleries on the top floor.' }] },
          { time: '18:00 - 19:30', items: [{ title: 'Latin Quarter', address: 'Latin Quarter, 75005 Paris, France', category: 'neighborhood', description: 'Wander through historic streets, discover hidden bookshops, and enjoy the bohemian atmosphere.', recommendations: 'Perfect for a romantic dinner. Try traditional French cuisine at a local restaurant.' }] },
          { time: '20:00 - 22:00', items: [{ title: 'Seine River Walk', address: 'Quai de la Tournelle, 75005 Paris, France', category: 'activity', description: 'End your romantic weekend with a moonlit walk along the Seine, taking in the illuminated monuments.', recommendations: 'Bring a bottle of wine and find a quiet spot on the riverbank for a perfect ending.' }] }
        ]
      }
    ]
  }
};

async function getOrCreateCity(cityName, countryName) {
  try {
    const { data: existing } = await supabase.from('cities').select('id').ilike('name', cityName).limit(1).maybeSingle();
    if (existing) return existing.id;
    const { data: newCity, error } = await supabase.from('cities').insert({ name: cityName, country: countryName || null }).select('id').single();
    if (error) { console.error(`❌ Error creating city ${cityName}:`, error); return null; }
    return newCity.id;
  } catch (err) { console.error(`❌ Error:`, err); return null; }
}

async function getOrCreateTags(tagNames) {
  const tagIds = [];
  for (const tagName of tagNames) {
    try {
      const { data: existing } = await supabase.from('tags').select('id').ilike('name', tagName).limit(1).maybeSingle();
      if (existing) { tagIds.push(existing.id); continue; }
      const { data: newTag, error } = await supabase.from('tags').insert({ name: tagName }).select('id').single();
      if (error) { console.error(`❌ Error creating tag ${tagName}:`, error); continue; }
      tagIds.push(newTag.id);
    } catch (err) { console.error(`❌ Error:`, err); }
  }
  return tagIds;
}

async function enrichTours() {
  console.log('🚀 Starting tour enrichment process...\n');

  // Get all existing tours
  const { data: existingTours, error: fetchError } = await supabase
    .from('tours')
    .select('id, title, city_id')
    .eq('is_published', true);

  if (fetchError) {
    console.error('❌ Error fetching tours:', fetchError);
    return;
  }

  console.log(`📊 Found ${existingTours.length} published tours to process\n`);

  let updated = 0;
  let skipped = 0;
  const errors = [];

  for (const existingTour of existingTours) {
    const tourData = enrichedTours[existingTour.title];
    
    if (!tourData) {
      console.log(`⏭️  Skipping "${existingTour.title}" - no enrichment data available`);
      skipped++;
      continue;
    }

    try {
      console.log(`\n📝 Processing: ${existingTour.title}`);
      
      const cityId = await getOrCreateCity(tourData.city, tourData.country);
      if (!cityId) {
        errors.push({ tour: existingTour.title, error: 'Failed to get/create city' });
        continue;
      }

      const tagIds = await getOrCreateTags(tourData.tags);
      const maxDay = Math.max(...tourData.daily_plan.map(d => d.day));

      // Update tour basic info
      const { error: updateError } = await supabase.from('tours').update({
        description: tourData.description,
        city_id: cityId,
        duration_value: maxDay,
        duration_type: 'days'
      }).eq('id', existingTour.id);

      if (updateError) {
        errors.push({ tour: existingTour.title, error: updateError.message });
        continue;
      }

      // Delete existing structure
      const { data: existingDays } = await supabase.from('tour_days').select('id').eq('tour_id', existingTour.id);
      if (existingDays && existingDays.length > 0) {
        const dayIds = existingDays.map(d => d.id);
        const { data: existingBlocks } = await supabase.from('tour_blocks').select('id').in('tour_day_id', dayIds);
        if (existingBlocks && existingBlocks.length > 0) {
          const blockIds = existingBlocks.map(b => b.id);
          await supabase.from('tour_items').delete().in('tour_block_id', blockIds);
        }
        await supabase.from('tour_blocks').delete().in('tour_day_id', dayIds);
      }
      await supabase.from('tour_days').delete().eq('tour_id', existingTour.id);
      await supabase.from('tour_tags').delete().eq('tour_id', existingTour.id);

      // Create tour_tags
      if (tagIds.length > 0) {
        const tourTagInserts = tagIds.map(tagId => ({ tour_id: existingTour.id, tag_id: tagId }));
        await supabase.from('tour_tags').insert(tourTagInserts);
      }

      // Create new structure
      for (const day of tourData.daily_plan) {
        const { data: tourDay, error: dayError } = await supabase.from('tour_days').insert({
          tour_id: existingTour.id,
          day_number: day.day,
          title: null,
          date_hint: null
        }).select('id').single();
        
        if (dayError || !tourDay) {
          console.error(`❌ Error creating tour_day:`, dayError);
          continue;
        }

        for (const block of day.blocks) {
          const { data: tourBlock, error: blockError } = await supabase.from('tour_blocks').insert({
            tour_day_id: tourDay.id,
            start_time: block.time.split(' - ')[0] || null,
            end_time: block.time.split(' - ')[1] || null,
            title: null
          }).select('id').single();
          
          if (blockError || !tourBlock) {
            console.error(`❌ Error creating tour_block:`, blockError);
            continue;
          }

          for (let i = 0; i < block.items.length; i++) {
            const item = block.items[i];
            let locationId = null;
            
            const { data: existingLocation } = await supabase
              .from('locations')
              .select('id')
              .ilike('name', item.title)
              .eq('city_id', cityId)
              .limit(1)
              .maybeSingle();
            
            if (existingLocation) {
              locationId = existingLocation.id;
            } else {
              const { data: newLocation, error: locError } = await supabase.from('locations').insert({
                name: item.title,
                city_id: cityId,
                address: item.address,
                category: item.category || null,
                description: item.description || null,
                recommendations: item.recommendations || null,
                source: 'guide',
                verified: true
              }).select('id').single();
              
              if (!locError && newLocation) locationId = newLocation.id;
            }
            
            if (locationId) {
              await supabase.from('tour_items').insert({
                tour_block_id: tourBlock.id,
                location_id: locationId,
                custom_title: null,
                custom_description: item.description || null,
                custom_recommendations: item.recommendations || null,
                order_index: i,
                approx_cost: null
              });
            }
          }
        }
      }

      const totalItems = tourData.daily_plan.reduce((sum, day) => 
        sum + day.blocks.reduce((s, b) => s + b.items.length, 0), 0
      );
      
      console.log(`✅ Updated: ${existingTour.title} with ${maxDay} day(s) and ${totalItems} locations`);
      updated++;

    } catch (err) {
      console.error(`❌ Error processing ${existingTour.title}:`, err);
      errors.push({ tour: existingTour.title, error: err.message });
    }
  }

  console.log('\n\n📈 Summary:');
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
  if (errors.length > 0) {
    console.log(`   Errors: ${errors.length}`);
    console.log(errors);
  }
  console.log('\n✅ Enrichment complete!');
}

enrichTours().catch(console.error);



