-- Create admins table for admin profiles
-- This table stores additional profile data for admins
-- The id column matches users.id (same as guides table structure)

CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  bio TEXT,
  avatar_url VARCHAR(500),
  permissions JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_admins_id ON admins(id);

-- Add comment to table
COMMENT ON TABLE admins IS 'Admin profiles - additional data for users with role=admin. id matches users.id';



