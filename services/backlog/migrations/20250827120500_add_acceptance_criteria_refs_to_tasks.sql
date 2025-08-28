-- Add acceptance_criteria_refs column to tasks table
ALTER TABLE tasks ADD COLUMN acceptance_criteria_refs TEXT[] NOT NULL DEFAULT '{}';