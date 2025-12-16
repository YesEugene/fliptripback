// ContentGenerationService - Handles all OpenAI content generation
// Isolated service for text generation (descriptions, recommendations, titles, etc.)

import OpenAI from 'openai';

export class ContentGenerationService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Generate day concept with time slots
   */
  async generateDayConcept({ city, audience, interests, date, budget }) {
    console.log('🎨 ContentGenerationService: Generating day concept...');

    const prompt = `You are a creative travel planner. Based on the input data (city, date, interests, audience, budget), create a full-day itinerary that runs from 9:00 AM to around 9:30 PM.

CONTEXT:
- City: ${city}
- Audience: ${audience}
- Interests: ${Array.isArray(interests) ? interests.join(', ') : interests}
- Budget: ${budget}€
- Date: ${date}

Step 1. Build a Creative Concept of the Day
• Take into account the city and what it has to offer.
• Consider the audience (for him, for her, for a couple, for a child) and adapt the tone of the day accordingly.
• Use the chosen interests to design a unique and memorable plan, with a balance between activities and meals across time slots (breakfast, lunch, dinner, snacks, activities, nightlife).
• Respect the budget: the total cost of all locations must fit within the user's budget, with a maximum deviation of ±30%. If the budget is small, include free or affordable activities; if large, suggest exclusive experiences.
• Enrich the interests with associative ideas (e.g. "sports" → running, cycling, gyms, outdoor activities, sports cafés).

Step 2. Formulate a Task for Google Places
Once the creative concept of the day is ready, translate each time slot into a structured request for Google Places API.

RESPONSE FORMAT (JSON only, no markdown):
{
  "concept": "Brief description of the day's creative theme/concept",
  "timeSlots": [
    {
      "time": "09:00",
      "activity": "Morning coffee at scenic viewpoint",
      "category": "cafe",
      "keywords": ["coffee", "viewpoint", "morning"]
    }
  ]
}

Create a full-day plan with 8-10 time slots.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1500,
        temperature: 0.8
      });

      const content = response.choices[0].message.content.trim();
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const dayConcept = JSON.parse(jsonMatch[0]);
        console.log('✅ Day concept generated');
        return dayConcept;
      }
      throw new Error('Invalid JSON response from OpenAI');
    } catch (error) {
      console.error('❌ Error generating day concept:', error);
      throw error;
    }
  }

  /**
   * Generate descriptions and recommendations for all activities
   */
  async generateActivitiesContent({ locations, dayConcept, interests, audience }) {
    console.log('✍️ ContentGenerationService: Generating activities content...');

    const activities = await Promise.all(locations.map(async (slot) => {
      const place = slot.realPlace;

      // Generate description and recommendations in parallel
      const [description, recommendations] = await Promise.all([
        this.generateDescription({
          locationName: place.name,
          address: place.address,
          category: slot.category,
          interests,
          audience,
          concept: dayConcept.concept,
          fromDatabase: place.fromDatabase,
          dbDescription: place.description
        }),
        this.generateRecommendations({
          locationName: place.name,
          category: slot.category,
          interests,
          audience,
          concept: dayConcept.concept,
          fromDatabase: place.fromDatabase,
          dbRecommendations: place.recommendations
        })
      ]);

      return {
        time: slot.time,
        name: place.name,
        title: place.name,
        description: description,
        category: slot.category,
        duration: 90,
        price: place.priceLevel * 5, // Will be adjusted by BudgetService
        priceLevel: place.priceLevel || 2,
        location: place.address,
        photos: place.photos || [],
        recommendations: recommendations,
        rating: place.rating
      };
    }));

    console.log(`✅ Generated content for ${activities.length} activities`);
    return activities;
  }

  /**
   * Generate location description
   */
  async generateDescription({ locationName, address, category, interests, audience, concept, fromDatabase, dbDescription }) {
    // If from database and has description, use it (but can enhance with OpenAI)
    if (fromDatabase && dbDescription) {
      console.log(`📝 Using DB description for ${locationName}`);
      return dbDescription;
    }

    const prompt = `You are a masterful travel writer creating an immersive, vivid description of ${locationName} in ${address}.

TASK: Write a rich, detailed description in EXACTLY 3-5 complete sentences (aim for 4-5 sentences for depth).

REQUIREMENTS:
- Capture the essence, atmosphere, history, and unique character of this ${category}
- Describe what makes this location special and memorable
- Include sensory details: what visitors will see, hear, smell, taste, and feel
- Mention the emotional impact and cultural significance
- Connect to the creative concept: ${concept}
- Consider the audience: ${audience}
- Reference the interests: ${Array.isArray(interests) ? interests.join(', ') : interests}

Location: ${locationName}
Address: ${address}
Category: ${category}
Interests: ${Array.isArray(interests) ? interests.join(', ') : interests}
Audience: ${audience}
Creative concept: ${concept}

Write the description now:`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 200,
        temperature: 0.8
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error(`❌ Error generating description for ${locationName}:`, error);
      return `Experience the authentic charm of ${locationName}, a beloved ${category} that captures the essence of the city.`;
    }
  }

  /**
   * Generate recommendations
   */
  async generateRecommendations({ locationName, category, interests, audience, concept, fromDatabase, dbRecommendations }) {
    // If from database and has recommendations, use them
    if (fromDatabase && dbRecommendations) {
      console.log(`💡 Using DB recommendations for ${locationName}`);
      return dbRecommendations;
    }

    const prompt = `IMPORTANT: Write EXACTLY 1 complete sentence in English with practical tips for visiting this location.
Include specific advice about timing, what to order/see/do, or insider secrets that enhance the experience.
Make the tip personal, caring, and inspiring — like advice from a knowledgeable local friend.
Include practical details that connect to the user's interests and the creative concept of the day.
REQUIREMENT: Your response must be exactly 1 complete sentence with a period.

Location: ${locationName}
Category: ${category}
Interests: ${Array.isArray(interests) ? interests.join(', ') : interests}
Audience: ${audience}
Creative concept: ${concept}

Write the recommendation now:`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 100,
        temperature: 0.9
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error(`❌ Error generating recommendations for ${locationName}:`, error);
      return `Plan to spend quality time at ${locationName} to fully appreciate its unique character.`;
    }
  }

  /**
   * Generate meta info (title, subtitle, weather)
   */
  async generateMetaInfo({ city, audience, interests, date, concept }) {
    console.log('📋 ContentGenerationService: Generating meta info...');

    const [title, subtitle, weather] = await Promise.all([
      this.generateTitle({ city, audience, interests, concept }),
      this.generateSubtitle({ city, audience, interests, date, concept }),
      this.generateWeather({ city, date })
    ]);

    return { title, subtitle, weather };
  }

  async generateTitle({ city, audience, interests, concept }) {
    const prompt = `Create a dynamic, personalized title for a travel itinerary.

City: ${city}
Audience: ${audience}
Interests: ${Array.isArray(interests) ? interests.join(', ') : interests}
Creative concept: ${concept}

Examples:
- "Paris Romance" (for romantic interests)
- "Rome Culinary Journey" (for food interests)
- "Barcelona Cultural Heritage" (for culture/history interests)

Create a personalized, dynamic title for this itinerary:`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 50,
        temperature: 0.8
      });
      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('❌ Error generating title:', error);
      return `Epic amazing discoveries in ${city}`;
    }
  }

  async generateSubtitle({ city, audience, interests, date, concept }) {
    const prompt = `Write a long, inspiring, and detailed subtitle in English for the day's itinerary.

REQUIREMENTS:
* Mention the date: ${date}
* Reflect the city: ${city}
* Include the chosen interests: ${Array.isArray(interests) ? interests.join(', ') : interests}
* Consider the audience: ${audience}
* Describe the rhythm and flow of the day from morning to night
* Connect to the creative concept: ${concept}
* Use evocative, engaging language
* Length: 4–5 sentences

Create a similarly rich, detailed subtitle for this itinerary:`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 150,
        temperature: 0.8
      });
      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('❌ Error generating subtitle:', error);
      return `${date} for ${audience} - discover the magic of ${city}`;
    }
  }

  async generateWeather({ city, date }) {
    const prompt = `You are providing weather information for travel planning.

TASK: Look up realistic current weather for ${city} on ${date}.

Use your knowledge of ${city}'s climate and typical weather patterns for this time of year.
Consider the city's geographic location, season, and typical temperature ranges.

Provide this information in JSON format:
{
  "temperature": [realistic temperature number for ${city}],
  "description": "[weather description without temperature]",
  "clothing": "[brief clothing advice for this specific weather]"
}

IMPORTANT: Use realistic temperature for ${city} specifically.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 150,
        temperature: 0.7
      });

      const content = response.choices[0].message.content.trim();
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const weatherData = JSON.parse(jsonMatch[0]);
        return {
          temperature: weatherData.temperature,
          description: weatherData.description,
          clothing: weatherData.clothing,
          tips: "Stay hydrated and bring a camera!"
        };
      }
    } catch (error) {
      console.error('❌ Error generating weather:', error);
    }

    return {
      temperature: 20,
      description: "Perfect weather for exploring",
      clothing: "Comfortable walking shoes and light layers",
      tips: "Stay hydrated and bring a camera!"
    };
  }
}

