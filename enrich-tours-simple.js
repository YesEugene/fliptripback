/**
 * Simple Node.js script to enrich tours
 * Run: node enrich-tours-simple.js
 * 
 * This script calls the API endpoint to enrich tours
 */

const API_URL = 'https://fliptripbackend.vercel.app/api/enrich-tours';

async function enrichTours() {
  console.log('🚀 Starting tour enrichment...\n');
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://flip-trip.com'
      },
      body: JSON.stringify({})
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log('✅ SUCCESS!');
      console.log(`\n${data.message}`);
      console.log(`\nUpdated: ${data.results.updated}`);
      console.log(`Skipped: ${data.results.skipped}`);
      if (data.results.errors && data.results.errors.length > 0) {
        console.log(`\nErrors: ${JSON.stringify(data.results.errors, null, 2)}`);
      }
    } else {
      console.error('❌ ERROR:');
      console.error(data.error || data.message || 'Unknown error');
      console.error('\nFull response:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('❌ NETWORK ERROR:');
    console.error(error.message);
    console.error('\nMake sure:');
    console.error('1. The endpoint is deployed on Vercel');
    console.error('2. You have internet connection');
  }
}

enrichTours();

