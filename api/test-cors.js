/**
 * Test CORS endpoint
 * Simple test to verify CORS is working
 */

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Handle GET/POST
  return res.status(200).json({ 
    success: true, 
    message: 'CORS test successful',
    method: req.method 
  });
}

