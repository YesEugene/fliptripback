-- Migrate preview images from draft_data.preview to preview_media_url
-- This script updates tours that have preview in draft_data but not in preview_media_url

UPDATE tours
SET 
  preview_media_url = draft_data->>'preview',
  preview_media_type = COALESCE(draft_data->>'previewType', 'image')
WHERE 
  draft_data IS NOT NULL
  AND draft_data->>'preview' IS NOT NULL
  AND draft_data->>'preview' != ''
  AND (preview_media_url IS NULL OR preview_media_url = '');

-- Show results
SELECT 
  COUNT(*) as migrated_tours,
  COUNT(CASE WHEN preview_media_url LIKE 'data:image%' THEN 1 END) as base64_images,
  COUNT(CASE WHEN preview_media_url LIKE 'http%' THEN 1 END) as url_images
FROM tours
WHERE preview_media_url IS NOT NULL AND preview_media_url != '';

