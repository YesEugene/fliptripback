// FlipTrip Clean Backend - Get Alternative Places
import { Client } from '@googlemaps/google-maps-services-js';

const googleMapsClient = new Client({});

export default async function handler(req, res) {
  // CORS headers - УСТАНАВЛИВАЕМ ПЕРВЫМИ, ДО ЛЮБЫХ ДРУГИХ ОПЕРАЦИЙ
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { category, city, currentPlaceName, currentAddress } = req.query;

    if (!category || !city) {
      return res.status(400).json({ success: false, error: 'Category and city are required' });
    }

    if (!process.env.GOOGLE_MAPS_KEY) {
      return res.status(500).json({ success: false, error: 'Google Maps API key not configured' });
    }

    console.log(`🔍 Поиск альтернативных мест: category=${category}, city=${city}, currentPlace=${currentPlaceName}`);

    // Формируем поисковый запрос для альтернативных мест
    const searchQuery = `${category} ${city}`;
    
    console.log(`📤 Google Maps API request: query="${searchQuery}"`);
    
    const response = await googleMapsClient.textSearch({
      params: {
        query: searchQuery,
        key: process.env.GOOGLE_MAPS_KEY,
        language: 'en'
      }
    });

    console.log(`📥 Google Maps API response: ${response.data?.results?.length || 0} results`);

    // Проверяем, что есть результаты
    if (!response.data || !response.data.results || response.data.results.length === 0) {
      console.log('⚠️ No results from Google Maps API');
      return res.status(200).json({ 
        success: true, 
        alternatives: []
      });
    }

    // Фильтруем результаты: исключаем текущее место и берем до 5 альтернатив
    let alternatives = response.data.results
      .filter(place => {
        // Исключаем текущее место по имени или адресу
        if (currentPlaceName) {
          const placeNameLower = place.name?.toLowerCase() || '';
          const currentNameLower = currentPlaceName.toLowerCase();
          if (placeNameLower.includes(currentNameLower) || currentNameLower.includes(placeNameLower)) {
            return false;
          }
        }
        if (currentAddress) {
          const placeAddressLower = place.formatted_address?.toLowerCase() || '';
          const currentAddressLower = currentAddress.toLowerCase();
          if (placeAddressLower.includes(currentAddressLower) || currentAddressLower.includes(placeAddressLower)) {
            return false;
          }
        }
        return true;
      })
      .slice(0, 5) // Берем максимум 5 альтернатив
      .map(place => ({
        name: place.name || 'Unknown Place',
        address: place.formatted_address || place.vicinity || 'Address not available',
        rating: place.rating || 4.0,
        priceLevel: place.price_level !== undefined ? place.price_level : 2,
        photos: place.photos && place.photos.length > 0 ? place.photos.slice(0, 3).map(photo => 
          `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photo.photo_reference}&key=${process.env.GOOGLE_MAPS_KEY}`
        ) : [],
        placeId: place.place_id
      }));

    console.log(`✅ Найдено ${alternatives.length} альтернативных мест после фильтрации`);

    return res.status(200).json({ 
      success: true, 
      alternatives 
    });

  } catch (error) {
    // Убеждаемся, что CORS заголовки установлены даже при ошибке
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    
    console.error('❌ Error getting alternatives:', error);
    console.error('❌ Error stack:', error.stack);
    
    // Если это ошибка от Google Maps API, возвращаем более информативное сообщение
    if (error.response?.data?.error_message) {
      console.error('❌ Google Maps API error:', error.response.data.error_message);
      return res.status(500).json({ 
        success: false, 
        error: 'Google Maps API error', 
        details: error.response.data.error_message 
      });
    }
    
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to get alternatives', 
      details: error.message 
    });
  }
}
