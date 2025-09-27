-- Populate default data for development and testing

-- Update existing users to have default contributor role if they don't have one
UPDATE users SET role = 'contributor' WHERE role IS NULL;

-- Example team creation (commented out - should be created via API)
-- INSERT INTO teams (id, name, organization_id, created_at, updated_at)
-- VALUES (
--     gen_random_uuid(),
--     'Engineering Team',
--     -- Replace with actual organization_id
--     '00000000-0000-0000-0000-000000000000'::uuid,
--     NOW(),
--     NOW()
-- );

-- Create indexes for better query performance on frequently accessed patterns
CREATE INDEX IF NOT EXISTS idx_users_external_id_role ON users(external_id, role);
CREATE INDEX IF NOT EXISTS idx_team_memberships_role_active ON team_memberships(role, is_active) WHERE is_active = true;

-- Add helpful comments to tables
COMMENT ON TABLE teams IS 'Agile teams within organizations - each team works on one sprint at a time';
COMMENT ON TABLE team_memberships IS 'User membership in teams with role-based permissions';
COMMENT ON TABLE sprints IS 'Sprint management with capacity planning and velocity tracking';

COMMENT ON COLUMN teams.active_sprint_id IS 'Current active sprint - enforces one sprint at a time per team';
COMMENT ON COLUMN teams.velocity_history IS 'Array of last 10 sprint velocities for capacity planning';
COMMENT ON COLUMN sprints.capacity_points IS 'Planned team capacity in story points for this sprint';
COMMENT ON COLUMN sprints.committed_points IS 'Story points committed to this sprint';
COMMENT ON COLUMN sprints.completed_points IS 'Story points completed in this sprint';