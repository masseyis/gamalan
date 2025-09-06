-- Test Database Initialization Script
-- Creates test-specific data and schema for integration tests

-- Create test users
INSERT INTO users (id, clerk_id, email, name, created_at) VALUES 
    ('550e8400-e29b-41d4-a716-446655440000', 'test-clerk-id-1', 'test1@example.com', 'Test User 1', NOW()),
    ('550e8400-e29b-41d4-a716-446655440001', 'test-clerk-id-2', 'test2@example.com', 'Test User 2', NOW())
ON CONFLICT (clerk_id) DO NOTHING;

-- Create test projects
INSERT INTO projects (id, name, description, owner_id, created_at) VALUES 
    ('550e8400-e29b-41d4-a716-446655440000', 'Test Project 1', 'Integration test project', '550e8400-e29b-41d4-a716-446655440000', NOW()),
    ('550e8400-e29b-41d4-a716-446655440001', 'Test Project 2', 'Performance test project', '550e8400-e29b-41d4-a716-446655440001', NOW())
ON CONFLICT (id) DO NOTHING;

-- Create test stories
INSERT INTO stories (id, project_id, title, description, status, labels, created_at) VALUES 
    ('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440000', 'Test Story 1', 'Integration test story', 'Ready', '["test","integration"]', NOW()),
    ('550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', 'Test Story 2', 'Performance test story', 'InProgress', '["test","performance"]', NOW())
ON CONFLICT (id) DO NOTHING;

-- Create test tasks
INSERT INTO tasks (id, story_id, title, description, acceptance_criteria_refs, created_at) VALUES 
    ('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440000', 'Test Task 1', 'Integration test task', '["AC1","AC2"]', NOW()),
    ('550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'Test Task 2', 'Performance test task', '["AC1"]', NOW())
ON CONFLICT (id) DO NOTHING;

-- Create test acceptance criteria
INSERT INTO acceptance_criteria (id, story_id, ac_id, given_clause, when_clause, then_clause, created_at) VALUES 
    ('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440000', 'AC1', 'a user is authenticated', 'they request test data', 'they should receive valid test responses', NOW()),
    ('550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', 'AC2', 'a user makes an invalid request', 'they send malformed data', 'they should receive a 400 error', NOW())
ON CONFLICT (id) DO NOTHING;

-- Create test readiness evaluations
INSERT INTO readiness_evaluations (id, story_id, is_ready, score, missing_items, evaluated_at) VALUES 
    ('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440000', true, 0.95, '[]', NOW()),
    ('550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', false, 0.60, '["Missing AC coverage", "Incomplete tasks"]', NOW())
ON CONFLICT (id) DO NOTHING;

-- Grant permissions for test user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;