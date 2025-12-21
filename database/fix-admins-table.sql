-- Fix admins table structure
-- If the table was created with wrong column types, this script fixes it

-- First, check if table exists and drop it if needed
DROP TABLE IF EXISTS admins CASCADE;

-- Recreate with correct structure
CREATE TABLE admins (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  bio TEXT,
  avatar_url VARCHAR(500),
  permissions JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_admins_id ON admins(id);

-- Add comment to table
COMMENT ON TABLE admins IS 'Admin profiles - additional data for users with role=admin. id matches users.id';



