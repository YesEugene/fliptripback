// ContentBlocksGenerationService - Generates content blocks for tours
// Follows the exact sequence: TITLE → TEXT (intro) → LOCATION → DIVIDER → PHOTO → etc.

import OpenAI from 'openai';
import { Client } from '@googlemaps/google-maps-services-js';

const SYSTEM_TONE = `You are writing a personal city guide in the style of a local or frequent visitor.

Write as a real person, not a travel expert.

Avoid marketing language, poetic metaphors, and dramatic storytelling.

The tone should be calm, observant, and grounded — like notes you would send to a friend.

Focus on how places feel and when they make sense during the day.

Less emotion, more presence.
Less explanation, more confidence.`;

export class ContentBlocksGenerationService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.googleMapsClient = new Client({});
  }
  
  /**
   * Search for location in Google Places API
   * @param {string} query - Search query (location name + city)
   * @param {string} city - City name
   * @returns {Promise<Object|null>} Place data with photos or null
   */
  /**
   * Check if address contains city name (case-insensitive)
   * @param {string} address - Full address string
   * @param {string} city - City name to check
   * @returns {boolean} True if address contains city
   */
  addressMatchesCity(address, city) {
    if (!address || !city) return false;
    const addressLower = address.toLowerCase();
    const cityLower = city.toLowerCase();
    // Check if city name appears in address
    // Also check for common city name variations (e.g., "Lisboa" vs "Lisbon")
    const cityVariations = {
      'lisboa': ['lisbon', 'lisboa'],
      'paris': ['paris'],
      'rome': ['roma', 'rome'],
      'barcelona': ['barcelona'],
      'madrid': ['madrid'],
      'amsterdam': ['amsterdam'],
      'berlin': ['berlin'],
      'vienna': ['wien', 'vienna'],
      'prague': ['praha', 'prague']
    };
    
    // Check exact match
    if (addressLower.includes(cityLower)) return true;
    
    // Check variations
    const variations = cityVariations[cityLower] || [cityLower];
    for (const variation of variations) {
      if (addressLower.includes(variation)) return true;
    }
    
    return false;
  }

  async searchGooglePlace(query, city, options = {}) {
    try {
      if (!process.env.GOOGLE_MAPS_KEY) {
        console.warn('⚠️ Google Maps API key not configured');
        return null;
      }
      
      const { strictCityMatch = false, maxResults = 5 } = options;
      
      // Try multiple search queries
      const searchQueries = [
        `${query} ${city}`, // Exact query with city
        query, // Just the query (Google Places is usually good at geolocation)
        `${query} near ${city}` // Alternative format
      ];
      
      for (const searchQuery of searchQueries) {
        console.log(`🔍 Searching Google Places: "${searchQuery}"`);
        
        try {
          const response = await this.googleMapsClient.textSearch({
            params: {
              query: searchQuery,
              key: process.env.GOOGLE_MAPS_KEY,
              language: 'en'
            }
          });
          
          if (response.data.results && response.data.results.length > 0) {
            // Try to find a place that matches the city
            let place = null;
            
            // First, try to find exact city match
            for (const result of response.data.results) {
              const address = result.formatted_address || '';
              if (this.addressMatchesCity(address, city)) {
                place = result;
                console.log(`✅ Found exact city match: ${place.name} in ${city}`);
                break;
              }
            }
            
            // If no exact match and strictCityMatch is false, use first result
            if (!place && !strictCityMatch) {
              // Check first few results to see if any are in the city
              for (let i = 0; i < Math.min(maxResults, response.data.results.length); i++) {
                const result = response.data.results[i];
                const address = result.formatted_address || '';
                
                // If address matches city, use it
                if (this.addressMatchesCity(address, city)) {
                  place = result;
                  console.log(`✅ Found city match in result ${i + 1}: ${place.name}`);
                  break;
                }
              }
              
              // If still no match, but we have results, use first one (Google Places is usually accurate)
              if (!place && response.data.results.length > 0) {
                place = response.data.results[0];
                const address = place.formatted_address || '';
                console.log(`⚠️ Using first result "${place.name}" (address: ${address.substring(0, 50)}...) - may not be in ${city}`);
              }
            }
            
            if (place) {
              const photos = place.photos && place.photos.length > 0
                ? place.photos.slice(0, 10).map(photo => 
                    `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photo.photo_reference}&key=${process.env.GOOGLE_MAPS_KEY}`
                  )
                : [];
              
              console.log(`✅ Found Google Place: ${place.name} with ${photos.length} photos`);
              
              return {
                name: place.name,
                address: place.formatted_address || '',
                photos: photos,
                place_id: place.place_id,
                rating: place.rating || null,
                price_level: place.price_level !== undefined ? String(place.price_level) : null
              };
            }
          }
        } catch (searchError) {
          console.warn(`⚠️ Search query "${searchQuery}" failed:`, searchError.message || searchError);
          // Continue to next query
          continue;
        }
      }
      
      console.warn(`❌ No location found for query "${query}" in ${city} after trying ${searchQueries.length} search queries`);
      return null;
    } catch (error) {
      console.warn(`⚠️ Google Places search error for "${query}":`, error.message || error);
      return null;
    }
  }
  
  /**
   * Search for popular places in a city via Google Places API
   * Used to get real photos of the city for Photo and 3columns blocks
   * @param {string} city - City name
   * @param {number} count - Number of places to find
   * @param {Array<string>} queries - Optional search queries (e.g., ['landmarks', 'cafes', 'viewpoints'])
   * @returns {Promise<Array<string>>} Array of photo URLs
   */
  async searchCityPhotos(city, count = 3, queries = null) {
    try {
      if (!process.env.GOOGLE_MAPS_KEY) {
        console.warn('⚠️ Google Maps API key not configured');
        return [];
      }
      
      // Default queries if not provided
      const searchQueries = queries || [
        `landmarks ${city}`,
        `popular places ${city}`,
        `tourist attractions ${city}`
      ];
      
      const allPhotos = [];
      
      // Search for each query and collect photos
      for (const query of searchQueries.slice(0, count)) {
        try {
          console.log(`🔍 Searching Google Places for city photos: ${query}`);
          
          const response = await this.googleMapsClient.textSearch({
            params: {
              query: query,
              key: process.env.GOOGLE_MAPS_KEY,
              language: 'en',
              type: 'tourist_attraction' // Focus on tourist attractions
            }
          });
          
          if (response.data.results && response.data.results.length > 0) {
            // Take first result and get its photos
            const place = response.data.results[0];
            if (place.photos && place.photos.length > 0) {
              const photos = place.photos.slice(0, 3).map(photo => 
                `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photo.photo_reference}&key=${process.env.GOOGLE_MAPS_KEY}`
              );
              allPhotos.push(...photos);
              console.log(`✅ Found ${photos.length} photos from ${place.name} in ${city}`);
            }
          }
        } catch (queryError) {
          console.warn(`⚠️ Error searching for "${query}":`, queryError.message || queryError);
          // Continue with next query
        }
      }
      
      // If we got photos, return them (up to count)
      if (allPhotos.length > 0) {
        return allPhotos.slice(0, count);
      }
      
      return [];
    } catch (error) {
      console.warn(`⚠️ Error searching city photos for "${city}":`, error.message || error);
      return [];
    }
  }

  /**
   * Get photo from Unsplash (no API key needed for basic usage)
   * @param {string} query - Search query (city name or description)
   * @returns {string} Photo URL
   */
  async getUnsplashPhoto(query) {
    try {
      // Use Unsplash's public API with random images
      // Since source.unsplash.com is deprecated, we'll use a curated list of high-quality images
      // or use the Unsplash API with a simple fetch approach
      
      // For now, use a hash-based approach to get consistent images for the same query
      // This uses Unsplash's image service directly
      const encodedQuery = encodeURIComponent(query);
      
      // Use Unsplash's image service with random seed based on query
      // This ensures we get different images for different queries
      const seed = this.hashString(query);
      const photoUrl = `https://images.unsplash.com/photo-${1500000000000 + (seed % 1000000)}?w=800&h=600&fit=crop&q=80`;
      
      // Alternative: Use a curated list of popular Unsplash photos
      // This is more reliable than source.unsplash.com
      const curatedPhotos = [
        'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&h=600&fit=crop&q=80', // Nature
        'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&h=600&fit=crop&q=80', // City
        'https://images.unsplash.com/photo-1516550893923-42d28e5677af?w=800&h=600&fit=crop&q=80', // Architecture
        'https://images.unsplash.com/photo-1539037116277-4db20889f2d2?w=800&h=600&fit=crop&q=80', // Travel
        'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=800&h=600&fit=crop&q=80', // Street
        'https://images.unsplash.com/photo-1529260830199-42c24126f198?w=800&h=600&fit=crop&q=80', // Landscape
        'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800&h=600&fit=crop&q=80', // Urban
        'https://images.unsplash.com/photo-1587330979470-3595ac045ab0?w=800&h=600&fit=crop&q=80', // Culture
        'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&h=600&fit=crop&q=80', // Food
        'https://images.unsplash.com/photo-1541849546-216549ae216d?w=800&h=600&fit=crop&q=80'  // Lifestyle
      ];
      
      // Select photo based on query hash for consistency
      const selectedPhoto = curatedPhotos[seed % curatedPhotos.length];
      
      console.log(`📸 Getting Unsplash photo for query: "${query}" -> ${selectedPhoto}`);
      return selectedPhoto;
    } catch (error) {
      console.error('❌ Error getting Unsplash photo:', error);
      // Fallback to a generic city photo
      return 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&h=600&fit=crop&q=80';
    }
  }
  
  /**
   * Simple hash function to convert string to number
   * @param {string} str - String to hash
   * @returns {number} Hash value
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Generate all 17 blocks for a full day
   * @param {Object} params - { city, audience, interests, concept, locations, dayConcept }
   * @returns {Array} Array of content blocks with order_index
   */
  async generateFullDayBlocks({ city, audience, interests, concept, locations, dayConcept }) {
    console.log('📦 ContentBlocksGenerationService: Generating full day blocks...');

    const blocks = [];
    let orderIndex = 0;
    
    // Track used locations to avoid duplicates
    const usedLocationNames = new Set();
    const usedPlaceIds = new Set();
    
    // Track used photos in Photo/Slide/3columns blocks to avoid duplicates
    const usedPhotoUrls = new Set();
    
    // Helper function to check if location is already used
    const isLocationUsed = (location) => {
      const name = location?.realPlace?.name || location?.name || '';
      const placeId = location?.realPlace?.place_id || location?.place_id || '';
      return usedLocationNames.has(name.toLowerCase()) || usedPlaceIds.has(placeId);
    };
    
    // Helper function to mark location as used
    const markLocationAsUsed = (location) => {
      const name = location?.realPlace?.name || location?.name || '';
      const placeId = location?.realPlace?.place_id || location?.place_id || '';
      if (name) usedLocationNames.add(name.toLowerCase());
      if (placeId) usedPlaceIds.add(placeId);
    };

    // 1. TITLE BLOCK
    const titleBlock = await this.generateTitleBlock({ city, concept, interests, audience });
    blocks.push({
      block_type: 'title',
      order_index: orderIndex++,
      content: titleBlock
    });

    // 2. TEXT BLOCK (INTRO)
    const introTextBlock = await this.generateIntroTextBlock({ city, concept, interests, audience });
    blocks.push({
      block_type: 'text',
      order_index: orderIndex++,
      content: introTextBlock
    });

    // 3. LOCATION BLOCK (09:00-10:00) - Breakfast/Coffee
    const breakfastLocation = locations.find(loc => {
      const time = loc.time || loc.slot?.time;
      return time && (time.startsWith('09:') || time.startsWith('10:00'));
    });
    if (breakfastLocation && !isLocationUsed(breakfastLocation)) {
      markLocationAsUsed(breakfastLocation);
      const locationBlock = await this.generateLocationBlock({
        location: breakfastLocation,
        timeSlot: '09:00-10:00',
        purpose: 'Breakfast / Coffee + Gentle Start',
        city,
        concept,
        interests,
        audience,
        usedLocationNames,
        usedPlaceIds
      });
      blocks.push({
        block_type: 'location',
        order_index: orderIndex++,
        content: locationBlock
      });
    }

    // 4. DIVIDER
    blocks.push({
      block_type: 'divider',
      order_index: orderIndex++,
      content: { style: 'solid' }
    });

    // 5. PHOTO BLOCK
    const photoBlock = await this.generatePhotoBlock({
      context: 'after breakfast, while walking',
      city,
      concept,
      interests,
      locations
    });
    blocks.push({
      block_type: 'photo',
      order_index: orderIndex++,
      content: photoBlock
    });

    // 6. LOCATION BLOCK (10:30-12:00) - Walking/Exploring
    const morningLocation = locations.find(loc => {
      const time = loc.time || loc.slot?.time;
      return time && (time.startsWith('10:') || time.startsWith('11:') || time.startsWith('12:00'));
    });
    if (morningLocation && !isLocationUsed(morningLocation)) {
      markLocationAsUsed(morningLocation);
      const locationBlock = await this.generateLocationBlock({
        location: morningLocation,
        timeSlot: '10:30-12:00',
        purpose: 'Walking / Exploring After Breakfast',
        city,
        concept,
        interests,
        audience,
        usedLocationNames,
        usedPlaceIds
      });
      blocks.push({
        block_type: 'location',
        order_index: orderIndex++,
        content: locationBlock
      });
    }

    // 7. DIVIDER
    blocks.push({
      block_type: 'divider',
      order_index: orderIndex++,
      content: { style: 'solid' }
    });

    // 8. LOCATION BLOCK (12:30-15:00) - Lunch
    const lunchLocation = locations.find(loc => {
      const time = loc.time || loc.slot?.time;
      return time && (time.startsWith('12:') || time.startsWith('13:') || time.startsWith('14:') || time.startsWith('15:00'));
    });
    if (lunchLocation && !isLocationUsed(lunchLocation)) {
      markLocationAsUsed(lunchLocation);
      const locationBlock = await this.generateLocationBlock({
        location: lunchLocation,
        timeSlot: '12:30-15:00',
        purpose: 'Lunch / Long Break',
        city,
        concept,
        interests,
        audience,
        usedLocationNames,
        usedPlaceIds
      });
      blocks.push({
        block_type: 'location',
        order_index: orderIndex++,
        content: locationBlock
      });
    }

    // 9. SLIDE BLOCK
    const slideBlock = await this.generateSlideBlock({
      context: 'after lunch, middle of the day',
      city,
      concept,
      interests,
      locations,
      usedPhotoUrls
    });
    blocks.push({
      block_type: 'slide',
      order_index: orderIndex++,
      content: slideBlock
    });

    // 10. DIVIDER
    blocks.push({
      block_type: 'divider',
      order_index: orderIndex++,
      content: { style: 'solid' }
    });

    // 11. LOCATION BLOCK (15:30-17:00) - Light Activity
    const afternoonLocation = locations.find(loc => {
      const time = loc.time || loc.slot?.time;
      return time && (time.startsWith('15:') || time.startsWith('16:') || time.startsWith('17:00'));
    });
    if (afternoonLocation && !isLocationUsed(afternoonLocation)) {
      markLocationAsUsed(afternoonLocation);
      const locationBlock = await this.generateLocationBlock({
        location: afternoonLocation,
        timeSlot: '15:30-17:00',
        purpose: 'Light Activity After Lunch',
        city,
        concept,
        interests,
        audience,
        usedLocationNames,
        usedPlaceIds
      });
      blocks.push({
        block_type: 'location',
        order_index: orderIndex++,
        content: locationBlock
      });
    }

    // 12. 3 COLUMNS BLOCK
    const threeColumnsBlock = await this.generateThreeColumnsBlock({
      context: 'late afternoon, different ways to spend time',
      city,
      concept,
      interests,
      locations,
      usedPhotoUrls
    });
    blocks.push({
      block_type: '3columns',
      order_index: orderIndex++,
      content: threeColumnsBlock
    });

    // 13. DIVIDER
    blocks.push({
      block_type: 'divider',
      order_index: orderIndex++,
      content: { style: 'solid' }
    });

    // 14. LOCATION BLOCK (17:30-19:00) - Pre-Dinner
    const preDinnerLocation = locations.find(loc => {
      const time = loc.time || loc.slot?.time;
      return time && (time.startsWith('17:') || time.startsWith('18:') || time.startsWith('19:00'));
    });
    if (preDinnerLocation && !isLocationUsed(preDinnerLocation)) {
      markLocationAsUsed(preDinnerLocation);
      const locationBlock = await this.generateLocationBlock({
        location: preDinnerLocation,
        timeSlot: '17:30-19:00',
        purpose: 'Pre-Dinner Walk / Views / Transition',
        city,
        concept,
        interests,
        audience,
        usedLocationNames,
        usedPlaceIds
      });
      blocks.push({
        block_type: 'location',
        order_index: orderIndex++,
        content: locationBlock
      });
    }

    // 15. LOCATION BLOCK (19:30-21:00) - Dinner
    const dinnerLocation = locations.find(loc => {
      const time = loc.time || loc.slot?.time;
      return time && (time.startsWith('19:') || time.startsWith('20:') || time.startsWith('21:00'));
    });
    if (dinnerLocation) {
      const locationBlock = await this.generateLocationBlock({
        location: dinnerLocation,
        timeSlot: '19:30-21:00',
        purpose: 'Dinner',
        city,
        concept,
        interests,
        audience
      });
      blocks.push({
        block_type: 'location',
        order_index: orderIndex++,
        content: locationBlock
      });
    }

    // 16. DIVIDER
    blocks.push({
      block_type: 'divider',
      order_index: orderIndex++,
      content: { style: 'solid' }
    });

    // 17. TEXT BLOCK (CLOSING)
    const closingTextBlock = await this.generateClosingTextBlock({ city, concept, interests, audience });
    blocks.push({
      block_type: 'text',
      order_index: orderIndex++,
      content: closingTextBlock
    });

    console.log(`✅ ContentBlocksGenerationService: Generated ${blocks.length} blocks`);
    return blocks;
  }

  /**
   * Generate TITLE block
   */
  async generateTitleBlock({ city, concept, interests, audience }) {
    const prompt = `Create a short title for a day in ${city}.

The title should feel like a personal label, not a headline.

Requirements:
- 2–5 words
- No city name
- No "best", "top", "guide", "itinerary"
- Neutral, calm tone

The title should sound like something the author would write for themselves.

Context:
- City: ${city}
- Concept: ${concept}
- Interests: ${Array.isArray(interests) ? interests.join(', ') : interests}
- Audience: ${audience}

Return only the title text, no quotes, no explanation.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: SYSTEM_TONE },
          { role: "user", content: prompt }
        ],
        max_tokens: 20,
        temperature: 0.7
      });

      const title = response.choices[0].message.content.trim().replace(/^["']|["']$/g, '');
      return {
        text: title,
        size: 'large'
      };
    } catch (error) {
      console.error('❌ Error generating title:', error);
      return {
        text: 'A day in the city',
        size: 'large'
      };
    }
  }

  /**
   * Generate INTRO TEXT block
   */
  async generateIntroTextBlock({ city, concept, interests, audience }) {
    const prompt = `Write a short introductory text for the beginning of the day in ${city}.

Do not describe the plan.
Do not mention locations or time.

Instead, explain how this day should be approached.

The text should sound like a quiet observation or reassurance.

2–3 short paragraphs.

The reader should feel less pressure, not more structure.

Context:
- City: ${city}
- Concept: ${concept}
- Interests: ${Array.isArray(interests) ? interests.join(', ') : interests}
- Audience: ${audience}

Return only the text, no markdown, no quotes.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: SYSTEM_TONE },
          { role: "user", content: prompt }
        ],
        max_tokens: 200,
        temperature: 0.7
      });

      const text = response.choices[0].message.content.trim();
      return {
        text: text,
        formatted: false
      };
    } catch (error) {
      console.error('❌ Error generating intro text:', error);
      return {
        text: 'Take your time. There is no rush.',
        formatted: false
      };
    }
  }

  /**
   * Generate LOCATION block with 1 main + 2 alternatives
   */
  async generateLocationBlock({ location, timeSlot, purpose, city, concept, interests, audience, usedLocationNames = new Set(), usedPlaceIds = new Set() }) {
    const locationName = location.realPlace?.name || location.name || location.title;
    const locationAddress = location.realPlace?.address || location.location || location.address;
    const category = location.category || location.realPlace?.category;

    const prompt = `Create a location block for ${timeSlot} in ${city}, focused on: ${purpose}.

Choose places that work well for this time of day: ${category || 'various places'}.

Include:
- 1 main location: ${locationName} at ${locationAddress}
- 2 alternative locations (suggest similar places in ${city})

For each location:
- Explain why it works for this time slot
- Describe the mood it creates at this time of day
- Add one simple, personal recommendation (what to order, where to sit, how long to stay)

Avoid factual descriptions.
Write as if you start your days like this yourself.

Context:
- City: ${city}
- Concept: ${concept}
- Interests: ${Array.isArray(interests) ? interests.join(', ') : interests}
- Audience: ${audience}

IMPORTANT: You MUST return EXACTLY 2 alternatives. Do not return fewer.

Return JSON (no markdown, no code blocks, just JSON):
{
  "mainLocation": {
    "name": "${locationName}",
    "address": "${locationAddress}",
    "description": "3-5 sentences about why this works",
    "recommendation": "1-2 sentences with personal tip"
  },
  "alternatives": [
    {
      "name": "Alternative location name",
      "address": "Address in ${city}",
      "description": "Why it works",
      "recommendation": "Personal tip"
    },
    {
      "name": "Alternative location name 2",
      "address": "Address 2 in ${city}",
      "description": "Why it works",
      "recommendation": "Personal tip"
    }
  ]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: SYSTEM_TONE },
          { role: "user", content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.7
      });

      let content;
      try {
        // Try to parse JSON - handle markdown code blocks if present
        let responseText = response.choices[0].message.content.trim();
        // Remove markdown code blocks if present
        responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        content = JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ Error parsing JSON response:', parseError);
        throw new Error('Failed to parse OpenAI response as JSON');
      }
      
      // Validate that we have required fields
      if (!content.mainLocation) {
        throw new Error('Missing mainLocation in response');
      }
      
      // Ensure we have exactly 2 alternatives (add fallback if needed)
      let alternatives = content.alternatives || [];
      if (alternatives.length < 2) {
        console.warn(`⚠️ Only ${alternatives.length} alternatives returned, adding fallback`);
        // Add fallback alternatives if needed
        while (alternatives.length < 2) {
          alternatives.push({
            name: `Alternative ${alternatives.length + 1} in ${city}`,
            address: `${city} city center`,
            description: `Another good option for ${purpose.toLowerCase()}.`,
            recommendation: 'Worth considering.'
          });
        }
      }
      
      // Get photos for main location - use all photos from Google Places (up to 10)
      // First check if we have photos in realPlace
      let mainLocationPhotos = location.realPlace?.photos || [];
      
      // If no photos in realPlace, try to search Google Places by name and address
      if (mainLocationPhotos.length === 0 && locationName) {
        console.log(`🔍 Main location has no photos, searching Google Places for: ${locationName} in ${city}`);
        const googlePlace = await this.searchGooglePlace(locationName, city);
        if (googlePlace && googlePlace.photos && googlePlace.photos.length > 0) {
          mainLocationPhotos = googlePlace.photos;
          console.log(`✅ Found ${mainLocationPhotos.length} photos for main location via Google Places search`);
        }
      }
      
      let finalMainPhotos = [];
      
      if (mainLocationPhotos.length > 0) {
        // Use up to 10 photos from Google Places
        finalMainPhotos = mainLocationPhotos.slice(0, 10);
        console.log(`✅ Using ${finalMainPhotos.length} photos for main location`);
      } else {
        // Final fallback to Unsplash only if Google Places search also failed
        console.warn(`⚠️ No Google Places photos found for main location "${locationName}", using Unsplash fallback`);
        const fallbackPhoto = await this.getUnsplashPhoto(`${city} ${locationName}`);
        finalMainPhotos = [fallbackPhoto];
      }
      
      // Get photos for alternatives - search Google Places for real photos
      // Filter out already used locations
      const availableAlternatives = alternatives.filter(alt => {
        const altName = (alt.name || alt.title || '').toLowerCase();
        return !usedLocationNames.has(altName);
      });
      
      const alternativesWithPhotos = await Promise.all(
        availableAlternatives.slice(0, 2).map(async (alt) => {
          const altName = alt.name || alt.title || 'Alternative location';
          
          // Try multiple search strategies to find the location in Google Places
          let googlePlace = null;
          
          // Strategy 1: Search by exact name (not strict city match - Google Places is usually accurate)
          googlePlace = await this.searchGooglePlace(altName, city, { strictCityMatch: false });
          
          // Strategy 2: If failed or no photos, try with address if available
          if ((!googlePlace || !googlePlace.photos || googlePlace.photos.length === 0) && alt.address) {
            console.log(`⚠️ First search failed for "${altName}", trying with address: ${alt.address}`);
            const addressQuery = `${altName} ${alt.address}`;
            googlePlace = await this.searchGooglePlace(addressQuery, city, { strictCityMatch: false });
          }
          
          // Strategy 3: If still failed, try with purpose/category context
          if ((!googlePlace || !googlePlace.photos || googlePlace.photos.length === 0) && purpose) {
            console.log(`⚠️ Second search failed for "${altName}", trying with purpose: ${purpose}`);
            const purposeQuery = `${altName} ${purpose}`;
            googlePlace = await this.searchGooglePlace(purposeQuery, city, { strictCityMatch: false });
          }
          
          // Strategy 4: Try searching just the name without city (Google Places geolocation)
          if ((!googlePlace || !googlePlace.photos || googlePlace.photos.length === 0)) {
            console.log(`⚠️ Third search failed for "${altName}", trying name only`);
            googlePlace = await this.searchGooglePlace(altName, city, { strictCityMatch: false });
          }
          
          // If found, mark as used
          if (googlePlace && googlePlace.place_id) {
            usedPlaceIds.add(googlePlace.place_id);
            usedLocationNames.add(googlePlace.name.toLowerCase());
          }
          
          let altPhotos = [];
          let altAddress = alt.address || '';
          let altRating = null;
          let altPriceLevel = null;
          let altPlaceId = null;
          
          if (googlePlace && googlePlace.photos && googlePlace.photos.length > 0) {
            // Use real photos from Google Places - get multiple photos (gallery)
            // Use up to 5 photos for alternative locations
            altPhotos = googlePlace.photos.slice(0, 5);
            altAddress = googlePlace.address || altAddress;
            altRating = googlePlace.rating;
            altPriceLevel = googlePlace.price_level;
            altPlaceId = googlePlace.place_id;
            console.log(`✅ Using ${altPhotos.length} Google Places photos (gallery) for alternative: ${altName}`);
          } else {
            // Final fallback: use Unsplash only if all Google Places searches fail
            console.warn(`⚠️ All Google Places searches failed for "${altName}", using Unsplash fallback`);
            const fallbackPhoto = await this.getUnsplashPhoto(`${city} ${altName}`);
            altPhotos = [fallbackPhoto];
          }
          
          return {
            ...alt,
            name: altName,
            title: altName, // Frontend expects 'title'
            address: altAddress,
            photos: altPhotos.filter(photo => photo), // Filter out any null/undefined photos
            photo: altPhotos[0] || null, // Keep single photo for backward compatibility
            rating: altRating,
            price_level: altPriceLevel,
            place_id: altPlaceId // For Google Maps link
          };
        })
      );
      
      // Ensure recommendations field exists
      const recommendations = content.mainLocation.recommendation || 
                              content.mainLocation.recommendations || 
                              'Take your time here.';
      
      // Get rating, price_level, and approximate_cost from Google Places data
      const realPlace = location.realPlace || {};
      const rating = realPlace.rating || null;
      const userRatingsTotal = realPlace.user_ratings_total || realPlace.userRatingsTotal || null;
      const priceLevel = realPlace.priceLevel !== undefined && realPlace.priceLevel !== null 
        ? String(realPlace.priceLevel) 
        : (realPlace.price_level !== undefined && realPlace.price_level !== null 
          ? String(realPlace.price_level) 
          : '');
      
      // Map price_level to approximate_cost
      const approximateCostMap = {
        0: 'Free',
        1: '€5-10',
        2: '€10-30',
        3: '€30-60',
        4: '€60+'
      };
      const approximateCost = priceLevel && approximateCostMap[priceLevel] 
        ? approximateCostMap[priceLevel] 
        : '';
      
      // Return structure compatible with location block (frontend expects alternativeLocations, not alternatives)
      const result = {
        tour_block_id: null, // Will be set when saving
        tour_item_ids: [], // Will be set when saving
        mainLocation: {
          ...content.mainLocation,
          name: content.mainLocation.name || locationName,
          address: content.mainLocation.address || locationAddress,
          title: content.mainLocation.name || locationName, // Frontend may expect 'title' as well
          time: timeSlot, // Always include time slot
          photos: finalMainPhotos, // Use photos array (multiple photos)
          photo: finalMainPhotos[0] || null, // Keep single photo for backward compatibility
          recommendations: recommendations, // Frontend expects 'recommendations'
          description: content.mainLocation.description || `${locationName} works well for ${purpose.toLowerCase()}.`,
          // Add Google Places data
          rating: rating,
          user_ratings_total: userRatingsTotal,
          price_level: priceLevel,
          approx_cost: approximateCost,
          place_id: location.realPlace?.place_id || location.realPlace?.googlePlaceId || null // For Google Maps link
        },
        alternativeLocations: alternativesWithPhotos // Frontend expects 'alternativeLocations', not 'alternatives'
      };
      
      console.log('📍 Generated location block:', {
        mainLocation: result.mainLocation?.title || result.mainLocation?.name,
        mainLocationPhotos: result.mainLocation?.photos?.length || 0,
        mainLocationPhotosArray: result.mainLocation?.photos?.slice(0, 3).map(p => p?.substring(0, 80)) || [],
        alternativeLocationsCount: alternativesWithPhotos.length,
        alternativeLocations: alternativesWithPhotos.map(alt => ({
          name: alt.name || alt.title,
          hasPhotos: !!alt.photos && alt.photos.length > 0,
          photosCount: alt.photos?.length || 0,
          photosArray: alt.photos?.slice(0, 3).map(p => p?.substring(0, 80)) || []
        }))
      });
      
      return result;
    } catch (error) {
      console.error('❌ Error generating location block:', error);
      // Fallback: ensure all required fields are present
      const fallbackPhotos = location.realPlace?.photos || [];
      let finalFallbackPhotos = [];
      
      if (fallbackPhotos.length > 0) {
        finalFallbackPhotos = fallbackPhotos.slice(0, 10);
      } else {
        const fallbackPhoto = await this.getUnsplashPhoto(`${city} ${locationName}`);
        finalFallbackPhotos = [fallbackPhoto];
      }
      
      // Get rating, price_level, and approximate_cost from Google Places data (fallback)
      const realPlace = location.realPlace || {};
      const rating = realPlace.rating || null;
      const userRatingsTotal = realPlace.user_ratings_total || realPlace.userRatingsTotal || null;
      const priceLevel = realPlace.priceLevel !== undefined && realPlace.priceLevel !== null 
        ? String(realPlace.priceLevel) 
        : (realPlace.price_level !== undefined && realPlace.price_level !== null 
          ? String(realPlace.price_level) 
          : '');
      
      // Map price_level to approximate_cost
      const approximateCostMap = {
        0: 'Free',
        1: '€5-10',
        2: '€10-30',
        3: '€30-60',
        4: '€60+'
      };
      const approximateCost = priceLevel && approximateCostMap[priceLevel] 
        ? approximateCostMap[priceLevel] 
        : '';
      
      return {
        tour_block_id: null,
        tour_item_ids: [],
        mainLocation: {
          name: locationName,
          address: locationAddress,
          title: locationName,
          time: timeSlot, // Always include time slot
          description: `${locationName} works well for ${purpose.toLowerCase()}.`,
          recommendations: 'Take your time here.', // Frontend expects 'recommendations'
          photos: finalFallbackPhotos, // Use photos array
          photo: finalFallbackPhotos[0] || null, // Keep single photo for backward compatibility
          // Add Google Places data
          rating: rating,
          user_ratings_total: userRatingsTotal,
          price_level: priceLevel,
          approx_cost: approximateCost
        },
        alternativeLocations: [] // Frontend expects 'alternativeLocations', not 'alternatives'
      };
    }
  }

  /**
   * Generate PHOTO block
   * @param {Object} params - { context, city, concept, interests, locations }
   */
  async generatePhotoBlock({ context, city, concept, interests, locations = [], usedPhotoUrls = new Set() }) {
    const prompt = `Write a short caption for a photo taken ${context} in ${city}.

Do not mention locations.
Do not explain anything.

The caption should feel like a passing thought or observation.

1–2 sentences max.

Context:
- City: ${city}
- Concept: ${concept}
- Interests: ${Array.isArray(interests) ? interests.join(', ') : interests}

Return only the caption text, no quotes.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: SYSTEM_TONE },
          { role: "user", content: prompt }
        ],
        max_tokens: 50,
        temperature: 0.7
      });

      const caption = response.choices[0].message.content.trim();
      
      // IMPORTANT: Photo blocks should NOT use photos from locations
      // They are meant to complement the story, not repeat location photos
      // Search for interesting places near the suggested locations
      let photos = [];
      
      // Get context from nearby locations - search for interesting places near them
      const nearbyQueries = [];
      if (locations && locations.length > 0) {
        locations.forEach(loc => {
          const locName = loc.realPlace?.name || loc.name || '';
          if (locName) {
            // Search for interesting places near this location
            nearbyQueries.push(`interesting places near ${locName} ${city}`);
            nearbyQueries.push(`hidden gems ${city}`);
            nearbyQueries.push(`local spots ${city}`);
          }
        });
      }
      
      // If we have nearby queries, use them; otherwise use general city photos
      const searchQueries = nearbyQueries.length > 0 
        ? nearbyQueries.slice(0, 3)
        : [`landmarks ${city}`, `hidden gems ${city}`, `local spots ${city}`];
      
      console.log(`🔍 Searching Google Places for interesting places near locations: ${city}`);
      const cityPhotos = await this.searchCityPhotos(city, 5, searchQueries);
      
      // Filter out already used photos
      const availablePhotos = cityPhotos.filter(photoUrl => !usedPhotoUrls.has(photoUrl));
      
      if (availablePhotos.length > 0) {
        const numPhotos = Math.min(Math.floor(Math.random() * 3) + 1, availablePhotos.length);
        photos = availablePhotos.slice(0, numPhotos);
        // Mark photos as used
        photos.forEach(photo => usedPhotoUrls.add(photo));
        console.log(`✅ Using ${photos.length} unique photos from Google Places for Photo block in ${city}`);
      }
      
      // Final fallback to Unsplash if Google Places search failed
      if (photos.length === 0) {
        console.log(`⚠️ No Google Places photos found, using Unsplash fallback for Photo block`);
        const photoQueries = [
          `${city} travel`,
          `${city} cityscape`,
          `${city} ${interests?.[0] || 'travel'}`
        ].filter(Boolean);
        
        const numPhotos = Math.floor(Math.random() * 3) + 1; // 1-3 photos
        const selectedQueries = photoQueries.slice(0, numPhotos);
        
        photos = await Promise.all(
          selectedQueries.map(query => this.getUnsplashPhoto(query))
        );
      }
      
      const result = {
        photos: photos, // Use photos array
        photo: photos[0] || null, // Keep single photo for backward compatibility
        caption: caption
      };
      
      console.log('📸 Generated photo block:', {
        photosCount: photos.length,
        hasPhotos: photos.length > 0,
        firstPhoto: photos[0] || null,
        caption: caption
      });
      
      return result;
    } catch (error) {
      console.error('❌ Error generating photo block:', error);
      // Fallback: try to get at least one photo from Unsplash
      try {
        const fallbackPhoto = await this.getUnsplashPhoto(city);
        return {
          photos: [fallbackPhoto], // Use photos array
          photo: fallbackPhoto, // Keep single photo for backward compatibility
          caption: 'A moment between places.'
        };
      } catch (fallbackError) {
        console.error('❌ Error getting fallback photo:', fallbackError);
        return {
          photos: [], // Empty array if all fails
          photo: null,
          caption: 'A moment between places.'
        };
      }
    }
  }

  /**
   * Generate SLIDE block
   * @param {Object} params - { context, city, concept, interests, locations }
   */
  async generateSlideBlock({ context, city, concept, interests, locations = [], usedPhotoUrls = new Set() }) {
    const prompt = `Create a slide with:
- A short title (max 5 words)
- A short description (2 sentences)

The slide should express a quiet insight that fits ${context} in ${city}.

No instructions.
No locations.

It should feel like something the author noticed while slowing down.

Context:
- City: ${city}
- Concept: ${concept}
- Interests: ${Array.isArray(interests) ? interests.join(', ') : interests}

Return JSON:
{
  "title": "Short title",
  "text": "2 sentences description"
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: SYSTEM_TONE },
          { role: "user", content: prompt }
        ],
        max_tokens: 100,
        temperature: 0.7
      });

      const content = JSON.parse(response.choices[0].message.content.trim());
      
      // IMPORTANT: Slide blocks should NOT use photos from locations
      // They are meant to complement the story, not repeat location photos
      // Search for interesting places near the suggested locations
      let photos = [];
      
      // Get context from nearby locations - search for interesting places near them
      const nearbyQueries = [];
      if (locations && locations.length > 0) {
        locations.forEach(loc => {
          const locName = loc.realPlace?.name || loc.name || '';
          if (locName) {
            // Search for interesting places near this location
            nearbyQueries.push(`scenic views near ${locName} ${city}`);
            nearbyQueries.push(`local life ${city}`);
            nearbyQueries.push(`street scenes ${city}`);
          }
        });
      }
      
      // If we have nearby queries, use them; otherwise use general city photos
      const searchQueries = nearbyQueries.length > 0 
        ? nearbyQueries.slice(0, 3)
        : [`scenic views ${city}`, `local life ${city}`, `street scenes ${city}`];
      
      console.log(`🔍 Searching Google Places for interesting places near locations: ${city}`);
      const cityPhotos = await this.searchCityPhotos(city, 5, searchQueries);
      
      // Filter out already used photos
      const availablePhotos = cityPhotos.filter(photoUrl => !usedPhotoUrls.has(photoUrl));
      
      if (availablePhotos.length > 0) {
        const numPhotos = Math.min(Math.floor(Math.random() * 3) + 1, availablePhotos.length);
        photos = availablePhotos.slice(0, numPhotos);
        // Mark photos as used
        photos.forEach(photo => usedPhotoUrls.add(photo));
        console.log(`✅ Using ${photos.length} unique photos from Google Places for Slide block in ${city}`);
      }
      
      // Final fallback to Unsplash if Google Places search failed
      if (photos.length === 0) {
        console.log(`⚠️ No Google Places photos found, using Unsplash fallback for Slide block`);
        const photoQueries = [
          `${city} travel`,
          `${city} cityscape`,
          `${city} ${interests?.[0] || 'travel'}`
        ].filter(Boolean);
        
        const numPhotos = Math.floor(Math.random() * 3) + 1; // 1-3 photos
        const selectedQueries = photoQueries.slice(0, numPhotos);
        
        photos = await Promise.all(
          selectedQueries.map(query => this.getUnsplashPhoto(query))
        );
      }
      
      return {
        title: content.title,
        photos: photos, // Use photos array
        photo: photos[0] || null, // Keep single photo for backward compatibility
        text: content.text
      };
    } catch (error) {
      console.error('❌ Error generating slide block:', error);
      return {
        title: 'A quiet moment',
        photo: null,
        text: 'Time slows down here.'
      };
    }
  }

  /**
   * Generate 3 COLUMNS block
   */
  async generateThreeColumnsBlock({ context, city, concept, interests, locations = [], usedPhotoUrls = new Set() }) {
    const prompt = `Create a 3-column block for ${context} in ${city}.

Each column should represent a different possible mood or approach to this part of the day.

For each column:
- One short sentence
- No locations
- No verbs like "visit", "go", "see"

Think of these as alternative states, not actions.

Context:
- City: ${city}
- Concept: ${concept}
- Interests: ${Array.isArray(interests) ? interests.join(', ') : interests}

Return JSON:
{
  "columns": [
    {
      "text": "First alternative state"
    },
    {
      "text": "Second alternative state"
    },
    {
      "text": "Third alternative state"
    }
  ]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: SYSTEM_TONE },
          { role: "user", content: prompt }
        ],
        max_tokens: 150,
        temperature: 0.7
      });

      const content = JSON.parse(response.choices[0].message.content.trim());
      
      // IMPORTANT: 3columns blocks should NOT use photos from locations
      // They are meant to complement the story, not repeat location photos
      // Search for interesting places near the suggested locations
      let locationPhotos = [];
      
      // Get context from nearby locations - search for interesting places near them
      const nearbyQueries = [];
      if (locations && locations.length > 0) {
        locations.forEach(loc => {
          const locName = loc.realPlace?.name || loc.name || '';
          if (locName) {
            // Search for different types of interesting places near this location
            nearbyQueries.push(`cafes near ${locName} ${city}`);
            nearbyQueries.push(`viewpoints near ${locName} ${city}`);
            nearbyQueries.push(`local markets ${city}`);
            nearbyQueries.push(`parks ${city}`);
            nearbyQueries.push(`streets ${city}`);
          }
        });
      }
      
      // If we have nearby queries, use them; otherwise use general city photos
      const searchQueries = nearbyQueries.length > 0 
        ? nearbyQueries.slice(0, 5)
        : [`cafes ${city}`, `viewpoints ${city}`, `local markets ${city}`, `parks ${city}`, `streets ${city}`];
      
      console.log(`🔍 Searching Google Places for interesting places near locations: ${city}`);
      // Get more photos to ensure we have at least 3 unique ones
      const cityPhotos = await this.searchCityPhotos(city, 10, searchQueries);
      
      // Filter out already used photos
      const availablePhotos = cityPhotos.filter(photoUrl => !usedPhotoUrls.has(photoUrl));
      
      if (availablePhotos.length >= 3) {
        // Use exactly 3 different photos for 3 columns
        locationPhotos = availablePhotos.slice(0, 3);
        // Mark photos as used
        locationPhotos.forEach(photo => usedPhotoUrls.add(photo));
        console.log(`✅ Using ${locationPhotos.length} unique photos from Google Places for 3columns block in ${city}`);
      } else if (availablePhotos.length > 0) {
        // If we have some photos but less than 3, use what we have and fill the rest with Unsplash
        locationPhotos = availablePhotos;
        locationPhotos.forEach(photo => usedPhotoUrls.add(photo));
        console.log(`⚠️ Only ${availablePhotos.length} unique photos found, will use Unsplash for remaining columns`);
      }
      
      const columnsWithPhotos = await Promise.all(
        content.columns.map(async (col, index) => {
          let photoUrl = null;
          
          // Use location/city photos if available for this specific column
          if (locationPhotos.length > index) {
            // Use different photo for each column (index 0, 1, 2)
            photoUrl = locationPhotos[index];
            console.log(`📸 Using location/city photo ${index + 1} for 3columns block column ${index + 1}`);
          } else if (locationPhotos.length > 0) {
            // If we have some photos but not enough, cycle through them
            const photoIndex = index % locationPhotos.length;
            photoUrl = locationPhotos[photoIndex];
            console.log(`⚠️ Using location/city photo ${photoIndex + 1} (reused) for 3columns block column ${index + 1}`);
          } else {
            // Final fallback to Unsplash - use different queries for each column
            const photoQueries = [
              `${city} travel`,
              `${city} cityscape`,
              `${city} landmarks`,
              `${city} streets`,
              `${city} culture`
            ];
            photoUrl = await this.getUnsplashPhoto(photoQueries[index] || `${city}`);
            console.log(`⚠️ No location/city photos, using Unsplash for 3columns block column ${index + 1}`);
          }
          
          return {
            photo: photoUrl,
            text: col.text
          };
        })
      );
      
      const result = {
        columns: columnsWithPhotos
      };
      
      console.log('📸 Generated 3columns block:', {
        columnsCount: columnsWithPhotos.length,
        columnsWithPhotos: columnsWithPhotos.map((col, idx) => ({
          index: idx,
          hasPhoto: !!col.photo,
          photo: col.photo || null,
          text: col.text
        }))
      });
      
      return result;
    } catch (error) {
      console.error('❌ Error generating 3 columns block:', error);
      // Fallback: try to get photos from Unsplash
      try {
        const fallbackPhotos = await Promise.all([
          this.getUnsplashPhoto(`${city} afternoon`),
          this.getUnsplashPhoto(`${city} evening`),
          this.getUnsplashPhoto(`${city} cityscape`)
        ]);
        return {
          columns: [
            { photo: fallbackPhotos[0], text: 'One way to be.' },
            { photo: fallbackPhotos[1], text: 'Another way to be.' },
            { photo: fallbackPhotos[2], text: 'A third way to be.' }
          ]
        };
      } catch (fallbackError) {
        console.error('❌ Error getting fallback photos for 3 columns:', fallbackError);
        return {
          columns: [
            { photo: null, text: 'One way to be.' },
            { photo: null, text: 'Another way to be.' },
            { photo: null, text: 'A third way to be.' }
          ]
        };
      }
    }
  }

  /**
   * Generate CLOSING TEXT block
   */
  async generateClosingTextBlock({ city, concept, interests, audience }) {
    const prompt = `Write a short closing text for the end of the day in ${city}.

Do not summarize the day.
Do not conclude anything.

The text should feel like the moment after dinner when nothing else needs to happen.

1–2 short paragraphs.

Context:
- City: ${city}
- Concept: ${concept}
- Interests: ${Array.isArray(interests) ? interests.join(', ') : interests}
- Audience: ${audience}

Return only the text, no markdown, no quotes.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: SYSTEM_TONE },
          { role: "user", content: prompt }
        ],
        max_tokens: 150,
        temperature: 0.7
      });

      const text = response.choices[0].message.content.trim();
      return {
        text: text,
        formatted: false
      };
    } catch (error) {
      console.error('❌ Error generating closing text:', error);
      return {
        text: 'Nothing else needs to happen.',
        formatted: false
      };
    }
  }
}

