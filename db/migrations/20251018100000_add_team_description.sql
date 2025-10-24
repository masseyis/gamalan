-- Add optional description support for teams
ALTER TABLE teams ADD COLUMN IF NOT EXISTS description TEXT;
