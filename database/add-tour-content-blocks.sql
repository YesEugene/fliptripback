-- Migration: Add tour_content_blocks table for flexible content blocks
-- This allows guides to create tours with various content types (Location, Title, Photo+Text, etc.)

-- Create tour_content_blocks table
CREATE TABLE IF NOT EXISTS tour_content_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id UUID REFERENCES tours(id) ON DELETE CASCADE,
  block_type VARCHAR(50) NOT NULL CHECK (block_type IN (
    'location',      -- Location block (uses existing tour_items)
    'title',         -- Title/Heading block
    'photo_text',    -- Photo + Text block
    'text',          -- Text block with formatting
    'slide',         -- Slide type block
    '3columns',      -- 3 columns layout
    'photo',         -- Photo only block
    'divider'        -- Divider/separator block
  )),
  order_index INTEGER NOT NULL DEFAULT 0,
  content JSONB NOT NULL DEFAULT '{}'::jsonb, -- All block-specific data
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_tour_content_blocks_tour_id ON tour_content_blocks(tour_id);
CREATE INDEX IF NOT EXISTS idx_tour_content_blocks_order ON tour_content_blocks(tour_id, order_index);
CREATE INDEX IF NOT EXISTS idx_tour_content_blocks_type ON tour_content_blocks(block_type);
CREATE INDEX IF NOT EXISTS idx_tour_content_blocks_content ON tour_content_blocks USING GIN(content);

-- Add trigger for updated_at
CREATE TRIGGER update_tour_content_blocks_updated_at 
  BEFORE UPDATE ON tour_content_blocks
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TABLE tour_content_blocks IS 'Stores flexible content blocks for tours. Each block can be of different type (location, title, photo+text, etc.)';
COMMENT ON COLUMN tour_content_blocks.content IS 'JSONB field storing block-specific data. Structure varies by block_type';

