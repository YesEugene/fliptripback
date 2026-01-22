-- Check preview_media_url for specific tour
-- Replace '7f764415-3ca1-4198-a79a-76bec43d9f1c' with actual tour ID

SELECT 
  id,
  title,
  preview_media_url IS NOT NULL as has_preview_media_url,
  CASE 
    WHEN preview_media_url IS NULL THEN 'NULL'
    WHEN preview_media_url = '' THEN 'EMPTY STRING'
    WHEN preview_media_url LIKE 'data:image%' THEN 'BASE64 (length: ' || LENGTH(preview_media_url) || ')'
    WHEN preview_media_url LIKE 'http%' THEN 'HTTP URL: ' || LEFT(preview_media_url, 100)
    ELSE 'OTHER: ' || LEFT(preview_media_url, 100)
  END as preview_media_url_type,
  LEFT(preview_media_url, 100) as preview_media_url_preview,
  preview_media_type,
  status,
  is_published
FROM tours
WHERE id = '7f764415-3ca1-4198-a79a-76bec43d9f1c'  -- Fishing Trips Worldwide
   OR title ILIKE '%Fishing%'
ORDER BY created_at DESC
LIMIT 10;

-- Also check all tours to see preview_media_url status
SELECT 
  COUNT(*) as total_tours,
  COUNT(preview_media_url) as tours_with_preview,
  COUNT(*) - COUNT(preview_media_url) as tours_without_preview,
  COUNT(CASE WHEN preview_media_url LIKE 'data:image%' THEN 1 END) as tours_with_base64,
  COUNT(CASE WHEN preview_media_url LIKE 'http%' THEN 1 END) as tours_with_url
FROM tours
WHERE status = 'approved';

