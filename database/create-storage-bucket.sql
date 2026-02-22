-- Create Supabase Storage bucket for caching place photos
-- This avoids repeated Google Places API billing for photo access
-- Run this in Supabase SQL Editor

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tour-assets',
  'tour-assets',
  true, -- Public bucket so images can be loaded in <img> tags
  10485760, -- 10MB max per file
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to the bucket
CREATE POLICY IF NOT EXISTS "Public read access for tour-assets"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'tour-assets');

-- Allow service role to upload files
CREATE POLICY IF NOT EXISTS "Service role upload for tour-assets"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'tour-assets');

-- Allow service role to update files  
CREATE POLICY IF NOT EXISTS "Service role update for tour-assets"
  ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'tour-assets');
