/**
 * Generate Highlights API - Uses OpenAI to generate "What's Inside This Walk" bullet points
 * Reads all tour content blocks and generates 3 editable highlights (bullets 3, 4, 5)
 */

import OpenAI from 'openai';
import { supabase } from '../database/db.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  // CORS headers
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://www.flip-trip.com',
    'https://flip-trip.com',
    'https://fliptripfrontend.vercel.app',
    'https://fliptrip-clean-frontend.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000'
  ];

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY is not configured');
      return res.status(503).json({ error: 'AI service is not configured. Please set OPENAI_API_KEY environment variable.' });
    }

    // Auth check
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization required' });
    }

    const { tourId, tourTitle, tourDescription, city, blocks, language = 'English' } = req.body;

    if (!tourId && !blocks) {
      return res.status(400).json({ error: 'Either tourId or blocks data is required' });
    }

    // Get blocks from DB if not provided directly
    let contentBlocks = blocks || [];
    if (tourId && contentBlocks.length === 0) {
      const { data: dbBlocks, error: blocksError } = await supabase
        .from('tour_content_blocks')
        .select('block_type, content, sort_order')
        .eq('tour_id', tourId)
        .order('sort_order', { ascending: true });

      if (!blocksError && dbBlocks) {
        contentBlocks = dbBlocks;
      }
    }

    // Build a summary of the tour content for AI
    const locationNames = [];
    const locationCategories = [];
    const locationDescriptions = [];
    const textContents = [];

    contentBlocks.forEach(block => {
      const content = block.content || {};
      if (block.block_type === 'location') {
        const loc = content.mainLocation || content;
        if (loc.title || loc.name) locationNames.push(loc.title || loc.name);
        if (loc.category) locationCategories.push(loc.category);
        if (loc.description) locationDescriptions.push(loc.description);
        // Also check alternative locations
        if (content.alternativeLocations && Array.isArray(content.alternativeLocations)) {
          content.alternativeLocations.forEach(alt => {
            if (alt.title || alt.name) locationNames.push(alt.title || alt.name);
          });
        }
      } else if (block.block_type === 'text') {
        if (content.text) textContents.push(content.text.substring(0, 300));
      }
    });

    const tourSummary = [
      tourTitle ? `Tour title: "${tourTitle}"` : '',
      city ? `City: ${city}` : '',
      tourDescription ? `Author's description: "${tourDescription.substring(0, 500)}"` : '',
      locationNames.length > 0 ? `Locations mentioned: ${locationNames.join(', ')}` : '',
      locationCategories.length > 0 ? `Categories: ${[...new Set(locationCategories)].join(', ')}` : '',
      locationDescriptions.length > 0 ? `Location highlights: ${locationDescriptions.slice(0, 3).join('; ').substring(0, 500)}` : '',
      textContents.length > 0 ? `Text blocks: ${textContents.slice(0, 3).join('; ').substring(0, 500)}` : ''
    ].filter(Boolean).join('\n');

    console.log('🤖 Generating highlights for tour:', tourTitle || tourId);
    console.log('📝 Tour summary length:', tourSummary.length, 'chars');

    const prompt = `You are writing preview cards for a self-guided walking tour. Based on the tour content below:
1) generate exactly 3 short highlight descriptions,
2) generate ONE short homepage card description with exactly two short sentences.

TOUR CONTENT:
${tourSummary}

RULES:
- Each highlight must be 5-12 words maximum
- Write in a compelling, marketing-friendly tone
- Do NOT mention specific numbers of locations (that's handled separately)
- Do NOT mention maps or PDFs (that's handled separately)
- Do NOT mention "self-guided" or "walking tour"
- Homepage description must contain exactly 2 short sentences
- Homepage total length: about 140-180 characters (never exceed 180)
- Homepage style: vivid, engaging, no formal tone, focus on one unique hook
- Homepage format: start directly with action or intrigue, never "This tour offers..."
- Homepage language: ${language}

Generate these 3 specific highlights:

1. CREATIVE TAGLINE: A catchy, unique description of the tour's essence. What story does this tour tell? Example: "The real Paris of Athos, Porthos, Aramis, and d'Artagnan"

2. THEME/VIBE: What kind of experience the visitor gets. Focus on the atmosphere or knowledge. Example: "Historical context at every stop"

3. SPECIFIC DETAIL: A concrete perk or feature inside the guide. Example: "Atmospheric cafés and bistros along the way"

Also suggest an appropriate emoji (single emoji) for each highlight.

Return ONLY valid JSON, no markdown:
{
  "shortDescription": "Follow the footsteps of the Three Musketeers through hidden old-Paris alleys. Discover the cafés and courtyards where their legends still echo.",
  "bullet3": { "icon": "⚔️", "text": "The real Paris of Athos, Porthos, Aramis, and d'Artagnan" },
  "bullet4": { "icon": "🏛", "text": "Historical context at every stop" },
  "bullet5": { "icon": "☕", "text": "Atmospheric cafés and bistros along the way" }
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.8
    });

    const rawContent = response.choices[0].message.content.trim();
    console.log('🤖 AI response:', rawContent);

    // Parse JSON - handle potential markdown code blocks
    let parsed;
    try {
      const jsonStr = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('❌ Failed to parse AI response:', parseError.message);
      return res.status(500).json({ error: 'Failed to parse AI response', raw: rawContent });
    }

    // Build the highlights object
    const highlights = {
      icon3: parsed.bullet3?.icon || '⚔️',
      text3: parsed.bullet3?.text || '',
      icon4: parsed.bullet4?.icon || '🏛',
      text4: parsed.bullet4?.text || '',
      icon5: parsed.bullet5?.icon || '☕',
      text5: parsed.bullet5?.text || ''
    };

    console.log('✅ Generated highlights:', highlights);

    const shortDescription = String(parsed.shortDescription || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 180);

    return res.status(200).json({
      success: true,
      highlights,
      shortDescription
    });

  } catch (error) {
    console.error('❌ Error generating highlights:', error);
    return res.status(500).json({ error: 'Failed to generate highlights', message: error.message });
  }
}
