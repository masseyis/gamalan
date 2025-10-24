-- Add role and specialty support to users table

-- Add role column with default and constraint
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'contributor'
    CHECK (role IN ('sponsor', 'product_owner', 'managing_contributor', 'contributor'));

-- Add specialty column for contributors
ALTER TABLE users ADD COLUMN specialty TEXT
    CHECK (specialty IS NULL OR specialty IN ('frontend', 'backend', 'fullstack', 'qa', 'devops', 'ux_designer'));

-- Add constraint to ensure only contributors can have specialties
ALTER TABLE users ADD CONSTRAINT check_specialty_only_for_contributors
    CHECK (
        (role IN ('contributor', 'managing_contributor') AND specialty IS NOT NULL) OR
        (role IN ('sponsor', 'product_owner') AND specialty IS NULL)
    );

-- Create indexes for performance
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_specialty ON users(specialty) WHERE specialty IS NOT NULL;