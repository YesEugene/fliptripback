// ContentBlocksGenerationService - Generates content blocks for tours
// Follows the exact sequence: TITLE → TEXT (intro) → LOCATION → DIVIDER → PHOTO → etc.

import OpenAI from 'openai';

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
  }

  /**
   * Get photo from Unsplash (no API key needed for basic usage)
   * @param {string} query - Search query (city name or description)
   * @returns {string} Photo URL
   */
  async getUnsplashPhoto(query) {
    try {
      // Use Unsplash Source API (no key required for basic usage)
      // Format: https://source.unsplash.com/800x600/?{query}
      const encodedQuery = encodeURIComponent(query);
      return `https://source.unsplash.com/800x600/?${encodedQuery}`;
    } catch (error) {
      console.error('❌ Error getting Unsplash photo:', error);
      // Fallback to a generic city photo
      return 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&h=600&fit=crop&q=80';
    }
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
    if (breakfastLocation) {
      const locationBlock = await this.generateLocationBlock({
        location: breakfastLocation,
        timeSlot: '09:00-10:00',
        purpose: 'Breakfast / Coffee + Gentle Start',
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
      interests
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
    if (morningLocation) {
      const locationBlock = await this.generateLocationBlock({
        location: morningLocation,
        timeSlot: '10:30-12:00',
        purpose: 'Walking / Exploring After Breakfast',
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
    if (lunchLocation) {
      const locationBlock = await this.generateLocationBlock({
        location: lunchLocation,
        timeSlot: '12:30-15:00',
        purpose: 'Lunch / Long Break',
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

    // 9. SLIDE BLOCK
    const slideBlock = await this.generateSlideBlock({
      context: 'after lunch, middle of the day',
      city,
      concept,
      interests
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
    if (afternoonLocation) {
      const locationBlock = await this.generateLocationBlock({
        location: afternoonLocation,
        timeSlot: '15:30-17:00',
        purpose: 'Light Activity After Lunch',
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

    // 12. 3 COLUMNS BLOCK
    const threeColumnsBlock = await this.generateThreeColumnsBlock({
      context: 'late afternoon, different ways to spend time',
      city,
      concept,
      interests
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
    if (preDinnerLocation) {
      const locationBlock = await this.generateLocationBlock({
        location: preDinnerLocation,
        timeSlot: '17:30-19:00',
        purpose: 'Pre-Dinner Walk / Views / Transition',
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
  async generateLocationBlock({ location, timeSlot, purpose, city, concept, interests, audience }) {
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

Return JSON:
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
      "address": "Address",
      "description": "Why it works",
      "recommendation": "Personal tip"
    },
    {
      "name": "Alternative location name 2",
      "address": "Address 2",
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

      const content = JSON.parse(response.choices[0].message.content.trim());
      
      // Return structure compatible with location block
      return {
        tour_block_id: null, // Will be set when saving
        tour_item_ids: [], // Will be set when saving
        mainLocation: content.mainLocation,
        alternatives: content.alternatives
      };
    } catch (error) {
      console.error('❌ Error generating location block:', error);
      return {
        tour_block_id: null,
        tour_item_ids: [],
        mainLocation: {
          name: locationName,
          address: locationAddress,
          description: `${locationName} works well for ${purpose.toLowerCase()}.`,
          recommendation: 'Take your time here.'
        },
        alternatives: []
      };
    }
  }

  /**
   * Generate PHOTO block
   */
  async generatePhotoBlock({ context, city, concept, interests }) {
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
      
      // Get photo from Unsplash (Google Places not available)
      const photoQuery = `${city} street walking`;
      const photoUrl = await this.getUnsplashPhoto(photoQuery);
      
      return {
        photo: photoUrl,
        caption: caption
      };
    } catch (error) {
      console.error('❌ Error generating photo block:', error);
      return {
        photo: null,
        caption: 'A moment between places.'
      };
    }
  }

  /**
   * Generate SLIDE block
   */
  async generateSlideBlock({ context, city, concept, interests }) {
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
      
      // Get photo from Unsplash (Google Places not available)
      const photoQuery = `${city} ${context}`;
      const photoUrl = await this.getUnsplashPhoto(photoQuery);
      
      return {
        title: content.title,
        photo: photoUrl,
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
  async generateThreeColumnsBlock({ context, city, concept, interests }) {
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
      
      // Get photos from Unsplash for each column (Google Places not available)
      const photoQueries = [
        `${city} afternoon`,
        `${city} evening`,
        `${city} cityscape`
      ];
      
      const columnsWithPhotos = await Promise.all(
        content.columns.map(async (col, index) => {
          const photoUrl = await this.getUnsplashPhoto(photoQueries[index] || `${city}`);
          return {
            photo: photoUrl,
            text: col.text
          };
        })
      );
      
      return {
        columns: columnsWithPhotos
      };
    } catch (error) {
      console.error('❌ Error generating 3 columns block:', error);
      return {
        columns: [
          { photo: null, text: 'One way to be.' },
          { photo: null, text: 'Another way to be.' },
          { photo: null, text: 'A third way to be.' }
        ]
      };
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

