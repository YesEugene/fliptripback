/**
 * Direct script to update tours in the database
 * Run with: node scripts/update-tours-direct.js
 */

import { supabase } from '../database/db.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read the tours data from generate-sample-tours.js
const generateFile = readFileSync(join(__dirname, '../api/generate-sample-tours.js'), 'utf8');

// Extract the sampleTours array using regex
const toursMatch = generateFile.match(/const sampleTours = \[([\s\S]*?)\];/);
if (!toursMatch) {
  console.error('❌ Could not extract sampleTours from generate-sample-tours.js');
  process.exit(1);
}

// Evaluate the tours data (in a real scenario, we'd parse it properly)
// For now, we'll import it directly
const { default: handler } = await import('../api/generate-sample-tours.js');

// Create a mock request/response
const mockReq = {
  method: 'POST',
  headers: {
    origin: 'https://flip-trip.com'
  }
};

const mockRes = {
  status: (code) => ({
    json: (data) => {
      console.log(`Response (${code}):`, JSON.stringify(data, null, 2));
      return mockRes;
    },
    end: () => {
      console.log(`Response (${code}): ended`);
      return mockRes;
    }
  }),
  setHeader: () => {},
  statusCode: 200
};

// Call the handler
console.log('🚀 Starting tour update...');
await handler(mockReq, mockRes);
console.log('✅ Tour update completed!');



